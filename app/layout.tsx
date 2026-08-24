import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://penstyle.space"),
  title: "Penstyle — Write the way you think",
  description: "A private, paper-inspired note studio with handwriting styles, voice input, and flexible exports.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/penstyle.png", shortcut: "/penstyle.png", apple: "/penstyle.png" },
};

const startupSurfaceScript = `(() => {
  try {
    const oauthReturn = sessionStorage.getItem("penstyl-oauth-pending") === "1";
    if (oauthReturn) document.documentElement.dataset.penstyleOauthReturn = "true";
    const hasSession = Object.keys(localStorage).some((key) => {
      if (!/^sb-.*-auth-token$/.test(key)) return false;
      try {
        const value = JSON.parse(localStorage.getItem(key) || "null");
        const session = value?.access_token ? value : value?.currentSession;
        if (!session?.access_token) return false;
        const userId = session?.user?.id;
        if (userId) document.documentElement.dataset.penstyleStartupUser = userId;
        return true;
      } catch { return false; }
    });
    if (!hasSession && !oauthReturn) return;
    document.documentElement.dataset.penstyleAuthenticated = "true";
    const userId = document.documentElement.dataset.penstyleStartupUser || "";
    const locationKey = userId ? "penstyl-last-location-v2:" + userId : "penstyl-last-location-v1";
    const location = JSON.parse(localStorage.getItem(locationKey) || "null");
    const hasBook = !oauthReturn && location?.screen === "book" && Boolean(location?.activeBookId);
    document.documentElement.dataset.penstyleStartup = hasBook ? "book" : "library";
    if (location?.dark) document.documentElement.dataset.penstyleStartupTheme = "dark";
  } catch {}
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: startupSurfaceScript }} /></head><body>{children}</body></html>;
}
