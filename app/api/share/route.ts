import { createClient } from "@supabase/supabase-js";
import { env } from "cloudflare:workers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function adminClient() {
  return serverKey && supabaseUrl
    ? createClient(supabaseUrl, serverKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
}

async function signedInUser(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const admin = adminClient();
  if (!admin || !token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

export async function POST(request: Request) {
  const admin = adminClient();
  if (!admin) return Response.json({ error: "Sharing is not configured yet." }, { status: 503 });
  const user = await signedInUser(request);
  if (!user) return Response.json({ error: "Sign in again before sharing." }, { status: 401 });

  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > 40 * 1024 * 1024) return Response.json({ error: "This shared notebook is too large." }, { status: 413 });
  const payload = await request.json().catch(() => null);
  if (!payload || !["book", "page"].includes(payload.kind) || !payload.data || typeof payload.data.id !== "string" || !/^[a-f0-9-]{16,64}$/i.test(payload.data.id)) {
    return Response.json({ error: "Invalid share request." }, { status: 400 });
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${user.id}:${payload.kind}:${payload.data.id}`));
  const slug = `${payload.kind}-${[...new Uint8Array(digest)].slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  const document = JSON.stringify({
    version: 1,
    kind: payload.kind,
    owner: user.id,
    createdAt: new Date().toISOString(),
    data: payload.data,
  });
  if (document.length > 40 * 1024 * 1024) return Response.json({ error: "This shared notebook is too large." }, { status: 413 });
  await env.FILES.put(`shares/${slug}.json`, document, { httpMetadata: { contentType: "application/json" } });
  return Response.json({ slug, url: `/share/${slug}` });
}

export async function GET(request: Request) {
  const admin = adminClient();
  if (!admin) return Response.json({ error: "Sharing is not configured yet." }, { status: 503 });
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug || !/^(book|page)-[a-f0-9]{16,24}$/.test(slug)) {
    return Response.json({ error: "Invalid link." }, { status: 400 });
  }

  const data = await env.FILES.get(`shares/${slug}.json`);
  if (!data) return Response.json({ error: "This shared note was not found." }, { status: 404 });
  return new Response(await data.text(), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
  });
}
