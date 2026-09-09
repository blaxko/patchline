// Maps a spoken word (as AssemblyAI would transcribe it) to the literal
// character it stands for, so callers spelling out an ID character-by-character
// ("seven one Q nine", "B as in bravo") normalize to the same value as a
// caller who reads the ID as a single formatted token ("BRK-71Q9").
const DIGIT_WORDS: Record<string, string> = {
  zero: "0",
  oh: "0",
  o: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

const NATO_WORDS: Record<string, string> = {
  alpha: "A",
  alfa: "A",
  bravo: "B",
  charlie: "C",
  delta: "D",
  echo: "E",
  foxtrot: "F",
  golf: "G",
  hotel: "H",
  india: "I",
  juliet: "J",
  juliett: "J",
  kilo: "K",
  lima: "L",
  mike: "M",
  november: "N",
  oscar: "O",
  papa: "P",
  quebec: "Q",
  romeo: "R",
  sierra: "S",
  tango: "T",
  uniform: "U",
  victor: "V",
  whiskey: "W",
  xray: "X",
  "x-ray": "X",
  yankee: "Y",
  zulu: "Z",
};

const FILLER_WORDS = new Set(["dash", "hyphen", "as", "in", "the", "letter", "number", "and"]);

/**
 * Maps one token (already lowercased) to the character(s) it represents, or
 * null if the token contributes nothing (unmapped, non-filler) and should
 * abort the surrounding candidate window.
 */
export function tokenToChars(token: string): string | null {
  const clean = token.replace(/[.,!?]/g, "");
  if (clean === "") return "";
  if (clean in DIGIT_WORDS) return DIGIT_WORDS[clean];
  if (clean in NATO_WORDS) return NATO_WORDS[clean];
  if (FILLER_WORDS.has(clean)) return "";
  // A single already-literal character (AssemblyAI transcribing a spelled-out
  // "B" or "9" as itself). Deliberately NOT extended to short multi-char
  // words — that would let ordinary short English words ("cat", "the")
  // masquerade as ID characters once concatenated across a token window.
  if (/^[a-z0-9]$/i.test(clean)) return clean.toUpperCase();
  return null;
}

/**
 * Attempts to map a whole run of tokens into a single uppercase character
 * string, returning null the moment a token can't be interpreted.
 */
export function mapTokensToChars(tokens: string[]): string | null {
  let out = "";
  for (const t of tokens) {
    const mapped = tokenToChars(t.toLowerCase());
    if (mapped === null) return null;
    out += mapped;
  }
  return out;
}
