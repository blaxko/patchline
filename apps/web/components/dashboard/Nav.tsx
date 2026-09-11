"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardLive } from "../../lib/useDashboardLive";
import { apiPost } from "../../lib/api";

const LINKS = [
  { href: "/dashboard", label: "Reliability Overview" },
  { href: "/sessions", label: "Live Sessions" },
  { href: "/regressions", label: "Regression Lab" },
  { href: "/configs", label: "Configurations" },
  { href: "/call", label: "Call UI" },
];

const noop = () => {};

export function Nav() {
  const pathname = usePathname();
  const { connected } = useDashboardLive(noop);
  const [resetting, setResetting] = useState(false);

  const resetDemo = async () => {
    if (!window.confirm("Reset demo state? This clears all sessions, regressions, and promotions.")) return;
    setResetting(true);
    try {
      await apiPost("/api/demo/reset");
      window.location.reload();
    } finally {
      setResetting(false);
    }
  };

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "10px 20px",
        borderBottom: "1px solid #333",
        fontFamily: "monospace",
        fontSize: 13,
      }}
    >
      <strong style={{ marginRight: 8 }}>Patchline</strong>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          style={{
            color: pathname === link.href ? "#8cf" : "#ccc",
            textDecoration: "none",
          }}
        >
          {link.label}
        </Link>
      ))}
      <button onClick={() => void resetDemo()} disabled={resetting} style={{ marginLeft: "auto" }}>
        Reset Demo
      </button>
      <span style={{ color: connected ? "#8f8" : "#f84", fontSize: 11 }}>{connected ? "● live" : "○ reconnecting…"}</span>
    </nav>
  );
}
