import type { Analysis, HistoryItem, Job, User } from "./types";

interface ErrorPayload {
  error?: { code?: string; message?: string; requestId?: string };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly requestId: string | null,
  ) {
    super(message);
  }
}

function csrfToken(): string | null {
  return document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("etd_session_csrf="))
    ?.slice("etd_session_csrf=".length) ?? null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const csrf = csrfToken();
  if (csrf && !["GET", "HEAD"].includes(options.method ?? "GET")) headers.set("X-CSRF-Token", decodeURIComponent(csrf));
  const response = await fetch(path, { ...options, headers, credentials: "same-origin" });
  if (!response.ok) {
    let payload: ErrorPayload = {};
    try { payload = (await response.json()) as ErrorPayload; } catch { /* Keep a generic safe error. */ }
    throw new ApiError(payload.error?.message ?? "The request could not be completed", response.status, payload.error?.code ?? "request_failed", payload.error?.requestId ?? null);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  session: () => request<{ user: User }>("/api/auth/session"),
  login: (username: string, password: string) => request<{ user: User }>("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  upload: (file: File) => {
    const body = new FormData();
    body.append("email", file);
    return request<{ emailId: string; jobId: string; duplicate: boolean }>("/api/emails", { method: "POST", body });
  },
  job: (id: string) => request<Job>(`/api/jobs/${encodeURIComponent(id)}`),
  analysis: (id: string) => request<Analysis>(`/api/analyses/${encodeURIComponent(id)}`),
  history: () => request<{ items: HistoryItem[]; nextCursor: string | null }>("/api/emails?limit=30"),
  reanalyze: (emailId: string) => request<{ emailId: string; jobId: string }>(`/api/emails/${encodeURIComponent(emailId)}/analyses`, { method: "POST" }),
  deleteEmail: (emailId: string) => request<void>(`/api/emails/${encodeURIComponent(emailId)}`, { method: "DELETE" }),
  exportAnalysis: (analysisId: string) => request<{ exportVersion: string; exportedAt: string; analysis: Analysis }>(`/api/analyses/${encodeURIComponent(analysisId)}/export`, { method: "POST" }),
};

export function defangUrl(value: string): string {
  return value.replace(/^http/iu, "hxxp").replace(/\./g, "[.]");
}
