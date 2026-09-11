// Restrained line-art glyphs shared across the landing page — same visual
// register everywhere (thin stroke, no fill, sand/umber tones), per the
// brief's "one clean hero object" rule (Section 5, Stage C) rather than a
// mismatched icon pack.

export function MicGlyph({ color = "var(--cream)", size = 28 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="9" y="2" width="6" height="12" rx="3" stroke={color} strokeWidth="1.5" />
      <path d="M5 11a7 7 0 0 0 14 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 18v3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.5 21h7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Stage A/B: a woman's profile, calm, a still wisp beginning at her mouth.
 * A solid silhouette (not thin outline strokes) — the classic, instantly-
 * readable way to depict a calm face in profile, which the previous
 * thin-line version didn't achieve. */
export function ProfileFigure({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M85 15
           C108 16 122 34 126 58
           C128 68 133 72 140 78
           C144 82 143 87 137 88
           C132 89 129 92 131 97
           C132 101 129 104 124 103
           C119 102 116 105 118 110
           C120 116 116 120 109 119
           C103 118 100 122 102 128
           C105 136 100 143 90 148
           C84 151 82 158 84 168
           C86 185 84 205 78 225
           C74 240 78 252 90 260
           L18 260
           C24 250 24 236 20 222
           C13 198 13 174 18 152
           C10 122 15 92 32 66
           C40 54 48 46 55 38
           C62 24 72 15 85 15 Z"
        fill="var(--espresso)"
      />
      {/* still wisp beginning at the lips */}
      <circle cx="141" cy="87" r="2.2" fill="var(--sand)" opacity="0.85" />
      <circle cx="150" cy="84" r="1.5" fill="var(--sand)" opacity="0.6" />
      <circle cx="157" cy="89" r="1" fill="var(--sand)" opacity="0.4" />
    </svg>
  );
}

/** Stage C: minimal line-art receiver, deliberately not cartoonish. Defaults
 * suit a light background; the Receiver section itself is now dark (Section
 * 3's "contrast from value"), so it passes lighter stroke colors in. */
export function ReceiverGlyph({
  className,
  stroke = "var(--umber)",
  accent = "var(--sand)",
}: {
  className?: string;
  stroke?: string;
  accent?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="40" y="30" width="80" height="70" rx="12" stroke={stroke} strokeWidth="1.5" />
      <circle cx="62" cy="60" r="5" stroke={stroke} strokeWidth="1.5" />
      <circle cx="98" cy="60" r="5" stroke={stroke} strokeWidth="1.5" />
      <path d="M62 78h36" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M80 100v14" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M56 128h48" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M80 114v14" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M30 50c-6 4-6 16 0 20" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M130 50c6 4 6 16 0 20" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CheckGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="var(--umber)" strokeWidth="1.5" />
      <path d="M8 12.5l2.5 2.5L16 9" stroke="var(--umber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function QuestionGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="var(--umber)" strokeWidth="1.5" />
      <path
        d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7"
        stroke="var(--umber)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.5" r="0.9" fill="var(--umber)" />
    </svg>
  );
}

export function LoopGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 12a7 7 0 0 1 12-5m2 5a7 7 0 0 1-12 5"
        stroke="var(--umber)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M17 3v4h-4" stroke="var(--umber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 21v-4h4" stroke="var(--umber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
