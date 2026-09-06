import { checkDatabaseReadiness } from "../lib/database-readiness.ts";

try {
  const readiness = await checkDatabaseReadiness();
  if (!readiness.ready) {
    console.error(`Database readiness failed: ${readiness.reason}`);
    process.exitCode = 1;
  } else {
    console.log("Database readiness passed: migrations, schema, and verified evidence relationships are valid.");
  }
} catch (error) {
  console.error(`Database readiness failed: ${error instanceof Error ? error.message : "unknown database error"}`);
  process.exitCode = 1;
}
