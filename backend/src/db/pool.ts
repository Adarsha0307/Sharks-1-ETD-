import { Pool } from "pg";
import type { Config } from "../config.js";

export function createPool(config: Config): Pool {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
    application_name: "email-threat-detector",
  });
  pool.on("connect", (client) => {
    void client.query("SET TIME ZONE 'UTC'");
  });
  return pool;
}
