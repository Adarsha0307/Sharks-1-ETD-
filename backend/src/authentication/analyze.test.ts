import { describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import type { ParsedEmail } from "../domain/types.js";
import { analyzeAuthentication } from "./analyze.js";

const config = loadConfig({
  DATABASE_URL: "postgresql://user:password@postgres:5432/etd",
  ALLOWED_ORIGIN: "http://127.0.0.1:8080",
  DNS_FIXTURE_PATH: "/missing-fixture.json",
});

const parsed: ParsedEmail = {
  headers: [], subject: null, from: null, replyTo: null, returnPath: null, recipients: [], messageId: null, date: null,
  received: [], authenticationResults: [{ evidenceRef: "header:0", index: 0, name: "authentication-results", rawName: "Authentication-Results", rawValue: " mx.example; dkim=pass", normalizedValue: "mx.example; dkim=pass" }],
  dkimSignatures: [], textBody: "", htmlText: "", bodyTruncated: false, links: [], attachments: [], parserWarnings: [], checkStatuses: [], decodedBytes: 0, mimeDepth: 1,
};

describe("authentication trust", () => {
  it("never promotes an uploaded pass claim to verified", async () => {
    const result = await analyzeAuthentication("unused.eml", parsed, config);
    expect(result.checks.find((check) => check.mechanism === "reported")?.state).toBe("untrusted_reported_result");
    expect(result.checks.find((check) => check.mechanism === "spf")?.state).toBe("unverifiable");
  });
});
