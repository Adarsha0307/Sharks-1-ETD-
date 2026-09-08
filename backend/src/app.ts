import cookieParser from "cookie-parser";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import type { Pool } from "pg";
import type { Config } from "./config.js";
import { AppError, errorHandler, notFoundHandler } from "./errors.js";
import { loadSession } from "./middleware/auth.js";
import { assignRequestId, requireAllowedOrigin } from "./middleware/request.js";
import { createAuthRouter } from "./routes/auth.js";
import { createEmailsRouter } from "./routes/emails.js";
import { createJobsRouter } from "./routes/jobs.js";
import { createAnalysesRouter } from "./routes/analyses.js";

export function createApp(pool: Pool, config: Config) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(assignRequestId);
  app.use((request, response, next) => {
    const started = performance.now();
    response.once("finish", () => {
      process.stdout.write(
        `${JSON.stringify({
          level: "info",
          event: "request_completed",
          requestId: request.requestId,
          method: request.method,
          path: request.path,
          status: response.statusCode,
          durationMs: Math.round((performance.now() - started) * 100) / 100,
        })}\n`,
      );
    });
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          baseUri: ["'none'"],
        },
      },
    }),
  );
  app.use((request, response, next) => {
    if (request.path === "/api/emails" && request.method === "POST") return next();
    express.json({ limit: config.jsonBodyLimit, type: "application/json" })(request, response, next);
  });
  app.use(cookieParser());
  app.use(requireAllowedOrigin(config));
  app.use(loadSession(pool, config));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      handler: (_request, _response, next) => next(new AppError(429, "rate_limited", "Request limit exceeded")),
    }),
  );

  app.get("/health", (_request, response) => response.json({ status: "ok" }));
  app.get("/ready", async (_request, response) => {
    try {
      await pool.query("SELECT 1");
      response.json({ status: "ready", dependencies: { database: "available" } });
    } catch {
      response.status(503).json({ status: "not_ready", dependencies: { database: "unavailable" } });
    }
  });
  app.use("/api/auth", createAuthRouter(pool, config));
  app.use("/api/emails", createEmailsRouter(pool, config));
  app.use("/api/jobs", createJobsRouter(pool));
  app.use("/api/analyses", createAnalysesRouter(pool, config));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
