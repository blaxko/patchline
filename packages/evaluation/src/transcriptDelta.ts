export interface DeltaEntry {
  type: "equal" | "added" | "removed";
  word: string;
}

/**
 * Simple LCS-based word diff — catches collateral damage from a config
 * change (e.g. keyterms boosting one ID but mangling a nearby word), per
 * PRD.md §9 Step 8. Inputs are small (one turn's worth of words), so a plain
 * O(n*m) LCS table is more than fast enough.
 */
export function computeTranscriptDelta(before: string, after: string): DeltaEntry[] {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);

  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const delta: DeltaEntry[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      delta.push({ type: "equal", word: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      delta.push({ type: "removed", word: a[i] });
      i++;
    } else {
      delta.push({ type: "added", word: b[j] });
      j++;
    }
  }
  while (i < a.length) {
    delta.push({ type: "removed", word: a[i] });
    i++;
  }
  while (j < b.length) {
    delta.push({ type: "added", word: b[j] });
    j++;
  }

  return delta;
}
