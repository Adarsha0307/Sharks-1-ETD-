import { describe, expect, it } from "vitest";
import { parseRawHeaders } from "./headers.js";

describe("raw header preservation", () => {
  it("keeps repeated headers, order, casing, folding, and normalized values", () => {
    const headers = parseRawHeaders(Buffer.from("Received: first\r\nX-Test: one\r\n\ttwo\r\nReceived: second\r\n\r\nbody", "latin1"));
    expect(headers.map((header) => header.rawName)).toEqual(["Received", "X-Test", "Received"]);
    expect(headers[1]?.rawValue).toBe(" one\r\n\ttwo");
    expect(headers[1]?.normalizedValue).toBe("one two");
    expect(headers[2]?.evidenceRef).toMatch(/^header:2:offset:/);
  });

  it("rejects input without a header terminator", () => {
    expect(() => parseRawHeaders(Buffer.from("From: analyst@example.test"))).toThrow("not terminated");
  });
});
