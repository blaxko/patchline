"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Dashboard.module.css";
import { useDashboardLive } from "../../lib/useDashboardLive";
import { apiPost } from "../../lib/api";
import { LogoMark } from "../landing/icons";

const LINKS = [
  { href: "/dashboard", label: "Reliability Overview" },
  { href: "/sessions", label: "Live Sessions" },
  { href: "/regressions", label: "Regression Lab" },
  { href: "/configs", label: "Configurations" },
  { href: "/call", label: "Call UI" },
];

const noop = () => {};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      className={`${styles.navChevron} ${open ? styles.navChevronOpen : ""}`}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

/**
 * Floating three-element nav (iOS video-scrubber control look): a circular
 * home button, a center pill that names the current page and opens a page
 * switcher, and a circular "more" button holding Reset Demo + the live
 * status — the same destinations/actions the old horizontal link bar had,
 * just regrouped. Shared by the dashboard layout and CallUI.
 */
export function Nav() {
  const pathname = usePathname();
  const { connected } = useDashboardLive(noop);
  const [resetting, setResetting] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const current = LINKS.find((l) => pathname === l.href) ?? LINKS.find((l) => pathname.startsWith(`${l.href}/`));

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

  const closeMenus = () => {
    setPageMenuOpen(false);
    setMoreMenuOpen(false);
  };

  return (
    <nav className={styles.navRow}>
      <Link href="/dashboard" className={styles.navCircle} aria-label="Home — Reliability Overview" onClick={closeMenus}>
        <LogoMark />
      </Link>

      <div className={styles.navCenterWrap}>
        <button
          type="button"
          className={styles.navPillCenter}
          onClick={() => {
            setPageMenuOpen((v) => !v);
            setMoreMenuOpen(false);
          }}
          aria-expanded={pageMenuOpen}
        >
          {current?.label ?? "Patchline"}
          <ChevronIcon open={pageMenuOpen} />
        </button>

        {pageMenuOpen && (
          <>
            <div className={styles.navDropdownBackdrop} onClick={closeMenus} />
            <div className={styles.navDropdown}>
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenus}
                  className={`${styles.navDropdownItem} ${link.href === current?.href ? styles.navDropdownItemActive : ""}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <div className={styles.navRightWrap}>
        <button
          type="button"
          className={styles.navCircle}
          onClick={() => {
            setMoreMenuOpen((v) => !v);
            setPageMenuOpen(false);
          }}
          aria-expanded={moreMenuOpen}
          aria-label="More"
        >
          <MoreIcon />
        </button>

        {moreMenuOpen && (
          <>
            <div className={styles.navDropdownBackdrop} onClick={closeMenus} />
            <div className={`${styles.navDropdown} ${styles.navDropdownRight}`}>
              <button
                type="button"
                onClick={() => {
                  void resetDemo();
                  closeMenus();
                }}
                disabled={resetting}
                className={styles.navDropdownItem}
              >
                Reset Demo
              </button>
              <div className={styles.navDropdownStatus}>
                <span>Status</span>
                <span className={styles.liveDot} style={{ color: connected ? "#ff8a3d" : "#f37272" }}>
                  {connected ? "● live" : "○ reconnecting…"}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
