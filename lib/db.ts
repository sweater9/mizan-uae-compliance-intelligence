import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

let database: ReturnType<typeof createDatabase> | undefined;

function createDatabase() {
  const url = process.env.MIZAN_DATABASE_URL?.trim();
  if (!url) throw new Error("MIZAN_DATABASE_URL is not configured.");
  const sql = neon(url);
  return drizzle({ client: sql, schema });
}

export function getDatabase() {
  database ??= createDatabase();
  return database;
}
