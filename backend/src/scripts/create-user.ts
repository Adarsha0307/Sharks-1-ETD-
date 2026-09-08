import { randomUUID } from "node:crypto";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { createPool } from "../db/pool.js";
import { hashPassword } from "../security/password.js";

const username = process.argv[process.argv.indexOf("--username") + 1];
const password = process.env.ETD_PROVISION_PASSWORD;
const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/);

if (!username || !password) {
  throw new Error("Use --username and provide ETD_PROVISION_PASSWORD through the environment");
}

const normalizedUsername = usernameSchema.parse(username);
const config = loadConfig();
const pool = createPool(config);
try {
  const passwordHash = await hashPassword(password);
  await pool.query(
    `INSERT INTO users(id, username, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, disabled = false`,
    [randomUUID(), normalizedUsername, passwordHash],
  );
  process.stdout.write(`${JSON.stringify({ event: "lab_user_provisioned", username: normalizedUsername })}\n`);
} finally {
  await pool.end();
}
