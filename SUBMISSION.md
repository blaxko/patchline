# SUBMISSION.md

Draft submission text for the AssemblyAI hackathon (lablab.ai). Kept in-repo so it stays versioned alongside the build it describes, rather than living only in a form field.

## Project title

Patchline

## Short description

Patchline is a self-healing reliability layer for voice AI agents: it uses AssemblyAI's real-time speech recognition to catch unsafe tool calls before they execute, repairs misheard critical data live in the conversation, and turns every recovered failure into a permanent regression test that future configs must pass before going live.

## Long description

Most voice agent demos show the happy path. Patchline is built for the path where AssemblyAI mishears something that matters — an order ID, a tracking number, a refund amount — and a naive agent would just act on the wrong value.

Patchline sits between AssemblyAI's real-time speech-to-text stream and a set of business tools, watching every extracted entity against an evidence policy before any tool (`lookup_order`, `request_refund`, `update_shipping_address`, etc.) is allowed to fire. When evidence is weak or a value is ambiguous, the Action Gate blocks the call, and the Reliability Supervisor asks a targeted repair question live, in the same turn-taking cadence as the conversation — not a script, but a real, evidence-driven follow-up. The caller's own confirmation, not a model's confidence, is what turns an ambiguous value into a verified one.

Every recovered failure is captured as a permanent regression: the exact audio segment, the wrong value, the confirmed correct value, and how it was confirmed. Operators can replay any regression against a candidate AssemblyAI configuration (different speech model, `keyterms_prompt`, `prompt`, or turn-detection settings) in a Regression Lab, see whether it actually fixes that specific failure, and only promote a config to production if it passes the full regression suite — not just an aggregate score. Nothing is ever silently "learned" by retraining a model; every improvement is a new, replay-tested configuration with a full audit trail and one-click rollback.

Built on AssemblyAI's Realtime Speech-to-Text API (Universal-Streaming) with a self-orchestrated stack on top: read-only business tools (`lookup_order`, `check_tracking`, `lookup_product`) are triggered deterministically once an entity is extracted and verified — no LLM decides whether to call them, so the highest-risk path in the system has no model in the loop at all. Groq is used narrowly and specifically: as a fallback entity extractor (JSON tool-call mode, for `customer_name`, `shipping_address`, and `refund_amount` when AssemblyAI's transcript alone doesn't cleanly parse) and for TTS via Orpheus. Verified multiple times against a real, non-mocked AssemblyAI account — including finding and fixing a real `keyterms_prompt` wire-format bug that had silently broken every "boosted vocabulary" config, and a full live walk of the block → repair → regression → replay → promotion → first-pass-success loop, documented honestly end to end.

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
