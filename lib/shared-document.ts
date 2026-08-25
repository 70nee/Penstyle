export type SharedDocument = {
  version: number;
  kind: "book" | "page";
  owner: string;
  createdAt: string;
  data: Record<string, any>;
};

export function validShareSlug(slug: string) {
  return /^(?:(?:book|page)-[a-f0-9]{16,24}|s-[a-f0-9]{10})$/.test(slug);
}

export async function readSharedDocument(slug: string): Promise<SharedDocument | null> {
  if (!validShareSlug(slug)) return null;
  const { env } = await import("cloudflare:workers");
  const object = await env.FILES.get(`shares/${slug}.json`);
  if (!object) return null;
  try {
    return JSON.parse(await object.text()) as SharedDocument;
  } catch {
    return null;
  }
}
