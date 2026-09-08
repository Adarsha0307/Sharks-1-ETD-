import { randomUUID } from "node:crypto";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import type { Config } from "../config.js";
import { AppError } from "../errors.js";
import { clearAuthCookies, requireCsrf, requireSession } from "../middleware/auth.js";
import { hashPassword, verifyPassword } from "../security/password.js";
import { createToken, hashToken } from "../security/tokens.js";

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/),
  password: z.string().min(1).max(256),
}).strict();

const dummyHash = hashPassword("not-a-valid-user-password");

export function createAuthRouter(pool: Pool, config: Config): Router {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_request, _response, next) => next(new AppError(429, "rate_limited", "Too many sign-in attempts")),
  });

  router.post("/login", loginLimiter, async (request, response, next) => {
    try {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) throw new AppError(400, "invalid_request", "Username and password are required");
      const result = await pool.query<{ id: string; username: string; password_hash: string; disabled: boolean }>(
        "SELECT id, username, password_hash, disabled FROM users WHERE username = $1",
        [parsed.data.username],
      );
      const user = result.rows[0];
      const valid = await verifyPassword(parsed.data.password, user?.password_hash ?? (await dummyHash));
      if (!user || user.disabled || !valid) {
        await recordLogin(pool, request.requestId, user?.id ?? null, "denied");
        throw new AppError(401, "invalid_credentials", "Invalid username or password");
      }

      const sessionToken = createToken();
      const csrfToken = createToken();
      const sessionId = randomUUID();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO sessions(id, user_id, token_hash, csrf_hash, expires_at)
           VALUES ($1, $2, $3, $4, now() + ($5::double precision * interval '1 minute'))`,
          [sessionId, user.id, hashToken(sessionToken), hashToken(csrfToken), config.sessionTtlMinutes],
        );
        await recordLogin(client, request.requestId, user.id, "success");
        await client.query("COMMIT");
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Preserve the original failure; the connection is released below.
        }
        throw error;
      } finally {
        client.release();
      }

      const common = { path: "/", sameSite: "strict" as const, secure: config.cookieSecure };
      response.cookie(config.sessionCookieName, sessionToken, {
        ...common,
        httpOnly: true,
        maxAge: config.sessionTtlMinutes * 60_000,
      });
      response.cookie(`${config.sessionCookieName}_csrf`, csrfToken, {
        ...common,
        httpOnly: false,
        maxAge: config.sessionTtlMinutes * 60_000,
      });
      response.status(200).json({ user: { id: user.id, username: user.username }, expiresInSeconds: config.sessionTtlMinutes * 60 });
    } catch (error) {
      next(error);
    }
  });

  router.get("/session", requireSession, (request, response) => {
    response.json({ user: { id: request.auth!.userId, username: request.auth!.username } });
  });

  router.post("/logout", requireSession, requireCsrf(config), async (request, response, next) => {
    try {
      await pool.query("UPDATE sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2", [
        request.auth!.sessionId,
        request.auth!.userId,
      ]);
      clearAuthCookies(response, config);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

async function recordLogin(client: Pool | PoolClient, requestId: string, userId: string | null, outcome: "success" | "denied") {
  await client.query(
    `INSERT INTO audit_events(id, user_id, event_type, request_id, outcome, details)
     VALUES ($1, $2, 'auth.login', $3, $4, '{}'::jsonb)`,
    [randomUUID(), userId, requestId, outcome],
  );
}
