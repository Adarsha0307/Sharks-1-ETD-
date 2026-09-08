import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import type { PoolClient } from "pg";
import { AppError } from "./errors.js";
import { analyzeAuthentication } from "./authentication/analyze.js";
import { loadConfig } from "./config.js";
import { completeJob, claimJob, failExhaustedJobs, failOrRetryJob, renewLease, type ClaimedJob } from "./db/jobs.js";
import { createPool } from "./db/pool.js";
import { RULES_VERSION, runDeterministicRules } from "./detection/rules.js";
import type { AuthenticationAnalysis, Finding, MlResult, ParsedEmail, ScoreResult } from "./domain/types.js";
import { containedPath } from "./ingestion/upload.js";
import { classifyContent } from "./ml/client.js";
import { parseEmailFile } from "./parsing/email.js";
import { SCORING_VERSION, scoreFindings } from "./scoring/score.js";

const ENGINE_VERSION = "2026.09.1";
const config = loadConfig();
const pool = createPool(config);
let stopping = false;

process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});

while (!stopping) {
  let job: ClaimedJob | null = null;
  try {
    await failExhaustedJobs(pool);
    job = await claimJob(pool, config.jobLeaseSeconds);
    if (!job) {
      await delay(config.workerPollMs);
      continue;
    }
    await processJob(job);
  } catch (error) {
    const code = safeErrorCode(error);
    process.stderr.write(`${JSON.stringify({ level: "error", event: "job_failed", jobId: job?.id, code })}\n`);
    if (job) await failOrRetryJob(pool, job, code, safeErrorMessage(code));
    else await delay(config.workerPollMs);
  }
}
await pool.end();

async function processJob(job: ClaimedJob): Promise<void> {
  const selected = await pool.query<{ storage_key: string; deleted_at: string | null }>(
    `SELECT evidence.storage_key, email.deleted_at
     FROM evidence_objects AS evidence JOIN emails AS email ON email.id = evidence.email_id
     WHERE evidence.email_id = $1 AND evidence.state = 'ready' AND email.user_id = $2`,
    [job.emailId, job.userId],
  );
  if (!selected.rows[0] || selected.rows[0].deleted_at) throw new WorkerError("evidence_unavailable");
  const originalPath = containedPath(config.evidenceRoot, selected.rows[0].storage_key);
  const integrity = await pool.query<{ sha256: string; byte_size: string }>(
    "SELECT sha256, byte_size FROM evidence_objects WHERE email_id = $1 AND state = 'ready'",
    [job.emailId],
  );
  if (!integrity.rows[0]) throw new WorkerError("evidence_unavailable");
  const measured = await hashFile(originalPath);
  if (measured.sha256 !== integrity.rows[0].sha256 || measured.byteSize !== Number(integrity.rows[0].byte_size)) {
    throw new WorkerError("evidence_integrity_failed");
  }
  let leaseLost = false;
  const heartbeat = setInterval(() => {
    void renewLease(pool, job.id, job.leaseToken, config.jobLeaseSeconds, "analysing")
      .then((renewed) => { if (!renewed) leaseLost = true; })
      .catch(() => { leaseLost = true; });
  }, Math.max(1000, Math.floor((config.jobLeaseSeconds * 1000) / 3)));
  heartbeat.unref();
  try {
    const parsed = await withTimeout(parseEmailFile(originalPath, config), config.parseTimeoutMs, "parse_timeout");
    if (!(await renewLease(pool, job.id, job.leaseToken, config.jobLeaseSeconds, "analysing"))) throw new WorkerError("lease_lost");
    const findings = runDeterministicRules(parsed, config);
    const authentication = await analyzeAuthentication(originalPath, parsed, config);
    const ml = await classifyContent(parsed.subject ?? "", `${parsed.textBody}\n${parsed.htmlText}`, config);
    const score = scoreFindings(findings, authentication);
    if (leaseLost) throw new WorkerError("lease_lost");
    if (!(await renewLease(pool, job.id, job.leaseToken, config.jobLeaseSeconds, "persisting"))) throw new WorkerError("lease_lost");
    await persistAnalysis(job, parsed, findings, authentication, ml, score);
  } finally {
    clearInterval(heartbeat);
  }
}

