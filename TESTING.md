# TESTING.md

Testing strategy for Patchline. The governing rule (brief technical rule #9 and Step 14): **test the business outcome, not just the transcript.** A passing transcript diff proves nothing on its own — the tests below assert that the right tool was called, the wrong tool was blocked, the right regression was created with the right provenance, and a promoted config actually holds the line on the existing suite.

## Test pyramid

### Unit tests (`/tests/unit`, colocated `*.test.ts` also acceptable per workspace)
- Entity normalization: every regex/spoken-form normalizer in `packages/schemas`, against the confusable-ID fixture set (`PRD.md` §4) and the adversarial fixture set (`PRD.md` Step 14).
- Validator rules: each Commerce Sandbox validator, success/not-found/ambiguous/ineligible cases.
- Policy decisions: Action Gate's `evaluate()` (`PRD.md` §7) against every `(tool, evidence-state)` combination in the evidence policy table — this table should be exhaustively enumerated in one parameterized test file.
- Config scoring: replay scoring function (`exact_match`, `normalized_match`, `transcript_delta`) in `packages/evaluation`, pure-function, no network/DB.
- Regression pass/fail logic and promotion-gate logic (`packages/evaluation`), including the latency-threshold and suite-non-regression checks from `PRD.md` §9 Step 9.

### Integration tests (`/tests/integration`)
- transcript → entity → validator (Steps 4–5 wired together against a real Prisma SQLite test DB).
- entity → gate → tool call (Step 5).
- failed entity → repair → verified entity (Step 6).
- repair → regression creation, asserting correct `truth_source` and playable audio asset (Step 7).
- regression → replay result (Step 8), against a mocked AssemblyAI WS server for CI determinism (see below), plus an optional real-API smoke test behind `RUN_LIVE_ASSEMBLYAI_TESTS=1`.
- replay suite → config promotion (Step 9), including a case where an older regression is made to fail under the candidate to prove rejection actually blocks promotion.
- event coverage test (`PRD.md` §9 Step 12): every event type in the catalog has ≥1 emission site.

### End-to-end tests (`/tests/e2e`, Playwright against `apps/web` + a running backend in `prerecorded_clip` mode)
- Successful support call (Demo Call A).
- Ambiguous order ID call → blocked → repaired (Demo Call B).
- Blocked unsafe refund (deliberately mismatched amount).
- Regression replay via the UI (select candidates, run, see table).
- Config promotion via the UI, including the disabled-until-`eligible` button state.
- Learned follow-up call (Demo Call C) succeeding first-pass under the promoted config.

### Failure-injection tests (`/tests/integration`, using fault-injection wrappers around each external dependency)
| Fault | Expected safe behavior | Where specified |
|---|---|---|
| AssemblyAI WS drop mid-call | session → `reconnecting` → reconnect within grace window or → `degraded` with visible banner, call not silently killed | PRD §2.1, §9 Step 3 |
| Groq LLM timeout (extraction fallback) | slot extraction skipped for that turn, no retry-stall; downstream gate correctly blocks on `LOW_EVIDENCE` | PRD §9 Step 4 |
| Groq LLM timeout (repair phrasing) | falls back to the nearest template question rather than hanging the turn | PRD §9 Step 6 |
| TTS (Groq Orpheus) failure | agent reply still recorded/shown as text in UI; call does not hard-fail, a text-only turn is acceptable degraded behavior | new — see below |
| Validator/DB unavailable | gate fails closed (`POLICY_DENIED`/`VALIDATOR_UNAVAILABLE`), never fails open | PRD §9 Step 5 |
| Duplicate final transcript event from AssemblyAI | Adapter deduplicates by `turn_order`; no duplicate `utterances`/`entities` rows | new — see below |
| Missing audio segment for regression creation | regression creation fails closed with `AUDIO_SEGMENT_MISSING`, no regression row without audio | PRD §9 Step 7 |
| Invalid/malformed config (e.g. both `prompt` and `keyterms_prompt` set) | rejected at the Configuration Registry write layer (zod schema in `packages/contracts` enforces `context_mode` mutual exclusion from `DECISIONS.md` D2) before ever reaching AssemblyAI | PRD §6 |
| Replay failure (AssemblyAI connect error during replay) | that candidate's `replay_runs` row is `status: fail` with a logged reason; batch continues for other candidates | PRD §9 Step 8 |
| Database outage | API layer returns `503` with a structured error; write paths do not partially commit (Prisma transactions wrap multi-row writes, e.g. entity update + audit event) | new — see below |
| Malformed tool-call arguments from the LLM (Support Agent) | zod-validated against each tool's schema before reaching the Action Gate; invalid shape is treated as `LOW_EVIDENCE`/`POLICY_DENIED`, never passed through | new — see below |

The three "new" rows above are failure modes not explicitly named in the brief's list but implied by its general degrade-safely requirement; they're specified here so an implementer has a concrete target rather than discovering them ad hoc.

## Adversarial regression suite (brief Step 14)

Detailed in `PRD.md` §9 Step 14. Lives at `tests/regression/adversarial.test.ts` against `fixtures/audio/adversarial/*` with a manifest asserting business outcome per fixture, not transcript similarity.

## CI determinism for AssemblyAI-dependent tests

Real AssemblyAI streaming calls are non-deterministic in timing and cost money per session. CI runs:
1. All unit tests (no network).
2. Integration/e2e tests against a **mocked AssemblyAI WS server** (`tests/mocks/assemblyai-ws-server.ts`) that replays scripted `Begin`/`Turn`/`Termination` sequences recorded from real sessions — this keeps the Adapter's real protocol-handling code under test without hitting the network in CI.
3. Real-API smoke tests (`RUN_LIVE_ASSEMBLYAI_TESTS=1`) are opt-in, run manually or in a separate nightly job, never blocking a normal CI run.

## Manual verification checklist (per PRD build step)

Each build step in `PRD.md` §9 has its own "Manual verification" line — collectively they form the full manual QA pass before a demo. `TASKS.md` tracks completion of both automated tests and manual verification per step.
