import type { ReactNode } from "react";

export function HelpShell({ active, eyebrow, title, intro, children }: { active: "docs" | "guide"; eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return <main className="help-page">
    <a className="skip-link" href="#help-content">Skip to the help content</a>
    <header className="help-header">
      <a className="help-brand" href="/" aria-label="Open Penstyle library"><img src="/penstyle-logo.png" width="145" height="54" alt="Penstyle" /></a>
      <nav aria-label="Help pages">
        <a className={active === "docs" ? "active" : ""} aria-current={active === "docs" ? "page" : undefined} href="/documentation">Docs</a>
        <a className={active === "guide" ? "active" : ""} aria-current={active === "guide" ? "page" : undefined} href="/guide">Guide</a>
        <a className="library-link" href="/">Open library</a>
      </nav>
    </header>
    <section className="help-hero"><p>{eyebrow}</p><h1>{title}</h1><span>{intro}</span></section>
    <div className="help-content" id="help-content">{children}</div>
    <footer className="help-footer"><span>Penstyle</span><a href="/">Back to your library</a></footer>
  </main>;
}

export function HelpSection({ id, number, title, summary, children }: { id: string; number: string; title: string; summary: string; children: ReactNode }) {
  return <section className="help-section" id={id}><div className="help-section-heading"><span>{number}</span><div><h2>{title}</h2><p>{summary}</p></div></div><div className="help-section-body">{children}</div></section>;
}
