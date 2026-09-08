import { describe, expect, it } from "vitest";
import type { AuthenticationAnalysis, Finding } from "../domain/types.js";
import { scoreFindings } from "./score.js";

const authentication: AuthenticationAnalysis = {
  fixtureSource: null,
  checks: [{ mechanism: "spf", state: "unverifiable", explanation: "No SMTP context", evidenceRefs: [], simulated: false, limitation: "Upload only" }],
};

function finding(id: string, contribution: number): Finding {
  return { findingId: id, ruleId: id, ruleVersion: "1", category: "content", severity: "high", evidenceRefs: [], explanation: id, limitations: [], recommendedAction: "Review", scoreContribution: contribution };
}

describe("rules scoring", () => {
  it("caps correlated contributions by category", () => {
    const score = scoreFindings([finding("one", 30), finding("two", 30)], authentication);
    expect(score.riskIndex).toBe(40);
    expect(score.contributions[1]).toMatchObject({ applied: 10, capped: true });
  });

  it("keeps unavailable checks separate from a low index", () => {
    const score = scoreFindings([], authentication);
    expect(score.riskIndex).toBe(0);
    expect(score.riskBand).toBe("low");
    expect(score.completeness).toBe("partial");
    expect(score.evidenceConfidence).toBe("low");
  });
});
