// DESIGN.md: "Icons throughout the UI are thin-stroke, single-color Iris
// Glow, 24px, outlined style. No filled iconography anywhere."

const common = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "var(--iris-glow)",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function ListenIcon() {
  return (
    <svg {...common}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M8.5 21h7" />
    </svg>
  );
}

export function VerifyIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9" />
    </svg>
  );
}

export function RepairIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" />
      <circle cx="12" cy="16.5" r="0.9" fill="var(--iris-glow)" stroke="none" />
    </svg>
  );
}

export function LearnIcon() {
  return (
    <svg {...common}>
      <path d="M5 12a7 7 0 0 1 12-5m2 5a7 7 0 0 1-12 5" />
      <path d="M17 3v4h-4" />
      <path d="M7 21v-4h4" />
    </svg>
  );
}

/**
 * Abstract illustration for the split "two agents" section — deliberately
 * not a literal robot/headset/human figure (Section 4 of the layout brief:
 * "simple SVG/line-art or abstract gradient shapes, not photorealistic 3D
 * renders"). Two overlapping nodes (the support agent and the reliability
 * supervisor watching it) inside a loose orbit, same thin-stroke language
 * as the small icons above, just larger.
 */
export function TwoAgentsGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 280 280" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="140" cy="140" r="110" stroke="var(--charcoal)" strokeWidth="1.5" strokeDasharray="3 8" />
      <circle cx="112" cy="130" r="52" stroke="var(--twilight)" strokeWidth="1.5" fill="rgba(79, 79, 128, 0.08)" />
      <circle cx="176" cy="158" r="34" stroke="var(--iris-glow)" strokeWidth="1.5" fill="rgba(97, 153, 246, 0.08)" />
      <path d="M138 140 168 155" stroke="var(--iris-glow)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 6" />
      <circle cx="138" cy="140" r="3" fill="var(--carbon-vellum)" />
      <circle cx="176" cy="158" r="3" fill="var(--iris-glow)" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg {...common}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
