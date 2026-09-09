# DECISIONS.md

Record of product/technical decisions made while turning `PATCHLINE_BUILD_BRIEF.md` into `PRD.md`, and why. Read this before questioning why the PRD deviates from the brief's literal wording.

## D1. AssemblyAI product and endpoint

The brief assumed a generic "realtime speech-to-text API." Verified against current AssemblyAI docs (Sept 2026): the correct product is **Universal-Streaming**, a WebSocket API at:

- `wss://streaming.assemblyai.com/v3/ws` (global, default)
- `wss://streaming.us.assemblyai.com/v3/ws` / `wss://streaming.eu.assemblyai.com/v3/ws` (data residency)

Default model: `universal-3-5-pro`. Cheaper alternative: `universal-streaming-english`. We use both as the two "speech models" available to the Configuration Registry (see D4).

Sources: assemblyai.com/docs/streaming/universal-streaming, assemblyai.com/docs/api-reference/streaming-api/streaming-api.

## D2. `prompt` and `keyterms_prompt` are mutually exclusive

AssemblyAI's streaming API rejects a session that sets both `prompt` (free-text context, ≤1750 chars, Universal-3.5-Pro only) and `keyterms_prompt` (list of ≤100 boosted terms, ≤50 chars each) at once — `keyterms_prompt` is implemented internally as an addendum to AssemblyAI's own default prompt, so a user-supplied `prompt` can't coexist with it.

