import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import { validateDatabaseUrl } from "./database-config";

let database: ReturnType<typeof createDatabase> | undefined;

function createDatabase() {
  const url = validateDatabaseUrl(process.env.MIZAN_DATABASE_URL);
  const sql = neon(url);
  return drizzle({ client: sql, schema });
}

export function getDatabase() {
  database ??= createDatabase();
  return database;
}
