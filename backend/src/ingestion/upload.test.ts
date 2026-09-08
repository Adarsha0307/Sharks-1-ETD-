import { describe, expect, it } from "vitest";
import { containedPath } from "./upload.js";

describe("evidence path containment", () => {
  it("accepts generated keys within storage", () => {
    expect(containedPath("/var/lib/etd/evidence", "ab/id.eml")).toContain("evidence");
  });

  it("rejects traversal outside storage", () => {
    expect(() => containedPath("/var/lib/etd/evidence", "../../etc/passwd")).toThrow("invalid");
  });
});
