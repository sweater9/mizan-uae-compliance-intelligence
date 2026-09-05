import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { publicTrialStatus } from "../app/public-trial.mjs";

const start = "2026-09-05T12:00:00.000Z";
const end = "2026-10-05T12:00:00.000Z";

test("one shared calendar month has inclusive start and exclusive end", () => {
  for (const [now, status] of [
    [Date.parse(start) - 1, "scheduled"], [Date.parse(start), "active"],
    [Date.parse(end) - 1, "active"], [Date.parse(end), "ended"],
  ]) {
    const trial = publicTrialStatus(start, now);
    assert.equal(trial.status, status);
    assert.equal(trial.endsAt, end);
  }
});

test("month ends clamp correctly, including leap years and year rollover", () => {
  for (const [from, to] of [
    ["2026-01-31T12:00:00Z", "2026-02-28T12:00:00.000Z"],
    ["2028-01-31T12:00:00Z", "2028-02-29T12:00:00.000Z"],
    ["2026-12-31T12:00:00Z", "2027-01-31T12:00:00.000Z"],
  ]) assert.equal(publicTrialStatus(from).endsAt, to);
});

test("missing, invalid, ambiguous and overflow dates fail closed", () => {
  for (const value of [undefined, "", "garbage", "2026-09-05", "2026-09-05T12:00:00",
    "2026-02-30T12:00:00Z", "2026-09-05T12:00:00+04:00"])
    assert.equal(publicTrialStatus(value).status, "unconfigured");
});

// Exercise the real handlers without installing Vinext. Only unrelated image
// and app-router imports are replaced; the policy and assistant code run intact.
async function loadHandler(path, worker = false) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  source = source.replace(/"(?:\.\.\/)+app\/public-trial\.mjs"|"\.\.\/\.\.\/public-trial\.mjs"/g,
    JSON.stringify(new URL("../app/public-trial.mjs", import.meta.url).href));
  if (worker) source = source
    .replace(/^import .* from "vinext\/server\/image-optimization";$/m,
      "const handleImageOptimization = () => { throw new Error('Unexpected image route'); }; const DEFAULT_DEVICE_SIZES = []; const DEFAULT_IMAGE_SIZES = [];")
    .replace(/^import handler from "vinext\/server\/app-router-entry";$/m,
      "const handler = { fetch: () => { throw new Error('Unexpected app route'); } };");
  return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
}

const route = await loadHandler("../app/api/assistant/route.ts");
const worker = (await loadHandler("../worker/index.ts", true)).default;
for (const name of ["server route", "Worker"]) {
  async function call(method, launch = start, body = { question: "Explain VAT" }) {
    const request = new Request("https://example.test/api/assistant", {
      method, ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    if (name === "Worker") return worker.fetch(request, { NVIDIA_API_KEY: "test-key", PUBLIC_TRIAL_START_AT: launch }, {});
    const oldStart = process.env.PUBLIC_TRIAL_START_AT;
    const oldKey = process.env.NVIDIA_API_KEY;
    try {
      if (launch === undefined) delete process.env.PUBLIC_TRIAL_START_AT;
      else process.env.PUBLIC_TRIAL_START_AT = launch;
      process.env.NVIDIA_API_KEY = "test-key";
      return await (method === "GET" ? route.GET() : route.POST(request));
    } finally {
      if (oldStart === undefined) delete process.env.PUBLIC_TRIAL_START_AT;
      else process.env.PUBLIC_TRIAL_START_AT = oldStart;
      if (oldKey === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = oldKey;
    }
  }

  test(`${name}: anonymous requests succeed during the free month; key stays upstream`, async t => {
    t.mock.method(Date, "now", () => Date.parse(start));
    const upstream = t.mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(options.headers.Authorization, "Bearer test-key");
      return Response.json({ choices: [{ message: { content: "Test answer" } }] });
    });
    const response = await call("POST");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { answer: "Test answer" });
    assert.equal(upstream.mock.callCount(), 1);
  });

  test(`${name}: no upstream calls outside the window or with invalid configuration`, async t => {
    const upstream = t.mock.method(globalThis, "fetch", () => { throw new Error("Must not call NVIDIA"); });
    const clock = t.mock.method(Date, "now", () => Date.parse(start) - 1);
    assert.equal((await call("POST")).status, 403);
    clock.mock.mockImplementation(() => Date.parse(end));
    assert.equal((await call("POST")).status, 410);
    assert.equal((await call("POST", "")).status, 503);
    assert.equal((await call("POST", "invalid")).status, 503);
    assert.equal(upstream.mock.callCount(), 0);
  });

  test(`${name}: public status exposes only dates and policy, without caching`, async t => {
    t.mock.method(Date, "now", () => Date.parse(start));
    const response = await call("GET");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const data = await response.json();
    assert.equal(data.status, "active");
    assert.equal(data.endsAt, end);
    assert.ok(!JSON.stringify(data).includes("test-key"));
  });
}
