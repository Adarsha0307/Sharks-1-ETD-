import { describe, expect, it } from "vitest";
import { createToken, hashToken, tokenMatches } from "./tokens.js";

describe("session tokens", () => {
  it("stores only a deterministic digest", () => {
    const token = createToken();
    const digest = hashToken(token);
    expect(digest).not.toContain(token);
    expect(tokenMatches(token, digest)).toBe(true);
    expect(tokenMatches(createToken(), digest)).toBe(false);
  });
});
