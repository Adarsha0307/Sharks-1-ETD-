import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { createPool } from "./pool.js";

const config = loadConfig();
const pool = createPool(config);
const migrationDirectory = join(dirname(fileURLToPath(import.meta.url)), "migrations");

try {
  const files = (await readdir(migrationDirectory)).filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name)).sort();
  for (const file of files) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1)", [26_106]);
      await client.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
      );
      const applied = await client.query<{ version: string }>("SELECT version FROM schema_migrations WHERE version = $1", [file]);
      if (applied.rowCount === 0) {
        await client.query(await readFile(join(migrationDirectory, file), "utf8"));
        await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [file]);
        process.stdout.write(`${JSON.stringify({ event: "migration_applied", version: file })}\n`);
      }
      await client.query("COMMIT");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the migration failure; the client is released below.
      }
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
