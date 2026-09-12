import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

function authorized(request: NextRequest) {
  const expected = process.env.MIZAN_INGESTION_API_KEY?.trim();
  const header = request.headers.get("authorization") ?? "";
  if (!expected || !header.startsWith("Bearer ")) return false;

  const supplied = header.slice("Bearer ".length).trim();
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, ["scripts/regulatory-update.mjs"], {
      cwd: process.cwd(),
      env: process.env,
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });

    const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
    const summary = lines.length ? lines[lines.length - 1] : "";
    let result: unknown = { status: "completed" };
    try {
      result = JSON.parse(summary);
    } catch {
      result = { status: "completed", summary };
    }

    return NextResponse.json({ ok: true, result, stderr: stderr.trim() || undefined });
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string; code?: number | string };
    const lines = (failure.stdout ?? "").trim().split(/\r?\n/).filter(Boolean);
    const summary = lines.length ? lines[lines.length - 1] : "";
    let result: unknown = undefined;
    try {
      result = summary ? JSON.parse(summary) : undefined;
    } catch {
      result = summary || undefined;
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Regulatory update did not complete successfully.",
        result,
        stderr: failure.stderr?.trim() || failure.message,
        exitCode: failure.code,
      },
      { status: 502 },
    );
  }
}
