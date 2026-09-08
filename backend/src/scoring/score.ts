import type { AuthenticationAnalysis, Finding, FindingCategory, ScoreResult } from "../domain/types.js";

export const SCORING_VERSION = "2026.09.1";

const categoryCaps: Record<FindingCategory, number> = {
  sender: 25,
  authentication: 15,
  url: 30,
  content: 40,
  attachment: 30,
};

export function scoreFindings(findings: Finding[], authentication: AuthenticationAnalysis): ScoreResult {
  const orderedFindings = [...findings].sort(
    (left, right) => right.scoreContribution - left.scoreContribution || left.ruleId.localeCompare(right.ruleId),
  );
  const used: Record<FindingCategory, number> = { sender: 0, url: 0, content: 0, attachment: 0 };
  const contributions = orderedFindings.map((finding) => {
    const available = Math.max(0, categoryCaps[finding.category] - used[finding.category]);
    const applied = Math.min(finding.scoreContribution, available);
    used[finding.category] += applied;
    return {
      ruleId: finding.ruleId,
      category: finding.category,
      raw: finding.scoreContribution,
      applied,
      capped: applied < finding.scoreContribution,
    };
  });
  const total = Math.min(100, contributions.reduce((sum, contribution) => sum + contribution.applied, 0));
  const independentlyVerified = authentication.checks.some((check) => check.mechanism === "dkim" && check.state === "pass");
  const failedAuthentication = authentication.checks.some((check) => ["dkim", "spf"].includes(check.mechanism) && check.state === "fail");
  const unavailableChecks = authentication.checks.filter((check) => ["unverifiable", "lookup_error"].includes(check.state)).length;
  const contradictoryEvidence = independentlyVerified && total >= 25
    ? ["A verified DKIM signature coexists with suspicious content or identity evidence; authentication does not make content benign."]
    : [];
  const hasUsefulEvidence = findings.length > 0 || authentication.checks.length > 0;
  return {
    riskIndex: hasUsefulEvidence ? total : null,
    riskBand: hasUsefulEvidence ? (total >= 65 ? "high" : total >= 40 ? "elevated" : total >= 20 ? "guarded" : "low") : null,
    completeness: unavailableChecks > 0 ? "partial" : "complete",
    evidenceConfidence: independentlyVerified || failedAuthentication ? "high" : findings.length >= 2 ? "medium" : "low",
    scoringVersion: SCORING_VERSION,
    contributions,
    categoryCaps,
    contradictoryEvidence,
  };
}
