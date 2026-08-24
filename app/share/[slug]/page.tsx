import type { Metadata, Viewport } from "next";
import { readSharedDocument } from "../../../lib/shared-document";
import SharedNote from "./shared-note";

const plainText = (value: unknown) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const shared = await readSharedDocument(slug);
  if (!shared) return { title: "Shared note — Penstyle", description: "A shared Penstyle note." };
  const title = plainText(shared.data.title) || (shared.kind === "book" ? "Shared book" : "Shared page");
  const firstPage = shared.kind === "book" ? shared.data.pages?.[0] : shared.data;
  const excerpt = plainText(firstPage?.content || firstPage?.contentHtml);
  const pageCount = Array.isArray(shared.data.pages) ? shared.data.pages.length : 1;
  const description = shared.kind === "book"
    ? `${pageCount} ${pageCount === 1 ? "page" : "pages"} in ${title}, shared from Penstyle.`
    : excerpt.slice(0, 155) || `${title}, shared from Penstyle.`;
  const image = `/share/${encodeURIComponent(slug)}/opengraph-image`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article", siteName: "Penstyle", images: [{ url: image, width: 1200, height: 630, alt: `${title} preview` }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export function generateViewport(): Viewport {
  return { themeColor: "#ffffff" };
}

export default async function SharedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SharedNote slug={slug} />;
}
