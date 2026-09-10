# DEMO.md

Demo script for judges. Uses `prerecorded_clip` mode (`PRD.md` §9 Step 15) so the story is reproducible regardless of live mic/network conditions. A live-mic variant of the same script works identically once Steps 3–10 are implemented, and can be substituted if the room supports it.

Before starting: click **Reset Demo** in the dashboard header (`POST /api/demo/reset`) to restore the seeded database, seeded baseline config, and clear any regressions/promotions from a prior run.

## Setup

1. Open the Operator Dashboard → **Reliability Overview**. Point out `first_pass_entity_success_rate` and `regression_closure_rate` starting at their seeded baseline.
2. Open **Live Sessions** in a second panel/tab.

## Call A — clean success

1. Start a session, clip picker → `Live Mic` or a clean demo clip ("What's the status of order BRK-71Q9?").
2. Transcript is correct; Evidence Timeline shows `entity.detected → entity.verified → action.allowed` with no repair step.
3. Agent reads back tracking status. No regression created.
4. Say: *"This is the boring path — most demos stop here."*

## Call B — live repair (the core mechanism)

1. Start a new session, clip picker → `Demo Clip: BRK-71Q9 (known failure)`.
2. The clip is transcribed as `BRK-7109` in the mocked-AssemblyAI test suite, which scripts and asserts on this exact string. **On a live, non-mocked AssemblyAI account, this specific clip is not a reliable way to trigger the mis-hearing**: 5 careful live streams of it (real trailing silence, proper turn finalization — see `TASKS.md`'s "Live re-verification" addendum) all came back correctly transcribed as `BRK-71Q9`, meaning `lookup_order` was allowed immediately with no repair triggered. If demoing live with this exact clip, do not assume Call B's block-and-repair sequence will actually occur — it may just succeed first-pass. Treat the mocked test suite as the reliable proof of the repair mechanism, and either accept that a live run of Call B may not need repair, or generate a fresh clip / use a real recorded voice and verify it actually mis-transcribes before demoing it live.
3. Evidence Timeline updates live:
   ```
   Entity detected: BRK-7109
   Validation failed
   lookup_order blocked  (reason: ENTITY_NOT_FOUND)
   Repair question spoken: "I heard B-R-K-7-1-0-9 — could you repeat the last four characters?"
   Caller confirms "71Q9"
   Entity verified: BRK-71Q9
   lookup_order allowed
   Regression #___ created
   ```
4. Say: *"Nothing was silently guessed — the fix required the caller's own confirmation, not the model's confidence."*
5. Switch to **Regression Lab** — the new regression card is already there with the captured audio clip attached and playable.

## Call C — proving the system learned

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
