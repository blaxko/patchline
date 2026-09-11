import Link from "next/link";
import styles from "./Landing.module.css";
import { Hero, Problem, HowItWorks, RegressionShowcase, Close, Footer } from "./sections";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "/dashboard", label: "Reliability" },
];

/**
 * Checkpoint 1 of the rebuilt (Frame.io-derived, dark) direction: static
 * layout, real copy, full color/type/spacing system from DESIGN.md applied,
 * no motion yet. Confirmed by an actual browser screenshot before this was
 * shown, per the "build, screenshot, look, iterate" discipline the mist
 * version should have followed from the start.
 */
export function LandingPage() {
  return (
    <div className={styles.page}>
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
          <Link href="/dashboard" className={styles.signInLink}>
            Sign in
          </Link>
          <Link href="/call" className={`${styles.pillFilled} ${styles.pillFilledSm}`}>
            Try it
          </Link>
        </div>
      </nav>

      <Hero />
      <Problem />
      <HowItWorks />
      <RegressionShowcase />
      <Close />
      <Footer />
    </div>
  );
}
