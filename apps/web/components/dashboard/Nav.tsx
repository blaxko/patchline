"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Dashboard.module.css";
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
    <nav className={styles.nav}>
      <strong className={styles.navLogo}>Patchline</strong>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={pathname === link.href ? styles.navLinkActive : styles.navLink}>
          {link.label}
        </Link>
      ))}
      <div className={styles.navSpacer} style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => void resetDemo()} disabled={resetting} className={styles.button}>
          Reset Demo
        </button>
        <span className={styles.liveDot} style={{ color: connected ? "#6199f6" : "#f37272" }}>
          {connected ? "● live" : "○ reconnecting…"}
        </span>
      </div>
    </nav>
  );
}
