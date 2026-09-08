import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const base = {
  DATABASE_URL: "postgresql://user:password@postgres:5432/etd",
  ALLOWED_ORIGIN: "http://127.0.0.1:8080",
};

describe("loadConfig", () => {
  it("loads bounded defaults", () => {
    const config = loadConfig(base);
    expect(config.uploadMaxBytes).toBe(10 * 1024 * 1024);
    expect(config.maxAttachments).toBe(25);
    expect(config.protectedDomains).toEqual(["example.edu"]);
  });

  it("rejects relative evidence storage", () => {
    expect(() => loadConfig({ ...base, EVIDENCE_ROOT: "evidence" })).toThrow();
  });

  it("requires secure cookies in production", () => {
    expect(() => loadConfig({ ...base, NODE_ENV: "production", COOKIE_SECURE: "false" })).toThrow();
  });

  it("rejects upload limits above the PRD maximum", () => {
    expect(() => loadConfig({ ...base, UPLOAD_MAX_BYTES: String(10 * 1024 * 1024 + 1) })).toThrow();
  });
});