**Impact on the brief:** Step 8's example "Combined configuration" (context + keyterms together) is not literally buildable as a single AssemblyAI session. We preserve the product behavior — "a richer configuration that uses both contextual guidance and boosted vocabulary" — by defining a config's `context_policy` as *either* `prompt`-mode *or* `keyterms`-mode, and let "combined" mean: keyterms_prompt (which still carries the default prompt underneath) plus `agent_context` (the separate, always-composable field carrying the TTS agent's own last reply, see D3) plus `previous_context_n_turns`. This is documented explicitly in the Configuration schema (`PRD.md` §6) so no candidate config silently violates the constraint.

## D3. Additional real fields the brief didn't anticipate

The current API exposes several fields the brief never mentions, which materially strengthen the config-comparison story and are added to the Configuration schema:

- `agent_context` (≤1750 chars, Universal-3.5-Pro only): lets the orchestrator pass the support agent's own last TTS reply back into the STT session, improving recognition of the caller's response to that reply. Composable with `keyterms_prompt`.
- `previous_context_n_turns` (0–100, default 5): how many prior turns of conversational context AssemblyAI itself retains.
- `end_of_turn_confidence_threshold`, `min_turn_silence`, `max_turn_silence`, `mode` (`max_accuracy` / `min_latency` / `balanced`): turn-detection tuning. Not part of entity-accuracy comparison but tracked as a config field and included in the latency metric.
- `format_turns`: whether finals come back formatted (punctuation/casing). Off by default in our baseline config for cheaper/faster candidates, on for the "richer" candidate, since formatting can change how the entity extractor tokenizes an ID.

## D4. No AssemblyAI field is invented

Every field referenced in `PRD.md`'s Configuration schema, session-init query params, and message types (`Begin`, `SpeechStarted`, `Turn`, `SpeakerRevision`, `Termination`, `Heartbeat`, client `UpdateConfiguration`/`ForceEndpoint`/`Terminate`/`KeepAlive`) is taken from the verified docs above, not guessed. Where the brief's step language ("richer conversation context", "domain keyterms", "account-derived vocabulary") maps to a real field, that mapping is stated explicitly in `PRD.md` Step 8.

`UpdateConfiguration` is real and lets a *live* session's `prompt`/`keyterms_prompt`/`agent_context` be changed mid-call without reconnecting — this is what powers the repair engine's ability to inject a caller-confirmed value's neighborhood back into recognition context for the remainder of the call, an enhancement beyond the brief's literal text but consistent with its intent ("repair ambiguous entities during the live conversation").

## D5. AssemblyAI does not do TTS or LLM reasoning

Confirmed: Universal-Streaming is STT only. Two more vendor decisions were required:

- **LLM (support agent + reliability supervisor reasoning): Groq**, per the brief's explicit instruction. Current Groq chat model with tool-calling support used for both agents: `openai/gpt-oss-120b` (Groq deprecated `llama-3.3-70b-versatile` in June 2026 in favor of the `gpt-oss`/`qwen3.6` family). One model, one key, used for both agents to keep the vendor surface minimal — the two agents are differentiated by system prompt and tool schema, not by model.
- **TTS: Groq's own Orpheus endpoint** (`canopylabs/orpheus-v1-english` via `POST https://api.groq.com/openai/v1/audio/speech`, voice `autumn`), not a third vendor. The brief allows "chosen TTS provider if the AssemblyAI path does not supply voice output" without naming one. Using Groq for TTS too (instead of adding e.g. ElevenLabs) means a single `GROQ_API_KEY` covers both reasoning and voice output, which simplifies the credential surface for a hackathon judge running the repo (Step 13 of the brief: "no secrets in frontend bundles", fewer secrets = fewer leak surfaces). Groq previously offered `playai-tts`; it was deprecated Dec 23, 2025 in favor of Orpheus — `playai-tts` must not be used.

## D6. Hosting, database, and auth

Not specified in the brief beyond "fill in." Chosen for hackathon reproducibility over production polish:

- **Monorepo**: pnpm workspaces, TypeScript throughout.
- **Frontend**: Next.js (App Router), deployable to Vercel, but the primary judged path is local (`pnpm dev`).
- **Realtime/reliability backend**: a single Node.js (Fastify + `ws`) service — not split into two network services — because the brief's "ownership boundaries" (realtime gateway, orchestrator, reliability supervisor, etc.) are enforced as internal module boundaries within one deployable process. Splitting them into separately deployed services would add operational surface (service discovery, auth between services) with no benefit for a hackathon judge running one process locally, and the brief's acceptance criteria never require independent scaling. This is a deliberate simplification; `ARCHITECTURE.md` documents both the logical (module) boundaries and the physical (process) topology so the distinction is explicit.
- **Database**: SQLite via Prisma. Zero external dependency, judge runs the repo with no DB server to provision, still gives us relational integrity and migrations. Documented as a hackathon-scope choice; a Postgres connection string is a drop-in Prisma provider swap if productionized later.
- **Audio storage**: local filesystem (`/data/audio`, gitignored) served by the backend behind an authenticated route; captured regression clips only (not full-call raw audio) per Step 13's minimization requirement.
- **Operator dashboard auth**: a single shared operator password (`OPERATOR_PASSWORD` env var) exchanged for a signed, httpOnly session cookie. Explicitly documented in `SECURITY.md` as hackathon-scope, not multi-tenant or production-grade auth — no OAuth/SSO is in scope.

## D7. "Learning" claim boundary

Per the brief's explicit instruction: Patchline never retrains AssemblyAI or changes model weights. "Improvement" means: a new `configs` row (different `speech_model`, `prompt`/`keyterms_prompt`, `agent_context`, turn-detection settings) is tested via replay against stored regression audio, scored deterministically, and promoted only if it passes the full regression suite. This is stated verbatim in `PRD.md` §Policy and Promotion.

## D8. Regression truth provenance enforcement

Three allowed sources for a regression's `expected_value`: `caller_confirmation` (repair flow), `deterministic_validation` (backend business-rule match, e.g. an SKU that deterministically resolves), `human_review` (operator marks it in Regression Lab). This is enforced at the database layer (`regressions.truth_source` is a non-null enum with no `llm_guess` member — see `PRD.md` §6) so the LLM's own extraction can never become ground truth even by accident.
