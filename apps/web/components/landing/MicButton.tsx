import Link from "next/link";
import styles from "./Landing.module.css";

/**
 * Primary CTA for the hero and close sections only — nav keeps its small
 * pill (DESIGN.md's own "Pill Navigation Button" pattern; this button
 * belongs beside it as the page's boldest shape, not a replacement for it).
 * Carbon Vellum fill (the design system's highest-contrast neutral against
 * the Obsidian/cosmic background, same logic as the existing pill CTAs) with
 * Iris Glow reserved for the two ring animations — DESIGN.md: "reserve Iris
 * Glow for icons, eyebrow labels, links, and active states," which a pulse/
 * hover state qualifies as, without adding a second accent color.
 */
export function MicButton({ label, href }: { label: string; href: string }) {
  return (
    <Link href={href} className={styles.micWrap} aria-label={label}>
      <span className={styles.micOuter}>
        <span className={styles.micPulseRing} />
        <span className={styles.micHoverRing} />
        <span className={styles.micCircle}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="9" y="2" width="6" height="12" rx="3" stroke="var(--obsidian)" strokeWidth="1.6" />
            <path d="M5 11a7 7 0 0 0 14 0" stroke="var(--obsidian)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M12 18v3" stroke="var(--obsidian)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M8.5 21h7" stroke="var(--obsidian)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      </span>
      <span className={styles.micLabel}>{label}</span>
    </Link>
  );
}
