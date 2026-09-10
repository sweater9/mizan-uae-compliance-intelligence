import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const databaseUrl = process.env.MIZAN_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("MIZAN_DATABASE_URL is required");
}

const migrationsDir = path.resolve("drizzle");
const migrationFiles = (await readdir(migrationsDir))
  .filter((file) => /^\d+.*\.sql$/.test(file))
  .sort();

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.mizan_schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const filename of migrationFiles) {
    const applied = await client.query(
      "SELECT 1 FROM public.mizan_schema_migrations WHERE filename = $1",
      [filename],
    );
    if (applied.rowCount) continue;

    const sql = await readFile(path.join(migrationsDir, filename), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO public.mizan_schema_migrations (filename) VALUES ($1)",
        [filename],
      );
      await client.query("COMMIT");
      console.log(`Applied ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  console.log(`Migration check complete (${migrationFiles.length} migration files).`);
} finally {
  await client.end();
}
