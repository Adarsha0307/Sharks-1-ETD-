import type { ErrorRequestHandler, RequestHandler } from "express";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new AppError(404, "not_found", `No route for ${request.method} ${request.path}`));
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const bodyParseError = error instanceof SyntaxError && "status" in error && error.status === 400;
  const bodyTooLarge = typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large";
  const known = error instanceof AppError;
  const status = known ? error.status : bodyTooLarge ? 413 : bodyParseError ? 400 : 500;
  const code = known ? error.code : bodyTooLarge ? "request_too_large" : bodyParseError ? "invalid_json" : "internal_error";
  const message = known
    ? error.message
    : bodyTooLarge
      ? "The request body exceeds the configured limit"
      : bodyParseError
        ? "The JSON request body is invalid"
        : "The request could not be completed";

  process.stderr.write(
    `${JSON.stringify({
      level: "error",
      event: "request_failed",
      requestId: request.requestId,
      method: request.method,
      path: request.path,
      status,
      code,
    })}\n`,
  );

  if (response.headersSent) return;
  response.status(status).json({ error: { code, message, requestId: request.requestId } });
};
