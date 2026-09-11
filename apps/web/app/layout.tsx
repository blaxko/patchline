import { Inter, Space_Mono } from "next/font/google";

export const metadata = {
  title: "Patchline",
  description: "A self-healing reliability layer for production voice agents.",
};

// One app-wide font setup (DESIGN.md's own documented substitutes for its
// extracted, non-real font names — Inter for display/body, Space Mono for
// mono/eyebrow-style text) so every route — landing, dashboard, Call UI,
// login — shares it without each page re-declaring its own next/font call.
const display = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

// No page-wide colors here — the landing page has its own light theme and
// the dashboard/login/call pages each set their own dark styling explicitly,
// so only the font variables are global.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
