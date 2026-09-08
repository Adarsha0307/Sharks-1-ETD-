import { describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import type { ParsedEmail } from "../domain/types.js";
import { runDeterministicRules } from "./rules.js";

const config = loadConfig({
  DATABASE_URL: "postgresql://user:password@postgres:5432/etd",
  ALLOWED_ORIGIN: "http://127.0.0.1:8080",
  PROTECTED_DOMAINS: "example.edu",
  PROTECTED_ORGANIZATIONS: "Example University",
  AUTHORIZED_SENDERS: "vendor.test:example.edu",
});

function email(overrides: Partial<ParsedEmail> = {}): ParsedEmail {
  return {
    headers: [], subject: "Routine notice", from: { address: "sender@example.edu", displayName: "Example University", domain: "example.edu", evidenceRef: "header:0" },
    replyTo: null, returnPath: null, recipients: [], messageId: null, date: null, received: [], authenticationResults: [],
    dkimSignatures: [], textBody: "A normal message.", htmlText: "", bodyTruncated: false, links: [], attachments: [], parserWarnings: [], checkStatuses: [], decodedBytes: 20, mimeDepth: 1,
    ...overrides,
  };
}

describe("deterministic rules", () => {
  it("requires a deceptive link in addition to a credential request", () => {
    const benign = runDeterministicRules(email({ textBody: "Sign in to review your account.", links: [] }), config);
    expect(benign.find((finding) => finding.ruleId === "ETD-CONTENT-001")).toBeUndefined();
    const suspicious = runDeterministicRules(email({
      textBody: "Verify your password now.",
      links: [{ evidenceRef: "url:0", source: "html", original: "https://trusted.example@192.0.2.5/login", normalized: "https://trusted.example@192.0.2.5/login", displayedText: "https://example.edu/login", hostname: "192.0.2.5", registrableDomain: null, hasUserInfo: true, isIpHost: true, parseError: null }],
    }), config);
    expect(suspicious.find((finding) => finding.ruleId === "ETD-CONTENT-001")?.severity).toBe("high");
  });

  it("does not create a content finding for urgency alone", () => {
    expect(runDeterministicRules(email({ textBody: "Urgent: the library closes today." }), config).filter((item) => item.category === "content")).toEqual([]);
  });

  it("honors a configured third-party sender exception", () => {
    const findings = runDeterministicRules(email({ from: { address: "notify@vendor.test", displayName: "Example University alerts", domain: "vendor.test", evidenceRef: "header:0" } }), config);
    expect(findings.find((finding) => finding.ruleId === "ETD-SENDER-002")).toBeUndefined();
  });

  it("flags protected-name impersonation without an exception", () => {
    const findings = runDeterministicRules(email({ from: { address: "help@unrelated.test", displayName: "Example University support", domain: "unrelated.test", evidenceRef: "header:0" } }), config);
    expect(findings.find((finding) => finding.ruleId === "ETD-SENDER-002")?.evidenceRefs[0]?.ref).toBe("header:0");
  });

  it("flags inert double-extension attachment metadata", () => {
    const findings = runDeterministicRules(email({ attachments: [{ evidenceRef: "attachment:0", index: 0, filename: "invoice.pdf.exe", declaredContentType: "application/octet-stream", detectedContentType: null, size: 4, sha256: "0".repeat(64) }] }), config);
    expect(findings.find((finding) => finding.ruleId.startsWith("ETD-ATTACHMENT-001:"))?.limitations.join(" ")).toContain("not executed");
  });
});
