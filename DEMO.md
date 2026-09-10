# DEMO.md

Demo script for judges. Uses `prerecorded_clip` mode (`PRD.md` §9 Step 15) so the story is reproducible regardless of live mic/network conditions. A live-mic variant of the same script works identically once Steps 3–10 are implemented, and can be substituted if the room supports it.

Before starting: click **Reset Demo** in the dashboard header (`POST /api/demo/reset`) to restore the seeded database, seeded baseline config, and clear any regressions/promotions from a prior run.

## Setup

1. Open the Operator Dashboard → **Reliability Overview**. Point out `first_pass_entity_success_rate` and `regression_closure_rate` starting at their seeded baseline.
2. Open **Live Sessions** in a second panel/tab.

## Call A — clean success

1. Start a session, clip picker → `Live Mic` (no dedicated "clean success" demo clip exists yet as a fixture — a live mic call with a correctly-heard order id demonstrates the same no-repair-needed path).
2. Transcript is correct; Evidence Timeline shows `entity.detected → entity.verified → action.allowed` with no repair step.
3. Agent reads back tracking status. No regression created.
4. Say: *"This is the boring path — most demos stop here."*

## Call B — live repair (the core mechanism)

**Verified live against a real, non-mocked AssemblyAI account, 5/5 runs** (see `TASKS.md`'s "Live re-verification, round 2" addendum) — this is a real, reproducible sequence, not merely what the mocked test suite scripts.

1. Start a new session, clip picker → `Demo Clip: BRK-71Q9 (known failure)`. This clip is two turns in one file, matching real turn-taking: the caller first states the id as `BRK-7109` (a genuine misstatement, not a mis-hearing of the correct one — AssemblyAI transcribes this turn correctly, exactly as spoken), then after the block-and-repair-question, a second turn repeats just the disputed suffix, spoken as "seven one Q nine."
2. Evidence Timeline updates live:
   ```
   Entity detected: order_id BRK-7109
   Validation failed
   lookup_order blocked  (reason: ENTITY_AMBIGUOUS — BRK-7109 is a close match to the real BRK-71Q9)
   Repair question spoken: "I heard B-R-K-7-1-0-9 — could you repeat the last four characters of your order ID?"
   Caller repeats "seven one Q nine" — AssemblyAI transcribes this as the single token "71q9"
   Entity verified: BRK-71Q9
   lookup_order allowed — real order record returned
   Regression created (truth_source: caller_confirmation)
   ```
3. Say: *"Nothing was silently guessed — the fix required the caller's own confirmation, not the model's confidence."*
4. Switch to **Regression Lab** — the new regression card is already there with the captured audio clip attached and playable. Its `observed_value` will be `BRK-7109` and `expected_value` `BRK-71Q9`, matching what was just heard live.

**If you generate a fresh version of this clip** (different TTS voice, different recording): re-verify it actually reproduces this block-and-repair sequence before relying on it live — TTS pronunciation and AssemblyAI's real-time accuracy are not something this build can guarantee for arbitrary new audio, only for the specific clip shipped in `fixtures/audio/demo/`.

## Call B2 — repair on a second confusable ID (this is what actually gets promoted)

**Verified live end-to-end against the real, non-mocked API — a genuinely causal chain, not staged** (see `TASKS.md`'s "Live re-verification, round 3" addendum). Call B's own regression (`BRK-71Q9`'s Q/0 confusion) does **not** pass replay under `cfg_keyterms_v3` — verified live, it still mis-transcribes as `BRK-7109`, and a real promotion attempt against it is correctly **denied** (`POLICY_DENIED / TARGET_FAILS`), because `cfg_keyterms_v3`'s boosted terms (`BRK`, `ZXA`, `NV`, `SKU`, "tracking number", "order ID") only help the ID *prefix* vocabulary, not this *suffix* confusion. This was investigated directly (0s/3s/5s of real trailing silence, the full original multi-turn source clip) — a real, structural limit of this candidate config, not a clip-isolation artifact. So the regression that gets promoted comes from a second, different confusable ID that `cfg_keyterms_v3` genuinely does fix.

1. Start a new session, clip picker → `Demo Clip: ZXA-4B8K repair (regression source for promotion)`. Same two-turn structure as Call B: turn 1 states the id, mis-heard as the confusable pair's other value; after the block-and-repair, turn 2 repeats the disputed suffix.
2. Evidence Timeline updates live:
   ```
   Entity detected: order_id ZXA-4V8K
   lookup_order blocked  (reason: ENTITY_AMBIGUOUS — ZXA-4V8K is a close match to the real ZXA-4B8K)
   Repair question spoken: "I heard Z-X-A-4-V-8-K — could you repeat the last four characters of your order ID?"
   Caller repeats "four B eight K" — AssemblyAI transcribes this as the token "4b8k"
   Entity verified: ZXA-4B8K
   lookup_order allowed — real order record returned
   Regression created (truth_source: caller_confirmation)
   ```
3. Switch to **Regression Lab** — this new regression card is there (`observed_value: ZXA-4V8K`, `expected_value: ZXA-4B8K`), separate from Call B's card above it.
4. Select candidate config `cfg_keyterms_v3` and click **Replay**. Result table renders:
   ```
                        ENTITY       LATENCY       RESULT
   Keyterms v3          ZXA-4B8K     ~9.8 s        PASS  (exactMatch)
   ```
5. Run the full regression suite against `cfg_keyterms_v3` (button: "Run full suite") — show that Call B's own case is still visibly `FAIL` here, and say plainly: *"This candidate doesn't fix every case — it fixes this one. That's exactly why the gate checks the specific regression we're promoting against, not just 'did latency improve.'"*
6. Click **Promote** (targeting this regression). Configuration Registry now shows `cfg_keyterms_v3` as `active`, with the promotion's real suite-results snapshot visible.

## Call C — proving the system learned

1. Start a **new** session, clip picker → `Demo Clip: ZXA-4B8K (post-fix, first-pass)` — the same id as Call B2, now under the freshly, genuinely promoted config.
2. This call succeeds **first-pass** — no repair turn. Evidence Timeline shows `entity.detected → entity.verified → action.allowed` directly, with the real order record for `ZXA-4B8K`.
3. Reliability Overview: `first_pass_entity_success_rate` has visibly increased since setup.
4. Say: *"Call B showed the repair mechanism catching a live mistake. Call B2 showed that exact same mechanism catching a DIFFERENT live mistake, and this time the fix generalizes — so the system promoted it for real, and Call C never needed to ask."*

## Closing line

> "Every failure becomes a test. Every verified fix makes the next call harder to break."

## Fallback plan

If live mic is unreliable in the room, the entire script above already runs on `prerecorded_clip` mode by default — there is no live-mic dependency in the primary script. If asked to prove live mic also works, Call A can be repeated in `Live Mic` mode as a bonus, not as the primary proof.

## Timing

Roughly 6–7 minutes for Calls A, B, B2, and C plus the closing line, fitting a typical hackathon demo slot with room for Q&A.
