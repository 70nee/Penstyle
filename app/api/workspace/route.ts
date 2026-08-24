import { createClient } from "@supabase/supabase-js";
import { env } from "cloudflare:workers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
let schemaReady: Promise<void> | null = null;

function adminClient() {
  return serverKey && supabaseUrl ? createClient(supabaseUrl, serverKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

async function signedInUser(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const admin = adminClient();
  if (!admin || !token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

async function ensureSchema() {
  if (!schemaReady) schemaReady = env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS user_workspaces (user_id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, object_key TEXT NOT NULL, updated_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS user_workspaces_email_idx ON user_workspaces (email)"),
  ]).then(() => undefined);
  return schemaReady;
}

const privateHeaders = { "cache-control": "private, no-store", vary: "authorization" };

export async function GET(request: Request) {
  const user = await signedInUser(request);
  if (!user) return Response.json({ error: "Sign in again to open your books." }, { status: 401, headers: privateHeaders });
  await ensureSchema();
  const record = await env.DB.prepare("SELECT object_key FROM user_workspaces WHERE user_id = ?").bind(user.id).first<{ object_key: string }>();
  if (!record) return Response.json({ workspace: null }, { headers: privateHeaders });
  const object = await env.FILES.get(record.object_key);
  if (!object) return Response.json({ workspace: null }, { headers: privateHeaders });
  return new Response(await object.text(), { headers: { ...privateHeaders, "content-type": "application/json" } });
}

export async function PUT(request: Request) {
  const user = await signedInUser(request);
  if (!user) return Response.json({ error: "Sign in again before saving." }, { status: 401, headers: privateHeaders });
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > 40 * 1024 * 1024) return Response.json({ error: "This notebook library is too large to save." }, { status: 413, headers: privateHeaders });
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.books)) {
    return Response.json({ error: "Invalid notebook data." }, { status: 400, headers: privateHeaders });
  }
  const document = JSON.stringify(payload);
  if (document.length > 40 * 1024 * 1024) return Response.json({ error: "This notebook library is too large to save." }, { status: 413, headers: privateHeaders });
  const savedAt = Number(payload.savedAt);
  if (!Number.isSafeInteger(savedAt) || savedAt <= 0) return Response.json({ error: "Invalid save version." }, { status: 400, headers: privateHeaders });
  await ensureSchema();
  const prefix = `workspaces/${user.id}/`;
  const objectKey = `${prefix}${savedAt}-${crypto.randomUUID()}.json`;
  await env.FILES.put(objectKey, document, { httpMetadata: { contentType: "application/json" } });
  await env.DB.prepare("INSERT INTO user_workspaces (user_id, email, object_key, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, object_key = excluded.object_key, updated_at = excluded.updated_at WHERE excluded.updated_at > user_workspaces.updated_at")
    .bind(user.id, (user.email || "").trim().toLowerCase(), objectKey, savedAt).run();
  const current = await env.DB.prepare("SELECT object_key, updated_at FROM user_workspaces WHERE user_id = ?").bind(user.id).first<{ object_key: string; updated_at: number }>();
  const accepted = current?.object_key === objectKey;
  if (!accepted) await env.FILES.delete(objectKey);
  else {
    const listed = await env.FILES.list({ prefix });
    await Promise.all(listed.objects.filter((object) => object.key !== objectKey).map((object) => env.FILES.delete(object.key)));
    await env.FILES.delete(`workspaces/${user.id}.json`);
  }
  return Response.json({ saved: true, accepted, savedAt: current?.updated_at || savedAt }, { headers: privateHeaders });
}
