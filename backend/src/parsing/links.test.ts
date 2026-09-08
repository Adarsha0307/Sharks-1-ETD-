import { describe, expect, it } from "vitest";
import { extractLinks } from "./links.js";

describe("offline URL extraction", () => {
  it("extracts displayed and actual destinations without fetching", () => {
    const links = extractLinks("Visit https://example.test/help.", '<a href="https://evil.test/login">https://example.test/login</a>', 10);
    expect(links).toHaveLength(2);
    expect(links[1]).toMatchObject({ hostname: "evil.test", displayedText: "https://example.test/login" });
  });

  it("recognizes user-info and IP hosts", () => {
    const [link] = extractLinks("https://trusted.example@192.0.2.10/login", "", 10);
    expect(link).toMatchObject({ hostname: "192.0.2.10", hasUserInfo: true, isIpHost: true });
  });

  it("enforces the URL count limit", () => {
    expect(() => extractLinks("https://one.test https://two.test", "", 1)).toThrow("url_limit_exceeded");
  });
});
