import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("workspace migration establishes tenant ownership", async () => {
  const migration = await read("drizzle/0006_auth_workspace_foundation.sql");
  assert.match(migration, /CREATE TABLE "users"/);
  assert.match(migration, /CREATE TABLE "workspace_memberships"/);
  assert.match(migration, /ALTER TABLE "company_profiles" ADD COLUMN "workspace_id"/);
  assert.match(migration, /company_profiles_workspace_id_workspaces_id_fk/);
});

test("company APIs enforce membership and profile tenant boundaries", async () => {
  const profile = await read("server/company-profile.ts");
  const calendar = await read("app/api/compliance-calendar/route.ts");
  const changes = await read("app/api/regulatory-changes/route.ts");
  assert.match(profile, /requireWorkspaceAccess/);
  assert.match(profile, /eq\(companyProfiles\.workspaceId, workspaceId\)/);
  assert.match(calendar, /requireProfileAccess/);
  assert.match(changes, /requireProfileAccess/);
});

test("public APIs do not require workspace auth", async () => {
  const search = await read("app/api/regulatory-search/route.ts");
  const ask = await read("app/api/assistant/route.ts");
  assert.doesNotMatch(search, /requireWorkspaceAccess|requireProfileAccess/);
  assert.doesNotMatch(ask, /requireWorkspaceAccess|requireProfileAccess/);
});
