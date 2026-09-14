"use client";

import Link from "next/link";
import styles from "./Landing.module.css";
import { LogoMark } from "./icons";
import { Reveal, RevealStagger, RevealStaggerItem } from "./Reveal";

function BlobField({ variant = "hero" }: { variant?: "hero" | "small" }) {
  if (variant === "small") {
    return (
      <div className={styles.blob} style={{ position: "absolute", inset: 0, filter: "blur(30px)" }}>
        <div className={`${styles.blob} ${styles.blobEmber}`} style={{ width: 140, height: 140, left: -20, top: -20 }} />
        <div className={`${styles.blob} ${styles.blobTeal}`} style={{ width: 140, height: 140, left: 40, top: 0 }} />
        <div className={`${styles.blob} ${styles.blobIndigo}`} style={{ width: 140, height: 140, right: -20, top: -10 }} />
      </div>
    );
  }
  return (
    <div className={styles.blobField} aria-hidden>
      <div className={`${styles.blob} ${styles.blobEmber}`} />
      <div className={`${styles.blob} ${styles.blobTeal}`} />
      <div className={`${styles.blob} ${styles.blobIndigo}`} />
      <div className={`${styles.blob} ${styles.blobVioletSecondary}`} />
    </div>
  );
}

export function Nav({ menuOpen, onToggle }: { menuOpen: boolean; onToggle: () => void }) {
  return (
    <nav className={styles.nav}>
      <div className={styles.navLeft}>
        <Link href="/" className={styles.navLogoPill}>
          <LogoMark />
          <span className={styles.navLogoWordmark}>patchline</span>
        </Link>
        <div className={styles.navLinksPill}>
          <Link href="#how-it-works" className={styles.navLink}>
            how it works
          </Link>
          <Link href="/dashboard" className={styles.navLink}>
            dashboard
          </Link>
          <a href="https://github.com/blaxko/patchline" className={styles.navLink}>
            github
          </a>
        </div>
      </div>
      <div className={styles.navRight}>
        <span className={styles.navWordmark}>PATCHLINE</span>
        <button
          className={styles.navToggle}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={onToggle}
        >
          <span className={styles.navToggleBar} style={menuOpen ? { transform: "translateY(5.5px) rotate(45deg)" } : undefined} />
          <span className={styles.navToggleBar} style={menuOpen ? { opacity: 0 } : undefined} />
          <span className={styles.navToggleBar} style={menuOpen ? { transform: "translateY(-5.5px) rotate(-45deg)" } : undefined} />
        </button>
      </div>
    </nav>
  );
}

export function NavMobilePanel({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.navMobilePanel}>
      <Link href="#how-it-works" className={styles.navLink} onClick={onClose}>
        how it works
      </Link>
      <Link href="/dashboard" className={styles.navLink} onClick={onClose}>
        dashboard
      </Link>
      <a href="https://github.com/blaxko/patchline" className={styles.navLink} onClick={onClose}>
        github
      </a>
    </div>
  );
}

export function Hero() {
  return (
    <section className={styles.hero} id="top">
      <BlobField />
      <Reveal>
        <h1 className={styles.heroHeadline}>
          every word your
          <br />
          voice agent hears.
        </h1>
        <p className={styles.heroSubhead}>
          Most voice agents trust the transcript. Patchline doesn&apos;t — it verifies every critical detail
          against what&apos;s actually true before a single tool call fires.
        </p>
        <p className={styles.heroExplainer}>
          Patchline&apos;s job: catch what your voice agent misheard, check it against what&apos;s actually
          true, and fix it before a wrong detail becomes a wrong action.
        </p>
      </Reveal>
    </section>
  );
}

export function InteractivePill() {
  return (
    <div className={styles.interactiveWrap}>
      <Reveal className={styles.interactivePill}>
        <span className={styles.interactiveLabel}>
          <span className={styles.interactiveDot} aria-hidden />
          listening for the next misheard order ID
        </span>
        <Link href="/dashboard" className={styles.pillAmber}>
          Try Patchline
        </Link>
      </Reveal>
    </div>
  );
}

export function SecondaryBlock() {
  return (
    <Reveal className={styles.secondary}>
      <p className={styles.secondaryTagline}>Speech gets misheard. Patchline catches it before it costs you.</p>
      <p className={styles.secondaryBody}>
        A wrong order ID triggers the wrong lookup. A misheard digit turns a $18 refund into $80. Patchline
        sits between your voice agent and every tool call it makes, blocking anything built on unverified
        evidence — then asks one short question to fix it, live.
      </p>
    </Reveal>
  );
}

export function CTABanner() {
  return (
    <div className={styles.ctaBanner}>
      <Reveal className={styles.ctaBannerInner}>
        <p className={styles.ctaBannerText}>Built for the calls that can&apos;t afford to be wrong.</p>
        <Link href="/dashboard" className={styles.pillOutlineAmber}>
          Try Patchline
        </Link>
      </Reveal>
    </div>
  );
}

