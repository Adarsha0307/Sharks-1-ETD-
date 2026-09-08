import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

export interface ClaimedJob {
  id: string;
  emailId: string;
  userId: string;
  kind: "initial" | "reanalysis";
  attemptCount: number;
  leaseToken: string;
}

export async function claimJob(pool: Pool, leaseSeconds: number): Promise<ClaimedJob | null> {
  const leaseToken = randomUUID();
  const result = await pool.query<{
    id: string;
    email_id: string;
    user_id: string;
    kind: "initial" | "reanalysis";
    attempt_count: number;
    lease_token: string;
  }>(
    `WITH candidate AS (
       SELECT id
       FROM analysis_jobs
       WHERE (
         (status IN ('queued', 'retrying') AND available_at <= now())
         OR (status = 'processing' AND lease_until < now())
       )
       AND attempt_count < max_attempts
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     UPDATE analysis_jobs AS job
     SET status = 'processing',
         stage = 'parsing',
         attempt_count = attempt_count + 1,
         lease_token = $1,
         lease_until = now() + ($2::double precision * interval '1 second'),
         started_at = COALESCE(started_at, now()),
         updated_at = now()
     FROM candidate
     WHERE job.id = candidate.id
       AND EXISTS (
         SELECT 1 FROM emails AS email
         WHERE email.id = job.email_id AND email.deleted_at IS NULL
       )
     RETURNING job.id, job.email_id, job.user_id, job.kind, job.attempt_count, job.lease_token`,
    [leaseToken, leaseSeconds],
  );
  const row = result.rows[0];
  return row
    ? {
        id: row.id,
        emailId: row.email_id,
        userId: row.user_id,
        kind: row.kind,
        attemptCount: row.attempt_count,
        leaseToken: row.lease_token,
      }
    : null;
}

export async function renewLease(
  client: Pool | PoolClient,
  jobId: string,
  leaseToken: string,
  leaseSeconds: number,
  stage: "parsing" | "analysing" | "persisting",
): Promise<boolean> {
  const result = await client.query(
    `UPDATE analysis_jobs
     SET lease_until = now() + ($3::double precision * interval '1 second'), stage = $4, updated_at = now()
     WHERE id = $1 AND lease_token = $2 AND status = 'processing'`,
    [jobId, leaseToken, leaseSeconds, stage],
  );
  return result.rowCount === 1;
}

export async function completeJob(
  client: PoolClient,
  job: ClaimedJob,
  terminalStatus: "completed" | "partial",
): Promise<boolean> {
  const result = await client.query(
    `UPDATE analysis_jobs
     SET status = $3, stage = $3, lease_until = NULL, lease_token = NULL,
         finished_at = now(), updated_at = now()
     WHERE id = $1 AND lease_token = $2 AND status = 'processing'`,
    [job.id, job.leaseToken, terminalStatus],
  );
  return result.rowCount === 1;
}

export async function failOrRetryJob(
  pool: Pool,
  job: ClaimedJob,
  code: string,
  safeMessage: string,
): Promise<void> {
  await pool.query(
    `UPDATE analysis_jobs
     SET status = CASE WHEN attempt_count < max_attempts THEN 'retrying' ELSE 'failed' END,
         stage = CASE WHEN attempt_count < max_attempts THEN 'queued' ELSE 'failed' END,
          available_at = now() + (LEAST(30, power(2, attempt_count))::double precision * interval '1 second'),
         last_error_code = $3,
         last_error_message = $4,
         lease_until = NULL,
         lease_token = NULL,
         finished_at = CASE WHEN attempt_count >= max_attempts THEN now() ELSE NULL END,
         updated_at = now()
     WHERE id = $1 AND lease_token = $2 AND status = 'processing'`,
    [job.id, job.leaseToken, code, safeMessage],
  );
}

export async function failExhaustedJobs(pool: Pool): Promise<void> {
  await pool.query(
    `UPDATE analysis_jobs
     SET status = 'failed', stage = 'failed', lease_until = NULL, lease_token = NULL,
         finished_at = now(), updated_at = now(),
         last_error_code = COALESCE(last_error_code, 'attempts_exhausted'),
         last_error_message = COALESCE(last_error_message, 'Processing attempts were exhausted.')
     WHERE status IN ('queued', 'retrying', 'processing')
       AND attempt_count >= max_attempts
       AND (lease_until IS NULL OR lease_until < now())`,
  );
}
