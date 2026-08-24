import { ImageResponse } from "next/og";
import { readSharedDocument } from "../../../lib/shared-document";

export const runtime = "edge";
export const alt = "Penstyle shared note preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const clean = (value: unknown) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export default async function SharePreview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shared = await readSharedDocument(slug);
  const isBook = shared?.kind === "book";
  const data = shared?.data || {};
  const page = isBook ? data.pages?.[0] || {} : data;
  const title = clean(data.title || page.title) || (isBook ? "Shared book" : "Shared page");
  const excerpt = clean(page.content || page.contentHtml).slice(0, 210);
  const cover = data.color || "#405f49";
  const coverBorder = data.borderColor || "#22211f";
  const paper = page.settings?.paperColor || "#fffef9";
  const ink = page.settings?.ink || "#243d6b";
  const border = page.settings?.borderColor || "#c8c1b5";
  const pageCount = Array.isArray(data.pages) ? data.pages.length : 1;

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", padding: 54, background: "#f2f0eb", color: "#242321", fontFamily: "Georgia, serif" }}>
      <div style={{ width: "100%", display: "flex", alignItems: "stretch", gap: 52 }}>
        {isBook ? (
          <div style={{ position: "relative", width: 430, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "52px 42px 42px 72px", border: `5px solid ${coverBorder}`, borderRadius: "5px 20px 20px 5px", background: cover, color: "white" }}>
            <div style={{ position: "absolute", left: 27, top: 0, bottom: 0, width: 4, borderLeft: "1px solid rgba(255,255,255,.42)", borderRight: "1px solid rgba(0,0,0,.25)" }} />
            <div style={{ fontSize: 30 }}>Penstyle</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}><div style={{ fontSize: 54, lineHeight: 1.05 }}>{title}</div><div style={{ fontSize: 22, opacity: .82 }}>{pageCount} {pageCount === 1 ? "page" : "pages"}</div></div>
          </div>
        ) : (
          <div style={{ width: 590, padding: "50px 52px 44px 92px", border: `4px solid ${border}`, background: paper, color: ink, display: "flex", flexDirection: "column", gap: 26 }}>
            <div style={{ fontSize: 48, lineHeight: 1.08 }}>{title}</div>
            <div style={{ fontFamily: "Arial, sans-serif", fontSize: 25, lineHeight: 1.5 }}>{excerpt || "A shared handwritten page."}</div>
            {[0, 1, 2, 3, 4].map((line) => <div key={line} style={{ height: 1, background: "rgba(95,126,153,.42)" }} />)}
          </div>
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 18, letterSpacing: 4, color: "#77716a" }}>{isBook ? "SHARED BOOK" : "SHARED PAGE"}</div>
          <div style={{ fontSize: 54, lineHeight: 1.08 }}>{title}</div>
          <div style={{ width: 78, height: 4, background: "#292725" }} />
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 24, lineHeight: 1.45, color: "#625e58" }}>{isBook ? `${pageCount} ${pageCount === 1 ? "page" : "pages"} · Read-only` : excerpt || "Open this shared page on Penstyle."}</div>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 21, color: "#292725" }}>penstyle.space</div>
        </div>
      </div>
    </div>,
    size,
  );
}
