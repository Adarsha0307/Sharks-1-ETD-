import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import type { Config } from "../config.js";
import { AppError } from "../errors.js";

export const assignRequestId: RequestHandler = (request, response, next) => {
  request.requestId = randomUUID();
  response.setHeader("X-Request-Id", request.requestId);
  next();
};

export function requireAllowedOrigin(config: Config): RequestHandler {
  return (request, _response, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
    const origin = request.get("origin");
    const fetchSite = request.get("sec-fetch-site");
    if (origin !== config.allowedOrigin || (fetchSite && !["same-origin", "none"].includes(fetchSite))) {
      return next(new AppError(403, "origin_denied", "Request origin is not allowed"));
    }
    next();
  };
}
