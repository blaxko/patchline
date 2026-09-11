"use client";

import Link from "next/link";
import styles from "./Landing.module.css";
import { Hero, Problem, Receiver, Board, HowItWorks, Close } from "./sections";

const NAV_LINKS = [
  { href: "/call", label: "Try it" },
  { href: "#how-it-works", label: "How it works" },
  { href: "/dashboard", label: "Operator" },
];

/**
 * Checkpoint 1 (per the user's own request): static layout, real copy, the
 * full color/type system, and the mic CTA's own lightweight CSS pulse — but
 * NOT yet the scroll-scrubbed mist/particle system from Section 6 of the
 * brief. Each stage renders in its settled/resolved state, which doubles as
 * the prefers-reduced-motion fallback content once the animated version
 * exists — nothing here needs to change for that later, only be layered
 * on top of.
 */
export function LandingPage() {
  return (
    <div className={styles.page}>
      <div className={styles.grain} aria-hidden />
      <nav className={styles.nav}>
        <span className={styles.navLogo}>Patchline</span>
        <div className={styles.navLinks}>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={styles.navLink}>
              {link.label}
            </Link>
          ))}
        </div>
      </nav>

      <Hero />
      <Problem />
      <Receiver />
      <Board />
      <div id="how-it-works">
        <HowItWorks />
      </div>
      <Close />
    </div>
  );
}
