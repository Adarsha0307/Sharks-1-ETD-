import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 32;
const N = 32_768;
const R = 8;
const P = 1;
const MAX_MEMORY = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  const salt = randomBytes(16);
  const result = (await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAX_MEMORY })) as Buffer;
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${result.toString("base64")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, nText, rText, pText, saltText, hashText, ...extra] = encoded.split("$");
  if (algorithm !== "scrypt" || !nText || !rText || !pText || !saltText || !hashText || extra.length > 0) return false;
  const n = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  if (n !== N || r !== R || p !== P) return false;
  try {
    const expected = Buffer.from(hashText, "base64");
    const actual = (await scrypt(password, Buffer.from(saltText, "base64"), expected.length, {
      N: n,
      r,
      p,
      maxmem: MAX_MEMORY,
    })) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function validatePassword(password: string): void {
  if (password.length < 12 || password.length > 256) {
    throw new Error("Password must contain between 12 and 256 characters");
  }
}
