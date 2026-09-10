import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const databaseUrl = process.env.MIZAN_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("MIZAN_DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("PostgreSQL migrations applied using the Drizzle migration journal.");
} finally {
  await pool.end();
}
