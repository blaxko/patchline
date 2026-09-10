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

## Call C — proving the system learned

**Not yet live-verified to the same standard as Call B** — the replay table below and step 6-7's "succeeds first-pass under the promoted config" are what the mocked test suite (`demoMode.test.ts`, `replay.test.ts`) scripts and asserts on; whether `cfg_keyterms_v3`'s real `keyterms_prompt` boost actually changes a real AssemblyAI account's transcription of this specific audio, and whether `zxa_post_fix.wav` actually succeeds first-pass under a real promoted config, have not been confirmed live end-to-end. `zxa_post_fix.wav` IS confirmed (3/3 live runs) to reliably block with `ENTITY_AMBIGUOUS` under the baseline config, matching this call's setup premise — the part after promotion is the unverified part.

1. In Regression Lab, open the regression from Call B.
2. Select candidate configs: `cfg_baseline_v1` (already known-fail, for contrast) and `cfg_keyterms_v3`.
3. Click **Replay**. Result table renders:
   ```
                        ENTITY       LATENCY       RESULT
   Baseline             BRK-7109     412 ms        FAIL
   Keyterms v3          BRK-71Q9     421 ms        PASS
   ```
4. Run the full regression suite against `cfg_keyterms_v3` (button: "Run full suite") — show that previously-passing cases still pass.
5. Click **Promote**. Configuration Registry now shows `cfg_keyterms_v3` as `active`, with the promotion's suite-results snapshot visible.
6. Start a new session, clip picker → `Demo Clip: ZXA-4V8K (post-fix)` — a *different* confusable ID than Call B's, deliberately, to prove generalization rather than clip-memorization.
7. This call succeeds **first-pass** — no repair turn. Evidence Timeline shows `entity.detected → entity.verified → action.allowed` directly.
8. Reliability Overview: `first_pass_entity_success_rate` has visibly increased since setup.

## Closing line

> "Every failure becomes a test. Every verified fix makes the next call harder to break."

## Fallback plan

If live mic is unreliable in the room, the entire script above already runs on `prerecorded_clip` mode by default — there is no live-mic dependency in the primary script. If asked to prove live mic also works, Call A can be repeated in `Live Mic` mode as a bonus, not as the primary proof.

## Timing

Roughly 4–5 minutes for Calls A–C plus the closing line, fitting a typical hackathon demo slot with room for Q&A.
