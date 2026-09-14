"use client";

import { useState } from "react";
import styles from "./Landing.module.css";
import { Nav, NavMobilePanel, Hero, InteractivePill, SecondaryBlock, LogoStrip, CTABanner, BenefitsGrid, ProofSection, Footer } from "./sections";

/**
 * Checkpoint 3 (static): full rebuild against securify-ui-prompt.md — dark,
 * pure-black ground, one abstract gradient blob as the sole color source,
 * pill nav/buttons, floating stat callouts, mid-page interactive pill,
 * benefits triptych. No scroll motion or blob drift yet — reviewing this
 * static layout first before any animation pass, same process as the last
 * two checkpoints.
 */
export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.page}>
      <Nav menuOpen={menuOpen} onToggle={() => setMenuOpen((v) => !v)} />
      {menuOpen && <NavMobilePanel onClose={() => setMenuOpen(false)} />}

      <Hero />
      <InteractivePill />
      <SecondaryBlock />
      <LogoStrip />
      <BenefitsGrid />
      <ProofSection />
      <CTABanner />
      <Footer />
    </div>
  );
}
