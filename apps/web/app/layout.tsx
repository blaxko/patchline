export const metadata = {
  title: "Patchline",
  description: "A self-healing reliability layer for production voice agents.",
};

// No page-wide colors here — the landing page ("/") has its own light theme,
// and the dashboard/login/call pages each set their own dark styling
// explicitly (they used to rely on this body default; moving it down means
// the landing page isn't stuck inheriting a dark background it never wants).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
