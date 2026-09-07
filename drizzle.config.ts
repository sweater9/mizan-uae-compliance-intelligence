import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: process.env.MIZAN_DATABASE_URL ? { url: process.env.MIZAN_DATABASE_URL } : undefined,
});
