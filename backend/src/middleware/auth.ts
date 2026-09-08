import type { RequestHandler } from "express";
import type { Pool } from "pg";
import type { Config } from "../config.js";
import { AppError } from "../errors.js";
import { hashToken, tokenMatches } from "../security/tokens.js";

interface SessionRow {
  session_id: string;
  user_id: string;
  username: string;
  csrf_hash: string;
}

export function loadSession(pool: Pool, config: Config): RequestHandler {
  return async (request, response, next) => {
    try {
      const token = request.cookies?.[config.sessionCookieName] as string | undefined;
      if (!token) return next();
      const result = await pool.query<SessionRow>(
        `UPDATE sessions AS session
         SET last_seen_at = now()
         FROM users AS app_user
         WHERE session.token_hash = $1
           AND session.user_id = app_user.id
           AND session.revoked_at IS NULL
           AND session.expires_at > now()
           AND app_user.disabled = false
         RETURNING session.id AS session_id, app_user.id AS user_id, app_user.username, session.csrf_hash`,
        [hashToken(token)],
      );
      const row = result.rows[0];
      if (row) {
        request.auth = {
          sessionId: row.session_id,
          userId: row.user_id,
          username: row.username,
          csrfHash: row.csrf_hash,
        };
      } else {
        clearAuthCookies(response, config);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireSession: RequestHandler = (request, _response, next) => {
  if (!request.auth) return next(new AppError(401, "authentication_required", "A valid session is required"));
  next();
};

export function requireCsrf(config: Config): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) return next(new AppError(401, "authentication_required", "A valid session is required"));
    const cookie = request.cookies?.[`${config.sessionCookieName}_csrf`] as string | undefined;
    const header = request.get("x-csrf-token");
    if (!cookie || !header || cookie !== header || !tokenMatches(header, request.auth.csrfHash)) {
      return next(new AppError(403, "csrf_invalid", "CSRF validation failed"));
    }
    next();
  };
}

export function clearAuthCookies(response: Parameters<RequestHandler>[1], config: Config): void {
  const common = { path: "/", sameSite: "strict" as const, secure: config.cookieSecure };
  response.clearCookie(config.sessionCookieName, { ...common, httpOnly: true });
  response.clearCookie(`${config.sessionCookieName}_csrf`, { ...common, httpOnly: false });
}