async function persistAnalysis(
  job: ClaimedJob,
  parsed: ParsedEmail,
  findings: Finding[],
  authentication: AuthenticationAnalysis,
  ml: MlResult,
  score: ScoreResult,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const valid = await client.query<{ deleted_at: string | null }>(
      `SELECT email.deleted_at FROM analysis_jobs AS job
       JOIN emails AS email ON email.id = job.email_id
       WHERE job.id = $1 AND job.lease_token = $2 AND job.status = 'processing'
       FOR UPDATE`,
      [job.id, job.leaseToken],
    );
    if (!valid.rows[0] || valid.rows[0].deleted_at) throw new WorkerError("lease_lost_or_deleted");
    const version = await nextAnalysisVersion(client, job.emailId);
    const analysisId = randomUUID();
    const status = score.completeness === "complete" ? "completed" : score.riskIndex === null ? "inconclusive" : "partial";
    await client.query(
      `INSERT INTO analyses(
         id, job_id, email_id, version, engine_version, rules_version, scoring_version, model_version,
         status, risk_index, risk_band, completeness, evidence_confidence, subject, sender_summary,
         observations, authentication, score_breakdown, ml_result, limitations
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        analysisId,
        job.id,
        job.emailId,
        version,
        ENGINE_VERSION,
        RULES_VERSION,
        SCORING_VERSION,
        ml.modelVersion,
        status,
        score.riskIndex,
        score.riskBand,
        score.completeness,
        score.evidenceConfidence,
        parsed.subject,
        JSON.stringify(parsed.from),
        JSON.stringify(parsed),
        JSON.stringify(authentication),
        JSON.stringify(score),
        JSON.stringify(ml),
        JSON.stringify(["No links were fetched.", "Attachments received metadata-only inspection and were not executed or unpacked."]),
      ],
    );
    for (const finding of findings) await insertFinding(client, analysisId, finding);
    for (const link of parsed.links) {
      await client.query(
        `INSERT INTO indicators(id, analysis_id, kind, original_value, normalized_value, evidence_ref)
         VALUES ($1, $2, 'url', $3, $4, $5)`,
        [randomUUID(), analysisId, link.original, link.normalized, link.evidenceRef],
      );
    }
    await client.query(
      `UPDATE emails SET state = $2, parsed_observations = $3, parser_warnings = $4
       WHERE id = $1 AND deleted_at IS NULL`,
      [job.emailId, status === "completed" ? "completed" : "partial", JSON.stringify(parsed), JSON.stringify(parsed.parserWarnings)],
    );
    if (!(await completeJob(client, job, status === "completed" ? "completed" : "partial"))) throw new WorkerError("lease_lost");
    await client.query("COMMIT");
    process.stdout.write(`${JSON.stringify({ level: "info", event: "analysis_completed", jobId: job.id, analysisId, status })}\n`);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the processing failure; the client is released below.
    }
    throw error;
  } finally {
    client.release();
  }
}

async function nextAnalysisVersion(client: PoolClient, emailId: string): Promise<number> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [emailId]);
  const result = await client.query<{ version: number }>(
    "SELECT COALESCE(MAX(version), 0) + 1 AS version FROM analyses WHERE email_id = $1",
    [emailId],
  );
  return Number(result.rows[0]?.version ?? 1);
}

async function insertFinding(client: PoolClient, analysisId: string, finding: Finding): Promise<void> {
  await client.query(
    `INSERT INTO findings(id, analysis_id, rule_id, rule_version, category, severity, evidence_refs,
                          explanation, limitations, recommended_action, score_contribution)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      randomUUID(), analysisId, finding.ruleId, finding.ruleVersion, finding.category, finding.severity,
      JSON.stringify(finding.evidenceRefs), finding.explanation, JSON.stringify(finding.limitations),
      finding.recommendedAction, finding.scoreContribution,
    ],
  );
}

class WorkerError extends Error {}

function safeErrorCode(error: unknown): string {
  if (error instanceof WorkerError && /^[a-z_]+$/.test(error.message)) return error.message;
  if (error instanceof AppError) return error.code;
  return "processing_failed";
}

function safeErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    evidence_unavailable: "Original evidence is unavailable.",
    evidence_integrity_failed: "Original evidence failed its stored integrity check.",
    lease_lost: "The job lease expired before processing completed.",
    lease_lost_or_deleted: "The job lease expired or the email was deleted.",
    invalid_eml: "The input is not a structurally recognizable email.",
    parse_failed: "The email could not be parsed safely.",
    decoded_limit_exceeded: "Decoded content exceeded a configured limit.",
    attachment_limit_exceeded: "Attachment count exceeded a configured limit.",
    mime_depth_exceeded: "MIME nesting exceeded a configured limit.",
    parse_timeout: "Email parsing exceeded the configured processing time.",
    email_too_large: "Email size exceeded a configured limit.",
  };
  return messages[code] ?? "Processing failed without exposing internal details.";
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withTimeout<T>(operation: Promise<T>, milliseconds: number, code: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new WorkerError(code)), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function hashFile(path: string): Promise<{ sha256: string; byteSize: number }> {
  const hash = createHash("sha256");
  let byteSize = 0;
  for await (const chunk of createReadStream(path, { highWaterMark: 64 * 1024 })) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteSize += buffer.byteLength;
    hash.update(buffer);
  }
  return { sha256: hash.digest("hex"), byteSize };
}
