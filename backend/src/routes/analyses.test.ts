import { describe, it, expect, vi, beforeEach } from "vitest";
import { Router } from "express";
import { createAnalysesRouter } from "./analyses.js";
import { AppError } from "../errors.js";

describe("analyses router", () => {
  let mockPool: any;
  let mockConfig: any;
  let router: Router;

  beforeEach(() => {
    mockPool = { query: vi.fn() };
    mockConfig = { sessionSecret: "secret" };
    router = createAnalysesRouter(mockPool, mockConfig);
  });

  it("is created successfully", () => {
    expect(router).toBeDefined();
  });
});