import { and, eq } from "drizzle-orm";
import { getDatabase } from "./db";
import { identities, users, workspaceMemberships, workspaces } from "./auth-schema";

type Claims = { sub: string; email?: string; iss?: string; aud?: string | string[]; exp?: number; iat?: number };
export type AuthenticatedUser = { id: string; subject: string; email: string | null };
export type WorkspaceAccess = AuthenticatedUser & { workspaceId: string; role: string };

type Jwk = JsonWebKey & { kid?: string; kty?: string };
let jwksCache: { expiresAt: number; keys: Jwk[] } | undefined;

function decode(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
  return new Uint8Array(bytes);
}

function parseClaims(token: string): { header: { alg?: string; kid?: string }; claims: Claims; signingInput: Uint8Array<ArrayBuffer>; signature: Uint8Array<ArrayBuffer> } {
  if (token.length > 16_384) throw new Error("Session token is too large.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid session token.");
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0]))) as { alg?: string; kid?: string };
  const claims = JSON.parse(new TextDecoder().decode(decode(parts[1]))) as Claims;
  return { header, claims, signingInput: new TextEncoder().encode(`${parts[0]}.${parts[1]}`), signature: decode(parts[2]) };
}

async function getKeys(url: string) {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`JWKS request failed with ${response.status}.`);
  const payload = await response.json() as { keys?: Jwk[] };
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) throw new Error("JWKS response contains no keys.");
  jwksCache = { keys: payload.keys, expiresAt: Date.now() + 300_000 };
  return payload.keys;
}

async function verifyToken(token: string): Promise<Claims> {
  const issuer = process.env.MIZAN_AUTH_ISSUER?.trim();
  const audience = process.env.MIZAN_AUTH_AUDIENCE?.trim();
  const jwksUrl = process.env.MIZAN_AUTH_JWKS_URL?.trim();
  if (!issuer || !audience || !jwksUrl) throw new Error("Authentication is not configured.");
  const { header, claims, signingInput, signature } = parseClaims(token);
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== "RS256" || !claims.sub || !claims.exp || claims.exp <= now || (claims.iat !== undefined && claims.iat > now + 60)) throw new Error("Invalid session claims.");
  if (claims.iss !== issuer || (Array.isArray(claims.aud) ? !claims.aud.includes(audience) : claims.aud !== audience)) throw new Error("Invalid session audience.");
  const jwk = (await getKeys(jwksUrl)).find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) throw new Error("Signing key not found.");
  const cryptoKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, signingInput)) throw new Error("Invalid session signature.");
  return claims;
}

function tokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim();
  const cookie = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith("mizan_session="));
  return cookie?.slice("mizan_session=".length) || null;
}

export function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null;
}

export async function requireUser(request: Request): Promise<AuthenticatedUser> {
  const token = tokenFromRequest(request);
  if (!token) throw new Response(JSON.stringify({ error: "Authentication required." }), { status: 401, headers: { "Content-Type": "application/json" } });
  let claims: Claims;
  try { claims = await verifyToken(token); } catch { throw new Response(JSON.stringify({ error: "Authentication could not be verified." }), { status: 401, headers: { "Content-Type": "application/json" } }); }
  const db = getDatabase();
  const existing = await db.select().from(identities).where(and(eq(identities.provider, process.env.MIZAN_AUTH_PROVIDER?.trim() || "default"), eq(identities.subject, claims.sub))).limit(1);
  if (existing[0]) {
    const found = await db.select().from(users).where(eq(users.id, existing[0].userId)).limit(1);
    if (found[0]) return { id: found[0].id, subject: claims.sub, email: found[0].email };
  }
  const userId = crypto.randomUUID();
  await db.insert(users).values({ id: userId, email: claims.email ?? null });
  await db.insert(identities).values({ id: crypto.randomUUID(), userId, provider: process.env.MIZAN_AUTH_PROVIDER?.trim() || "default", subject: claims.sub });
  return { id: userId, subject: claims.sub, email: claims.email ?? null };
}

export async function requireWorkspaceAccess(request: Request, workspaceId: string): Promise<WorkspaceAccess> {
  if (!workspaceId || workspaceId.length > 100) throw new Response(JSON.stringify({ error: "A valid workspaceId is required." }), { status: 400, headers: { "Content-Type": "application/json" } });
  const user = await requireUser(request);
  const rows = await getDatabase().select({ role: workspaceMemberships.role }).from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
    .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.userId, user.id))).limit(1);
  if (!rows[0]) throw new Response(JSON.stringify({ error: "Resource not available." }), { status: 403, headers: { "Content-Type": "application/json" } });
  return { ...user, workspaceId, role: rows[0].role };
}
