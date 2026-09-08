import { describe, expect, it } from "vitest";
import { defangUrl } from "./api";

describe("defangUrl", () => {
  it("makes a URL non-navigable and visually separates dots", () => {
    expect(defangUrl("https://login.example.test/path")).toBe("hxxps://login[.]example[.]test/path");
  });
});
