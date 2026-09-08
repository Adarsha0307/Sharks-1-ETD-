import { Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { AppError } from "../errors.js";
import { requireSession } from "../middleware/auth.js";

export function createJobsRouter(pool: Pool): Router {
  const router = Router();
  router.use(requireSession);
  router.get("/:jobId", async (request, response, next) => {
    try {
      const parsed = z.string().uuid().safeParse(request.params.jobId);
      if (!parsed.success) throw new AppError(400, "invalid_id", "Identifier is invalid");
      const result = await pool.query(
        `SELECT job.id AS "jobId", job.email_id AS "emailId", job.status, job.stage,
                job.attempt_count AS "attemptCount", job.max_attempts AS "maxAttempts",
                job.last_error_code AS "errorCode", job.last_error_message AS "errorMessage",
                job.created_at AS "createdAt", job.updated_at AS "updatedAt", analysis.id AS "analysisId"
         FROM analysis_jobs AS job
         LEFT JOIN analyses AS analysis ON analysis.job_id = job.id
         WHERE job.id = $1 AND job.user_id = $2`,
        [parsed.data, request.auth!.userId],
      );
      if (!result.rows[0]) throw new AppError(404, "job_not_found", "Job was not found");
      response.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
