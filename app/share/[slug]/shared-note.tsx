"use client";

import { BookOpen, FileText } from "lucide-react";
import { useEffect, useState } from "react";

export default function SharedNote({ slug }: { slug: string }) {
  const [document, setDocument] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch(`/api/share?slug=${encodeURIComponent(slug)}`).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setDocument(body); }).catch((reason) => setError(reason.message)); }, [slug]);
  if (error) return <main className="shared-state"><div className="wordmark small"><img src="/penstyle-logo.webp" width="145" height="54" alt="Penstyle" /></div><h1>Link unavailable</h1><p>{error}</p></main>;
  if (!document) return <main className="shared-state"><p>Opening shared notes…</p></main>;
  const pages = document.kind === "book" ? document.data.pages : [document.data];
  return <main className="shared-screen"><header><div className="wordmark small"><img src="/penstyle-logo.webp" width="145" height="54" alt="Penstyle" /></div><span>{document.kind === "book" ? <><BookOpen size={15} /> Shared book</> : <><FileText size={15} /> Shared page</>}</span></header><section><h1>{document.kind === "book" ? document.data.title : pages[0]?.title}</h1><p className="shared-meta">Shared read-only on {new Date(document.createdAt).toLocaleDateString()}</p>{pages.map((page: any, index: number) => <article className="shared-paper" key={page.id} style={{ backgroundColor: page.settings?.paperColor || "#fffef9", borderColor: page.settings?.borderColor || "#c8c1b5", color: page.settings?.ink || "#243d6b", fontFamily: `'${page.settings?.font || "Nothing You Could Do"}', cursive` }}><h2>{page.title}</h2><div>{page.content}</div>{page.freeTexts?.map((text: any) => <p key={text.id}>{text.text}</p>)}{document.kind === "book" && document.data.pageNumbers && <span className="shared-page-number">{index + 1}</span>}</article>)}</section></main>;
}
