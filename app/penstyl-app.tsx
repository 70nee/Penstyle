"use client";

import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft, BookOpen, Check, Copy, Download,
  FileText, FolderOpen, GripVertical, Hash, ImagePlus, Library, LogOut, Menu, Mic, MicOff, MoveDown, MoveUp,
  LoaderCircle, Moon, Palette, Pencil, Pilcrow, Plus, RefreshCw, Search, Settings2, Share2, Star, Sun, Trash2, Type, Underline, X,
  Upload,
} from "lucide-react";
import type { Provider, Session } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabase-browser";

type PaperType = "ruled" | "dot-ruled" | "grid" | "dots" | "blank" | "cornell";
type BorderStyle = "solid" | "double" | "dashed" | "none";
type FreeText = { id: string; text: string; x: number; y: number; color: string; font: string; size: number };
type PageImage = { id: string; src: string; x: number; y: number; width: number; alt: string };
type PageSettings = {
  paper: PaperType; ruleMm: number; font: string; fontSize: number; ink: string;
  paperColor: string; borderColor: string; borderWidth: number; borderStyle: BorderStyle;
  sideMargin: number; topMargin: number; marginLine: boolean;
  showDate: boolean; autoDate: boolean; dateAlign: "left" | "center" | "right";
};
type NotePage = { id: string; title: string; titleHtml: string; content: string; contentHtml: string; dateText: string; updatedAt: number; settings: PageSettings; freeTexts: FreeText[]; images: PageImage[] };
type Book = { id: string; title: string; color: string; borderColor: string; pages: NotePage[]; updatedAt: number; important?: boolean; pageNumbers?: boolean };
type Profile = { name: string; email: string; avatar?: string };
type SavedWorkspace = { profile: Profile | null; books: Book[]; activeBookId: string; activePageId: string; screen: "library" | "book"; dark: boolean; savedAt?: number };
type ExportFormat = "pdf" | "png" | "jpeg" | "svg" | "html" | "md" | "txt" | "json" | "pen";

const LEGACY_STORAGE_KEY = "penstyl-workspace-v3";
const LEGACY_LOCATION_KEY = "penstyl-last-location-v1";
const workspaceKey = (userId: string) => `penstyl-workspace-v4:${userId}`;
const locationKey = (userId: string) => `penstyl-last-location-v2:${userId}`;
const handwritingFonts = ["Caveat", "Kalam", "Patrick Hand", "Handlee", "Architects Daughter", "Indie Flower", "Gochi Hand", "Gloria Hallelujah", "Reenie Beanie", "Sue Ellen Francisco", "Cedarville Cursive", "Homemade Apple", "Nothing You Could Do", "La Belle Aurore", "Nanum Pen Script", "Shadows Into Light Two"];
const computerFonts = ["Georgia", "DM Sans", "Arial", "Times New Roman", "Courier New"];
const bookColors = ["#345174", "#6f3f3f", "#4d6248", "#7a6343", "#5f536f", "#34383d", "#8a6b2d", "#6a4a36"];
const paperColors = ["#fffef9", "#fffdf3", "#fbf7e8", "#f8fbfd", "#f7fbf5", "#fff8f5", "#f9f7fc", "#f1eee5", "#fbfaf6", "#f5f0df", "#eef4ee", "#f3f0ea"];
const inkColors = ["#1d2632", "#243d6b", "#243f35", "#5b2f2f", "#553d64", "#3e352c", "#77501d", "#171717", "#45545f", "#6b2e48"];
const borderColors = ["#c8c1b5", "#393632", "#8d3232", "#345174", "#4d6248", "#7a6343", "#6a526f", "#d3c7ad"];

const defaultSettings: PageSettings = {
  paper: "ruled", ruleMm: 7, font: "Nothing You Could Do", fontSize: 19,
  ink: "#243d6b", paperColor: "#fffef9", borderColor: "#c8c1b5", borderWidth: 1,
  borderStyle: "solid", sideMargin: 72, topMargin: 64, marginLine: true,
  showDate: true, autoDate: true, dateAlign: "right",
};

function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
function fullDate(value = Date.now()) { return new Date(value).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }); }
function paperStyle(page: NotePage): React.CSSProperties {
  const ruleStep = Math.max(page.settings.ruleMm * 3.78, page.settings.fontSize * 1.25);
  const baselineLift = Math.max(3, Math.min(9, (ruleStep - page.settings.fontSize) * .82));
  return { backgroundColor: page.settings.paperColor, borderColor: page.settings.borderColor, borderWidth: `${page.settings.borderWidth}px`, borderStyle: page.settings.borderStyle, "--ink": page.settings.ink, "--hand": `'${page.settings.font}', cursive`, "--font-size": `${page.settings.fontSize}px`, "--rule": `${ruleStep}px`, "--rule-shift": `${-baselineLift}px`, "--side-margin": `${page.settings.sideMargin}px`, "--top-margin": `${page.settings.topMargin}px` } as React.CSSProperties;
}

