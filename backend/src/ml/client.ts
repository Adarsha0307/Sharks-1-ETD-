import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Config } from "../config.js";
import type { MlResult } from "../domain/types.js";

interface ModelManifest {
  modelVersion: string;
  artifactFilename: string;
  artifactSha256: string;
  language: string;
}

export async function classifyContent(subject: string, body: string, config: Config): Promise<MlResult> {
  const language = detectLanguage(`${subject}\n${body}`);
  if (language !== "en") {
    return result("unsupported_language", null, null, null, language, "The baseline classifier supports English only.");
  }
  let manifest: ModelManifest;
  try {
    manifest = JSON.parse(await readFile(config.modelManifestPath, "utf8")) as ModelManifest;
    if (!/^[A-Za-z0-9._-]+\.joblib$/.test(manifest.artifactFilename)) {
      return result("unavailable", manifest.modelVersion, null, null, language, "Approved model manifest contains an invalid artifact name.");
    }
    const artifact = await readFile(join(dirname(config.modelManifestPath), manifest.artifactFilename));
    if (createHash("sha256").update(artifact).digest("hex") !== manifest.artifactSha256) {
      return result("unavailable", manifest.modelVersion, null, null, language, "Approved model artifact integrity check failed.");
    }
  } catch {
    return result("unavailable", null, null, null, language, "The approved model manifest or artifact is unavailable.");
  }
  try {
    const response = await fetch(`${config.mlUrl}/v1/predict`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, body, modelVersion: manifest.modelVersion }),
      signal: AbortSignal.timeout(config.mlTimeoutMs),
    });
    if (!response.ok) return result("error", manifest.modelVersion, null, null, language, `ML service returned HTTP ${response.status}.`);
    const payload = (await response.json()) as { modelVersion?: string; label?: string; score?: number };
    if (
      payload.modelVersion !== manifest.modelVersion ||
      !["benign", "phishing"].includes(payload.label ?? "") ||
      typeof payload.score !== "number" ||
      payload.score < 0 ||
      payload.score > 1
    ) {
      return result("error", manifest.modelVersion, null, null, language, "ML service response failed validation.");
    }
    return result("available", manifest.modelVersion, payload.label as "benign" | "phishing", payload.score, language, null);
  } catch {
    return result("error", manifest.modelVersion, null, null, language, "ML inference was unavailable or timed out.");
  }
}

function detectLanguage(value: string): string {
  const letters = value.match(/\p{L}/gu) ?? [];
  if (letters.length < 8) return "und";
  const latin = letters.filter((letter) => /\p{Script=Latin}/u.test(letter)).length;
  return latin / letters.length >= 0.85 ? "en" : "unsupported";
}

function result(
  status: MlResult["status"],
  modelVersion: string | null,
  label: MlResult["label"],
  score: number | null,
  language: string,
  limitation: string | null,
): MlResult {
  return { status, modelVersion, label, score, language, limitation };
}
