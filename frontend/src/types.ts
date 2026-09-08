export interface User {
  id: string;
  username: string;
}

export interface Job {
  jobId: string;
  emailId: string;
  status: "queued" | "processing" | "retrying" | "completed" | "partial" | "failed" | "cancelled";
  stage: string;
  attemptCount: number;
  maxAttempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  analysisId: string | null;
  updatedAt: string;
}

export interface Finding {
  findingId: string;
  ruleId: string;
  ruleVersion: string;
  category: string;
  severity: "info" | "low" | "medium" | "high";
  evidenceRefs: Array<{ ref: string; summary: string }>;
  explanation: string;
  limitations: string[];
  recommendedAction: string;
  scoreContribution: number;
}

export interface Analysis {
  analysisId: string;
  emailId: string;
  version: number;
  engineVersion: string;
  rulesVersion: string;
  scoringVersion: string;
  modelVersion: string | null;
  status: string;
  riskIndex: number | null;
  riskBand: string | null;
  completeness: string;
  evidenceConfidence: string;
  observations: {
    subject: string | null;
    from: { address: string | null; displayName: string | null; domain: string | null } | null;
    textBody: string;
    bodyTruncated: boolean;
    links: Array<{ evidenceRef: string; original: string; normalized: string | null; hostname: string | null }>;
    attachments: Array<{ evidenceRef: string; filename: string | null; declaredContentType: string; detectedContentType: string | null; size: number; sha256: string }>;
    parserWarnings: string[];
    checkStatuses: Array<{ check: string; status: string; limitation: string | null }>;
    headers: Array<{ evidenceRef: string; rawName: string; rawValue: string; normalizedValue: string }>;
  };
  authentication: { checks: Array<{ mechanism: string; state: string; explanation: string; simulated: boolean; limitation: string | null }> };
  scoreBreakdown: { contradictoryEvidence: string[]; contributions: Array<{ ruleId: string; category: string; raw: number; applied: number; capped: boolean }> };
  mlResult: { status: string; modelVersion: string | null; label: string | null; score: number | null; language: string; limitation: string | null };
  limitations: string[];
  findings: Finding[];
  createdAt: string;
}

export interface HistoryItem {
  emailId: string;
  originalFilename: string;
  byteSize: number;
  state: string;
  createdAt: string;
  analysisId: string | null;
  analysisVersion: number | null;
  riskIndex: number | null;
  riskBand: string | null;
  completeness: string | null;
  subject: string | null;
}
