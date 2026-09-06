const REQUIRED = ["MIZAN_DATABASE_URL"];
const missing = REQUIRED.filter((name) => !process.env[name]?.trim());

if (missing.length) {
  console.error(`Mizan regulatory update not started: missing ${missing.join(", ")}.`);
  process.exitCode = 1;
} else {
  // Durable database execution is intentionally gated until the production
  // database adapter is configured. Never fall back to sample/static legal data.
  console.error("Mizan regulatory update is configured but the durable database adapter has not been activated yet.");
  process.exitCode = 1;
}
