import { mapTokensToChars } from "./spokenNormalizer.js";
import type { ExtractedCandidate } from "./entityTypes.js";

export interface RawCandidate {
  rawText: string;
  normalizedValue: string;
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function withDashAfter(chars: string, prefixLen: number): string {
  return `${chars.slice(0, prefixLen)}-${chars.slice(prefixLen)}`;
}

/**
 * Scans token windows of the given lengths for a run that, once spoken-word
 * normalized, matches `corePattern` (the ID shape with no separators). Used
 * for IDs a caller might spell out character-by-character ("seven one Q
 * nine") as well as read as a single formatted token ("BRK-71Q9").
 */
function scanTokenWindows(
  text: string,
  windowSizes: number[],
  corePattern: RegExp,
  dashAfter: number,
): RawCandidate[] {
  const tokens = tokenize(text);
  const found: RawCandidate[] = [];

  for (const size of windowSizes) {
    for (let i = 0; i + size <= tokens.length; i++) {
      const window = tokens.slice(i, i + size);
      const mapped = mapTokensToChars(window);
      if (mapped && corePattern.test(mapped)) {
        found.push({ rawText: window.join(" "), normalizedValue: withDashAfter(mapped, dashAfter) });
      }
    }
  }

  return found;
}

function dedupe(candidates: RawCandidate[]): RawCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c.normalizedValue)) return false;
    seen.add(c.normalizedValue);
    return true;
  });
}

// --- order_id: [A-Z]{2,3}-[A-Z0-9]{4}, e.g. BRK-71Q9, ZXA-4B8K, NV-15O2 ---

// Dash is required for the "direct" pattern — without it, this would match
// plain 6-7 letter English words (e.g. "Siobhan", "Mercer") as false-positive
// order ids. A caller reading an ID aloud without the dash is instead caught
// by the spoken token-window scan below, which is constrained to a run of
// short standalone word-tokens rather than an arbitrary word's letters.
const ORDER_ID_DIRECT_RE = /\b([A-Za-z]{2,3})-([A-Za-z0-9]{4})\b/g;

export function extractOrderIds(text: string): RawCandidate[] {
  const direct: RawCandidate[] = [];
  for (const m of text.matchAll(ORDER_ID_DIRECT_RE)) {
    direct.push({ rawText: m[0], normalizedValue: `${m[1].toUpperCase()}-${m[2].toUpperCase()}` });
  }

  const spoken3 = scanTokenWindows(text, [7], /^[A-Z]{3}[A-Z0-9]{4}$/, 3);
  const spoken2 = scanTokenWindows(text, [6], /^[A-Z]{2}[A-Z0-9]{4}$/, 2);

  return dedupe([...direct, ...spoken3, ...spoken2]);
}

// --- tracking_id: TRK-99999 (4-6 digits) ---

const TRACKING_ID_DIRECT_RE = /\b(TRK)-?(\d{4,6})\b/gi;

export function extractTrackingIds(text: string): RawCandidate[] {
  const direct: RawCandidate[] = [];
  for (const m of text.matchAll(TRACKING_ID_DIRECT_RE)) {
    direct.push({ rawText: m[0], normalizedValue: `TRK-${m[2]}` });
  }

  const spoken = scanTokenWindows(text, [7, 8, 9], /^TRK\d{4,6}$/, 3);

  return dedupe([...direct, ...spoken]);
}

// --- product_sku: e.g. WBH-100, WBH-100X — rule pass handles the formatted
// token a caller reads aloud; spoken-digit spelling is not covered (LLM
// fallback scope), a deliberate simplification documented in TASKS.md.

const SKU_DIRECT_RE = /\b[A-Z0-9]{2,}(?:-[A-Z0-9]{2,})+\b/g;

export function extractProductSkus(text: string): RawCandidate[] {
  const found: RawCandidate[] = [];
  for (const m of text.matchAll(SKU_DIRECT_RE)) {
    found.push({ rawText: m[0], normalizedValue: m[0].toUpperCase() });
  }
  return dedupe(found);
}

// --- coupon_code: generic alphanumeric code, must mix letters and digits ---

const COUPON_CODE_RE = /\b(?=[A-Z0-9]{5,12}\b)(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]{5,12}\b/gi;

export function extractCouponCodes(text: string): RawCandidate[] {
  const found: RawCandidate[] = [];
  for (const m of text.matchAll(COUPON_CODE_RE)) {
    found.push({ rawText: m[0], normalizedValue: m[0].toUpperCase() });
  }
  return dedupe(found);
}

// --- email: handles literal addresses and STT's spoken-out rendering
// ("john at example dot com") ---

const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;

export function extractEmails(text: string): RawCandidate[] {
  const rewritten = text
    .replace(/\s+at\s+/gi, "@")
    .replace(/\s+dot\s+/gi, ".");

  const found: RawCandidate[] = [];
  for (const m of rewritten.matchAll(EMAIL_RE)) {
    found.push({ rawText: m[0], normalizedValue: m[0].toLowerCase() });
  }
  return dedupe(found);
}

// --- phone_number: formatted numbers, or 7-15 consecutive spoken digit words ---

const PHONE_DIRECT_RE = /\b(?:\+?\d[\d\-. ]{6,}\d)\b/g;

export function extractPhoneNumbers(text: string): RawCandidate[] {
  const direct: RawCandidate[] = [];
  for (const m of text.matchAll(PHONE_DIRECT_RE)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) {
      direct.push({ rawText: m[0], normalizedValue: digits });
    }
  }

  const spoken: RawCandidate[] = [];
  const tokens = tokenize(text);
  for (let len = 10; len >= 7; len--) {
    for (let i = 0; i + len <= tokens.length; i++) {
      const window = tokens.slice(i, i + len);
      const mapped = mapTokensToChars(window);
      if (mapped && /^\d+$/.test(mapped)) {
        spoken.push({ rawText: window.join(" "), normalizedValue: mapped });
      }
    }
  }

  return dedupe([...direct, ...spoken]);
}

export function extractRulePassEntities(text: string): ExtractedCandidate[] {
  const out: ExtractedCandidate[] = [];
  const push = (type: ExtractedCandidate["entityType"], candidates: RawCandidate[]) => {
    for (const c of candidates) {
      out.push({ entityType: type, rawText: c.rawText, normalizedValue: c.normalizedValue, source: "rule" });
    }
  };

  const orderIds = extractOrderIds(text);
  push("order_id", orderIds);
  push("tracking_id", extractTrackingIds(text));

  // A token shaped like an order id (e.g. BRK-7109) also matches the generic
  // hyphenated-SKU pattern. Suppress it as a SKU candidate only when the
  // *exact same value* was already extracted as an order_id in this turn —
  // this avoids one spoken span proposing two competing tool calls (and two
  // competing repairs) for the same characters, without discarding a
  // legitimately SKU-only value that happens to share the same shape
  // (e.g. the WBH-100/WBH-100X confusable pair, PRD.md §4).
  const orderIdValues = new Set(orderIds.map((c) => c.normalizedValue));
  push(
    "product_sku",
    extractProductSkus(text).filter((c) => !orderIdValues.has(c.normalizedValue)),
  );
  push("coupon_code", extractCouponCodes(text));
  push("email", extractEmails(text));
  push("phone_number", extractPhoneNumbers(text));

  return out;
}
