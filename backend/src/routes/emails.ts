import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { Pool } from "pg";
import { z } from "zod";
import type { Config } from "../config.js";
import { AppError } from "../errors.js";
import { acceptEmailUpload, containedPath } from "../ingestion/upload.js";
import { requireCsrf, requireSession } from "../middleware/auth.js";

const idSchema = z.string().uuid();
const paginationSchema = z.object({ cursor: z.string().datetime({ offset: true }).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });

export function createEmailsRouter(pool: Pool, config: Config): Router {
  const router = Router();
  router.use(requireSession);

  router.post(
    "/",
    requireCsrf(config),
    rateLimit({
      windowMs: 60_000,
      limit: 10,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      handler: (_request, _response, next) => next(new AppError(429, "upload_rate_limited", "Upload limit exceeded")),
    }),
    async (request, response, next) => {
      try {
        const accepted = await acceptEmailUpload(request, request.auth!.userId, pool, config);
        response.status(202).json(accepted);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/", async (request, response, next) => {
    try {
      const query = paginationSchema.safeParse(request.query);
      if (!query.success) throw new AppError(400, "invalid_pagination", "Pagination parameters are invalid");
      const result = await pool.query(
        `SELECT email.id AS "emailId", email.original_filename AS "originalFilename", email.sha256,
                email.byte_size::double precision AS "byteSize", email.state, email.created_at AS "createdAt",
                analysis.id AS "analysisId", analysis.version AS "analysisVersion",
                analysis.risk_index AS "riskIndex", analysis.risk_band AS "riskBand",
                analysis.completeness, analysis.subject
         FROM emails AS email
         LEFT JOIN LATERAL (
           SELECT * FROM analyses WHERE analyses.email_id = email.id ORDER BY version DESC LIMIT 1
         ) AS analysis ON true
         WHERE email.user_id = $1 AND email.deleted_at IS NULL
           AND ($2::timestamptz IS NULL OR email.created_at < $2)
         ORDER BY email.created_at DESC LIMIT $3`,
        [request.auth!.userId, query.data.cursor ?? null, query.data.limit + 1],
      );
      const hasMore = result.rows.length > query.data.limit;
      const items = result.rows.slice(0, query.data.limit);
      response.json({ items, nextCursor: hasMore ? items.at(-1)?.createdAt ?? null : null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:emailId/analyses", requireCsrf(config), async (request, response, next) => {
    try {
      const emailId = parseId(request.params.emailId);
      const jobId = randomUUID();
      const result = await pool.query(
        `INSERT INTO analysis_jobs(id, email_id, user_id, kind, status, stage, max_attempts)
         SELECT $1, email.id, email.user_id, 'reanalysis', 'queued', 'queued', $3
         FROM emails AS email
         WHERE email.id = $2 AND email.user_id = $4 AND email.deleted_at IS NULL
         RETURNING id`,
        [jobId, emailId, config.jobMaxAttempts, request.auth!.userId],
      );
      if (result.rowCount !== 1) throw new AppError(404, "email_not_found", "Email was not found");
      response.status(202).json({ emailId, jobId });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:emailId/evidence/integrity", async (request, response, next) => {
    try {
      const emailId = parseId(request.params.emailId);
      const result = await pool.query<{ evidence_id: string; sha256: string; byte_size: string }>(
        `SELECT evidence.id AS evidence_id, evidence.sha256, evidence.byte_size
         FROM evidence_objects AS evidence
         JOIN emails AS email ON email.id = evidence.email_id
         WHERE email.id = $1 AND email.user_id = $2 AND email.deleted_at IS NULL AND evidence.state = 'ready'`,
        [emailId, request.auth!.userId],
      );
      const evidence = result.rows[0];
      if (!evidence) throw new AppError(404, "evidence_not_found", "Evidence was not found");
      response.json({ evidenceId: evidence.evidence_id, sha256: evidence.sha256, byteSize: Number(evidence.byte_size) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:emailId", requireCsrf(config), async (request, response, next) => {
    let emailId: string;
    try {
      emailId = parseId(request.params.emailId);
    } catch (error) {
      next(error);
      return;
    }
    const client = await pool.connect();
    let storageKey: string | null = null;
    try {
      await client.query("BEGIN");
      const selected = await client.query<{ storage_key: string }>(
        `SELECT evidence.storage_key FROM emails AS email
         JOIN evidence_objects AS evidence ON evidence.email_id = email.id
         WHERE email.id = $1 AND email.user_id = $2 AND email.deleted_at IS NULL
         FOR UPDATE`,
        [emailId, request.auth!.userId],
      );
      if (!selected.rows[0]) throw new AppError(404, "email_not_found", "Email was not found");
      storageKey = selected.rows[0].storage_key;
      const evidencePath = containedPath(config.evidenceRoot, storageKey);
      try {
        await rm(evidencePath, { force: true });
      } catch {
        throw new AppError(500, "evidence_delete_failed", "Evidence could not be deleted; database changes were not committed");
      }
      await client.query("UPDATE emails SET state = 'deleted', deleted_at = now() WHERE id = $1", [emailId]);
      await client.query("UPDATE evidence_objects SET state = 'deleted', deleted_at = now() WHERE email_id = $1", [emailId]);
      await client.query(
        `UPDATE analysis_jobs SET status = 'cancelled', stage = 'cancelled', lease_token = NULL,
                 lease_until = NULL, finished_at = now(), updated_at = now()
         WHERE email_id = $1 AND status IN ('queued', 'retrying', 'processing')`,
        [emailId],
      );
      await client.query("COMMIT");
      response.status(204).end();
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original safe error; a broken connection is released below.
      }
      next(error);
    } finally {
      client.release();
    }
  });
  return router;
}

function parseId(value: string | undefined): string {
  const result = idSchema.safeParse(value);
  if (!result.success) throw new AppError(400, "invalid_id", "Identifier is invalid");
  return result.data;
}
