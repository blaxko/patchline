# SUBMISSION.md

Draft submission text for the AssemblyAI hackathon (lablab.ai). Kept in-repo so it stays versioned alongside the build it describes, rather than living only in a form field.

## Project title

Patchline

## Short description

_(255 char max — currently 251)_

Patchline is a self-healing reliability layer for voice AI agents. Built on AssemblyAI, it blocks unsafe tool calls on misheard data, repairs mistakes live in the call, and turns every recovered failure into a regression test future configs must pass.

## Long description

_(2000 char max — currently 1977)_

Most voice agent demos show the happy path. Patchline is built for the path where AssemblyAI mishears something that matters — an order ID, a refund amount — and a naive agent would just act on the wrong value.

Patchline sits between AssemblyAI's real-time speech-to-text stream and a set of business tools, checking every extracted entity against real evidence before any tool (`lookup_order`, `request_refund`, `update_shipping_address`) is allowed to fire. When a value is weak or ambiguous, the Action Gate blocks the call and asks one targeted repair question live, in the same conversational turn-taking — a real evidence-driven follow-up, not a script. The caller's own confirmation, not a model's confidence, is what turns an ambiguous value into a verified one.

Every recovered failure is captured as a permanent regression: the audio, the wrong value, the confirmed correct value, and how it was confirmed. Operators can replay any regression against a candidate AssemblyAI config (speech model, `keyterms_prompt`, `prompt`, turn-detection settings), see whether it actually fixes that failure, and only promote it once it passes the full regression suite — not just an aggregate score. Nothing is silently "learned" by retraining a model; every improvement is a new, replay-tested config with a full audit trail and one-click rollback.

Built on AssemblyAI's Realtime Speech-to-Text API (Universal-Streaming). Read-only tools fire deterministically once an entity is verified — no LLM decides whether to call them, so the highest-risk path has no model in the loop. Groq is used narrowly: as a fallback entity extractor when the transcript alone doesn't cleanly parse, and for TTS via Orpheus. Verified against a real, non-mocked AssemblyAI account — including finding and fixing a real `keyterms_prompt` wire-format bug that had silently broken every "boosted vocabulary" config, plus a full live walk of block → repair → regression → replay → promotion → first-pass success.

## Technology & category tags

- AssemblyAI
- Voice AI
- Real-time Speech-to-Text
- Groq
- Customer Support / Customer Service
- Reliability / Observability
- AI Agents
- Next.js / TypeScript

## Links

- Live app: https://illustrious-laughter-production.up.railway.app
- Live API: https://patchline-production.up.railway.app
- Repository: https://github.com/blaxko/patchline
