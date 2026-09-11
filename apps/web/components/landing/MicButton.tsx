"use client";

import Link from "next/link";
import styles from "./Landing.module.css";
import { MicGlyph } from "./icons";

/**
 * Section 7: every CTA on this page is this same circular, mic-shaped
 * button — never a rectangular pill. Idle: a slow pulsing ring (recording
 * indicator). Hover: an expanding soundwave ring. Both animations are pure
 * CSS and already respect prefers-reduced-motion (see the media query in
 * Landing.module.css) — no JS/scroll dependency, safe to ship in this
 * static checkpoint ahead of the full scroll system.
 */
export function MicButton({ label = "Start", href = "/call" }: { label?: string; href?: string }) {
  return (
    <Link href={href} className={styles.micWrap} aria-label={label}>
      <span className={styles.micButtonOuter}>
        <span className={styles.micPulseRing} />
        <span className={styles.micHoverRing} />
        <span className={styles.micButton}>
          <MicGlyph />
        </span>
      </span>
      <span className={styles.micLabel}>{label}</span>
    </Link>
  );
}