const BENEFITS = [
  {
    title: "Listen",
    body: "Patchline listens alongside your voice agent, in real time, on every call.",
  },
  {
    title: "Verify",
    body: "Before any detail — a name, an order number, an amount — can trigger an action, it's checked against what's actually true. No LLM guesses in this path.",
    withGlow: true,
  },
  {
    title: "Repair",
    body: "If something's unclear, Patchline asks one short, specific question — never restarts the conversation, never guesses.",
  },
  {
    title: "Learn",
    body: "Every mistake it catches becomes a permanent regression test, so the next call gets it right the first time.",
  },
];

export function BenefitsGrid() {
  return (
    <div className={styles.benefits} id="how-it-works">
      <Reveal>
        <h2 className={styles.benefitsHeading}>How Patchline stays reliable</h2>
      </Reveal>
      <RevealStagger className={styles.benefitsGrid}>
        {BENEFITS.map((b) => (
          <RevealStaggerItem
            key={b.title}
            className={`${styles.benefitCard} ${b.withGlow ? styles.benefitCardMiddle : styles.benefitCardTop}`}
          >
            {b.withGlow && (
              <div className={styles.benefitGlow}>
                <BlobField variant="small" />
              </div>
            )}
            <h3 className={styles.benefitTitle}>{b.title}</h3>
            <p className={styles.benefitBody}>{b.body}</p>
          </RevealStaggerItem>
        ))}
      </RevealStagger>
    </div>
  );
}

/** Real events from a live, non-mocked run against this system's own
 * production deployment (Call B2 in DEMO.md's script) — not a mockup of
 * hypothetical behavior. AssemblyAI misheard "ZXA-4B8K" as "ZXA-4V8K";
 * this is the actual recorded sequence that followed. */
const EVIDENCE_TIMELINE = [
  { label: "Entity detected", detail: "order_id ZXA-4V8K", highlight: false },
  { label: "lookup_order blocked", detail: "reason: ENTITY_AMBIGUOUS", highlight: false },
  { label: "Repair question spoken", detail: "“I heard Z-X-A-4-V-8-K — could you repeat the last four characters?”", highlight: false },
  { label: "Caller repeats", detail: "“four B eight K”", highlight: false },
  { label: "Entity verified", detail: "ZXA-4B8K", highlight: true },
  { label: "lookup_order allowed", detail: "real order record returned", highlight: true },
  { label: "Regression created", detail: "truth_source: caller_confirmation", highlight: false },
];

/** Real replay results from this same production deployment, not
 * illustrative numbers: the same candidate config ("Keyterms + Agent
 * Context") replayed against two different real recovered failures. It
 * fixes one and not the other — and the promotion gate only approved it
 * for the one it actually fixes, which is the entire point. */
const REPLAY_ROWS = [
  { config: "Keyterms + Agent Context", entity: "BRK-71Q9", latency: "9,614 ms", result: "FAIL" as const },
  { config: "Keyterms + Agent Context", entity: "ZXA-4B8K", latency: "8,127 ms", result: "PASS" as const },
];

export function ProofSection() {
  return (
    <div className={styles.proof}>
      <Reveal>
        <p className={styles.proofEyebrow}>The regression lab — real data</p>
        <h2 className={styles.proofHeading}>Every failure becomes a test it must pass — forever.</h2>
        <p className={styles.proofSubhead}>
          Both panels below are from a real, non-mocked run against this system&apos;s own production
          deployment — not a mockup. The same candidate configuration was replayed against two different
          recovered failures: it fixed one and not the other, and the promotion gate only approved it for
          the case it actually fixes.
        </p>
      </Reveal>
      <RevealStagger className={styles.proofGrid}>
        <RevealStaggerItem className={styles.proofCard}>
          <p className={styles.proofCardTitle}>Evidence timeline — live repair</p>
          {EVIDENCE_TIMELINE.map((row) => (
            <div key={row.label} className={styles.proofTimelineRow}>
              <span className={row.highlight ? styles.proofTimelineHighlight : undefined}>{row.label}:</span>
              <span>{row.detail}</span>
            </div>
          ))}
        </RevealStaggerItem>
        <RevealStaggerItem className={styles.proofCard}>
          <p className={styles.proofCardTitle}>Regression replay — same config, two outcomes</p>
          <table className={styles.compareTable}>
            <thead>
              <tr>
                <th>Config</th>
                <th>Entity</th>
                <th>Latency</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {REPLAY_ROWS.map((row) => (
                <tr key={row.entity}>
                  <td>{row.config}</td>
                  <td>{row.entity}</td>
                  <td>{row.latency}</td>
                  <td className={row.result === "PASS" ? styles.resultPass : styles.resultFail}>{row.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.proofFootnote}>
            The BRK case still fails under this config and was correctly excluded from promotion. Only
            the ZXA case — the one this config actually fixes — was promoted to production.
          </p>
        </RevealStaggerItem>
      </RevealStagger>
    </div>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <span>Patchline — a self-healing reliability layer for production voice agents.</span>
    </footer>
  );
}
