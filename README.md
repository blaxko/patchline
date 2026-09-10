# Patchline

A self-healing reliability layer for production voice agents. Every failed voice interaction becomes a regression test; every verified fix becomes a better configuration for the next call.

> The customer-support voice agent in this repo is a reference workload. The product is the reliability supervisor watching it: blocking unsafe tool calls on weak speech evidence, repairing critical entities live, and turning every recovered failure into a permanent, replayable regression.

## Start here

- [`PRD.md`](PRD.md) — the full implementation spec: product contract, architecture, state machines, data model, and 15 sequential build steps.
- [`DECISIONS.md`](DECISIONS.md) — why the PRD deviates from the original build brief's wording, and every AssemblyAI/Groq fact it relies on, with sources.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — repo layout, physical topology, local bootstrap, commands.
- [`SECURITY.md`](SECURITY.md) · [`TESTING.md`](TESTING.md) · [`DEMO.md`](DEMO.md) · [`TASKS.md`](TASKS.md)

## Status

All 15 build steps in `PRD.md` §9 are implemented and tested — see `TASKS.md` for per-step detail (what was built, test results, manual verification, and honestly-flagged limitations). Two build-environment limitations apply throughout: no live `ASSEMBLYAI_API_KEY`/`GROQ_API_KEY` was available while building this, so the full reliability pipeline is proven against a mocked AssemblyAI server (per `TESTING.md`'s own CI-determinism design) rather than a live account, and the demo/adversarial audio fixtures are silent placeholders rather than real synthesized speech. The mechanism itself — extraction, gating, repair, regression capture, replay, promotion, the dashboard, and demo mode — is real, tested, and verified live against the running server throughout.

## Stack (see `DECISIONS.md` for why)

- **STT**: AssemblyAI Universal-Streaming (`wss://streaming.assemblyai.com/v3/ws`)
- **LLM**: Groq, `openai/gpt-oss-120b`
- **TTS**: Groq Orpheus, `canopylabs/orpheus-v1-english`
- **Backend**: Node.js/TypeScript, Fastify + `ws`, one process
- **Frontend**: Next.js
- **Database**: SQLite via Prisma
- **Monorepo**: pnpm workspaces

## Local bootstrap (once implementation exists)

```bash
pnpm install
cp .env.example .env   # fill in ASSEMBLYAI_API_KEY, GROQ_API_KEY, OPERATOR_PASSWORD, SESSION_SECRET
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev
```

See `ARCHITECTURE.md` for the full command reference (lint/typecheck/test/build).
