# SECURITY.md

Patchline is a hackathon build. This document states what is actually implemented, what is intentionally out of scope, and why — no compliance claims are made (brief Step 13 / technical rule #14).

## Secrets

- `ASSEMBLYAI_API_KEY` and `GROQ_API_KEY` are read only by `services/backend` (server-side). The browser never receives either key.
- The browser authenticates to AssemblyAI via a short-lived temporary token minted server-side per session (AssemblyAI's documented mechanism for browser-originated connections), not the raw API key.
- `.env` is gitignored; `.env.example` (see that file) contains only placeholder values, never real credentials.
- No secret is ever included in a Next.js client bundle — env vars consumed by `apps/web` must be prefixed appropriately and audited to contain no key material; only `NEXT_PUBLIC_*`-style values (none currently needed) would be bundle-visible.

## Operator authentication

A single shared `OPERATOR_PASSWORD` (env var, no default shipped — the server refuses to boot in non-dev mode without it) exchanges for a signed, httpOnly, `SameSite=Lax` session cookie (`SESSION_SECRET` signs it). This is explicitly **not** multi-user, multi-tenant, or production-grade auth (no OAuth/SSO, no per-operator accounts, no password hashing rotation policy). It exists to satisfy "authenticated operator dashboard" and "config promotion and rollback are authenticated" from the brief at hackathon scope. A judge or reviewer should treat this as a placeholder for real auth (e.g. an identity provider) in any non-demo deployment.

## Audio retention

- Full raw call audio is held only transiently (in-memory/temp buffer, bounded window) for the duration needed to extract a regression clip; it is not persisted long-term.
- Only regression-relevant audio ranges (typically a few seconds, padded) are written to `/data/audio` and referenced by `regressions.audio_asset`.
- `AUDIO_RETENTION_DAYS` (default 30) governs cleanup of persisted clips; clips backing an open (un-closed) regression are exempt from cleanup regardless of age.
- This satisfies the brief's "store only the audio ranges required for regression cases" and "configurable audio retention."

## PII handling

- The demo uses exclusively synthetic seeded customer data (`fixtures/commerce/seed.json`) — no real personal data is ever entered into the system for the hackathon build.
- A `REDACT_TRANSCRIPT_PII` flag exists in the config surface as a documented no-op for this build (single-operator, synthetic data — nothing to redact from). It is scaffolding for a future multi-tenant deployment with real customer data, not an active control here. This is stated explicitly so no false claim of active redaction is made.
- AssemblyAI's own `redact_pii`/`redact_pii_policies`/`redact_pii_sub` streaming parameters are available and documented in `PRD.md` D-notes as a real, wireable option; they are not enabled by default in the seeded demo configs since the demo data is synthetic, but any production config in the Configuration Registry could enable them per §6 of the PRD.

## Fail-closed behavior

- The Action Gate denies (`POLICY_DENIED`) rather than allows when a validator dependency (Commerce Sandbox/DB) is unavailable — see `PRD.md` §9 Step 5 error cases.
- `request_refund` and `update_shipping_address` execute in simulated/dry-run mode in this build; no real financial or logistics mutation ever occurs regardless of gate outcome (`PRD.md` §0).
- High-risk actions require explicit caller confirmation or deterministic backend validation before execution — never an LLM's own confidence claim (`PRD.md` §7, `DECISIONS.md` D8).

## Auditability

- `promotions` rows are immutable and capture a full snapshot of regression-suite results at promotion time, with `actor` recorded — config changes are always attributable and reversible via rollback (`PRD.md` §3, §9 Step 9).
- `audit_events` is append-only; nothing in the reliability pipeline is ever silently overwritten (`PRD.md` §3 "immutable" field annotations).

## Transport

TLS termination is handled by the hosting platform (Vercel for the frontend, Fly.io/Render for the backend) when deployed; local development is plaintext `ws://`/`http://` on `localhost`, which is standard and not a security gap for local judging.

## Explicitly out of scope for this build

- Multi-tenant isolation, per-operator RBAC, SSO/OAuth.
- Regulatory compliance claims (HIPAA, PCI, SOC2, GDPR-specific mechanisms) — none are made or implied.
- Rate limiting / WAF / DDoS protection beyond what the hosting platform provides by default.
- Real payment or shipping system integration (mutations are simulated by design, see above).

## Known dependency failure paths

See `TESTING.md` "Failure tests" for the full list (AssemblyAI disconnect, LLM timeout, TTS failure, validator outage, database outage, audio-storage failure, replay failure) and `PRD.md` §9's per-step "Error cases" for the specific safe-degradation behavior at each layer.
