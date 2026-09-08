import { isAbsolute, resolve } from "node:path";
import { z } from "zod";

const booleanValue = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const integer = (minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum);

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "sandbox", "production"]).default("development"),
    PORT: integer(1, 65535).default(8080),
    DATABASE_URL: z.string().url().refine(
      (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "DATABASE_URL must use PostgreSQL",
    ),
    EVIDENCE_ROOT: z.string().min(1).default("/var/lib/etd/evidence"),
    ALLOWED_ORIGIN: z
      .string()
      .url()
      .refine((value) => !value.includes("*"), "wildcard origins are prohibited")
      .refine((value) => new URL(value).origin === value.replace(/\/$/, ""), "must contain only an origin"),
    SESSION_COOKIE_NAME: z.literal("etd_session").default("etd_session"),
    SESSION_TTL_MINUTES: integer(5, 1440).default(480),
    COOKIE_SECURE: booleanValue,
    TRUST_PROXY: booleanValue,
    JSON_BODY_LIMIT: z.string().regex(/^\d+(?:kb|mb)$/i).default("64kb"),
    UPLOAD_MAX_BYTES: integer(1024, 10 * 1024 * 1024).default(10 * 1024 * 1024),
    DECODED_MAX_BYTES: integer(1024, 100 * 1024 * 1024).default(25 * 1024 * 1024),
    MAX_ATTACHMENTS: integer(0, 100).default(25),
    MAX_URLS: integer(0, 1000).default(200),
    MAX_MIME_DEPTH: integer(1, 50).default(20),
    JOB_LEASE_SECONDS: integer(10, 900).default(60),
    JOB_MAX_ATTEMPTS: integer(1, 10).default(3),
    WORKER_POLL_MS: integer(100, 60_000).default(1000),
    PARSE_TIMEOUT_MS: integer(1000, 120_000).default(15_000),
    ML_URL: z.string().url().default("http://ml:8000"),
    ML_TIMEOUT_MS: integer(100, 30_000).default(3000),
    MODEL_MANIFEST_PATH: z.string().default("/models/model-manifest.json"),
    DNS_FIXTURE_PATH: z.string().default("/app/fixtures/dns.json"),
    PROTECTED_DOMAINS: z.string().default("example.edu"),
    PROTECTED_ORGANIZATIONS: z.string().default("Example University"),
    AUTHORIZED_SENDERS: z.string().default(""),
  })
  .superRefine((value, context) => {
    if (!isAbsolute(value.EVIDENCE_ROOT)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["EVIDENCE_ROOT"], message: "must be absolute" });
    }
    if (value.NODE_ENV === "production" && !value.COOKIE_SECURE) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["COOKIE_SECURE"],
        message: "must be true in production",
      });
    }
  });

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = environmentSchema.parse(environment);
  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    evidenceRoot: resolve(parsed.EVIDENCE_ROOT),
    allowedOrigin: parsed.ALLOWED_ORIGIN.replace(/\/$/, ""),
    sessionCookieName: parsed.SESSION_COOKIE_NAME,
    sessionTtlMinutes: parsed.SESSION_TTL_MINUTES,
    cookieSecure: parsed.COOKIE_SECURE,
    trustProxy: parsed.TRUST_PROXY,
    jsonBodyLimit: parsed.JSON_BODY_LIMIT,
    uploadMaxBytes: parsed.UPLOAD_MAX_BYTES,
    decodedMaxBytes: parsed.DECODED_MAX_BYTES,
    maxAttachments: parsed.MAX_ATTACHMENTS,
    maxUrls: parsed.MAX_URLS,
    maxMimeDepth: parsed.MAX_MIME_DEPTH,
    jobLeaseSeconds: parsed.JOB_LEASE_SECONDS,
    jobMaxAttempts: parsed.JOB_MAX_ATTEMPTS,
    workerPollMs: parsed.WORKER_POLL_MS,
    parseTimeoutMs: parsed.PARSE_TIMEOUT_MS,
    mlUrl: parsed.ML_URL.replace(/\/$/, ""),
    mlTimeoutMs: parsed.ML_TIMEOUT_MS,
    modelManifestPath: parsed.MODEL_MANIFEST_PATH,
    dnsFixturePath: parsed.DNS_FIXTURE_PATH,
    protectedDomains: parseCsv(parsed.PROTECTED_DOMAINS),
    protectedOrganizations: parseCsv(parsed.PROTECTED_ORGANIZATIONS),
    authorizedSenders: parseAuthorizedSenders(parsed.AUTHORIZED_SENDERS),
  } as const;
}

function parseCsv(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

function parseAuthorizedSenders(value: string): ReadonlyMap<string, readonly string[]> {
  const entries = parseCsv(value).map((item) => {
    const [sender, claimedDomain, ...extra] = item.split(":");
    if (!sender || !claimedDomain || extra.length > 0) {
      throw new Error("AUTHORIZED_SENDERS entries must be sender-domain:claimed-domain");
    }
    return [sender, claimedDomain] as const;
  });
  const grouped = new Map<string, string[]>();
  for (const [sender, claimed] of entries) {
    grouped.set(sender, [...(grouped.get(sender) ?? []), claimed]);
  }
  return grouped;
}
