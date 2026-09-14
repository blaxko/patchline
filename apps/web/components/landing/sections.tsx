import Link from "next/link";
import styles from "./Landing.module.css";
import { MicButton } from "./MicButton";
import { Reveal, RevealStagger, RevealStaggerItem } from "./Reveal";
import { ListenIcon, VerifyIcon, RepairIcon, LearnIcon, TwoAgentsGlyph } from "./icons";

export function Hero() {
  return (
    <section className={styles.section}>
      <div className={styles.hero}>
        <Reveal className={styles.heroLeft}>
          <p className={styles.eyebrow}>Voice agent reliability</p>
          <h1 className={styles.headlineDisplay}>Every word your voice agent hears is evidence.</h1>
          <p className={styles.subheadline}>
            Patchline verifies critical speech — order IDs, refund amounts, addresses — before it can
            trigger a business action. When it&apos;s wrong, Patchline repairs it live instead of guessing.
          </p>
          <div className={styles.ctaRow} style={{ alignItems: "center" }}>
            <MicButton label="Try it" href="/dashboard" />
            <Link href="#how-it-works" className={styles.pillGhost}>
              See how it works
            </Link>
          </div>
        </Reveal>
        <Reveal className={styles.heroRight} delay={0.15}>
          <div className={styles.mockup}>
            <div className={styles.mockupHeader}>
              <span className={styles.mockupDot} />
              <span className={styles.mockupDot} />
              <span className={styles.mockupDot} />
            </div>
            <div className={styles.timelineRow}>
              <span className={styles.timelineTime}>00:18.2</span>
              <span>Caller speaks order ID</span>
            </div>
            <div className={styles.timelineRow}>
              <span className={styles.timelineTime}>00:19.4</span>
              <span className={styles.timelineHighlight}>Entity detected: BRK-7109</span>
            </div>
            <div className={styles.timelineRow}>
              <span className={styles.timelineTime}>00:19.6</span>
              <span>Validation failed</span>
            </div>
            <div className={styles.timelineRow}>
              <span className={styles.timelineTime}>00:19.7</span>
              <span>lookup_order blocked</span>
            </div>
            <div className={styles.timelineRow}>
              <span className={styles.timelineTime}>00:20.1</span>
              <span>Repair question spoken</span>
            </div>
            <div className={styles.timelineRow}>
              <span className={styles.timelineTime}>00:23.5</span>
              <span className={styles.timelineHighlight}>Entity verified: BRK-71Q9</span>
            </div>
            <div className={styles.timelineRow}>
              <span className={styles.timelineTime}>00:24.0</span>
              <span>Regression #018 created</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Real technology partners only (Section 3's own rule: no fabricated
 * logos) — AssemblyAI is the load-bearing speech provider, Groq runs both
 * agents' reasoning and TTS. Quiet text wordmarks, not graphic logos we
 * don't have rights to reproduce pixel-for-pixel. */
export function TrustRow() {
  return (
    <Reveal className={styles.trustRow}>
      <span className={styles.trustLabel}>Built with</span>
      <div className={styles.trustLogos}>
        <span className={styles.trustLogo}>AssemblyAI</span>
        <span className={styles.trustLogo}>Groq</span>
      </div>
    </Reveal>
  );
}

export function TwoAgents() {
  return (
    <section className={styles.section}>
      <div className={styles.splitSection}>
        <Reveal className={styles.splitText}>
          <p className={styles.eyebrow}>How the call is staffed</p>
          <h2 className={styles.headlineLg}>Two agents on every call. Only one talks.</h2>
          <p className={styles.subheadline} style={{ margin: 0 }}>
            Your support agent handles the conversation like normal. Patchline sits beside it,
            silently — watching every entity it extracts, and stepping in only when something
            needs to be checked before it can act.
          </p>
        </Reveal>
        <Reveal className={styles.splitVisual} delay={0.15}>
          <TwoAgentsGlyph />
        </Reveal>
      </div>
    </section>
  );
}

const PROBLEMS = [
  {
    title: "A wrong order ID",
    body: "Triggers the wrong lookup — the caller gets someone else's order status.",
  },
  {
    title: "A wrong refund amount",
    body: "One misheard digit turns eighteen dollars into an eighty-dollar mistake.",
  },
  {
    title: "A wrong shipping address",
    body: "The package goes out — to the wrong place, on the agent's confidence alone.",
  },
];

export function Problem() {
  const [flagship, ...rest] = PROBLEMS;
  return (
    <section className={`${styles.section} ${styles.sectionCentered}`}>
      <Reveal>
        <p className={styles.eyebrow}>The problem</p>
        <h2 className={styles.headlineLg}>Speech is treated as fact. It shouldn&apos;t be.</h2>
        <p className={styles.subheadline}>
          Most voice agents receive a transcript and act on it immediately. If the transcription is
          wrong, the rest of the system continues anyway — with false confidence.
        </p>
      </Reveal>
      <RevealStagger className={styles.mixedGrid}>
        <RevealStaggerItem className={styles.mixedCardLarge}>
          <h3 className={styles.featureTitle}>{flagship.title}</h3>
          <p className={styles.featureBody}>{flagship.body}</p>
        </RevealStaggerItem>
        {rest.map((p) => (
          <RevealStaggerItem key={p.title} className={styles.mixedCardSmall}>
            <h3 className={styles.featureTitle}>{p.title}</h3>
            <p className={styles.featureBody}>{p.body}</p>
          </RevealStaggerItem>
        ))}
      </RevealStagger>
    </section>
  );
}

const STEPS = [
  {
    icon: <ListenIcon />,
    title: "Listen",
    body: "Patchline listens alongside your voice agent, in real time, on every call.",
  },
  {
    icon: <VerifyIcon />,
    title: "Verify",
    body: "Before any detail like a name, an order number, or an amount can trigger an action, it's checked against what's actually true.",
  },
  {
    icon: <RepairIcon />,
    title: "Repair",
    body: "If something's unclear, Patchline asks one short, specific question — never restarts the conversation, never guesses.",
  },
  {
    icon: <LearnIcon />,
    title: "Learn",
    body: "Every mistake it catches becomes a permanent regression test, so the next call gets it right the first time.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className={`${styles.section} ${styles.sectionCentered}`}>
      <Reveal>
        <p className={styles.eyebrow}>How it works</p>
        <h2 className={styles.headlineLg}>One reliability layer, four jobs.</h2>
      </Reveal>
      <RevealStagger className={styles.featureGrid} style={{ marginTop: 24 }}>
        {STEPS.map((step) => (
          <RevealStaggerItem key={step.title} className={styles.featureCol}>
            <span className={styles.featureIcon}>{step.icon}</span>
            <h3 className={styles.featureTitle}>{step.title}</h3>
            <p className={styles.featureBody}>{step.body}</p>
          </RevealStaggerItem>
        ))}
      </RevealStagger>
    </section>
  );
}

export function RegressionShowcase() {
  return (
    <section className={`${styles.section} ${styles.sectionCentered} ${styles.midGradient}`}>
      <Reveal>
        <p className={styles.eyebrow}>The regression lab</p>
        <h2 className={styles.headlineLg}>Every failure becomes a test it must pass — forever.</h2>
        <p className={styles.subheadline}>
          A recovered failure is replayed against candidate speech configurations. A config only gets
          promoted once it passes the case that used to fail it, without breaking any case that already
          passed.
        </p>
      </Reveal>
      <Reveal delay={0.15}>
        <div className={styles.mockup} style={{ maxWidth: 560, textAlign: "left" }}>
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
              <tr>
                <td>Baseline</td>
                <td>BRK-7109</td>
                <td>412 ms</td>
                <td className={styles.resultFail}>FAIL</td>
              </tr>
              <tr>
                <td>Context v2</td>
                <td>BRK-71Q9</td>
                <td>438 ms</td>
                <td className={styles.resultPass}>PASS</td>
              </tr>
              <tr>
                <td>Keyterms v3</td>
                <td>BRK-71Q9</td>
                <td>421 ms</td>
                <td className={styles.resultPass}>PASS</td>
              </tr>
              <tr>
                <td>Combined v7</td>
                <td>BRK-71Q9</td>
                <td>429 ms</td>
                <td className={styles.resultPass}>PASS</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Reveal>
    </section>
  );
}

export function Close() {
  return (
    <section className={`${styles.section} ${styles.sectionCentered}`} style={{ paddingBottom: 40 }}>
      <Reveal>
        <h2 className={styles.headlineLg}>Built for the calls that can&apos;t afford to be wrong.</h2>
        <div className={styles.ctaRow} style={{ justifyContent: "center" }}>
          <MicButton label="Try Patchline" href="/dashboard" />
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <span>Patchline — a self-healing reliability layer for production voice agents.</span>
      <div className={styles.footerLinks}>
        <Link href="/dashboard">Try it</Link>
      </div>
    </footer>
  );
}
