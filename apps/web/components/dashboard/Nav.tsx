"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardLive } from "../../lib/useDashboardLive";

const LINKS = [
  { href: "/", label: "Reliability Overview" },
  { href: "/sessions", label: "Live Sessions" },
  { href: "/regressions", label: "Regression Lab" },
  { href: "/configs", label: "Configurations" },
  { href: "/call", label: "Call UI" },
];

const noop = () => {};

export function Nav() {
  const pathname = usePathname();
  const { connected } = useDashboardLive(noop);

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
      <span style={{ marginLeft: "auto", color: connected ? "#8f8" : "#f84", fontSize: 11 }}>
        {connected ? "● live" : "○ reconnecting…"}
      </span>
    </nav>
  );
}
