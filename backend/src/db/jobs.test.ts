import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool, PoolClient } from "pg";
import { claimJob, renewLease, completeJob, failOrRetryJob, failExhaustedJobs } from "./jobs.js";

describe("jobs", () => {
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    mockPool = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue(mockClient),
    };
  });

  describe("claimJob", () => {
    it("returns null if no job is available", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const job = await claimJob(mockPool, 300);
      expect(job).toBeNull();
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it("returns the claimed job when available", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: "job-123",
            email_id: "email-456",
            user_id: "user-789",
            kind: "initial",
            attempt_count: 1,
            lease_token: "token-abc",
          },
        ],
      });
      const job = await claimJob(mockPool, 300);
      expect(job).toEqual({
        id: "job-123",
        emailId: "email-456",
        userId: "user-789",
        kind: "initial",
        attemptCount: 1,
        leaseToken: "token-abc",
      });
    });
  });

  describe("renewLease", () => {
    it("returns true if the row was updated", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      const renewed = await renewLease(mockPool, "job-1", "token-1", 300, "parsing");
      expect(renewed).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE analysis_jobs"),
        ["job-1", "token-1", 300, "parsing"]
      );
    });

    it("returns false if the row was not updated", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });
      const renewed = await renewLease(mockPool, "job-1", "token-1", 300, "parsing");
      expect(renewed).toBe(false);
    });
  });

  describe("completeJob", () => {
    it("updates status to completed and returns true", async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });
      const job = { id: "job-1", leaseToken: "token-1" } as any;
      const completed = await completeJob(mockClient, job, "completed");
      expect(completed).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = $3"),
        ["job-1", "token-1", "completed"]
      );
    });
  });

  describe("failOrRetryJob", () => {
    it("updates the job with error information", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      const job = { id: "job-1", leaseToken: "token-1" } as any;
      await failOrRetryJob(mockPool, job, "parse_failed", "The email could not be parsed safely.");
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("last_error_code = $3"),
        ["job-1", "token-1", "parse_failed", "The email could not be parsed safely."]
      );
    });
  });

  describe("failExhaustedJobs", () => {
    it("updates exhausted jobs to failed", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 5 });
      await failExhaustedJobs(mockPool);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("attempt_count >= max_attempts")
      );
    });
  });
});