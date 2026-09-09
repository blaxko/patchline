export const metadata = {
  title: "Patchline",
  description: "A self-healing reliability layer for production voice agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "#111", color: "#eee" }}>{children}</body>
    </html>
  );
}
