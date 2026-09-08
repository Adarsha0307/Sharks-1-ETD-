export type AuthenticationState =
  | "pass"
  | "fail"
  | "missing"
  | "unverifiable"
  | "untrusted_reported_result"
  | "lookup_error"
  | "not_applicable";

export interface HeaderObservation {
  evidenceRef: string;
  index: number;
  name: string;
  rawName: string;
  rawValue: string;
  normalizedValue: string;
}

export interface AddressObservation {
  address: string | null;
  displayName: string | null;
  domain: string | null;
  evidenceRef: string;
}

export interface LinkObservation {
  evidenceRef: string;
  source: "plain" | "html";
  original: string;
  normalized: string | null;
  displayedText: string | null;
  hostname: string | null;
  registrableDomain: string | null;
  hasUserInfo: boolean;
  isIpHost: boolean;
  parseError: string | null;
}

export interface AttachmentObservation {
  evidenceRef: string;
  index: number;
  filename: string | null;
  declaredContentType: string;
  detectedContentType: string | null;
  size: number;
  sha256: string;
}

export interface ParsedEmail {
  headers: HeaderObservation[];
  subject: string | null;
  from: AddressObservation | null;
  replyTo: AddressObservation | null;
  returnPath: AddressObservation | null;
  recipients: AddressObservation[];
  messageId: string | null;
  date: string | null;
  received: HeaderObservation[];
  authenticationResults: HeaderObservation[];
  dkimSignatures: HeaderObservation[];
  textBody: string;
  htmlText: string;
  bodyTruncated: boolean;
  links: LinkObservation[];
  attachments: AttachmentObservation[];
  parserWarnings: string[];
  checkStatuses: Array<{ check: "headers" | "bodies" | "urls" | "attachments"; status: "completed" | "skipped" | "failed"; limitation: string | null }>;
  decodedBytes: number;
  mimeDepth: number;
}

export interface EvidenceReference {
  ref: string;
  summary: string;
}

export type FindingCategory = "sender" | "url" | "content" | "attachment";
export type FindingSeverity = "info" | "low" | "medium" | "high";

export interface Finding {
  findingId: string;
  ruleId: string;
  ruleVersion: string;
  category: FindingCategory;
  severity: FindingSeverity;
  evidenceRefs: EvidenceReference[];
  explanation: string;
  limitations: string[];
  recommendedAction: string;
  scoreContribution: number;
}

export interface AuthenticationCheck {
  mechanism: "reported" | "dkim" | "spf" | "dmarc";
  state: AuthenticationState;
  explanation: string;
  evidenceRefs: string[];
  simulated: boolean;
  limitation: string | null;
  domain?: string;
}

export interface AuthenticationAnalysis {
  checks: AuthenticationCheck[];
  fixtureSource: string | null;
}

export interface SmtpContext {
  source: "trusted_local_fixture";
  ip: string;
  helo: string;
  envelopeFrom: string;
}

export interface MlResult {
  status: "available" | "unavailable" | "unsupported_language" | "error";
  modelVersion: string | null;
  label: "benign" | "phishing" | null;
  score: number | null;
  language: string;
  limitation: string | null;
}

export interface ScoreResult {
  riskIndex: number | null;
  riskBand: "low" | "guarded" | "elevated" | "high" | null;
  completeness: "complete" | "partial" | "insufficient";
  evidenceConfidence: "low" | "medium" | "high";
  scoringVersion: string;
  contributions: Array<{
    ruleId: string;
    category: FindingCategory;
    raw: number;
    applied: number;
    capped: boolean;
  }>;
  categoryCaps: Record<FindingCategory, number>;
  contradictoryEvidence: string[];
}
