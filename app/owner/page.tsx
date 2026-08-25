import type { Metadata } from "next";
import { ArrowUpRight, AtSign } from "lucide-react";

export const metadata: Metadata = {
  title: "About 70ne — Penstyle",
  description: "Meet 70ne (Tone), also known as Shivam Mazumdar, the creator of Penstyle.",
};

export default function OwnerPage() {
  return <main className="owner-page">
    <header className="owner-header"><a href="https://penstyle.space" aria-label="Open Penstyle"><img src="/penstyle-logo.webp" width="145" height="54" alt="Penstyle" /></a><a href="https://penstyle.space">Open Penstyle <ArrowUpRight size={16} /></a></header>
    <article className="owner-story">
      <p className="owner-kicker">THE PERSON BEHIND PENSTYLE</p>
      <h1>Hi, I’m <span>70ne.</span></h1>
      <p className="owner-intro">You can call me Tone—or Shivam Mazumdar. Welcome to my little corner of Penstyle.</p>
      <div className="owner-copy">
        <p>I’m a computer science student, and Penstyle began in a fraction of a second: I had an idea and decided to start before a second thought could talk me out of it.</p>
        <p>I’m proud that I didn’t let the possibility of failure stop me from making this place. If an idea finds you, begin right there. Give it a chance before you give it doubts.</p>
        <p>I originally wanted a space of my own for jotting down notes—somewhere clean, personal, and interesting enough to make me want to return. That small wish became Penstyle.</p>
      </div>
      <a className="owner-social" href="https://www.instagram.com/t0ne.aep/" target="_blank" rel="noreferrer"><AtSign size={20} /><span><small>STAY IN TOUCH</small><strong>@t0ne.aep</strong></span><ArrowUpRight size={18} /></a>
      <p className="owner-thanks">Thank you for being here.</p>
    </article>
    <footer className="owner-footer">© 2026 Penstyle. All Rights Reserved <i /> Made with <span aria-label="love">💗</span> by 70ne</footer>
  </main>;
}
