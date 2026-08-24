import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, BookOpen, Copy, Download, FileText, GripVertical, Hash, ImagePlus, Library, LogOut, Mic, Moon, MoveDown, MoveUp, Palette, Pencil, Pilcrow, Plus, Search, Settings2, Share2, Star, Sun, Trash2, Type, Underline, Upload, X } from "lucide-react";
import { HelpShell } from "../help-shell";

export const metadata: Metadata = { title: "Guide — Penstyle", description: "A visual, control-by-control guide to Penstyle." };

function Control({ icon, label, children, danger = false }: { icon: ReactNode; label: string; children: ReactNode; danger?: boolean }) {
  return <article className={`guide-control ${danger ? "danger" : ""}`}><span className="guide-button" aria-hidden="true">{icon}<b>{label}</b></span><p>{children}</p></article>;
}

function Panel({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return <section className="guide-panel" id={id}><div className="guide-panel-head"><p>{eyebrow}</p><h2>{title}</h2><span>{intro}</span></div><div className="guide-controls">{children}</div></section>;
}

export default function GuidePage() {
  return <HelpShell active="guide" eyebrow="VISUAL GUIDE" title="Every button, panel, and control—explained." intro="Match the controls shown here with the ones in Penstyle. Each description tells you what happens and when to use it.">
    <nav className="help-jump" aria-label="Guide panels"><strong>Jump to a panel</strong><a href="#library">Library</a><a href="#book-header">Book header</a><a href="#pages">Pages</a><a href="#writing">Writing</a><a href="#voice">Voice</a><a href="#style">Page style</a><a href="#objects">Objects</a><a href="#sharing">Share & export</a></nav>
    <div className="guide-note"><strong>Quick start</strong><span>Sign in, choose New book, add a page style, then click the page and write. Everything below is there when you want more control.</span></div>

    <Panel id="library" eyebrow="PANEL 01" title="Library" intro="This is the shelf that holds all your books.">
      <Control icon={<Plus size={16} />} label="New book">Opens the cloudy book form. Name the book and choose its cover and border colors.</Control>
      <Control icon={<Upload size={16} />} label="Import">Opens an editable <b>.pen</b> book made in Penstyle. The imported copy is added to your library and opens immediately.</Control>
      <Control icon={<FileText size={16} />} label="Docs">Opens the simple feature reference at /documentation.</Control>
      <Control icon={<BookOpen size={16} />} label="Guide">Opens this visual guide.</Control>
      <Control icon={<Settings2 size={16} />} label="Light / Dark">Changes the library appearance without changing your page colors.</Control>
      <Control icon={<LogOut size={16} />} label="Sign out">Ends the current sign-in session and returns to the welcome page.</Control>
      <Control icon={<Star size={16} />} label="Important">Moves a book into or out of the Important section. A filled star means it is marked.</Control>
      <Control icon={<Pencil size={16} />} label="Rename">Opens a Penstyle rename popup for the book.</Control>
      <Control icon={<Share2 size={16} />} label="Share book">Creates a read-only link containing the complete book in its current order.</Control>
      <Control icon={<Trash2 size={16} />} label="Delete book" danger>Asks for confirmation, then removes the book and every page inside it.</Control>
    </Panel>

    <Panel id="book-header" eyebrow="PANEL 02" title="Book header" intro="The top row stays available while you work on pages.">
      <Control icon={<ArrowLeft size={16} />} label="Library">Returns to the book shelf. Your current book and page remain remembered.</Control>
      <Control icon={<Pencil size={16} />} label="Book name">Click the name beside the cover color to rename the current book directly.</Control>
      <Control icon={<Share2 size={16} />} label="Share page">Creates a read-only link for only the page you are viewing.</Control>
      <Control icon={<Mic size={16} />} label="Voice typing">Opens the microphone panel. It turns blue on hover and changes to Stop while listening.</Control>
      <Control icon={<Moon size={16} />} label="Dark"><span>Switches the workspace to dark mode. In dark mode the same button shows </span><Sun size={13} aria-hidden="true" /> Light.</Control>
      <Control icon={<Palette size={16} />} label="Page style">Opens the full appearance panel on the right. Its colors animate only while you hover.</Control>
      <Control icon={<BookOpen size={16} />} label="Read">Opens every page of the current book in order, without editing controls. Scroll naturally through the book and press Escape or Close when finished.</Control>
      <Control icon={<Download size={16} />} label="Export">Opens formats, page scope, resolution, and paper options—including editable PEN files.</Control>
    </Panel>

    <Panel id="pages" eyebrow="PANEL 03" title="Pages sidebar" intro="Use the left side to create, find, arrange, rename, and remove pages.">
      <Control icon={<Plus size={16} />} label="New page">Opens ruled, dot-ruled, grid, dots, blank, and Cornell choices. Picking one creates the page.</Control>
      <Control icon={<Search size={16} />} label="Find a page">Filters page names and writing as you type.</Control>
      <Control icon={<GripVertical size={16} />} label="Drag handle">Drag a page up or down to change its sequence.</Control>
      <Control icon={<MoveUp size={16} />} label="Move up">Moves the page one position earlier. This is also the keyboard-friendly alternative to dragging.</Control>
      <Control icon={<MoveDown size={16} />} label="Move down">Moves the page one position later.</Control>
      <Control icon={<Pencil size={16} />} label="Right-click → Rename">Right-click a page, then choose Rename page to open the rename popup.</Control>
      <Control icon={<Trash2 size={16} />} label="Right-click → Delete" danger>Removes that page after confirmation. A book always keeps at least one page.</Control>
      <Control icon={<Hash size={16} />} label="Page numbers">Turns automatic numbering on or off. Numbers refresh after every reorder.</Control>
      <Control icon={<Library size={16} />} label="All books">Returns to your complete library.</Control>
    </Panel>

    <Panel id="writing" eyebrow="PANEL 04" title="Writing toolbar" intro="These controls affect the page or the exact text you have selected.">
      <Control icon={<FileText size={16} />} label="Page">Changes the current paper layout without making a new page.</Control>
      <Control icon={<Type size={16} />} label="Font">Chooses a handwriting face or a computer/book font for the main writing.</Control>
      <Control icon={<Type size={16} />} label="Size">Changes selected text only. With no selection, it changes the main body size—not the title.</Control>
      <Control icon={<Palette size={16} />} label="Ink color">Colors selected letters or words. With no selection, it sets the main body ink.</Control>
      <Control icon={<Underline size={16} />} label="Underline">Underlines the selected text in either the title or body.</Control>
      <Control icon={<Pilcrow size={16} />} label="Paragraph">Starts a separate paragraph at the cursor.</Control>
      <Control icon={<AlignLeft size={16} />} label="Align left">Aligns the current paragraph or selected lines to the left.</Control>
      <Control icon={<AlignCenter size={16} />} label="Align centre">Centres the current paragraph or selected lines.</Control>
      <Control icon={<AlignRight size={16} />} label="Align right">Aligns the current paragraph or selected lines to the right.</Control>
      <Control icon={<ImagePlus size={16} />} label="Image">Imports a picture and places it on the page.</Control>
      <Control icon={<Type size={16} />} label="Add text box">Adds a separate movable note or caption anywhere on the page.</Control>
      <Control icon={<Copy size={16} />} label="Duplicate">Copies the current page, including writing, page style, images, and text boxes.</Control>
      <Control icon={<Trash2 size={16} />} label="Delete" danger>Opens confirmation for the current page. The label turns red on hover.</Control>
    </Panel>

    <Panel id="voice" eyebrow="PANEL 05" title="Voice typing panel" intro="English dictation listens directly to the selected microphone through Penstyle’s bundled recognizer.">
      <Control icon={<Type size={16} />} label="Page title">Sends recognized speech to the title.</Control>
      <Control icon={<BookOpen size={16} />} label="Main body">Sends recognized speech to the writing area.</Control>
      <Control icon={<Mic size={16} />} label="Input device">Chooses the microphone. The meter below confirms that sound is reaching Penstyle.</Control>
      <Control icon={<FileText size={16} />} label="Language">Tells recognition which language and regional accent to expect.</Control>
      <Control icon={<Mic size={16} />} label="Start">Opens the chosen microphone and begins live interim transcription. The first English session prepares the bundled recognizer; later sessions start immediately.</Control>
      <Control icon={<Mic size={16} />} label="Stop listening">Finishes the current phrase and keeps the dictated text on the page.</Control>
      <Control icon={<Trash2 size={16} />} label="Clear dictated text" danger>Removes only writing added through dictation. Typed writing stays untouched.</Control>
      <Control icon={<X size={16} />} label="Close">Stops listening if needed and closes the voice panel.</Control>
    </Panel>

    <Panel id="style" eyebrow="PANEL 06" title="Page style panel" intro="This panel controls the physical look of the current page.">
      <Control icon={<FileText size={16} />} label="Paper layout">Chooses ruled, dot-ruled, grid, dotted, blank, or Cornell paper.</Control>
      <Control icon={<Settings2 size={16} />} label="Ruling">Moves lines closer together or farther apart while keeping writing on the baseline.</Control>
      <Control icon={<FileText size={16} />} label="Page date">Shows or hides the date. Use today automatically, type your own date, and align it left, centre, or right.</Control>
      <Control icon={<Type size={16} />} label="Writing font & size">Sets the default appearance for the body of this page.</Control>
      <Control icon={<Palette size={16} />} label="Text color">Uses a swatch, color picker, or pasted hex code. Selected text takes priority.</Control>
      <Control icon={<Palette size={16} />} label="Paper color">Changes the sheet color using presets or a custom hex code.</Control>
      <Control icon={<Palette size={16} />} label="Page border">Chooses border color, thickness, and solid, double, dashed, or no border.</Control>
      <Control icon={<Settings2 size={16} />} label="Side & top margins">Changes where the writing area begins.</Control>
      <Control icon={<FileText size={16} />} label="Red margin line">Shows or hides the traditional notebook margin.</Control>
      <Control icon={<Settings2 size={16} />} label="Reset">Returns this page to Penstyle’s standard paper settings.</Control>
    </Panel>

    <Panel id="objects" eyebrow="PANEL 07" title="Images and text boxes" intro="Object controls appear only when the object is selected.">
      <Control icon={<GripVertical size={16} />} label="Move image">Drag the selected image to another place on the paper. Arrow keys also move it.</Control>
      <Control icon={<ImagePlus size={16} />} label="Replace image">Keeps the image position but lets you choose a different file.</Control>
      <Control icon={<Settings2 size={16} />} label="Size slider">Makes the selected image wider or narrower.</Control>
      <Control icon={<Trash2 size={16} />} label="Delete image" danger>Removes only the selected image.</Control>
      <Control icon={<GripVertical size={16} />} label="Move text box">Drag the small box header, then type inside the text area.</Control>
      <Control icon={<X size={16} />} label="Remove text box" danger>Removes that movable text box without changing the main writing.</Control>
    </Panel>

    <Panel id="sharing" eyebrow="PANEL 08" title="Share and export panels" intro="Share is for viewing; export is for files and editable handoff.">
      <Control icon={<Share2 size={16} />} label="Copy link">Copies the generated read-only link and changes to Copied as confirmation.</Control>
      <Control icon={<FileText size={16} />} label="Current page">Exports only the page currently open.</Control>
      <Control icon={<BookOpen size={16} />} label="Entire book">Exports every page in its visible sequence.</Control>
      <Control icon={<Settings2 size={16} />} label="Choose pages">Lets you tick the exact pages to include.</Control>
      <Control icon={<Download size={16} />} label="PDF / PNG / JPEG / SVG">Creates faithful visual pages. Multiple image pages download as an ordered ZIP.</Control>
      <Control icon={<FileText size={16} />} label="HTML / Markdown / Text / JSON">Creates portable reading or data formats.</Control>
      <Control icon={<Download size={16} />} label="PEN">Creates a complete editable .pen book. Another Penstyle user can Import it and continue editing.</Control>
      <Control icon={<Settings2 size={16} />} label="Output options">Controls resolution, JPEG quality, PDF page size, and whether paper styling is included.</Control>
    </Panel>
  </HelpShell>;
}
