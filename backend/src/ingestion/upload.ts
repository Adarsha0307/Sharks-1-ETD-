import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";
import type { IncomingMessage } from "node:http";
import Busboy from "busboy";
import type { Pool } from "pg";
import type { Config } from "../config.js";
import { AppError } from "../errors.js";

export interface AcceptedUpload {
  emailId: string;
  jobId: string;
  duplicate: boolean;
}

interface StagedUpload {
  path: string;
  originalFilename: string;
  sha256: string;
  byteSize: number;
}

export async function acceptEmailUpload(
  request: IncomingMessage,
  userId: string,
  pool: Pool,
  config: Config,
): Promise<AcceptedUpload> {
  const staged = await stageMultipartUpload(request, config);
  try {
    const existing = await findDuplicate(pool, userId, staged.sha256);
    if (existing) return { emailId: existing.id, jobId: existing.job_id, duplicate: true };

    const emailId = randomUUID();
    const evidenceId = randomUUID();
    const jobId = randomUUID();
    const storageKey = `${emailId.slice(0, 2)}/${emailId}.eml`;
    const finalPath = containedPath(config.evidenceRoot, storageKey);
    await mkdir(dirname(finalPath), { recursive: true, mode: 0o700 });
    let moved = false;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO emails(id, user_id, original_filename, sha256, byte_size, state)
         VALUES ($1, $2, $3, $4, $5, 'staging')`,
        [emailId, userId, staged.originalFilename, staged.sha256, staged.byteSize],
      );
      await client.query(
        `INSERT INTO evidence_objects(id, email_id, storage_key, sha256, byte_size, state)
         VALUES ($1, $2, $3, $4, $5, 'staged')`,
        [evidenceId, emailId, storageKey, staged.sha256, staged.byteSize],
      );
      await rename(staged.path, finalPath);
      moved = true;
      await client.query("UPDATE emails SET state = 'ready' WHERE id = $1", [emailId]);
      await client.query("UPDATE evidence_objects SET state = 'ready' WHERE id = $1", [evidenceId]);
      await client.query(
        `INSERT INTO analysis_jobs(id, email_id, user_id, kind, status, stage, max_attempts)
         VALUES ($1, $2, $3, 'initial', 'queued', 'queued', $4)`,
        [jobId, emailId, userId, config.jobMaxAttempts],
      );
      await client.query(
        `INSERT INTO audit_events(id, user_id, event_type, resource_type, resource_id, outcome, details)
         VALUES ($1, $2, 'email.upload', 'email', $3, 'success', jsonb_build_object('byteSize', $4))`,
        [randomUUID(), userId, emailId, staged.byteSize],
      );
      await client.query("COMMIT");
      return { emailId, jobId, duplicate: false };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the upload failure; staged evidence is cleaned below.
      }
      if (moved) await rm(finalPath, { force: true });
      if (isUniqueViolation(error)) {
        const duplicate = await findDuplicate(pool, userId, staged.sha256);
        if (duplicate) return { emailId: duplicate.id, jobId: duplicate.job_id, duplicate: true };
      }
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await rm(staged.path, { force: true });
  }
}

async function findDuplicate(pool: Pool, userId: string, sha256: string) {
  const result = await pool.query<{ id: string; job_id: string }>(
    `SELECT email.id, job.id AS job_id
     FROM emails AS email
     JOIN analysis_jobs AS job ON job.email_id = email.id
     WHERE email.user_id = $1 AND email.sha256 = $2 AND email.deleted_at IS NULL
     ORDER BY job.created_at DESC LIMIT 1`,
    [userId, sha256],
  );
  return result.rows[0] ?? null;
}

async function stageMultipartUpload(request: IncomingMessage, config: Config): Promise<StagedUpload> {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new AppError(415, "unsupported_media_type", "Use multipart/form-data with one email field");
  }
  const stagingRoot = containedPath(config.evidenceRoot, ".staging");
  await mkdir(stagingRoot, { recursive: true, mode: 0o700 });
  const path = containedPath(stagingRoot, `${randomUUID()}.upload`);
  const handle = await open(path, "wx", 0o600);
  await handle.close();

  return new Promise<StagedUpload>((resolvePromise, rejectPromise) => {
    let originalFilename = "upload.eml";
    let fileCount = 0;
    let byteSize = 0;
    let failed = false;
    let completed = false;
    const hash = createHash("sha256");
    let writeStream: ReturnType<typeof createWriteStream> | null = null;
    let fileFinished = false;
    let busboyClosed = false;
    let busboy: ReturnType<typeof Busboy> | null = null;

    const fail = (error: unknown) => {
      if (failed || completed) return;
      failed = true;
      if (busboy) request.unpipe(busboy);
      request.resume();
      writeStream?.destroy();
      void rm(path, { force: true }).finally(() => rejectPromise(error));
    };

    const succeed = () => {
      if (completed || failed || !fileFinished || !busboyClosed) return;
      completed = true;
      resolvePromise({ path, originalFilename, sha256: hash.digest("hex"), byteSize });
    };

    try {
      busboy = Busboy({
        headers: request.headers,
        limits: { files: 1, fields: 0, parts: 1, fileSize: config.uploadMaxBytes },
      });
    } catch {
      void rm(path, { force: true }).finally(() => rejectPromise(new AppError(400, "invalid_multipart", "Multipart upload headers are invalid")));
      return;
    }

    const parser = busboy;

    parser.on("file", (name, file, info) => {
      fileCount += 1;
      if (name !== "email" || fileCount > 1) {
        file.resume();
        fail(new AppError(400, "invalid_upload", "Provide exactly one file in the email field"));
        return;
      }
      originalFilename = sanitizeFilename(info.filename);
      writeStream = createWriteStream(path, { flags: "w", mode: 0o600, autoClose: true });
      file.on("data", (chunk: Buffer) => {
        byteSize += chunk.byteLength;
        hash.update(chunk);
      });
      file.on("limit", () => fail(new AppError(413, "email_too_large", "Email exceeds the upload limit")));
      file.on("error", fail);
      writeStream.on("error", fail);
      writeStream.on("close", () => {
        fileFinished = true;
        succeed();
      });
      file.pipe(writeStream);
    });
    parser.on("filesLimit", () => fail(new AppError(400, "invalid_upload", "Only one email file is accepted")));
    parser.on("fieldsLimit", () => fail(new AppError(400, "invalid_upload", "Unexpected form fields are not accepted")));
    parser.on("partsLimit", () => fail(new AppError(400, "invalid_upload", "Only one upload part is accepted")));
    parser.on("error", () => fail(new AppError(400, "invalid_multipart", "The multipart upload is malformed")));
    parser.on("close", () => {
      if (failed) return;
      if (fileCount !== 1 || byteSize === 0 || !writeStream) {
        fail(new AppError(400, "invalid_upload", "Provide one non-empty email file"));
        return;
      }
      busboyClosed = true;
      succeed();
    });
    request.pipe(parser);
  });
}

function sanitizeFilename(input: string): string {
  const value = basename(input.replace(/\\/g, "/")).replace(/[\u0000-\u001f\u007f]/g, "_").slice(0, 255).trim();
  return value || "upload.eml";
}

export function containedPath(root: string, key: string): string {
  const normalizedRoot = resolve(root);
  const candidate = resolve(normalizedRoot, key);
  if (candidate !== normalizedRoot && !candidate.startsWith(`${normalizedRoot}${sep}`)) {
    throw new AppError(500, "storage_path_invalid", "Evidence storage path is invalid");
  }
  return candidate;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
