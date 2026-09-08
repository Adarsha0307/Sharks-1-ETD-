import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { AppError } from "../errors.js";
import type { Config } from "../config.js";
import { requireCsrf, requireSession } from "../middleware/auth.js";

export function createAnalysesRouter(pool: Pool, config: Config): Router {
  const router = Router();
  router.use(requireSession);
  router.get("/:analysisId", async (request, response, next) => {
    try {
      const result = await getAnalysis(pool, request.params.analysisId, request.auth!.userId, false);
      await recordAccess(pool, request.auth!.userId, result.analysisId, request.requestId, "analysis.view");
      response.json(result);
    } catch (error) {
      next(error);
    }
  });
  router.post("/:analysisId/export", requireCsrf(config), async (request, response, next) => {
    try {
      const result = await getAnalysis(pool, request.params.analysisId, request.auth!.userId, true);
      await recordAccess(pool, request.auth!.userId, result.analysisId, request.requestId, "analysis.export");
      response
        .setHeader("Content-Disposition", `attachment; filename="analysis-${result.analysisId}.json"`)
        .setHeader("Cache-Control", "no-store")
        .json({ exportVersion: "1", exportedAt: new Date().toISOString(), analysis: result });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

async function recordAccess(pool: Pool, userId: string, analysisId: string, requestId: string, eventType: string) {
  await pool.query(
    `INSERT INTO audit_events(id, user_id, event_type, resource_type, resource_id, request_id, outcome, details)
     VALUES ($1, $2, $3, 'analysis', $4, $5, 'success', '{}'::jsonb)`,
    [randomUUID(), userId, eventType, analysisId, requestId],
  );
}

async function getAnalysis(pool: Pool, analysisIdValue: string | undefined, userId: string, redactBodies: boolean) {
  const id = z.string().uuid().safeParse(analysisIdValue);
  if (!id.success) throw new AppError(400, "invalid_id", "Identifier is invalid");
  const result = await pool.query(
    `SELECT analysis.id AS "analysisId", analysis.email_id AS "emailId", analysis.version,
            analysis.engine_version AS "engineVersion", analysis.rules_version AS "rulesVersion",
            analysis.scoring_version AS "scoringVersion", analysis.model_version AS "modelVersion",
            analysis.status, analysis.risk_index AS "riskIndex", analysis.risk_band AS "riskBand",
            analysis.completeness, analysis.evidence_confidence AS "evidenceConfidence",
            CASE WHEN $3::boolean THEN
              analysis.observations
                - 'textBody' - 'htmlText' - 'headers' - 'recipients'
                || jsonb_build_object(
                  'textBody', '[redacted from export]',
                  'htmlText', '[redacted from export]',
                  'headers', '[]'::jsonb,
                  'recipients', '[]'::jsonb,
                  'links', COALESCE((
                    SELECT jsonb_agg(
                      link - 'original' - 'normalized'
                      || jsonb_build_object(
                        'original', regexp_replace(replace(link->>'original', '.', '[.]'), '^http', 'hxxp', 'i'),
                        'normalized', CASE WHEN link->>'normalized' IS NULL THEN NULL ELSE regexp_replace(replace(link->>'normalized', '.', '[.]'), '^http', 'hxxp', 'i') END
                      )
                    )
                    FROM jsonb_array_elements(analysis.observations->'links') AS link
                  ), '[]'::jsonb)
                )
            ELSE analysis.observations END AS observations,
            analysis.authentication, analysis.score_breakdown AS "scoreBreakdown",
            analysis.ml_result AS "mlResult", analysis.limitations, analysis.created_at AS "createdAt",
            COALESCE(jsonb_agg(jsonb_build_object(
              'findingId', finding.id, 'ruleId', finding.rule_id, 'ruleVersion', finding.rule_version,
              'category', finding.category, 'severity', finding.severity, 'evidenceRefs', finding.evidence_refs,
              'explanation', finding.explanation, 'limitations', finding.limitations,
              'recommendedAction', finding.recommended_action, 'scoreContribution', finding.score_contribution
            ) ORDER BY finding.rule_id) FILTER (WHERE finding.id IS NOT NULL), '[]'::jsonb) AS findings
     FROM analyses AS analysis
     JOIN emails AS email ON email.id = analysis.email_id
     LEFT JOIN findings AS finding ON finding.analysis_id = analysis.id
     WHERE analysis.id = $1 AND email.user_id = $2 AND email.deleted_at IS NULL
     GROUP BY analysis.id`,
    [id.data, userId, redactBodies],
  );
  if (!result.rows[0]) throw new AppError(404, "analysis_not_found", "Analysis was not found");
  return result.rows[0] as Record<string, unknown> & { analysisId: string };
}
