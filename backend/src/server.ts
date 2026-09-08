import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { createApp } from "./app.js";

const config = loadConfig();
const pool = createPool(config);
const app = createApp(pool, config);
const server = app.listen(config.port, "0.0.0.0", () => {
  process.stdout.write(`${JSON.stringify({ level: "info", event: "api_started", port: config.port })}\n`);
});

async function shutdown(signal: string) {
  process.stdout.write(`${JSON.stringify({ level: "info", event: "api_stopping", signal })}\n`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
