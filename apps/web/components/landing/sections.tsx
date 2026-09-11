import styles from "./Landing.module.css";
import { MicButton } from "./MicButton";
import { ProfileFigure, ReceiverGlyph, CheckGlyph, QuestionGlyph, LoopGlyph, MicGlyph } from "./icons";

/** Stage A (0–15%): hero. */
export function Hero() {
  return (
    <section className={`${styles.section} ${styles.hero}`}>
      <div className={styles.heroFigureWrap}>
        <ProfileFigure />
      </div>
      <div className={styles.sectionInner}>
        <h1 className={styles.headline}>
          Every word is <span className={styles.headlineLight}>evidence.</span>
        </h1>
        <p className={styles.subline}>
          Patchline makes sure your voice agent hears it right — before it acts on it.
        </p>
        <MicButton label="Start" />
        <div className={styles.scrollCue}>
          <span>Scroll</span>
          <span className={styles.scrollLine} />
        </div>
      </div>
    </section>
  );
}

/** Stage B (15–40%): the problem — mist departs, text names what breaks. */
export function Problem() {
  return (
    <section className={styles.splitSection}>
      <div className={styles.splitVisual}>
        <svg width="240" height="320" viewBox="0 0 240 320" fill="none">
          <path
            d="M40 20c30 30 20 80 60 110s90 20 110 90"
            stroke="var(--sand)"
            strokeWidth="1.5"
            strokeDasharray="2 10"
            strokeLinecap="round"
          />
          <circle cx="40" cy="20" r="3" fill="var(--sand)" />
          <circle cx="210" cy="220" r="3" fill="var(--umber)" />
        </svg>
      </div>
      <div className={styles.splitText}>
        <h2 className={styles.headline}>Speech gets misheard.</h2>
        <p className={styles.subline}>The wrong details slip through before anyone notices.</p>
        <div className={styles.problemList}>
          <div className={styles.problemItem}>A wrong order ID.</div>
          <div className={styles.problemItem}>A wrong refund amount.</div>
          <div className={styles.problemItem}>A wrong shipping address.</div>
        </div>
      </div>
    </section>
  );
}

/** Stage C (40–60%): arrival at the receiver. */
export function Receiver() {
  return (
    <section className={`${styles.section} ${styles.sectionDark}`}>
      <ReceiverGlyph className={styles.heroFigureWrap} stroke="var(--sand)" accent="var(--taupe)" />
      <div className={styles.sectionInner}>
        <h2 className={styles.headline}>Patchline listens before the system trusts.</h2>
        <p className={styles.subline}>Every detail is checked against what&apos;s actually true, before it can trigger anything.</p>
        <div className={styles.glassCard}>
          <span className={styles.glassDot} />
          listening — extracting entities
        </div>
      </div>
    </section>
  );
}

/** Stage D (50–65%): the board of resolved text. */
export function Board() {
  return (
    <section className={styles.section}>
      <div className={styles.board}>
        <div className={styles.boardLine}>
          <span className={styles.boardTimestamp}>00:18.2</span>
          <span>entity detected — order id</span>
        </div>
        <div className={styles.boardLine}>
          <span className={styles.boardTimestamp}>00:19.6</span>
          <span>validation failed — repair requested</span>
        </div>
        <div className={styles.boardLine}>
          <span className={styles.boardTimestamp}>00:23.5</span>
          <span>entity verified</span>
        </div>
      </div>
      <div className={styles.sectionInner} style={{ marginTop: 40 }}>
        <h2 className={styles.headline}>
          Every failure becomes proof. <span className={styles.headlineLight}>Every proof makes the next call better.</span>
        </h2>
        <p className={styles.subline}>Each mistake it catches is kept and re-tested, so it never happens the same way twice.</p>
      </div>
    </section>
  );
}

const STEPS = [
  {
    icon: <MicGlyph color="var(--umber)" size={22} />,
    title: "Listen",
    body: "Patchline listens alongside your voice agent, in real time, on every call.",
  },
  {
    icon: <CheckGlyph />,
    title: "Verify",
    body: "Before any detail like a name, an order number, or an amount can trigger an action, it's checked against what's actually true.",
  },
  {
    icon: <QuestionGlyph />,
    title: "Repair",
    body: "If something's unclear, Patchline asks one short, specific question — never restarts the conversation, never guesses.",
  },
  {
    icon: <LoopGlyph />,
    title: "Learn",
    body: "Every mistake it catches becomes a permanent test, so the next call gets it right the first time.",
  },
];

/** Stage E (65–85%): how it works — the one calm, explanatory stretch. */
export function HowItWorks() {
  return (
    <section className={styles.section} style={{ paddingBottom: 0 }}>
      <span className={styles.eyebrow}>How it works</span>
      <div className={styles.howItWorks}>
        <div className={styles.howLine} />
        {STEPS.map((step) => (
          <div key={step.title} className={styles.howStep}>
            <div className={styles.howStepNumber}>{step.icon}</div>
            <div>
              <h3 className={styles.howStepTitle}>{step.title}</h3>
              <p className={styles.howStepBody}>{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Stage F (85–100%): close and CTA. */
export function Close() {
  return (
    <>
      <section className={`${styles.section} ${styles.close}`}>
        <div className={styles.sectionInner}>
          <h2 className={styles.headline}>Built for the calls that can&apos;t afford to be wrong.</h2>
          <MicButton label="Try Patchline" />
        </div>
      </section>
      <footer className={styles.footer}>
        <strong style={{ color: "var(--espresso)", fontFamily: "var(--font-display)" }}>Patchline</strong>
        <span>A self-healing reliability layer for production voice agents.</span>
      </footer>
    </>
  );
}
