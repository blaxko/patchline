"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./Landing.module.css";
import { Hero, Problem, HowItWorks, RegressionShowcase, Close, Footer } from "./sections";
import { ParallaxBackground } from "./ParallaxBackground";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "/dashboard", label: "Reliability" },
];

/**
 * Checkpoint 2: real scroll-triggered motion (Reveal/RevealStagger in
 * sections.tsx, parallax background here) on top of checkpoint 1's static
 * layout, plus a mobile hamburger nav — desktop keeps the always-visible
 * ghost links, which is the more premium/editorial choice at that width and
 * matches DESIGN.md's own nav pattern, so only mobile collapses.
 */
export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.page}>
      <ParallaxBackground />
      <nav className={styles.nav}>
        <div className={styles.navLeft}>
          <Link href="/" className={styles.navLogo}>
            Patchline
          </Link>
          <div className={styles.navLinks}>
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={styles.ghostNavLink}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className={styles.navRight}>
          <Link href="/dashboard" className={`${styles.pillFilled} ${styles.pillFilledSm}`}>
            Try it
          </Link>
          <button
            className={styles.navToggle}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className={`${styles.navToggleBar} ${menuOpen ? styles.navToggleBarOpenTop : ""}`} />
            <span className={`${styles.navToggleBar} ${menuOpen ? styles.navToggleBarOpenMiddle : ""}`} />
            <span className={`${styles.navToggleBar} ${menuOpen ? styles.navToggleBarOpenBottom : ""}`} />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className={styles.navMobilePanel}>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={styles.ghostNavLink} onClick={() => setMenuOpen(false)}>
              {link.label}
            </Link>
          ))}
        </div>
      )}

      <Hero />
      <Problem />
      <HowItWorks />
      <RegressionShowcase />
      <Close />
      <Footer />
    </div>
  );
}