function createPage(title = "Untitled page", paper: PaperType = "ruled"): NotePage {
  return { id: crypto.randomUUID(), title, titleHtml: escapeHtml(title), content: "", contentHtml: "", dateText: fullDate(), updatedAt: Date.now(), settings: { ...defaultSettings, paper }, freeTexts: [], images: [] };
}
function normalizePage(page: Partial<NotePage>): NotePage {
  const content = page.content || "";
  const contentHtml = page.contentHtml ?? content.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br>");
  const title = page.title || "Untitled page";
  return { id: page.id || crypto.randomUUID(), title, titleHtml: page.titleHtml ?? escapeHtml(title), content, contentHtml, dateText: page.dateText || fullDate(page.updatedAt || Date.now()), updatedAt: page.updatedAt || Date.now(), settings: { ...defaultSettings, ...(page.settings || {}) }, freeTexts: Array.isArray(page.freeTexts) ? page.freeTexts : [], images: Array.isArray(page.images) ? page.images : [] };
}
function sanitizeImportedHtml(value: unknown, fallback: string, preserveDictation = false) {
  if (typeof value !== "string") return escapeHtml(fallback);
  const root = document.createElement("div"); root.innerHTML = value;
  const allowed = new Set(["BR", "DIV", "P", "SPAN", "U", "B", "STRONG", "I", "EM"]);
  root.querySelectorAll("script,style,iframe,object,embed,link,meta,img,svg").forEach((node) => node.remove());
  [...root.querySelectorAll<HTMLElement>("*")].forEach((element) => {
    if (!allowed.has(element.tagName)) { element.replaceWith(document.createTextNode(element.textContent || "")); return; }
    const dictated = preserveDictation && element.getAttribute("data-penstyl-dictation") === "true";
    const color = element.style.color; const fontSize = element.style.fontSize; const textDecoration = element.style.textDecoration; const textAlign = element.style.textAlign;
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
    if (validHex(color) || /^rgba?\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(color)) element.style.color = color;
    if (/^(1[0-9]|[2-7][0-9]|80)px$/.test(fontSize)) element.style.fontSize = fontSize;
    if (textDecoration.includes("underline")) element.style.textDecoration = "underline";
    if (["left", "center", "right"].includes(textAlign)) element.style.textAlign = textAlign;
    if (dictated) element.setAttribute("data-penstyl-dictation", "true");
  });
  return root.innerHTML;
}
function importableBook(value: unknown): Book {
  const envelope = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (envelope.format !== "penstyle-book" || envelope.version !== 1) throw new Error("This is not a supported Penstyle .pen book.");
  const source = (envelope.book && typeof envelope.book === "object" ? envelope.book : envelope) as Partial<Book>;
  if (!Array.isArray(source.pages) || !source.pages.length) throw new Error("This .pen file does not contain any pages.");
  const now = Date.now();
  const pages = source.pages.map((raw) => {
    const page = raw && typeof raw === "object" ? raw as Partial<NotePage> : {};
    const title = typeof page.title === "string" ? page.title.slice(0, 200) : "Untitled page"; const content = typeof page.content === "string" ? page.content : "";
    const rawSettings = page.settings && typeof page.settings === "object" ? page.settings : defaultSettings;
    const numberIn = (input: unknown, min: number, max: number, fallback: number) => typeof input === "number" && Number.isFinite(input) ? Math.min(max, Math.max(min, input)) : fallback;
    const paper = (["ruled", "dot-ruled", "grid", "dots", "blank", "cornell"] as string[]).includes(rawSettings.paper) ? rawSettings.paper : defaultSettings.paper;
    const borderStyle = (["solid", "double", "dashed", "none"] as string[]).includes(rawSettings.borderStyle) ? rawSettings.borderStyle : defaultSettings.borderStyle;
    const dateAlign = (["left", "center", "right"] as string[]).includes(rawSettings.dateAlign) ? rawSettings.dateAlign : defaultSettings.dateAlign;
    const font = [...handwritingFonts, ...computerFonts].includes(String(rawSettings.font)) ? String(rawSettings.font) : defaultSettings.font;
    const settings: PageSettings = { paper: paper as PaperType, ruleMm: numberIn(rawSettings.ruleMm, 5, 10, defaultSettings.ruleMm), font, fontSize: numberIn(rawSettings.fontSize, 14, 80, defaultSettings.fontSize), ink: validHex(String(rawSettings.ink || "")) ? String(rawSettings.ink) : defaultSettings.ink, paperColor: validHex(String(rawSettings.paperColor || "")) ? String(rawSettings.paperColor) : defaultSettings.paperColor, borderColor: validHex(String(rawSettings.borderColor || "")) ? String(rawSettings.borderColor) : defaultSettings.borderColor, borderWidth: numberIn(rawSettings.borderWidth, 1, 4, defaultSettings.borderWidth), borderStyle: borderStyle as BorderStyle, sideMargin: numberIn(rawSettings.sideMargin, 30, 160, defaultSettings.sideMargin), topMargin: numberIn(rawSettings.topMargin, 30, 150, defaultSettings.topMargin), marginLine: Boolean(rawSettings.marginLine), showDate: Boolean(rawSettings.showDate), autoDate: Boolean(rawSettings.autoDate), dateAlign: dateAlign as PageSettings["dateAlign"] };
    const normalized = normalizePage({ id: crypto.randomUUID(), title, content, titleHtml: sanitizeImportedHtml(page.titleHtml, title), contentHtml: sanitizeImportedHtml(page.contentHtml, content), dateText: typeof page.dateText === "string" ? page.dateText.slice(0, 120) : fullDate(), updatedAt: now, settings, freeTexts: [], images: [] });
    const freeTexts = (Array.isArray(page.freeTexts) ? page.freeTexts : []).filter((item): item is FreeText => Boolean(item && typeof item === "object")).map((item) => ({ id: crypto.randomUUID(), text: String(item.text || "").slice(0, 10_000), x: numberIn(item.x, 0, 100, 52), y: numberIn(item.y, 0, 3000, 250), color: validHex(String(item.color || "")) ? String(item.color) : settings.ink, font: [...handwritingFonts, ...computerFonts].includes(String(item.font)) ? String(item.font) : settings.font, size: numberIn(item.size, 10, 80, settings.fontSize) }));
    const images = (Array.isArray(page.images) ? page.images : []).filter((item): item is PageImage => Boolean(item && typeof item === "object" && typeof item.src === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(item.src))).map((item) => ({ id: crypto.randomUUID(), src: item.src, x: numberIn(item.x, 0, 100, 50), y: numberIn(item.y, 0, 3000, 230), width: numberIn(item.width, 100, 650, 260), alt: String(item.alt || "Imported image").slice(0, 300) }));
    return { ...normalized, freeTexts, images };
  });
  return { id: crypto.randomUUID(), title: String(source.title || "Imported book").slice(0, 120), color: validHex(String(source.color || "")) ? String(source.color) : bookColors[0], borderColor: validHex(String(source.borderColor || "")) ? String(source.borderColor) : "#2f2d2a", pages, updatedAt: now, important: Boolean(source.important), pageNumbers: Boolean(source.pageNumbers) };
}
function cleanName(value: string) { return (value || "Untitled").replace(/[\\/:*?\"<>|]/g, "-"); }
function validHex(value: string) { return /^#[0-9a-f]{6}$/i.test(value.trim()); }
function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}
function download(name: string, content: string, type: string) { downloadBlob(name, new Blob([content], { type })); }
function downloadDataUrl(name: string, url: string) { const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); }
function shortDate(value: number) { return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function prepareImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.onload = () => {
      const image = new Image(); image.onerror = () => reject(new Error("Unsupported image."));
      image.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/webp", .8));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

export default function PenstylApp() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showStartupMessage, setShowStartupMessage] = useState(false);
  const [finishingOAuth, setFinishingOAuth] = useState(false);
  const [authError, setAuthError] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBookId, setActiveBookId] = useState("");
  const [activePageId, setActivePageId] = useState("");
  const [screen, setScreen] = useState<"library" | "book">("library");
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"title" | "body">("body");
  const [voiceLanguage, setVoiceLanguage] = useState("en-US");
  const [voiceError, setVoiceError] = useState("");
  const [voiceEngine, setVoiceEngine] = useState<"idle" | "loading" | "local" | "browser">("idle");
  const [activeMicLabel, setActiveMicLabel] = useState("");
  const [dictationDraft, setDictationDraft] = useState("");
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState("");
  const [micLoading, setMicLoading] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [dragPageId, setDragPageId] = useState("");
  const [dragTextId, setDragTextId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareError, setShareError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [sharePending, setSharePending] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => fullDate());
  const [newPageMenu, setNewPageMenu] = useState(false);
  const [pageMenu, setPageMenu] = useState<{ pageId: string; x: number; y: number } | null>(null);
  const [dragImageId, setDragImageId] = useState("");
  const [replaceImageId, setReplaceImageId] = useState("");
  const [selectedImageId, setSelectedImageId] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ kind: "book" | "page"; id: string; title: string } | null>(null);
  const [appearanceTarget, setAppearanceTarget] = useState<Book | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "book" | "page"; id: string; title: string } | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [appNotice, setAppNotice] = useState("");
  const [pendingFont, setPendingFont] = useState("");
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const activeFormatSpanRef = useRef<HTMLSpanElement | null>(null);
  const lastRichTargetRef = useRef<"title" | "body">("body");
  const shareCacheRef = useRef(new Map<string, { updatedAt: number; url: string }>());
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bookImportRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const dictationDraftRef = useRef("");
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const localModelRef = useRef<any>(null);
  const localRecognizerRef = useRef<any>(null);
  const localProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const localSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const localDiscardRef = useRef(false);
  const recognitionModeRef = useRef<"idle" | "local" | "browser">("idle");
  const loadedUserIdRef = useRef("");
  const saveGenerationRef = useRef(0);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const lastSavedAtRef = useRef(0);
  const fontChangeRef = useRef(0);

  useEffect(() => () => { localModelRef.current?.terminate?.(); }, []);

  useEffect(() => {
    if (!mobileToolsOpen) return;
    const closeTools = (event: KeyboardEvent) => event.key === "Escape" && setMobileToolsOpen(false);
    window.addEventListener("keydown", closeTools);
    return () => window.removeEventListener("keydown", closeTools);
  }, [mobileToolsOpen]);

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    const applySession = (next: Session | null) => {
      const nextUserId = next?.user.id || "";
      if (loadedUserIdRef.current !== nextUserId) {
        loadedUserIdRef.current = ""; setReady(false); setCloudReady(false); setBooks([]); setActiveBookId(""); setActivePageId(""); setScreen("library");
      }
      setSession(next);
      setProfile(next ? { name: next.user.user_metadata?.full_name || next.user.user_metadata?.name || next.user.email?.split("@")[0] || "Writer", email: next.user.email || "", avatar: next.user.user_metadata?.avatar_url || next.user.user_metadata?.picture || "" } : null);
      setAuthReady(true);
    };
    supabase.auth.getSession().then(({ data, error }) => { if (error) setAuthError(error.message); applySession(data.session); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => applySession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const userId = session?.user.id;
    if (!userId) { loadedUserIdRef.current = ""; setCloudReady(false); setReady(true); return; }
    let cancelled = false;
    const loadWorkspace = async () => {
      const forceLibraryAfterLogin = sessionStorage.getItem("penstyl-oauth-pending") === "1" || new URLSearchParams(window.location.search).has("code") || /(?:^|[#&])access_token=/.test(window.location.hash);
      setReady(false);
      setCloudReady(false);
      let localRaw = localStorage.getItem(workspaceKey(userId));
      let localLocationRaw = localStorage.getItem(locationKey(userId));
      let migratedLegacy = false;
      if (!localRaw) {
        localRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
        localLocationRaw = localStorage.getItem(LEGACY_LOCATION_KEY);
        migratedLegacy = Boolean(localRaw);
      }
      let cached: SavedWorkspace | null = null;
      let cachedLocation: { screen?: "library" | "book"; activeBookId?: string; activePageId?: string } | null = null;
      try { if (localRaw) cached = JSON.parse(localRaw); if (localLocationRaw) cachedLocation = JSON.parse(localLocationRaw); } catch { cached = null; cachedLocation = null; }
      const applyWorkspace = (saved: SavedWorkspace, location = cachedLocation) => {
        lastSavedAtRef.current = Math.max(lastSavedAtRef.current, saved.savedAt || 0);
        const normalizedBooks = (saved.books || []).map((book) => { const pages = (book.pages || []).map(normalizePage); return { ...book, pages: pages.length ? pages : [createPage("Page 1")] }; });
        const requestedBookId = location?.activeBookId ?? saved.activeBookId ?? "";
        const selectedBook = normalizedBooks.find((book) => book.id === requestedBookId);
        const requestedPageId = location?.activePageId ?? saved.activePageId ?? "";
        const selectedPageId = selectedBook?.pages.some((page) => page.id === requestedPageId) ? requestedPageId : selectedBook?.pages[0]?.id || "";
        setBooks(normalizedBooks); setActiveBookId(forceLibraryAfterLogin ? "" : selectedBook?.id || ""); setActivePageId(forceLibraryAfterLogin ? "" : selectedPageId);
        setScreen(forceLibraryAfterLogin ? "library" : selectedBook && (location?.screen ?? saved.screen) === "book" ? "book" : "library"); setDark(Boolean(saved.dark));
      };
      if (cached) { applyWorkspace(cached); loadedUserIdRef.current = userId; setReady(true); }
      let remote: SavedWorkspace | null = null;
      try {
        const response = await fetch("/api/workspace", { headers: { authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
        if (response.ok) { const result = await response.json(); if (Array.isArray(result?.books)) remote = result; }
      } catch {}
      if (cancelled) return;
      if (remote && (!cached || (remote.savedAt || 0) > (cached.savedAt || 0))) applyWorkspace(remote, cachedLocation || undefined);
      else if (!cached && !remote) { setBooks([]); setActiveBookId(""); setActivePageId(""); setScreen("library"); }
      loadedUserIdRef.current = userId;
      if (migratedLegacy && cached) {
        localStorage.setItem(workspaceKey(userId), JSON.stringify(cached));
        if (cachedLocation) localStorage.setItem(locationKey(userId), JSON.stringify(cachedLocation));
        localStorage.removeItem(LEGACY_STORAGE_KEY); localStorage.removeItem(LEGACY_LOCATION_KEY);
      }
      setCloudReady(true); setReady(true);
    };
    loadWorkspace();
    return () => { cancelled = true; };
  }, [authReady, session?.user.id]);

  useEffect(() => { if (ready && authReady) setShowStartupMessage(false); }, [ready, authReady]);

  useEffect(() => {
    const isOAuthReturn = sessionStorage.getItem("penstyl-oauth-pending") === "1" || new URLSearchParams(window.location.search).has("code") || /(?:^|[#&])access_token=/.test(window.location.hash);
    if (!isOAuthReturn) return;
    setFinishingOAuth(true); setShowStartupMessage(true);
    const timer = window.setTimeout(() => {
      setFinishingOAuth(false); sessionStorage.removeItem("penstyl-oauth-pending"); delete document.documentElement.dataset.penstyleOauthReturn;
      const cleanUrl = new URL(window.location.href); cleanUrl.searchParams.delete("code"); if (/(?:^|[#&])access_token=/.test(cleanUrl.hash)) cleanUrl.hash = "";
      window.history.replaceState(window.history.state, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    }, 1100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || !session?.user.id || loadedUserIdRef.current !== session.user.id) return;
    const userId = session.user.id;
    const savedAt = Math.max(Date.now(), lastSavedAtRef.current + 1); lastSavedAtRef.current = savedAt;
    const data: SavedWorkspace = { profile, books, activeBookId, activePageId, screen, dark, savedAt };
    localStorage.setItem(workspaceKey(userId), JSON.stringify(data));
    localStorage.setItem(locationKey(userId), JSON.stringify({ screen, activeBookId, activePageId, dark }));
    if (!cloudReady) return;
    const generation = ++saveGenerationRef.current;
    const timer = window.setTimeout(() => {
      if (generation !== saveGenerationRef.current) return;
      saveChainRef.current = saveChainRef.current.then(async () => {
        const response = await fetch("/api/workspace", { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(data) });
        if (response.ok) localStorage.removeItem(LEGACY_STORAGE_KEY);
      }).catch(() => undefined);
    }, 800);
    return () => clearTimeout(timer);
  }, [profile, books, activeBookId, activePageId, screen, dark, ready, cloudReady, session?.user.id, session?.access_token]);

  useEffect(() => {
    if (!profile || !ready || books.length) return;
    const legacy = localStorage.getItem("penstyl-pages");
    if (!legacy) return;
    try {
      const legacyPages = JSON.parse(legacy).map(normalizePage);
      const book: Book = { id: crypto.randomUUID(), title: "Imported notes", color: "#345174", borderColor: "#24364c", pages: legacyPages, updatedAt: Date.now() };
      setBooks([book]); setActiveBookId(book.id); setActivePageId(book.pages[0]?.id || ""); localStorage.removeItem("penstyl-pages");
    } catch {}
  }, [profile, ready, books.length]);

  const activeBook = books.find((book) => book.id === activeBookId);
  const activePage = activeBook?.pages.find((page) => page.id === activePageId) || activeBook?.pages[0];
  const hasDictatedText = Boolean(activePage && (activePage.titleHtml.includes("data-penstyl-dictation") || activePage.contentHtml.includes("data-penstyl-dictation")));
  const filteredPages = useMemo(() => activeBook?.pages.filter((page) => `${page.title} ${page.content}`.toLowerCase().includes(query.toLowerCase())) || [], [activeBook, query]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && activePage && editor.innerHTML !== activePage.contentHtml) editor.innerHTML = activePage.contentHtml;
    const title = titleRef.current;
    if (title && activePage && title.innerHTML !== activePage.titleHtml) title.innerHTML = activePage.titleHtml;
  // Returning from the library remounts both contentEditable elements while the
  // selected page data stays identical. Include the screen so saved HTML is
  // restored into those fresh DOM nodes every time the book is reopened.
  }, [screen, activePage?.id, activePage?.contentHtml, activePage?.titleHtml]);
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDate(fullDate()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!voiceOpen) return;
    let cancelled = false;
    const loadMicrophones = async () => {
      if (!navigator.mediaDevices?.enumerateDevices) { setVoiceError("This browser cannot list audio input devices."); return; }
      setMicLoading(true);
      try {
        const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true }); permissionStream.getTracks().forEach((track) => track.stop());
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput");
        if (cancelled) return; setMicDevices(devices);
        const remembered = localStorage.getItem("penstyl-microphone") || "";
        setSelectedMicId(devices.some((device) => device.deviceId === remembered) ? remembered : devices[0]?.deviceId || "");
      } catch (error) { if (!cancelled) setVoiceError(error instanceof DOMException && error.name === "NotAllowedError" ? "Microphone permission was blocked. Allow microphone access in the browser address bar." : "No microphone could be opened."); }
      finally { if (!cancelled) setMicLoading(false); }
    };
    void loadMicrophones();
    const refresh = () => void loadMicrophones(); navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => { cancelled = true; navigator.mediaDevices?.removeEventListener?.("devicechange", refresh); };
  }, [voiceOpen]);
  useEffect(() => {
    const trackSelection = () => {
      const editor = editorRef.current; const title = titleRef.current; const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      const target = editor?.contains(range.commonAncestorContainer) ? "body" : title?.contains(range.commonAncestorContainer) ? "title" : null;
      if (!target) return;
      lastRichTargetRef.current = target;
      const formatted = activeFormatSpanRef.current;
      if (formatted && !formatted.contains(range.commonAncestorContainer)) activeFormatSpanRef.current = null;
      savedSelectionRef.current = range.cloneRange();
    };
    document.addEventListener("selectionchange", trackSelection);
    return () => document.removeEventListener("selectionchange", trackSelection);
  }, []);
  useEffect(() => {
    if (!activePageId || !canvasRef.current) return;
    canvasRef.current.scrollTop = Number(localStorage.getItem(`penstyl-scroll-${activePageId}`) || 0);
  }, [activePageId]);
  useEffect(() => {
    if (!pageMenu) return;
    const closeMenu = () => setPageMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && closeMenu();
    window.addEventListener("click", closeMenu); window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("click", closeMenu); window.removeEventListener("keydown", closeOnEscape); };
  }, [pageMenu]);
  useEffect(() => {
    if (!selectedImageId) return;
    const clearImageSelection = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest?.(".page-image")) setSelectedImageId("");
    };
    document.addEventListener("pointerdown", clearImageSelection);
    return () => document.removeEventListener("pointerdown", clearImageSelection);
  }, [selectedImageId]);

  const updateBook = (bookId: string, updater: (book: Book) => Book) => setBooks((current) => current.map((book) => book.id === bookId ? updater(book) : book));
  const updatePage = (updates: Partial<NotePage>) => {
    if (!activeBook || !activePage) return;
    updateBook(activeBook.id, (book) => ({ ...book, updatedAt: Date.now(), pages: book.pages.map((page) => page.id === activePage.id ? { ...page, ...updates, updatedAt: Date.now() } : page) }));
  };
  const updateSettings = (updates: Partial<PageSettings>) => activePage && updatePage({ settings: { ...activePage.settings, ...updates } });
  const changeWritingFont = async (font: string) => {
    if (!activeBook || !activePage || ![...handwritingFonts, ...computerFonts].includes(font)) return;
    const generation = ++fontChangeRef.current;
    const bookId = activeBook.id;
    const pageId = activePage.id;
    setPendingFont(font);
    try {
      await document.fonts.load(`400 ${activePage.settings.fontSize}px "${font}"`);
    } catch {
      // A failed web-font request should not leave the font picker locked.
    }
    if (generation !== fontChangeRef.current) return;
    updateBook(bookId, (book) => ({
      ...book,
      updatedAt: Date.now(),
      pages: book.pages.map((page) => page.id === pageId ? { ...page, updatedAt: Date.now(), settings: { ...page.settings, font } } : page),
    }));
    setPendingFont("");
  };

  useEffect(() => {
    fontChangeRef.current += 1;
    setPendingFont("");
  }, [activePageId]);

  const rememberSelection = () => {
    const editor = editorRef.current; const title = titleRef.current; const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor?.contains(range.commonAncestorContainer)) { lastRichTargetRef.current = "body"; savedSelectionRef.current = range.cloneRange(); }
    else if (title?.contains(range.commonAncestorContainer)) { lastRichTargetRef.current = "title"; savedSelectionRef.current = range.cloneRange(); }
  };
  const syncRichTarget = (target: "title" | "body" = lastRichTargetRef.current) => {
    if (target === "title") {
      const title = titleRef.current; if (!title) return;
      updatePage({ title: title.innerText.replace(/\n/g, " "), titleHtml: sanitizeImportedHtml(title.innerHTML, title.innerText, true) });
    } else {
      const editor = editorRef.current; if (!editor) return;
      updatePage({ content: editor.innerText.replace(/\n{3,}/g, "\n\n"), contentHtml: sanitizeImportedHtml(editor.innerHTML, editor.innerText, true) });
    }
  };
  const applyBodyOrSelectionStyle = (property: "fontSize" | "color", value: string) => {
    const editor = editorRef.current; const title = titleRef.current; const range = savedSelectionRef.current;
    const activeSpan = activeFormatSpanRef.current;
    const activeTarget = activeSpan && title?.contains(activeSpan) ? "title" : "body";
    const rangeTarget = range && title?.contains(range.commonAncestorContainer) ? "title" : "body";
    const activeContainer = activeTarget === "title" ? title : editor;
    const rangeContainer = rangeTarget === "title" ? title : editor;
    if (activeContainer && activeSpan && activeContainer.contains(activeSpan)) {
      activeSpan.style[property] = value; syncRichTarget(activeTarget); return;
    }
    if (rangeContainer && range && !range.collapsed && rangeContainer.contains(range.commonAncestorContainer)) {
      const span = document.createElement("span"); span.style[property] = value;
      span.appendChild(range.extractContents()); range.insertNode(span);
      const styledRange = document.createRange(); styledRange.selectNodeContents(span);
      const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(styledRange);
      activeFormatSpanRef.current = span; savedSelectionRef.current = styledRange.cloneRange(); syncRichTarget(rangeTarget);
      return;
    }
    if (property === "fontSize") updateSettings({ fontSize: Number.parseInt(value, 10) });
    else updateSettings({ ink: value });
  };
  const runRichCommand = (command: "underline" | "justifyLeft" | "justifyCenter" | "justifyRight" | "insertParagraph") => {
    let target = lastRichTargetRef.current;
    let container = target === "title" ? titleRef.current : editorRef.current;
    let range = savedSelectionRef.current;
    if (command === "insertParagraph" && target === "title") { target = "body"; container = editorRef.current; range = null; }
    if (!container) return;
    container.focus();
    const selection = window.getSelection(); selection?.removeAllRanges();
    if (range && container.contains(range.commonAncestorContainer)) selection?.addRange(range);
    else {
      const end = document.createRange(); end.selectNodeContents(container); end.collapse(false); selection?.addRange(end);
    }
    document.execCommand(command, false);
    lastRichTargetRef.current = target;
    rememberSelection(); syncRichTarget(target);
  };

  const startOAuth = async (provider: Provider) => {
    setAuthError("");
    if (!supabase) { setAuthError("Supabase needs a publishable key before social sign-in can start."); return; }
    sessionStorage.setItem("penstyl-oauth-pending", "1");
    let { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    if (error && provider === "x") ({ error } = await supabase.auth.signInWithOAuth({ provider: "twitter", options: { redirectTo: window.location.origin } }));
    if (error) { sessionStorage.removeItem("penstyl-oauth-pending"); setAuthError(error.message); }
  };

  const signOut = async () => {
    setLogoutConfirmOpen(false); sessionStorage.removeItem("penstyl-oauth-pending");
    try {
      if (session) {
        const savedAt = Math.max(Date.now(), lastSavedAtRef.current + 1); lastSavedAtRef.current = savedAt;
        const data: SavedWorkspace = { profile, books, activeBookId, activePageId, screen, dark, savedAt };
        const response = await fetch("/api/workspace", { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(data) });
        if (!response.ok) throw new Error("save failed");
        localStorage.removeItem(workspaceKey(session.user.id)); localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
      setReady(false); setCloudReady(false); setBooks([]); setActiveBookId(""); setActivePageId(""); setScreen("library"); loadedUserIdRef.current = "";
      if (supabase) await supabase.auth.signOut(); setProfile(null); setSession(null); setReady(true);
    } catch { setAppNotice("Your books could not be secured online yet, so Penstyle kept you signed in. Check your connection and try again."); }
  };

  const shareItem = async (kind: "book" | "page", data: Book | NotePage) => {
    if (!session) { setShareError("Sign in again before sharing."); return; }
    const cacheKey = `${kind}:${data.id}`; const cached = shareCacheRef.current.get(cacheKey);
    if (cached?.updatedAt === data.updatedAt) { setShareError(""); setShareUrl(cached.url); setSharePending(false); return; }
    setSharing(true); setSharePending(true); setShareError(""); setShareUrl("");
    try {
      const response = await fetch("/api/share", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ kind, data }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not create link.");
      const publicUrl = new URL(result.url, window.location.origin).toString();
      shareCacheRef.current.set(cacheKey, { updatedAt: data.updatedAt, url: publicUrl }); setShareUrl(publicUrl);
    } catch (error) { setShareError(error instanceof Error ? error.message : "Could not create link."); }
    finally { setSharing(false); setSharePending(false); }
  };

  const createBook = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const title = String(form.get("title") || "Untitled book"); const customColor = String(form.get("customColor") || "").trim(); const customBorder = String(form.get("borderColor") || "").trim(); const color = validHex(customColor) ? customColor : String(form.get("color") || bookColors[0]);
    const firstPage = createPage("Page 1"); const book: Book = { id: crypto.randomUUID(), title, color, borderColor: validHex(customBorder) ? customBorder : "#2f2d2a", pages: [firstPage], updatedAt: Date.now() };
    setBooks((current) => [book, ...current]); setActiveBookId(book.id); setActivePageId(firstPage.id); setNewBookOpen(false); setScreen("book");
  };
  const openPenFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pen")) { setAppNotice("Choose a Penstyle .pen book file."); return; }
    if (file.size > 35 * 1024 * 1024) { setAppNotice("That book is larger than the 35 MB import limit."); return; }
    try {
      const imported = importableBook(JSON.parse(await file.text()));
      setBooks((current) => [imported, ...current]); setActiveBookId(imported.id); setActivePageId(imported.pages[0].id); setScreen("book");
      setAppNotice(`Imported “${imported.title}” — it is ready to edit.`);
    } catch (error) { setAppNotice(error instanceof Error ? error.message : "That .pen file could not be opened."); }
  };
  const importPenBook = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (file) await openPenFile(file);
  };
  useEffect(() => {
    const launchQueue = (window as any).launchQueue;
    if (!launchQueue?.setConsumer) return;
    launchQueue.setConsumer(async (launch: any) => { const handle = launch.files?.[0]; if (handle?.getFile) await openPenFile(await handle.getFile()); });
  }, []);
  const openBook = (book: Book) => { const rememberedPageId = book.id === activeBookId && book.pages.some((page) => page.id === activePageId) ? activePageId : ""; setActiveBookId(book.id); setActivePageId(rememberedPageId || book.pages[0]?.id || ""); setScreen("book"); };
  const openLibrary = () => { syncRichTarget("title"); syncRichTarget("body"); setScreen("library"); };
  const toggleImportant = (book: Book) => updateBook(book.id, (current) => ({ ...current, important: !current.important, updatedAt: Date.now() }));
  const renameBook = (book: Book) => setRenameTarget({ kind: "book", id: book.id, title: book.title });
  const changeBookAppearance = (color: string, borderColor: string) => {
    if (!appearanceTarget || !validHex(color) || !validHex(borderColor)) return;
    updateBook(appearanceTarget.id, (book) => ({ ...book, color, borderColor, updatedAt: Date.now() }));
    setAppearanceTarget(null);
  };
  const deleteBook = (book: Book) => setDeleteTarget({ kind: "book", id: book.id, title: book.title });
  const addPage = (paper: PaperType = "ruled") => {
    if (!activeBook) return; const page = createPage(`Page ${activeBook.pages.length + 1}`, paper);
    updateBook(activeBook.id, (book) => ({ ...book, pages: [...book.pages, page], updatedAt: Date.now() })); setActivePageId(page.id); setNewPageMenu(false);
  };
  const deletePage = (pageId: string, ask = true) => {
    if (!activeBook || activeBook.pages.length === 1) return;
    const page = activeBook.pages.find((item) => item.id === pageId);
    if (ask) { setDeleteTarget({ kind: "page", id: pageId, title: page?.title || "this page" }); setPageMenu(null); return; }
    const next = activeBook.pages.filter((page) => page.id !== pageId); updateBook(activeBook.id, (book) => ({ ...book, pages: next, updatedAt: Date.now() }));
    if (pageId === activePageId) setActivePageId(next[0].id); setPageMenu(null);
  };
  const renamePage = (pageId: string) => {
    if (!activeBook) return; const page = activeBook.pages.find((item) => item.id === pageId); if (!page) return;
    setRenameTarget({ kind: "page", id: pageId, title: page.title }); setPageMenu(null);
  };
  const commitRename = (title: string) => {
    if (!renameTarget) return; const cleanTitle = title.trim(); if (!cleanTitle) return;
    if (renameTarget.kind === "book") updateBook(renameTarget.id, (book) => ({ ...book, title: cleanTitle, updatedAt: Date.now() }));
    else if (activeBook) updateBook(activeBook.id, (book) => ({ ...book, updatedAt: Date.now(), pages: book.pages.map((item) => item.id === renameTarget.id ? { ...item, title: cleanTitle, titleHtml: escapeHtml(cleanTitle), updatedAt: Date.now() } : item) }));
    setRenameTarget(null);
  };
  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "book") { setBooks((current) => current.filter((item) => item.id !== deleteTarget.id)); if (activeBookId === deleteTarget.id) { setActiveBookId(""); setActivePageId(""); setScreen("library"); } }
    else deletePage(deleteTarget.id, false);
    setDeleteTarget(null);
  };
  const duplicatePage = () => {
    if (!activeBook || !activePage) return; const copy = normalizePage({ ...activePage, id: crypto.randomUUID(), title: `${activePage.title} copy`, updatedAt: Date.now(), freeTexts: activePage.freeTexts.map((block) => ({ ...block, id: crypto.randomUUID() })), images: activePage.images.map((item) => ({ ...item, id: crypto.randomUUID() })) });
    updateBook(activeBook.id, (book) => ({ ...book, pages: [...book.pages, copy], updatedAt: Date.now() })); setActivePageId(copy.id);
  };
  const movePage = (pageId: string, targetId: string) => {
    if (!activeBook || pageId === targetId) return;
    const pages = [...activeBook.pages]; const from = pages.findIndex((page) => page.id === pageId); const to = pages.findIndex((page) => page.id === targetId);
    if (from < 0 || to < 0) return; const [moved] = pages.splice(from, 1); pages.splice(to, 0, moved); updateBook(activeBook.id, (book) => ({ ...book, pages, updatedAt: Date.now() }));
  };
  const nudgePage = (pageId: string, direction: -1 | 1) => {
    if (!activeBook) return; const index = activeBook.pages.findIndex((page) => page.id === pageId); const target = activeBook.pages[index + direction]; if (target) movePage(pageId, target.id);
  };
  const togglePageNumbers = () => activeBook && updateBook(activeBook.id, (book) => ({ ...book, pageNumbers: !book.pageNumbers, updatedAt: Date.now() }));

  const addTextBox = () => {
    if (!activePage) return; const block: FreeText = { id: crypto.randomUUID(), text: "Type here", x: 52, y: 250, color: activePage.settings.ink, font: activePage.settings.font, size: activePage.settings.fontSize };
    updatePage({ freeTexts: [...activePage.freeTexts, block] });
  };
  const updateTextBox = (id: string, updates: Partial<FreeText>) => activePage && updatePage({ freeTexts: activePage.freeTexts.map((block) => block.id === id ? { ...block, ...updates } : block) });
  const removeTextBox = (id: string) => activePage && updatePage({ freeTexts: activePage.freeTexts.filter((block) => block.id !== id) });
  const updateImage = (id: string, updates: Partial<PageImage>) => activePage && updatePage({ images: activePage.images.map((item) => item.id === id ? { ...item, ...updates } : item) });
  const openImagePicker = (imageId = "") => { setReplaceImageId(imageId); imageInputRef.current?.click(); };
  const importImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !activePage) return;
    try {
      const src = await prepareImage(file);
      if (replaceImageId) { updateImage(replaceImageId, { src, alt: file.name }); setSelectedImageId(replaceImageId); }
      else { const id = crypto.randomUUID(); updatePage({ images: [...activePage.images, { id, src, x: 50, y: 230, width: 260, alt: file.name }] }); setSelectedImageId(id); }
      setReplaceImageId("");
    } catch (error) { setAppNotice(error instanceof Error ? error.message : "Could not import image."); }
  };
  const removeImage = (id: string) => {
    if (!activePage) return;
    updatePage({ images: activePage.images.filter((item) => item.id !== id) });
    if (selectedImageId === id) setSelectedImageId("");
  };
  const dropCanvasObject = (event: React.DragEvent<HTMLElement>) => {
    if (!dragTextId && !dragImageId) return; event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(5, Math.min(88, ((event.clientX - rect.left) / rect.width) * 100)); const y = Math.max(150, event.clientY - rect.top);
    if (dragTextId) updateTextBox(dragTextId, { x, y });
    if (dragImageId) updateImage(dragImageId, { x, y });
    setDragTextId(""); setDragImageId("");
  };

  const appendVoiceText = (target: "title" | "body", transcript: string) => {
    const text = transcript.trim().replace(/\bnew paragraph\b/gi, "\n\n").replace(/\bnew line\b/gi, "\n").replace(/\bfull stop\b/gi, ".").replace(/\bcomma\b/gi, ",");
    if (!text) return;
    const dictationId = crypto.randomUUID();
    setBooks((current) => current.map((book) => book.id !== activeBookId ? book : { ...book, updatedAt: Date.now(), pages: book.pages.map((page) => {
      if (page.id !== activePageId) return page;
      if (target === "title") { const addition = text.replace(/\s*\n+\s*/g, " "); const prefix = page.title.trim() ? " " : ""; const title = `${page.title}${prefix}${addition}`; return { ...page, title, titleHtml: `${page.titleHtml}<span data-penstyl-dictation="${dictationId}">${prefix}${escapeHtml(addition)}</span>`, updatedAt: Date.now() }; }
      const prefix = page.content.trim() ? " " : ""; return { ...page, content: `${page.content}${prefix}${text}`, contentHtml: `${page.contentHtml}<span data-penstyl-dictation="${dictationId}">${prefix}${escapeHtml(text).replaceAll("\n", "<br>")}</span>`, updatedAt: Date.now() };
    }) }));
  };
  const updateVoiceDraftText = (target: "title" | "body", transcript: string) => {
    const text = transcript.trim().replace(/\bnew paragraph\b/gi, "\n\n").replace(/\bnew line\b/gi, "\n").replace(/\bfull stop\b/gi, ".").replace(/\bcomma\b/gi, ",");
    setBooks((current) => current.map((book) => book.id !== activeBookId ? book : { ...book, updatedAt: Date.now(), pages: book.pages.map((page) => {
      if (page.id !== activePageId) return page;
      const root = document.createElement("div"); root.innerHTML = target === "title" ? page.titleHtml : page.contentHtml;
      root.querySelectorAll("[data-penstyl-dictation-draft]").forEach((node) => node.remove());
      if (text) {
        const prefix = root.innerText.trim() ? " " : ""; const span = document.createElement("span");
        span.dataset.penstylDictation = crypto.randomUUID(); span.dataset.penstylDictationDraft = "true";
        span.innerHTML = `${prefix}${escapeHtml(target === "title" ? text.replace(/\s*\n+\s*/g, " ") : text).replaceAll("\n", "<br>")}`; root.append(span);
      }
      const plain = root.innerText.replace(/\n{3,}/g, "\n\n");
      return target === "title" ? { ...page, title: plain.replace(/\n/g, " "), titleHtml: root.innerHTML, updatedAt: Date.now() } : { ...page, content: plain, contentHtml: root.innerHTML, updatedAt: Date.now() };
    }) }));
  };
  const clearDictatedText = () => {
    stopVoice(true);
    dictationDraftRef.current = ""; setDictationDraft("");
    setBooks((current) => current.map((book) => book.id !== activeBookId ? book : { ...book, updatedAt: Date.now(), pages: book.pages.map((page) => {
      if (page.id !== activePageId) return page;
      const clean = (html: string) => { const root = document.createElement("div"); root.innerHTML = html; root.querySelectorAll("[data-penstyl-dictation]").forEach((node) => node.remove()); return { html: root.innerHTML, text: root.innerText.replace(/\n{3,}/g, "\n\n").trimEnd() }; };
      const title = clean(page.titleHtml); const body = clean(page.contentHtml);
      return { ...page, title: title.text.replace(/\n/g, " ") || "", titleHtml: title.html, content: body.text, contentHtml: body.html, updatedAt: Date.now() };
    }) }));
  };
  const stopMicStream = () => {
    if (meterFrameRef.current) cancelAnimationFrame(meterFrameRef.current); meterFrameRef.current = null;
    micStreamRef.current?.getTracks().forEach((track) => track.stop()); micStreamRef.current = null;
    void audioContextRef.current?.close(); audioContextRef.current = null; setMicLevel(0);
  };
  const activateSelectedMicrophone = async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone input is unavailable in this browser.");
    stopMicStream();
    const audio: MediaTrackConstraints | boolean = selectedMicId ? { deviceId: { exact: selectedMicId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: { ideal: 16000 } } : { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: { ideal: 16000 } };
    const stream = await navigator.mediaDevices.getUserMedia({ audio }); micStreamRef.current = stream;
    const track = stream.getAudioTracks()[0]; setActiveMicLabel(track?.label || micDevices.find((device) => device.deviceId === selectedMicId)?.label || "System default microphone");
    const context = new AudioContext(); audioContextRef.current = context; const analyser = context.createAnalyser(); analyser.fftSize = 256; context.createMediaStreamSource(stream).connect(analyser); const levels = new Uint8Array(analyser.frequencyBinCount);
    let lastMeterUpdate = 0; const updateMeter = (time = 0) => { if (time - lastMeterUpdate > 80) { analyser.getByteFrequencyData(levels); const average = levels.reduce((sum, value) => sum + value, 0) / levels.length; setMicLevel(Math.min(100, Math.round(average * 1.7))); lastMeterUpdate = time; } meterFrameRef.current = requestAnimationFrame(updateMeter); }; updateMeter();
    return stream;
  };
  const stopLocalRecognition = (discard = false) => {
    localDiscardRef.current = discard;
    localProcessorRef.current && (localProcessorRef.current.onaudioprocess = null); localProcessorRef.current?.disconnect(); localProcessorRef.current = null;
    localSourceRef.current?.disconnect(); localSourceRef.current = null;
    const recognizer = localRecognizerRef.current; localRecognizerRef.current = null;
    if (recognizer) { if (!discard) recognizer.retrieveFinalResult(); window.setTimeout(() => recognizer.remove(), discard ? 0 : 750); }
    recognitionModeRef.current = "idle"; setListening(false); setVoiceEngine("idle"); stopMicStream();
  };
  const stopVoice = (discard = false) => {
    if (recognitionModeRef.current === "local") stopLocalRecognition(discard);
    else { if (discard) { dictationDraftRef.current = ""; setDictationDraft(""); } recognitionRef.current?.stop(); }
  };
  const startLocalRecognition = async (stream: MediaStream) => {
    setVoiceEngine("loading"); localDiscardRef.current = false;
    const { createModel } = await import("vosk-browser");
    const modelUrl = "https://raw.githubusercontent.com/70nee/Penstyle/main/public/models/vosk-model-small-en-us-0.15.tar.gz";
    const model = localModelRef.current || await createModel(modelUrl, -1); localModelRef.current = model;
    const context = audioContextRef.current; if (!context) throw new Error("The selected microphone audio could not be prepared."); if (context.state === "suspended") await context.resume();
    const recognizer = new model.KaldiRecognizer(context.sampleRate); localRecognizerRef.current = recognizer;
    recognizer.on("partialresult", (message: any) => { if (localDiscardRef.current) return; const partial = String(message.result?.partial || ""); updateVoiceDraftText(voiceTarget, partial); dictationDraftRef.current = partial; setDictationDraft(partial); });
    recognizer.on("result", (message: any) => { if (localDiscardRef.current) return; const text = String(message.result?.text || "").trim(); updateVoiceDraftText(voiceTarget, ""); dictationDraftRef.current = ""; setDictationDraft(""); if (text) appendVoiceText(voiceTarget, text); });
    recognizer.on("error", (message: any) => { setVoiceError(`Selected-microphone recognition stopped: ${message.error || "recognizer error"}.`); stopLocalRecognition(true); });
    const source = context.createMediaStreamSource(stream); const processor = context.createScriptProcessor(4096, 1, 1); localSourceRef.current = source; localProcessorRef.current = processor;
    processor.onaudioprocess = (event) => { event.outputBuffer.getChannelData(0).fill(0); try { recognizer.acceptWaveform(event.inputBuffer); } catch {} };
    source.connect(processor); processor.connect(context.destination); recognitionModeRef.current = "local"; setVoiceEngine("local"); setListening(true);
  };
  const startVoice = async () => {
    if (listening) { stopVoice(); return; }
    dictationDraftRef.current = ""; setDictationDraft(""); setVoiceError(""); setMicLoading(true);
    try {
      const stream = await activateSelectedMicrophone();
      if (voiceLanguage.startsWith("en")) { await startLocalRecognition(stream); return; }
      const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!Recognition) throw new Error("This language needs Chrome or Edge browser recognition.");
      const recognition = new Recognition(); recognition.continuous = true; recognition.interimResults = true; recognition.maxAlternatives = 1; recognition.lang = voiceLanguage;
      if ("processLocally" in recognition) recognition.processLocally = false;
      recognition.onstart = () => { recognitionModeRef.current = "browser"; setVoiceEngine("browser"); setListening(true); };
      recognition.onend = () => {
        const remaining = dictationDraftRef.current.trim();
        if (remaining) { updateVoiceDraftText(voiceTarget, ""); appendVoiceText(voiceTarget, remaining); }
        dictationDraftRef.current = ""; setDictationDraft(""); recognitionModeRef.current = "idle"; setVoiceEngine("idle"); setListening(false); stopMicStream();
      };
      recognition.onerror = (event: any) => {
        updateVoiceDraftText(voiceTarget, ""); dictationDraftRef.current = ""; setDictationDraft(""); recognitionModeRef.current = "idle"; setVoiceEngine("idle"); setListening(false); stopMicStream();
        setVoiceError(event.error === "not-allowed" ? "Microphone permission was blocked. Allow microphone access, then try again." : event.error === "audio-capture" ? "The selected microphone could not be captured. Choose another input device." : event.error === "network" ? "Browser recognition is unavailable for this language. English uses Penstyle’s selected-microphone recognizer and works without this service." : event.error === "language-not-supported" ? "This browser does not support that dictation language." : event.error === "no-speech" ? "No speech was detected. Speak closer to the selected microphone and try again." : `Voice typing stopped: ${event.error || "unknown error"}.`);
      };
      recognition.onresult = (event: any) => {
        let finalText = ""; let interim = "";
        for (let index = event.resultIndex; index < event.results.length; index++) {
          const transcript = String(event.results[index][0]?.transcript || "").trim();
          if (!transcript) continue;
          if (event.results[index].isFinal) finalText += `${finalText ? " " : ""}${transcript}`;
          else interim += `${interim ? " " : ""}${transcript}`;
        }
        if (finalText) { updateVoiceDraftText(voiceTarget, ""); appendVoiceText(voiceTarget, finalText); }
        updateVoiceDraftText(voiceTarget, interim);
        dictationDraftRef.current = interim; setDictationDraft(interim);
      };
      recognitionRef.current = recognition; const audioTrack = stream.getAudioTracks()[0];
      try { recognition.start(audioTrack); } catch { recognition.start(); }
    } catch (error) { stopMicStream(); setVoiceError(error instanceof DOMException && error.name === "OverconstrainedError" ? "That microphone is no longer available. Select another input device." : error instanceof Error ? error.message : "Voice typing could not start."); }
    finally { setMicLoading(false); }
  };
  const closeVoice = () => { stopVoice(); setVoiceOpen(false); setVoiceError(""); };

  if (!ready || !authReady || finishingOAuth) return <div className={`app-loading ${showStartupMessage ? "show-message" : ""}`} role="status" aria-label="Loading Penstyle" aria-busy="true"><span>Opening your desk…</span></div>;
  if (!profile) return <LoginScreen configured={supabaseConfigured} error={authError} onProvider={startOAuth} />;
  if (screen === "library" || !activeBook || !activePage) return <><LibraryScreen profile={profile} books={books} dark={dark} setDark={setDark} onOpen={openBook} onDelete={deleteBook} onRename={renameBook} onAppearance={setAppearanceTarget} onShare={(book) => shareItem("book", book)} onToggleImportant={toggleImportant} newBookOpen={newBookOpen} setNewBookOpen={setNewBookOpen} onCreate={createBook} onImport={importPenBook} importRef={bookImportRef} onSignOut={() => setLogoutConfirmOpen(true)} /><ShareDialog url={shareUrl} error={shareError} pending={sharePending} close={() => { setShareUrl(""); setShareError(""); }} /><RenameDialog target={renameTarget} close={() => setRenameTarget(null)} submit={commitRename} /><BookAppearanceDialog book={appearanceTarget} close={() => setAppearanceTarget(null)} submit={changeBookAppearance} /><ConfirmDialog target={deleteTarget} close={() => setDeleteTarget(null)} confirm={confirmDelete} /><LogoutDialog open={logoutConfirmOpen} close={() => setLogoutConfirmOpen(false)} confirm={signOut} />{appNotice && <div className="notice" role="alert"><span>{appNotice}</span><button onClick={() => setAppNotice("")} aria-label="Dismiss message"><X size={14} /></button></div>}</>;

  return (
    <main className={`desk ${dark ? "dark" : ""}`}>
      <header className="desk-header">
        <div className="header-left"><button className="icon-btn mobile-only" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? "Close pages" : "Open pages"} aria-expanded={sidebarOpen}><Menu size={19} /></button><button className="back-btn" onClick={openLibrary} aria-label="Back to your books" title="Back to your books"><ArrowLeft size={20} /> Library</button><span className="header-rule" /><div className="book-identity"><span style={{ background: activeBook.color }} /><input value={activeBook.title} onChange={(event) => updateBook(activeBook.id, (book) => ({ ...book, title: event.target.value, updatedAt: Date.now() }))} aria-label="Book title" title="Click to rename this book" /></div></div>
        <div className="header-actions"><button className="icon-action tooltip-action" onClick={() => shareItem("page", activePage)} disabled={sharing} aria-label={sharing ? "Preparing share link" : "Share page"} data-tooltip={sharing ? "Preparing share link" : "Share page"}>{sharing ? <LoaderCircle className="spin" size={18} /> : <Share2 size={18} />}</button><button className={`icon-action tooltip-action voice-action ${listening ? "active listening" : ""}`} onClick={() => listening ? stopVoice() : setVoiceOpen((open) => !open)} aria-label={listening ? "Stop dictation" : "Voice typing"} aria-pressed={listening} data-tooltip={listening ? "Stop dictation" : "Voice typing"}>{listening ? <MicOff size={19} /> : <Mic size={19} />}</button><button className="icon-action tooltip-action" onClick={() => setDark(!dark)} aria-label={dark ? "Switch to light appearance" : "Switch to dark appearance"} aria-pressed={dark} data-tooltip={dark ? "Light appearance" : "Dark appearance"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button><button className={`icon-action tooltip-action style-rgb ${settingsOpen ? "active" : ""}`} onClick={() => setSettingsOpen(!settingsOpen)} aria-label="Page style" aria-pressed={settingsOpen} data-tooltip="Page style"><Palette size={18} /></button><button className="plain-btn read-trigger" onClick={() => setReaderOpen(true)} aria-label={`Read ${activeBook.title}`}><BookOpen size={17} aria-hidden="true" /><span>Read</span></button><button className="plain-btn export-trigger" onClick={() => setExportOpen(true)} aria-label="Export"><Download size={17} /><span>Export</span></button></div>
      </header>

      <div className="desk-body">
        <button className={`mobile-sidebar-scrim ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} aria-label="Close pages" tabIndex={sidebarOpen ? 0 : -1} />
        <aside className={`page-sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-top"><div><strong>Pages</strong><span>{activeBook.pages.length}</span></div><div className="sidebar-top-actions"><div className="new-page-control"><button onClick={() => setNewPageMenu(!newPageMenu)} aria-expanded={newPageMenu}><Plus size={17} /> New page</button>{newPageMenu && <div className="new-page-menu"><strong>Choose page style</strong>{(["ruled","dot-ruled","grid","dots","blank","cornell"] as PaperType[]).map((paper) => <button key={paper} onClick={() => addPage(paper)}><span className={`mini-paper ${paper}`} />{paper.replace("-", " ")}</button>)}</div>}</div><button className="mobile-sidebar-close mobile-only" onClick={() => setSidebarOpen(false)} aria-label="Close pages"><X size={18} /></button></div></div>
          <label className="sidebar-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a page" /></label>
          <div className="sortable-pages">
            {filteredPages.map((page) => <div key={page.id} className={`sortable-page ${page.id === activePage.id ? "active" : ""}`} draggable onContextMenu={(event) => { event.preventDefault(); setPageMenu({ pageId: page.id, x: Math.min(window.innerWidth - 190, event.clientX), y: Math.min(window.innerHeight - 90, event.clientY) }); }} onDragStart={() => setDragPageId(page.id)} onDragEnd={() => setDragPageId("")} onDragOver={(event) => event.preventDefault()} onDrop={() => { movePage(dragPageId, page.id); setDragPageId(""); }}>
              <button className="drag-handle" aria-label={`Drag ${page.title}`}><GripVertical size={16} /></button><button className="page-open" onClick={() => { syncRichTarget("title"); syncRichTarget("body"); setActivePageId(page.id); if (window.innerWidth < 760) setSidebarOpen(false); }}><span>{activeBook.pages.findIndex((item) => item.id === page.id) + 1}</span><div><strong>{page.title || "Untitled"}</strong><small>{page.content.slice(0, 42) || "Blank page"}</small></div></button>
              <div className="page-order"><button onClick={() => nudgePage(page.id, -1)} disabled={activeBook.pages[0]?.id === page.id} aria-label="Move page up"><MoveUp size={13} /></button><button onClick={() => nudgePage(page.id, 1)} disabled={activeBook.pages[activeBook.pages.length - 1]?.id === page.id} aria-label="Move page down"><MoveDown size={13} /></button></div>
            </div>)}
          </div>
          <div className="sidebar-footer"><span>Drag pages to reorder them</span><button className={activeBook.pageNumbers ? "active" : ""} onClick={togglePageNumbers} aria-pressed={Boolean(activeBook.pageNumbers)}><Hash size={15} /> Page numbers <small>{activeBook.pageNumbers ? "On" : "Off"}</small></button><button onClick={openLibrary}><Library size={15} /> All books</button></div>
        </aside>

        <section className="writing-area">
          <div className="writing-toolbar">
            <label className="quick-paper-style"><span>Page</span><select value={activePage.settings.paper} onChange={(event) => updateSettings({ paper: event.target.value as PaperType })} aria-label="Page style"><option value="ruled">Ruled</option><option value="dot-ruled">Dot ruled</option><option value="grid">Grid</option><option value="dots">Dots</option><option value="blank">Blank</option><option value="cornell">Cornell</option></select></label>
            <label className={`font-control ${pendingFont ? "font-loading" : ""}`}><span>{pendingFont ? "Loading font" : "Font"}</span><select value={pendingFont || activePage.settings.font} onChange={(event) => void changeWritingFont(event.target.value)} aria-label="Writing font" aria-busy={Boolean(pendingFont)}><optgroup label="Handwritten">{handwritingFonts.map((font) => <option key={font}>{font}</option>)}</optgroup><optgroup label="Computer / book">{computerFonts.map((font) => <option key={font}>{font}</option>)}</optgroup></select></label>
            <label className="small-select"><span>Size</span><select value={activePage.settings.fontSize} onChange={(event) => applyBodyOrSelectionStyle("fontSize", `${event.target.value}px`)}>{[14,16,18,19,20,22,24,26,28,30,32].map((size) => <option key={size} value={size}>{size}px</option>)}</select></label>
            <label className="ink-picker" title="Selected text or body ink"><span className="ink-dot" style={{ background: activePage.settings.ink }} /><input type="color" value={activePage.settings.ink} onChange={(event) => applyBodyOrSelectionStyle("color", event.target.value)} aria-label="Selected text or body ink color" /></label>
            <div className="format-tools" aria-label="Text formatting"><button onMouseDown={(event) => event.preventDefault()} onClick={() => runRichCommand("underline")} aria-label="Underline selected text" title="Underline selected text"><Underline size={16} /></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => runRichCommand("insertParagraph")} aria-label="Insert paragraph break" title="Insert paragraph break"><Pilcrow size={16} /></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => runRichCommand("justifyLeft")} aria-label="Align paragraph left" title="Align left"><AlignLeft size={16} /></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => runRichCommand("justifyCenter")} aria-label="Center paragraph" title="Align center"><AlignCenter size={16} /></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => runRichCommand("justifyRight")} aria-label="Align paragraph right" title="Align right"><AlignRight size={16} /></button></div>
            <span className="toolbar-space" />
            <button className="toolbar-action" onClick={() => openImagePicker()} aria-label="Add an image to this page" title="Add an image anywhere on this page"><ImagePlus size={16} /> <span>Image</span></button>
            <button className="toolbar-action" onClick={addTextBox} aria-label="Add a movable text box" title="Add a text box you can move anywhere"><Type size={16} /> <span>Add text box</span></button>
            <button className="toolbar-action" onClick={duplicatePage} aria-label="Duplicate this page" title="Make a copy of this page"><Copy size={16} /><span className="desktop-only">Duplicate</span></button>
            <button className="toolbar-action toolbar-delete" onClick={() => deletePage(activePage.id)} disabled={activeBook.pages.length === 1} aria-label="Delete this page" title={activeBook.pages.length === 1 ? "A book must keep at least one page" : "Delete this page"}><Trash2 size={16} /><span className="desktop-only">Delete</span></button>
            <button className="mobile-tools-trigger mobile-only" onClick={() => setMobileToolsOpen(true)} aria-label="Open page tools"><Settings2 size={18} /><span>Tools</span></button>
            <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/*" onChange={importImage} />
          </div>
          <div className="paper-scroll" ref={canvasRef} onScroll={(event) => localStorage.setItem(`penstyl-scroll-${activePageId}`, String(event.currentTarget.scrollTop))}>
            <article className={`real-paper paper-${activePage.settings.paper}`} onPointerDown={(event) => { if (!(event.target as HTMLElement).closest(".page-image")) setSelectedImageId(""); }} onDragOver={(event) => (dragTextId || dragImageId) && event.preventDefault()} onDrop={dropCanvasObject} style={paperStyle(activePage)}>
              {activePage.settings.marginLine && <span className="red-margin" style={{ left: `${Math.max(28, activePage.settings.sideMargin - 18)}px` }} />}
              {activePage.settings.showDate && <input className="page-date" style={{ textAlign: activePage.settings.dateAlign }} value={activePage.settings.autoDate ? currentDate : activePage.dateText} onChange={(event) => updatePage({ dateText: event.target.value, settings: { ...activePage.settings, autoDate: false } })} onFocus={() => { lastRichTargetRef.current = "body"; }} aria-label="Page date; type to customize" />}
              <div ref={titleRef} className="page-title" contentEditable suppressContentEditableWarning onInput={() => syncRichTarget("title")} onPointerDown={() => { lastRichTargetRef.current = "title"; activeFormatSpanRef.current = null; }} onMouseUp={rememberSelection} onKeyUp={rememberSelection} onBlur={rememberSelection} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); editorRef.current?.focus(); } }} data-placeholder="Untitled page" spellCheck aria-label="Page title" />
              <div ref={editorRef} className="page-writing" contentEditable suppressContentEditableWarning onInput={() => syncRichTarget("body")} onPointerDown={() => { lastRichTargetRef.current = "body"; activeFormatSpanRef.current = null; }} onMouseUp={rememberSelection} onKeyUp={rememberSelection} onBlur={rememberSelection} data-placeholder="Start writing…" spellCheck aria-label="Page content" />
              {activeBook.pageNumbers && <span className="paper-page-number" aria-label={`Page ${activeBook.pages.findIndex((page) => page.id === activePage.id) + 1}`}>{activeBook.pages.findIndex((page) => page.id === activePage.id) + 1}</span>}
              {activePage.freeTexts.map((block) => <div className="free-text" key={block.id} style={{ left: `${block.x}%`, top: `${block.y}px`, color: block.color, fontFamily: `'${block.font}', cursive`, fontSize: `${block.size}px` }}><div className="free-text-controls" draggable onDragStart={(event) => { event.stopPropagation(); setDragTextId(block.id); }} onDragEnd={() => setDragTextId("")}><GripVertical size={14} /><button onClick={() => removeTextBox(block.id)} aria-label="Remove text box"><X size={14} /></button></div><textarea value={block.text} onChange={(event) => updateTextBox(block.id, { text: event.target.value })} aria-label="Custom text" /></div>)}
              {activePage.images.map((image) => { const selected = selectedImageId === image.id; return <div className={`page-image ${selected ? "selected" : ""}`} key={image.id} tabIndex={0} aria-label={`${image.alt}. Click to show image tools; use arrow keys to move.`} aria-selected={selected} onPointerDown={(event) => { event.stopPropagation(); setSelectedImageId(image.id); }} onFocus={() => setSelectedImageId(image.id)} onKeyDown={(event) => { if (event.key === "Escape") setSelectedImageId(""); if (event.key === "ArrowLeft") updateImage(image.id, { x: Math.max(5, image.x - 1) }); if (event.key === "ArrowRight") updateImage(image.id, { x: Math.min(95, image.x + 1) }); if (event.key === "ArrowUp") updateImage(image.id, { y: Math.max(150, image.y - 8) }); if (event.key === "ArrowDown") updateImage(image.id, { y: image.y + 8 }); }} style={{ left: `${image.x}%`, top: `${image.y}px`, width: `${image.width}px` }}>{selected && <div className="page-image-controls" draggable onDragStart={(event) => { event.stopPropagation(); setDragImageId(image.id); }} onDragEnd={() => setDragImageId("")}><GripVertical size={14} /><span>Move image</span><button onClick={() => openImagePicker(image.id)} aria-label="Replace image"><RefreshCw size={13} /></button><button onClick={() => removeImage(image.id)} aria-label="Delete image"><Trash2 size={13} /></button></div>}<img src={image.src} alt={image.alt} />{selected && <label><span>Size</span><input type="range" min="100" max="650" value={image.width} onChange={(event) => updateImage(image.id, { width: Number(event.target.value) })} /></label>}</div>; })}
            </article>
          </div>
          <footer className="writing-status"><span>{activePage.content.trim() ? activePage.content.trim().split(/\s+/).length : 0} words</span><span>{activePage.settings.ruleMm} mm ruling</span></footer>
        </section>

        {settingsOpen && <StylePanel page={activePage} update={updateSettings} changeFont={(font) => void changeWritingFont(font)} fontValue={pendingFont || activePage.settings.font} fontLoading={Boolean(pendingFont)} updatePageMeta={updatePage} applyTextColor={(color) => applyBodyOrSelectionStyle("color", color)} today={currentDate} close={() => setSettingsOpen(false)} />}
      </div>
      {voiceOpen && <section className="voice-panel" role="dialog" aria-modal="false" aria-labelledby="voice-title">
        <div className="voice-panel-head"><div><span className={listening ? "voice-pulse" : ""}><Mic size={17} /></span><div><strong id="voice-title">Voice typing</strong><small>{listening ? "Listening now" : "Choose where to write"}</small></div></div><button onClick={closeVoice} aria-label="Close voice typing"><X size={16} /></button></div>
        <div className="voice-targets"><button className={voiceTarget === "title" ? "selected" : ""} onClick={() => setVoiceTarget("title")} disabled={listening}><Type size={16} /><span>Page title</span></button><button className={voiceTarget === "body" ? "selected" : ""} onClick={() => setVoiceTarget("body")} disabled={listening}><BookOpen size={16} /><span>Main body</span></button></div>
        <label className="voice-device"><span>Input device</span><select value={selectedMicId} onChange={(event) => { setSelectedMicId(event.target.value); setActiveMicLabel(""); localStorage.setItem("penstyl-microphone", event.target.value); }} disabled={listening || micLoading} aria-label="Microphone input device"><option value="">{micLoading ? "Opening selected microphone…" : "System default microphone"}</option>{micDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></label>
        <div className="voice-active-device"><Check size={13} /><span>{activeMicLabel ? `Using ${activeMicLabel}` : "Your chosen microphone will be used directly"}</span></div>
        <div className="mic-meter" aria-label={`Microphone input level ${micLevel}%`}><span><i style={{ width: `${micLevel}%` }} /></span><small>{listening ? "Input level" : "The meter moves while listening"}</small></div>
        <div className={`voice-engine ${voiceEngine}`} role="status">{voiceEngine === "loading" ? "Preparing selected-microphone recognition…" : voiceEngine === "local" ? "Selected-microphone recognition is live" : voiceEngine === "browser" ? "Browser recognition is live" : voiceLanguage.startsWith("en") ? "English uses the selected microphone directly" : "This language uses browser recognition"}</div>
        <label className="voice-language"><span>Language</span><select value={voiceLanguage} onChange={(event) => { setVoiceLanguage(event.target.value); setVoiceError(""); }} disabled={listening || micLoading}><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option><option value="en-IN">English (India)</option><option value="hi-IN">Hindi</option><option value="es-ES">Spanish</option></select></label>
        {dictationDraft && <div className="dictation-preview" role="status" aria-live="polite"><span>Hearing</span><p>{dictationDraft}</p></div>}
        {voiceError && <p className="voice-error" role="alert">{voiceError}</p>}<p className="voice-hint">Say “new paragraph”, “new line”, “comma”, or “full stop” for punctuation.</p>
        <div className="voice-actions"><button className={`voice-start ${listening ? "stop" : ""}`} onClick={startVoice} disabled={micLoading}>{micLoading ? <LoaderCircle className="spin" size={17} /> : listening ? <MicOff size={17} /> : <Mic size={17} />}{micLoading ? voiceEngine === "loading" ? "Preparing recognition…" : "Opening selected microphone…" : listening ? "Stop listening" : `Start in ${voiceTarget === "title" ? "title" : "main body"}`}</button><button className="voice-clear" onClick={clearDictatedText} disabled={!hasDictatedText && !dictationDraft} aria-label="Clear text added by dictation"><Trash2 size={16} /><span>Clear dictated text</span></button></div>
      </section>}
      {mobileToolsOpen && <div className="mobile-tools-backdrop" onPointerDown={(event) => event.target === event.currentTarget && setMobileToolsOpen(false)}><section className="mobile-tools-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-tools-title"><div className="mobile-tools-head"><div><span>PAGE</span><h2 id="mobile-tools-title">Page tools</h2></div><button onClick={() => setMobileToolsOpen(false)} aria-label="Close page tools"><X size={19} /></button></div><div className="mobile-tools-grid"><button onClick={() => { setMobileToolsOpen(false); setSettingsOpen(true); }}><Palette size={20} /><span>Page style</span></button><button onClick={() => { setMobileToolsOpen(false); setDark(!dark); }}>{dark ? <Sun size={20} /> : <Moon size={20} />}<span>{dark ? "Light mode" : "Dark mode"}</span></button><button onClick={() => { setMobileToolsOpen(false); openImagePicker(); }}><ImagePlus size={20} /><span>Add image</span></button><button onClick={() => { setMobileToolsOpen(false); addTextBox(); }}><Type size={20} /><span>Text box</span></button><button onClick={() => { setMobileToolsOpen(false); duplicatePage(); }}><Copy size={20} /><span>Duplicate</span></button><button className="danger" onClick={() => { setMobileToolsOpen(false); deletePage(activePage.id); }} disabled={activeBook.pages.length === 1}><Trash2 size={20} /><span>Delete page</span></button></div></section></div>}
      {pageMenu && <div className="page-context-menu" style={{ left: pageMenu.x, top: pageMenu.y }} role="menu"><button className="rename-page" onClick={() => renamePage(pageMenu.pageId)} role="menuitem"><Pencil size={15} /> Rename page</button><button onClick={() => deletePage(pageMenu.pageId)} disabled={activeBook.pages.length === 1} role="menuitem"><Trash2 size={15} /> Delete page</button>{activeBook.pages.length === 1 && <span>A book needs one page.</span>}</div>}
      {readerOpen && <BookReader book={activeBook} today={currentDate} close={() => setReaderOpen(false)} />}
      {exportOpen && <ExportDialog book={activeBook} activePageId={activePage.id} today={currentDate} close={() => setExportOpen(false)} />}
      <ShareDialog url={shareUrl} error={shareError} pending={sharePending} close={() => { setShareUrl(""); setShareError(""); }} />
      <RenameDialog target={renameTarget} close={() => setRenameTarget(null)} submit={commitRename} />
      <ConfirmDialog target={deleteTarget} close={() => setDeleteTarget(null)} confirm={confirmDelete} />
      {appNotice && <div className="notice" role="alert"><span>{appNotice}</span><button onClick={() => setAppNotice("")} aria-label="Dismiss message"><X size={14} /></button></div>}
    </main>
  );
}

function BookReader({ book, today, close }: { book: Book; today: string; close: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [close]);
  return <section className="book-reader" role="dialog" aria-modal="true" aria-labelledby="reader-title">
    <header className="reader-header"><div><span>READING</span><h2 id="reader-title">{book.title}</h2><small>{book.pages.length} {book.pages.length === 1 ? "page" : "pages"}</small></div><button ref={closeButtonRef} onClick={close} aria-label="Close reading mode"><X size={20} /></button></header>
    <div className="reader-scroll"><div className="reader-pages">
      {book.pages.map((page, index) => <section className="reader-page-wrap" key={page.id} aria-label={`Page ${index + 1}: ${page.title || "Untitled page"}`}>
        <div className="reader-page-label"><span>Page {index + 1}</span><strong>{page.title || "Untitled page"}</strong></div>
        <ExportPaper page={page} today={today} pageNumber={index + 1} showPageNumber={Boolean(book.pageNumbers)} />
      </section>)}
    </div></div>
  </section>;
}

function RenameDialog({ target, close, submit }: { target: { kind: "book" | "page"; id: string; title: string } | null; close: () => void; submit: (title: string) => void }) {
  const [title, setTitle] = useState("");
  useEffect(() => setTitle(target?.title || ""), [target]);
  if (!target) return null;
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="rename-dialog cloud-dialog" onSubmit={(event) => { event.preventDefault(); submit(title); }} role="dialog" aria-modal="true" aria-labelledby="rename-title"><div className="dialog-title"><div><p>RENAME</p><h2 id="rename-title">Rename {target.kind}</h2></div><button type="button" onClick={close} aria-label="Close rename dialog"><X size={18} /></button></div><label htmlFor="rename-value">New name</label><input id="rename-value" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus required maxLength={120} /><div className="dialog-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" disabled={!title.trim()}>Save name</button></div></form></div>;
}

function BookAppearanceDialog({ book, close, submit }: { book: Book | null; close: () => void; submit: (color: string, borderColor: string) => void }) {
  const [color, setColor] = useState(bookColors[0]);
  const [borderColor, setBorderColor] = useState("#2f2d2a");
  useEffect(() => { if (book) { setColor(book.color); setBorderColor(book.borderColor); } }, [book]);
  if (!book) return null;
  const valid = validHex(color) && validHex(borderColor);
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="book-appearance-dialog cloud-dialog" onSubmit={(event) => { event.preventDefault(); if (valid) submit(color, borderColor); }} role="dialog" aria-modal="true" aria-labelledby="appearance-title"><div className="dialog-title"><div><p>BOOK APPEARANCE</p><h2 id="appearance-title">Change the cover</h2></div><button type="button" onClick={close} aria-label="Close book appearance dialog"><X size={18} /></button></div><div className="appearance-preview" style={{ background: validHex(color) ? color : book.color, borderColor: validHex(borderColor) ? borderColor : book.borderColor }}><span /><strong>{book.title}</strong></div><fieldset><legend>Cover presets</legend><div className="cover-colors">{bookColors.map((preset) => <button type="button" key={preset} className={color.toLowerCase() === preset.toLowerCase() ? "selected" : ""} style={{ background: preset }} onClick={() => setColor(preset)} aria-label={`Use cover color ${preset}`} aria-pressed={color.toLowerCase() === preset.toLowerCase()}>{color.toLowerCase() === preset.toLowerCase() && <Check size={15} />}</button>)}</div></fieldset><div className="appearance-fields"><label>Cover color<div><input type="color" value={validHex(color) ? color : book.color} onChange={(event) => setColor(event.target.value)} aria-label="Choose custom cover color" /><input value={color} onChange={(event) => setColor(event.target.value)} maxLength={7} aria-invalid={!validHex(color)} spellCheck={false} /></div></label><label>Border color<div><input type="color" value={validHex(borderColor) ? borderColor : book.borderColor} onChange={(event) => setBorderColor(event.target.value)} aria-label="Choose custom border color" /><input value={borderColor} onChange={(event) => setBorderColor(event.target.value)} maxLength={7} aria-invalid={!validHex(borderColor)} spellCheck={false} /></div></label></div>{!valid && <p className="field-error" role="alert">Use a six-digit hex color such as #345174.</p>}<div className="dialog-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" disabled={!valid}>Save colors</button></div></form></div>;
}

function ConfirmDialog({ target, close, confirm }: { target: { kind: "book" | "page"; id: string; title: string } | null; close: () => void; confirm: () => void }) {
  if (!target) return null;
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="confirm-dialog cloud-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><div className="dialog-title"><div><p>DELETE</p><h2 id="delete-title">Delete {target.kind}?</h2></div><button onClick={close} aria-label="Close delete dialog"><X size={18} /></button></div><p>“{target.title}” {target.kind === "book" ? "and all of its pages will be removed." : "will be removed from this book."}</p><div className="dialog-actions"><button onClick={close}>Cancel</button><button className="danger" onClick={confirm}>Delete</button></div></section></div>;
}

function LogoutDialog({ open, close, confirm }: { open: boolean; close: () => void; confirm: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);
  if (!open) return null;
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="confirm-dialog cloud-dialog logout-dialog" role="alertdialog" aria-modal="true" aria-labelledby="logout-title"><div className="dialog-title"><div><p>SIGN OUT</p><h2 id="logout-title">Leave Penstyle?</h2></div><button onClick={close} aria-label="Close sign out confirmation"><X size={18} /></button></div><p>Are you sure you want to sign out? Your books will stay ready for the next time you return.</p><div className="dialog-actions"><button onClick={close} autoFocus>Stay signed in</button><button className="danger" onClick={confirm}>Sign out</button></div></section></div>;
}

function Wordmark({ small = false }: { small?: boolean }) {
  return <div className={`wordmark ${small ? "small" : ""}`}><img src="/penstyle-logo.png" width="145" height="54" alt="Penstyle" /></div>;
}

function LoginScreen({ configured, error, onProvider }: { configured: boolean; error: string; onProvider: (provider: Provider) => void }) {
  const message = error || (!configured ? "Add the Supabase publishable key to .env.local to enable social sign-in." : "");
  return <main className="login-screen"><section className="login-card oauth-card"><Wordmark /><div className="login-copy"><p>YOUR PERSONAL NOTEBOOK</p><h1>Write naturally.<br />Keep everything.</h1><span>Sign in to open your library and continue exactly where you left off.</span></div><div className="oauth-buttons"><button className="google-auth" onClick={() => onProvider("google")} disabled={!configured}><b>G</b> Continue with Google</button><button className="x-auth" onClick={() => onProvider("x")} disabled={!configured}>Continue with X</button><button className="discord-auth" onClick={() => onProvider("discord")} disabled={!configured}>Continue with Discord</button></div>{message && <p className="auth-error" role="alert">{message}</p>}<small>By continuing, you agree to use Penstyle for your personal notes. We never receive your social password.</small></section><footer className="login-footer"><span>© 2026 Penstyle. All Rights Reserved</span><i aria-hidden="true" /><span>Made with <b aria-label="love">💗</b> by <a href="https://owner.penstyle.space">70ne</a></span></footer></main>;
}

function BookShelf({ books, onOpen, onDelete, onRename, onAppearance, onShare, onToggleImportant }: { books: Book[]; onOpen: (book: Book) => void; onDelete: (book: Book) => void; onRename: (book: Book) => void; onAppearance: (book: Book) => void; onShare: (book: Book) => void; onToggleImportant: (book: Book) => void }) {
  return <div className="book-grid">{books.map((book) => <article className="book-card" key={book.id}><button className="book-cover" onClick={() => onOpen(book)} style={{ background: book.color, borderColor: book.borderColor }}><span className="book-spine" /><div>{book.important && <Star className="cover-star" size={18} fill="currentColor" />}<BookOpen size={22} /><strong>{book.title}</strong><small>{book.pages.length} {book.pages.length === 1 ? "page" : "pages"}</small></div></button><div className="book-meta"><div className="book-card-copy"><strong>{book.title}</strong><span>{book.pages.length} {book.pages.length === 1 ? "page" : "pages"}</span><small>Edited {shortDate(book.updatedAt)}</small></div><div className="book-card-actions"><button className={book.important ? "important" : ""} onClick={() => onToggleImportant(book)} aria-label={book.important ? `Remove ${book.title} from Important` : `Mark ${book.title} important`} aria-pressed={Boolean(book.important)} title="Important"><Star size={15} fill={book.important ? "currentColor" : "none"} /></button><button onClick={() => onAppearance(book)} aria-label={`Change colors for ${book.title}`} title="Change book colors"><Palette size={15} /></button><button onClick={() => onRename(book)} aria-label={`Rename ${book.title}`} title="Rename book"><Pencil size={15} /></button><button onClick={() => onShare(book)} aria-label={`Share ${book.title}`} title="Share book"><Share2 size={15} /></button><button onClick={() => onDelete(book)} aria-label={`Delete ${book.title}`} title="Delete book"><Trash2 size={15} /></button></div></div></article>)}</div>;
}

function LibraryScreen({ profile, books, dark, setDark, onOpen, onDelete, onRename, onAppearance, onShare, onToggleImportant, newBookOpen, setNewBookOpen, onCreate, onImport, importRef, onSignOut }: { profile: Profile; books: Book[]; dark: boolean; setDark: (value: boolean) => void; onOpen: (book: Book) => void; onDelete: (book: Book) => void; onRename: (book: Book) => void; onAppearance: (book: Book) => void; onShare: (book: Book) => void; onToggleImportant: (book: Book) => void; newBookOpen: boolean; setNewBookOpen: (value: boolean) => void; onCreate: (event: FormEvent<HTMLFormElement>) => void; onImport: (event: React.ChangeEvent<HTMLInputElement>) => void; importRef: React.RefObject<HTMLInputElement | null>; onSignOut: () => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeMenu = (event: KeyboardEvent) => event.key === "Escape" && setMobileMenuOpen(false);
    window.addEventListener("keydown", closeMenu);
    return () => window.removeEventListener("keydown", closeMenu);
  }, [mobileMenuOpen]);
  const importantBooks = books.filter((book) => book.important); const otherBooks = books.filter((book) => !book.important);
  const shelfProps = { onOpen, onDelete, onRename, onAppearance, onShare, onToggleImportant };
  const initials = profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
  return <main className={`library-screen ${dark ? "dark" : ""}`}>
    <header className="library-header"><Wordmark small /><div className="account desktop-library-account"><div className="account-profile" title={profile.email}><span aria-hidden="true">{initials}</span>{profile.avatar && <img src={profile.avatar} width="28" height="28" alt="" aria-hidden="true" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} />}<strong>{profile.name}</strong></div><nav className="library-help" aria-label="Help"><a href="/documentation">Docs</a><a href="/guide">Guide</a></nav><button onClick={() => setDark(!dark)}><Settings2 size={16} /> {dark ? "Light" : "Dark"}</button><button className="sign-out" onClick={onSignOut}><LogOut size={16} /> Sign out</button></div><div className="mobile-library-account mobile-only"><div className="mobile-avatar"><span aria-hidden="true">{initials}</span>{profile.avatar && <img src={profile.avatar} width="36" height="36" alt="" aria-hidden="true" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} />}</div><button onClick={() => setMobileMenuOpen(true)} aria-label="Open account and help menu" aria-expanded={mobileMenuOpen}><Menu size={21} /></button></div></header>
    <section className="library-content"><div className="library-title"><div><p>LIBRARY</p><h1>Your books</h1></div><div className="library-actions"><button onClick={() => setNewBookOpen(true)}><Plus size={17} /> New book</button><button className="import-book" onClick={() => importRef.current?.click()}><Upload size={17} /> Import</button><input ref={importRef} className="visually-hidden" type="file" accept=".pen,application/x-penstyle-book+json" onChange={onImport} /></div></div>{books.length ? <>{importantBooks.length > 0 && <section className="book-section important-section"><h2><Star size={18} fill="currentColor" /> Important</h2><BookShelf books={importantBooks} {...shelfProps} /></section>}{otherBooks.length > 0 && <section className="book-section"><h2>{importantBooks.length ? "All other books" : "All books"}</h2><BookShelf books={otherBooks} {...shelfProps} /></section>}</> : <div className="empty-library"><FolderOpen size={34} /><h2>No books yet</h2><p>Create a new book or import an editable .pen book.</p><div className="empty-actions"><button onClick={() => setNewBookOpen(true)}>Create your first book</button><button onClick={() => importRef.current?.click()}>Import a .pen book</button></div></div>}</section>
    {newBookOpen && <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setNewBookOpen(false)}><form className="new-book-dialog" onSubmit={onCreate} role="dialog" aria-modal="true" aria-labelledby="create-book-title"><div className="dialog-title"><div><p>NEW BOOK</p><h2 id="create-book-title">Create a book</h2></div><button type="button" onClick={() => setNewBookOpen(false)} aria-label="Close create book dialog"><X size={18} /></button></div><label className="book-name-field">Book name<input name="title" required autoFocus placeholder="e.g. Research notes" /></label><fieldset><legend>Cover color</legend><div className="cover-colors">{bookColors.map((color, index) => <label key={color} style={{ background: color }}><input type="radio" name="color" value={color} defaultChecked={index === 0} aria-label={`Cover color ${color}`} /><Check size={15} /></label>)}</div></fieldset><div className="book-hex-fields"><label>Custom cover hex<input name="customColor" placeholder="#345174" pattern="#[0-9A-Fa-f]{6}" maxLength={7} /></label><label>Border hex<input name="borderColor" defaultValue="#2F2D2A" pattern="#[0-9A-Fa-f]{6}" maxLength={7} /></label></div><button className="create-book" type="submit">Create book</button></form></div>}
    {mobileMenuOpen && <div className="mobile-library-backdrop" onPointerDown={(event) => event.target === event.currentTarget && setMobileMenuOpen(false)}><section className="mobile-library-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-library-menu-title"><div className="mobile-sheet-profile"><div className="mobile-avatar large"><span aria-hidden="true">{initials}</span>{profile.avatar && <img src={profile.avatar} width="44" height="44" alt="" aria-hidden="true" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} />}</div><div><strong id="mobile-library-menu-title">{profile.name}</strong><span>{profile.email}</span></div><button onClick={() => setMobileMenuOpen(false)} aria-label="Close account menu"><X size={19} /></button></div><nav aria-label="Help and account"><a href="/documentation"><BookOpen size={19} /><span>Documentation</span></a><a href="/guide"><FileText size={19} /><span>Feature guide</span></a><button onClick={() => setDark(!dark)}>{dark ? <Sun size={19} /> : <Moon size={19} />}<span>{dark ? "Use light appearance" : "Use dark appearance"}</span></button><button className="sign-out" onClick={() => { setMobileMenuOpen(false); onSignOut(); }}><LogOut size={19} /><span>Sign out</span></button></nav></section></div>}
  </main>;
}

function ShareDialog({ url, error, pending, close }: { url: string; error: string; pending: boolean; close: () => void }) {
  const [copied, setCopied] = useState(false);
  const resetCopyRef = useRef<number | null>(null);
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      if (resetCopyRef.current) window.clearTimeout(resetCopyRef.current);
    };
  }, [close]);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const field = document.querySelector<HTMLInputElement>("#share-link");
      field?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    if (resetCopyRef.current) window.clearTimeout(resetCopyRef.current);
    resetCopyRef.current = window.setTimeout(() => setCopied(false), 1800);
  };
  if (!url && !error && !pending) return null;
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="share-dialog cloud-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title"><button className="share-close" onClick={close} aria-label="Close"><X size={18} /></button><span className="share-mark">{pending ? <LoaderCircle className="spin" size={20} /> : <Share2 size={20} />}</span><h2 id="share-title">{pending ? "Preparing your link" : error ? "Couldn’t share" : "Share link ready"}</h2>{pending ? <p role="status">Making a secure read-only copy…</p> : error ? <p>{error}</p> : <><p>Anyone with this link can open a read-only copy.</p><div className="share-link-row"><input id="share-link" readOnly value={url} aria-label="Share link" /><button className={copied ? "copied" : ""} onClick={copyLink} aria-live="polite">{copied ? <><Check size={16} /> Copied</> : <><Copy size={15} /> Copy link</>}</button></div></>}</section></div>;
}

function ExportPaper({ page, today, pageNumber, showPageNumber }: { page: NotePage; today: string; pageNumber: number; showPageNumber: boolean }) {
  return <article data-export-page={page.id} className={`real-paper export-paper paper-${page.settings.paper}`} style={paperStyle(page)}>
    {page.settings.marginLine && <span className="red-margin" style={{ left: `${Math.max(28, page.settings.sideMargin - 18)}px` }} />}
    {page.settings.showDate && <div className="page-date export-date" style={{ textAlign: page.settings.dateAlign }}>{page.settings.autoDate ? today : page.dateText}</div>}
    <div className="page-title" dangerouslySetInnerHTML={{ __html: page.titleHtml || escapeHtml(page.title) }} />
    <div className="page-writing" dangerouslySetInnerHTML={{ __html: page.contentHtml }} />
    {showPageNumber && <span className="paper-page-number">{pageNumber}</span>}
    {page.freeTexts.map((block) => <div className="free-text export-free-text" key={block.id} style={{ left: `${block.x}%`, top: `${block.y}px`, color: block.color, fontFamily: `'${block.font}', cursive`, fontSize: `${block.size}px` }}>{block.text}</div>)}
    {page.images.map((image) => <div className="page-image export-image" key={image.id} style={{ left: `${image.x}%`, top: `${image.y}px`, width: `${image.width}px` }}><img src={image.src} alt={image.alt} /></div>)}
  </article>;
}

function ExportDialog({ book, activePageId, today, close }: { book: Book; activePageId: string; today: string; close: () => void }) {
  const [scope, setScope] = useState<"current" | "book" | "selected">("current");
  const [selectedIds, setSelectedIds] = useState<string[]>([activePageId]);
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [scale, setScale] = useState(2);
  const [quality, setQuality] = useState(.92);
  const [paperSize, setPaperSize] = useState<"notebook" | "a4">("notebook");
  const [includePaper, setIncludePaper] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !exporting) close(); };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, exporting]);
  const formats: { id: ExportFormat; label: string; detail: string }[] = [
    { id: "pdf", label: "PDF", detail: "One ordered document" }, { id: "png", label: "PNG", detail: "Lossless page images" },
    { id: "jpeg", label: "JPEG", detail: "Smaller page images" }, { id: "svg", label: "SVG", detail: "Scalable page images" },
    { id: "html", label: "HTML", detail: "Styled browser document" }, { id: "md", label: "Markdown", detail: "Portable notes" },
    { id: "txt", label: "Text", detail: "Plain writing" }, { id: "pen", label: "PEN", detail: "Editable Penstyle book" },
    { id: "json", label: "JSON", detail: "Readable data backup" },
  ];
  const pages = scope === "current" ? book.pages.filter((page) => page.id === activePageId) : scope === "book" ? book.pages : book.pages.filter((page) => selectedIds.includes(page.id));
  const imageFormat = ["png", "jpeg", "svg"].includes(format);
  const togglePage = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((pageId) => pageId !== id) : [...current, id]);
  const pageText = (page: NotePage) => [page.title, page.settings.showDate ? (page.settings.autoDate ? today : page.dateText) : "", page.content, ...page.freeTexts.map((item) => item.text)].filter(Boolean).join("\n\n");
  const runExport = async () => {
    if (!pages.length || exporting) return;
    setExporting(true); setError(""); setStatus("Preparing pages…");
    try {
      await document.fonts.ready;
      const nodes = pages.map((page) => document.querySelector<HTMLElement>(`[data-export-page="${page.id}"]`)).filter((node): node is HTMLElement => Boolean(node));
      if (nodes.length !== pages.length) throw new Error("The selected pages could not be prepared.");
      const bookName = cleanName(book.title);
      const exportName = pages.length === 1 ? cleanName(pages[0].title) : bookName;
      if (format === "txt" || format === "md" || format === "json" || format === "pen") {
        if (format === "pen") download(`${exportName}.pen`, JSON.stringify({ format: "penstyle-book", version: 1, exportedAt: new Date().toISOString(), book: { ...book, pages } }), "application/x-penstyle-book+json");
        else if (format === "json") download(`${exportName}.penstyle.json`, JSON.stringify({ version: 1, book: { ...book, pages } }, null, 2), "application/json");
        else if (format === "md") download(`${exportName}.md`, pages.map((page) => `# ${page.title}\n\n${page.settings.showDate ? `_${page.settings.autoDate ? today : page.dateText}_\n\n` : ""}${page.content}\n\n${page.freeTexts.map((item) => `> ${item.text}`).join("\n\n")}`).join("\n\n---\n\n"), "text/markdown");
        else download(`${exportName}.txt`, pages.map(pageText).join("\n\n================================\n\n"), "text/plain");
      } else if (format === "html") {
        const css = Array.from(document.styleSheets).map((sheet) => { try { return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n"); } catch { return ""; } }).join("\n");
        const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(book.title)}</title><style>${css}.export-paper{margin:28px auto;box-shadow:none;page-break-after:always}</style></head><body>${nodes.map((node) => node.outerHTML).join("\n")}</body></html>`;
        download(`${exportName}.html`, html, "text/html");
      } else {
        const imageTools = await import("html-to-image");
        const renderNode = async (node: HTMLElement, kind: "png" | "jpeg" | "svg") => {
          node.classList.toggle("export-no-paper", !includePaper);
          try {
            const options = { pixelRatio: scale, cacheBust: true, backgroundColor: includePaper ? node.style.backgroundColor : "transparent" };
            if (kind === "jpeg") return await imageTools.toJpeg(node, { ...options, quality });
            if (kind === "svg") return await imageTools.toSvg(node, options);
            return await imageTools.toPng(node, options);
          } finally { node.classList.remove("export-no-paper"); }
        };
        if (format === "pdf") {
          const { jsPDF } = await import("jspdf"); let pdf: InstanceType<typeof jsPDF> | null = null;
          for (let index = 0; index < nodes.length; index++) {
            setStatus(`Rendering page ${index + 1} of ${nodes.length}…`); const node = nodes[index]; const data = await renderNode(node, "png");
            const pageFormat: "a4" | [number, number] = paperSize === "a4" ? "a4" : [node.offsetWidth, node.offsetHeight];
            if (!pdf) pdf = new jsPDF({ orientation: "portrait", unit: "px", format: pageFormat, compress: true, hotfixes: ["px_scaling"] });
            else pdf.addPage(pageFormat, "portrait");
            const pageWidth = pdf.internal.pageSize.getWidth(); const pageHeight = pdf.internal.pageSize.getHeight(); const ratio = Math.min(pageWidth / node.offsetWidth, pageHeight / node.offsetHeight);
            const width = node.offsetWidth * ratio; const height = node.offsetHeight * ratio; pdf.addImage(data, "PNG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, "FAST");
          }
          pdf?.save(`${exportName}.pdf`);
        } else {
          const extension = format === "jpeg" ? "jpg" : format; const rendered: { name: string; url: string }[] = [];
          for (let index = 0; index < nodes.length; index++) { const bookSequence = book.pages.findIndex((page) => page.id === pages[index].id) + 1; const pageName = cleanName(pages[index].title); setStatus(`Rendering page ${index + 1} of ${nodes.length}…`); rendered.push({ name: `${pages.length === 1 ? pageName : `${String(bookSequence).padStart(3, "0")}-${pageName}`}.${extension}`, url: await renderNode(nodes[index], format) }); }
          if (rendered.length === 1) downloadDataUrl(rendered[0].name, rendered[0].url);
          else { const { default: JSZip } = await import("jszip"); const zip = new JSZip(); for (const item of rendered) zip.file(item.name, await (await fetch(item.url)).blob()); downloadBlob(`${bookName}-${extension}-pages.zip`, await zip.generateAsync({ type: "blob" })); }
        }
      }
      setStatus("Export complete"); window.setTimeout(close, 450);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Export failed."); setStatus(""); }
    finally { setExporting(false); }
  };
  return <div className="dialog-backdrop export-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !exporting) close(); }}><section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title" aria-busy={exporting}><div className="export-heading"><div><p>EXPORT</p><h2 id="export-title">Export notebook</h2><span>Pages keep their current paper, type, ink, objects, and order.</span></div><button onClick={close} disabled={exporting} aria-label="Close export"><X size={18} /></button></div><div className="export-dialog-body"><section><label>Pages</label><div className="export-segments"><button className={scope === "current" ? "selected" : ""} onClick={() => setScope("current")}>Current page</button><button className={scope === "book" ? "selected" : ""} onClick={() => setScope("book")}>Entire book</button><button className={scope === "selected" ? "selected" : ""} onClick={() => setScope("selected")}>Choose pages</button></div>{scope === "selected" && <div className="export-page-list">{book.pages.map((page, index) => <label key={page.id}><input type="checkbox" checked={selectedIds.includes(page.id)} onChange={() => togglePage(page.id)} /><span>{index + 1}</span>{page.title || "Untitled page"}</label>)}</div>}</section><section><label>Format</label><div className="export-formats">{formats.map((item) => <button key={item.id} className={format === item.id ? "selected" : ""} onClick={() => setFormat(item.id)}><strong>{item.label}</strong><small>{item.detail}</small></button>)}</div></section>{(imageFormat || format === "pdf") && <section className="export-options"><label>Output options</label><div><label>Resolution<select value={scale} onChange={(event) => setScale(Number(event.target.value))}><option value="1">Standard (1×)</option><option value="2">High (2×)</option><option value="3">Ultra (3×)</option></select></label>{format === "jpeg" && <label>JPEG quality<input type="range" min="0.5" max="1" step="0.05" value={quality} onChange={(event) => setQuality(Number(event.target.value))} /><span>{Math.round(quality * 100)}%</span></label>}{format === "pdf" && <label>PDF page size<select value={paperSize} onChange={(event) => setPaperSize(event.target.value as "notebook" | "a4")}><option value="notebook">Match notebook page</option><option value="a4">Fit to A4</option></select></label>}<label className="check-option"><input type="checkbox" checked={includePaper} onChange={(event) => setIncludePaper(event.target.checked)} /> Include paper color, ruling and border</label></div></section>}</div>{error && <p className="export-error" role="alert">{error}</p>}<div className="export-footer"><span role="status">{status || `${pages.length} ${pages.length === 1 ? "page" : "pages"} selected${imageFormat && pages.length > 1 ? " · saved as an ordered ZIP" : ""}`}</span><button className="run-export" onClick={runExport} disabled={exporting || !pages.length}>{exporting ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}{exporting ? "Exporting…" : `Export ${format.toUpperCase()}`}</button></div></section><div className="export-stage" aria-hidden="true">{book.pages.map((page, index) => <ExportPaper key={page.id} page={page} today={today} pageNumber={index + 1} showPageNumber={Boolean(book.pageNumbers)} />)}</div></div>;
}

function HexColorField({ value, onChange, label }: { value: string; onChange: (color: string) => void; label: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => { const next = draft.trim(); if (validHex(next)) onChange(next); else setDraft(value); };
  return <div className="hex-color-field"><input type="color" value={validHex(value) ? value : "#000000"} onChange={(event) => { setDraft(event.target.value); onChange(event.target.value); }} aria-label={`${label} color picker`} /><input value={draft} onChange={(event) => { const next = event.target.value; setDraft(next); if (validHex(next)) onChange(next); }} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} maxLength={7} spellCheck={false} aria-label={`${label} hex code`} aria-invalid={draft.length > 0 && !validHex(draft)} placeholder="#243D6B" /></div>;
}

function StylePanel({ page, update, changeFont, fontValue, fontLoading, updatePageMeta, applyTextColor, today, close }: { page: NotePage; update: (settings: Partial<PageSettings>) => void; changeFont: (font: string) => void; fontValue: string; fontLoading: boolean; updatePageMeta: (updates: Partial<NotePage>) => void; applyTextColor: (color: string) => void; today: string; close: () => void }) {
  const settings = page.settings;
  return <aside className="style-panel">
    <div className="style-header"><div><p>PAGE SETTINGS</p><h2>Page style</h2></div><button onClick={close} aria-label="Close page settings"><X size={18} /></button></div>
    <section><label>Paper layout</label><div className="paper-layouts">{(["ruled","dot-ruled","grid","dots","blank","cornell"] as PaperType[]).map((paper) => <button key={paper} className={settings.paper === paper ? "selected" : ""} onClick={() => update({ paper })}><span className={`mini-paper ${paper}`} />{paper.replace("-", " ")}</button>)}</div></section>
    <section><div className="setting-row"><label>Ruling</label><span>{settings.ruleMm} mm</span></div><input type="range" min="5" max="10" step="1" value={settings.ruleMm} onChange={(event) => update({ ruleMm: Number(event.target.value) })} /><div className="range-hints"><span>Narrow</span><span>Wide</span></div></section>
    <section><div className="toggle-setting"><div><label>Page date</label><span>Show a date above the title</span></div><button className={settings.showDate ? "on" : ""} onClick={() => update({ showDate: !settings.showDate })} role="switch" aria-checked={settings.showDate}><span /></button></div>{settings.showDate && <div className="date-settings"><label><input type="checkbox" checked={settings.autoDate} onChange={(event) => update({ autoDate: event.target.checked })} /> Use today’s date automatically</label>{!settings.autoDate && <input value={page.dateText} onChange={(event) => updatePageMeta({ dateText: event.target.value })} placeholder={today} aria-label="Custom page date" />}<div className="date-alignments" aria-label="Date alignment"><button className={settings.dateAlign === "left" ? "selected" : ""} onClick={() => update({ dateAlign: "left" })} aria-label="Align date left"><AlignLeft size={15} /></button><button className={settings.dateAlign === "center" ? "selected" : ""} onClick={() => update({ dateAlign: "center" })} aria-label="Center date"><AlignCenter size={15} /></button><button className={settings.dateAlign === "right" ? "selected" : ""} onClick={() => update({ dateAlign: "right" })} aria-label="Align date right"><AlignRight size={15} /></button></div></div>}</section>
    <section className={fontLoading ? "font-loading" : ""}><label>{fontLoading ? "Loading font" : "Writing font"}</label><select value={fontValue} onChange={(event) => changeFont(event.target.value)} aria-busy={fontLoading}><optgroup label="Handwritten">{handwritingFonts.map((font) => <option key={font}>{font}</option>)}</optgroup><optgroup label="Computer / book">{computerFonts.map((font) => <option key={font}>{font}</option>)}</optgroup></select><div className="setting-row top"><label>Writing size</label><span>{settings.fontSize}px</span></div><input type="range" min="14" max="28" value={settings.fontSize} onChange={(event) => update({ fontSize: Number(event.target.value) })} /></section>
    <section><label>Text color</label><div className="swatches">{inkColors.map((color) => <button key={color} style={{ background: color }} className={settings.ink === color ? "selected" : ""} onClick={() => applyTextColor(color)} aria-label={`Text ${color}`}>{settings.ink === color && <Check size={13} />}</button>)}</div><HexColorField value={settings.ink} onChange={applyTextColor} label="Text" /><small className="color-help">Applies to selected letters or the main body when nothing is selected.</small></section>
    <section><label>Paper color</label><div className="swatches light">{paperColors.map((color) => <button key={color} style={{ background: color }} className={settings.paperColor === color ? "selected" : ""} onClick={() => update({ paperColor: color })} aria-label={`Paper ${color}`}>{settings.paperColor === color && <Check size={13} />}</button>)}</div><HexColorField value={settings.paperColor} onChange={(paperColor) => update({ paperColor })} label="Paper" /></section>
    <section><label>Page border</label><div className="border-controls"><select value={settings.borderStyle} onChange={(event) => update({ borderStyle: event.target.value as BorderStyle })}><option value="solid">Solid</option><option value="double">Double</option><option value="dashed">Dashed</option><option value="none">None</option></select><select value={settings.borderWidth} onChange={(event) => update({ borderWidth: Number(event.target.value) })}><option value="1">1px</option><option value="2">2px</option><option value="3">3px</option><option value="4">4px</option></select></div><div className="swatches border-swatches">{borderColors.map((color) => <button key={color} style={{ background: color }} className={settings.borderColor === color ? "selected" : ""} onClick={() => update({ borderColor: color })} aria-label={`Border ${color}`} />)}</div><HexColorField value={settings.borderColor} onChange={(borderColor) => update({ borderColor })} label="Border" /></section>
    <section><div className="setting-row"><label>Side margin</label><span>{settings.sideMargin}px</span></div><input type="range" min="42" max="130" step="2" value={settings.sideMargin} onChange={(event) => update({ sideMargin: Number(event.target.value) })} /><div className="setting-row top"><label>Top margin</label><span>{settings.topMargin}px</span></div><input type="range" min="36" max="120" step="2" value={settings.topMargin} onChange={(event) => update({ topMargin: Number(event.target.value) })} /></section>
    <section className="toggle-setting"><div><label>Red margin line</label><span>Traditional ruled-page margin</span></div><button className={settings.marginLine ? "on" : ""} onClick={() => update({ marginLine: !settings.marginLine })} role="switch" aria-checked={settings.marginLine}><span /></button></section><button className="reset-style" onClick={() => update(defaultSettings)}>Reset to standard paper</button>
  </aside>;
}
