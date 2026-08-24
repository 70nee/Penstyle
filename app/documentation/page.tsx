import type { Metadata } from "next";
import { HelpSection, HelpShell } from "../help-shell";

export const metadata: Metadata = { title: "Docs — Penstyle", description: "A simple reference for every Penstyle feature." };

export default function DocumentationPage() {
  return <HelpShell active="docs" eyebrow="PENSTYLE DOCS" title="Everything in one friendly reference." intro="Penstyle works like a real shelf: create a book, add pages, then write, arrange, share, or export them your way.">
    <nav className="help-jump" aria-label="On this page"><strong>Jump to</strong><a href="#library">Books</a><a href="#writing">Writing</a><a href="#voice">Voice</a><a href="#objects">Images & text</a><a href="#pages">Pages</a><a href="#share">Share & export</a></nav>
    <HelpSection id="library" number="01" title="Books and your library" summary="A book holds a set of pages, just like a notebook.">
      <p>Choose <b>New book</b>, give it a name, and pick a cover and border color. Use <b>Import</b> to open an editable .pen book from another Penstyle user. Open a book by selecting its cover. Use the star to place a book in <b>Important</b>, the pencil to rename it, and the bin to delete it.</p>
      <p>Penstyle remembers the book, page, and scroll position you were using, so returning to your work feels natural.</p>
    </HelpSection>
    <HelpSection id="writing" number="02" title="Writing and formatting" summary="Type normally, or style only the words you choose.">
      <p>Click the title or main page and start typing. To change a few words, select them first, then choose a size, ink color, underline, or alignment. With nothing selected, size and ink changes apply to the main body.</p>
      <p>The paragraph button starts a clean paragraph. Left, centre, and right alignment work on the paragraph containing your cursor.</p>
    </HelpSection>
    <HelpSection id="voice" number="03" title="Voice typing" summary="Choose where your speech goes before you start.">
      <p>Open the microphone panel, select your input device and language, then start in the title or main body. English dictation uses Penstyle’s bundled recognizer and listens directly to the microphone you selected, without relying on the unavailable online speech service. The first start prepares it; later starts are immediate. You can say “new paragraph”, “new line”, “comma”, or “full stop”.</p>
      <p><b>Clear dictated text</b> removes text added through that voice panel without clearing the rest of the page.</p>
    </HelpSection>
    <HelpSection id="objects" number="04" title="Images and movable text" summary="Place extra material anywhere on the page.">
      <p>Use <b>Image</b> to add a picture. Click the picture when you want its controls, then move, resize, replace, or delete it. Click elsewhere and the controls disappear.</p>
      <p>Use <b>Add text box</b> for captions, labels, or side notes. Each box can be moved and removed independently.</p>
    </HelpSection>
    <HelpSection id="pages" number="05" title="Pages and paper styles" summary="Build the notebook that suits the subject.">
      <p>Add ruled, dot-ruled, grid, dotted, blank, or Cornell pages. You can also adjust ruling, margins, paper and border colors, border style, date, and date alignment.</p>
      <p>Drag pages in the left panel to reorder them. Page numbers follow the new order automatically when numbering is on. Right-click a page for rename and delete actions.</p>
    </HelpSection>
    <HelpSection id="share" number="06" title="Sharing and exporting" summary="Send a read-only link or keep files of your own.">
      <p><b>Read</b> opens every page of the current book in sequence, with the paper appearance and placed objects preserved. Scroll through it like a complete notebook, then close the view to continue editing.</p>
      <p>Share creates a direct read-only link for a page or a whole book. Export can save the current page, chosen pages, or the complete book in the formats shown in the export panel.</p>
      <p>Exported page files use your page names and follow the current page order. Visual formats preserve the paper appearance, colors, writing, images, and placed text. Choose <b>PEN</b> when another person needs a complete editable copy they can import and continue working on.</p>
    </HelpSection>
  </HelpShell>;
}
