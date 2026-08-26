import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

async function render(path = "/", headers = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html", ...headers } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Penstyle application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Penstyle — Write the way you think<\/title>/i);
  assert.match(html, /aria-label="Loading Penstyle"/);
  assert.match(html, /Opening your desk/i);
  assert.match(html, /private, paper-inspired note studio/i);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/i);
});

test("serves the owner story from its route and owner hostname", async () => {
  const [routeResponse, hostResponse] = await Promise.all([
    render("/owner"),
    render("/", { host: "owner.penstyle.space" }),
  ]);
  assert.equal(routeResponse.status, 200);
  assert.equal(hostResponse.status, 200);
  const [routeHtml, hostHtml] = await Promise.all([routeResponse.text(), hostResponse.text()]);
  for (const html of [routeHtml, hostHtml]) {
    assert.match(html, /Hi, I(?:’|&#x27;)m/);
    assert.match(html, /Shivam Mazumdar/);
    assert.match(html, /t0ne\.aep/);
  }
});

test("keeps authentication OAuth-only and server secrets out of client code", async () => {
  const [app, browserClient, shareRoute, sharedDocument, styles, gitignore, background] = await Promise.all([
    readFile(new URL("../app/penstyl-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase-browser.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/share/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/shared-document.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
    stat(new URL("../public/signin-background.png", import.meta.url)),
  ]);

  assert.match(app, /onProvider\("google"\)/);
  assert.match(app, /onProvider\("x"\)/);
  assert.match(app, /onProvider\("discord"\)/);
  assert.doesNotMatch(app, /type=["']password["']|Sign in with email/i);
  assert.match(browserClient, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(browserClient, /SUPABASE_SERVICE_ROLE_KEY|service_role/);
  assert.doesNotMatch(app + browserClient, /(?:GOOGLE|TWITTER|TWTITTER|DISCORD)_CLIENT_SECRET|\bcredentials\b/);
  assert.match(shareRoute, /SUPABASE_SECRET_KEY/);
  assert.match(shareRoute, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(shareRoute, /signedInUser/);
  assert.match(shareRoute, /env\.FILES\.(?:put|get)/);
  assert.doesNotMatch(shareRoute, /\.storage|penstyl-shares|createBucket/);
  assert.match(shareRoute, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(shareRoute, /payload\.short === true/);
  assert.match(sharedDocument, /s-\[a-f0-9\]/);
  assert.match(shareRoute, /url: `\/share\/\$\{slug\}\?v=\$\{previewVersion\}`/);
  assert.match(app, /new URL\(result\.url, window\.location\.origin\)/);
  assert.match(app, /mobile-sidebar-scrim/);
  assert.match(app, /aria-expanded=\{sidebarOpen\}/);
  assert.match(app, /YOUR PERSONAL NOTEBOOK/);
  assert.match(app, /© 2026 Penstyle\. All Rights Reserved/);
  assert.match(app, /Made with/);
  assert.match(app, /mobile-tools-sheet/);
  assert.match(app, /Page tools/);
  assert.match(app, /mobile-library-sheet/);
  assert.match(app, /OAUTH_LIBRARY_KEY/);
  assert.match(app, /Use a shorter link/);
  assert.match(app, /PAPER_LAYOUT_VERSION/);
  assert.match(app, /restoreTraditionalMargins/);
  assert.match(app, /marginLine: true/);
  assert.match(styles, /\.paper-ruled,.paper-cornell \{ background-image:/);
  assert.match(styles, /\.paper-ruled \.page-writing,.paper-dot-ruled \.page-writing,.paper-cornell \.page-writing \{ background-image:none/);
  assert.match(app, /sanitizeImportedHtml\(editor\.innerHTML, editor\.innerText, true\)/);
  assert.match(gitignore, /^\/credentials$/m);
  assert.match(gitignore, /^\.env\*$/m);
  assert.ok(background.size > 100_000);
});

test("ships immediate dictation, editable PEN books, and the complete visual guide", async () => {
  const [app, guideResponse, logo, manifestSource] = await Promise.all([
    readFile(new URL("../app/penstyl-app.tsx", import.meta.url), "utf8"),
    render("/guide"),
    stat(new URL("../public/penstyle-logo.png", import.meta.url)),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(app, /Recognition\.(?:install|available)|Downloading the language pack/i);
  assert.match(app, /processLocally" in recognition\) recognition\.processLocally = false/);
  assert.match(app, /import\("vosk-browser"\)/);
  assert.match(app, /deviceId: \{ exact: selectedMicId \}/);
  assert.match(app, /format: "penstyle-book"/);
  assert.match(app, /accept="\.pen,application\/x-penstyle-book\+json"/);
  assert.match(app, /\.pen`/);
  assert.match(app, /LOCATION_KEY/);
  assert.match(app, /event\.target === event\.currentTarget && !exporting/);
  assert.match(app, /launchQueue\.setConsumer/);
  assert.match(app, /setReaderOpen\(true\)/);
  assert.match(app, /function BookReader/);
  assert.match(app, /book\.pages\.map\(\(page, index\)/);
  assert.match(app, /Close reading mode/);
  assert.equal(guideResponse.status, 200);
  const guide = await guideResponse.text();
  assert.match(guide, /Every button, panel, and control/);
  assert.match(guide, /Voice typing panel/);
  assert.match(guide, /Page style panel/);
  assert.match(guide, /Share and export panels/);
  assert.ok(logo.size > 100_000);
  const manifest = JSON.parse(manifestSource);
  assert.deepEqual(manifest.file_handlers[0].accept["application/x-penstyle-book+json"], [".pen"]);
  assert.equal(manifest.file_handlers[0].icons[0].src, "/penstyle.png");
});

test("isolates notebook storage by verified Supabase user", async () => {
  const [app, workspaceRoute, hosting] = await Promise.all([
    readFile(new URL("../app/penstyl-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  assert.match(app, /workspaceKey\(userId\)/);
  assert.match(app, /loadedUserIdRef\.current !== nextUserId/);
  assert.match(app, /setBooks\(\[\]\).*setActiveBookId\(""\).*setActivePageId\(""\)/s);
  assert.match(workspaceRoute, /admin\.auth\.getUser\(token\)/);
  assert.match(workspaceRoute, /WHERE user_id = \?/);
  assert.match(workspaceRoute, /workspaces\/\$\{user\.id\}\//);
  assert.match(workspaceRoute, /excluded\.updated_at > user_workspaces\.updated_at/);
  assert.match(workspaceRoute, /env\.FILES\.list\(\{ prefix \}\)/);
  assert.match(app, /localStorage\.setItem\(workspaceKey\(userId\), JSON\.stringify\(data\)\)/);
  assert.match(app, /saveChainRef/);
  assert.match(app, /\[screen, activePage\?\.id, activePage\?\.contentHtml, activePage\?\.titleHtml\]/);
  assert.match(app, /function BookAppearanceDialog/);
  assert.match(app, /Change book colors/);
  assert.match(app, /await document\.fonts\.load/);
  assert.match(app, /generation !== fontChangeRef\.current/);
  assert.doesNotMatch(workspaceRoute, /payload\.(?:userId|email)|payload\[(?:"|')user/);
  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, "FILES");
  assert.match(hostingConfig.project_id, /^appgprj_/);
});
