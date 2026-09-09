# ARCHITECTURE.md

See `PRD.md` §1–§2 for the full component diagram and state machines. This document covers physical topology, repo layout, and local/deploy operation — the "how it actually runs" complement to the PRD's "what it does."

## Physical topology vs. logical ownership

`PRD.md` §1 defines strict module ownership boundaries (Realtime Gateway, AssemblyAI Adapter, Orchestrator, Support Agent, Reliability Supervisor and its five sub-modules, Configuration Registry, Commerce Sandbox, Event Store). In this build, **all of these run inside one Node.js process** (`services/backend`), as TypeScript modules with enforced import boundaries (see below), not as separately deployed services. `DECISIONS.md` D6 explains why: no requirement in the brief needs independent scaling, and splitting services would add auth-between-services surface with zero hackathon payoff.

Enforcement: each module lives under `services/backend/src/<module>/` and exposes a single `index.ts` barrel. An ESLint `no-restricted-imports` rule (documented in `services/backend/.eslintrc.cjs` once created) blocks e.g. the Support Agent module from importing the Action Gate's internals directly — it must go through the Reliability Supervisor's public interface. This keeps the codebase honest about the ownership table even though it's one process.

## Repository layout

```text
/apps
  /web                      # Next.js frontend: Call UI + Operator Dashboard
/services
  /backend                  # Fastify + ws: gateway, adapter, orchestrator, reliability supervisor, config registry, event store
  /commerce-sandbox         # Seeded deterministic business data + typed tools (imported by /services/backend)
/packages
  /contracts                # Shared TS types + zod schemas for WS/REST messages (PRD §3, §8)
  /schemas                  # Entity normalization/regex, config schema, regression schema
  /config                   # Shared env/config loading
  /evaluation                # Replay scoring, promotion-gate logic (pure functions, unit-testable without DB)
/tests
  /unit
  /integration
  /regression                # Adversarial fixture suite (PRD Step 14)
/fixtures
  /audio                     # Demo clips + adversarial clips (checked in, small WAVs)
  /commerce                  # Seed data
  /configs                   # Seed configuration rows
/data
  /audio                     # Runtime-captured regression clips (gitignored)
/prisma
  schema.prisma
  seed.ts
/docs                        # (optional) generated API reference, kept out of judge-critical path
README.md
PRD.md
ARCHITECTURE.md
SECURITY.md
TESTING.md
DEMO.md
DECISIONS.md
.env.example
TASKS.md
```

`packages/evaluation` is deliberately DB-free and pure-function so the promotion gate (PRD §9 Step 9) and replay scoring (Step 8) are unit-testable without spinning up Prisma or a network connection — this is what "all critical backend logic should be testable without the frontend" (brief technical rule #9) means in practice here.

## Local bootstrap

```bash
pnpm install
cp .env.example .env        # fill in ASSEMBLYAI_API_KEY, GROQ_API_KEY, OPERATOR_PASSWORD, SESSION_SECRET
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev                    # runs apps/web + services/backend concurrently (turborepo/pnpm -r)
```

No Docker requirement for the judged path — SQLite removes the only stateful external dependency. A `docker-compose.yml` may be added later purely for deploy parity, not required for local judging.

## Deploy targets (optional, not required for judging)

- `apps/web` → Vercel (static/SSR Next.js).
- `services/backend` → Fly.io or Render (needs a persistent process for WebSocket + SQLite file, or swap the Prisma provider to Postgres for a horizontally-friendly deploy — not required for the hackathon).

## Commands

| Command | Purpose |
|---|---|
| `pnpm lint` | ESLint across all workspaces, including the import-boundary rule |
| `pnpm typecheck` | `tsc --noEmit` across all workspaces |
| `pnpm test` | unit + integration tests |
| `pnpm test:regression` | adversarial + regression-replay suite (PRD Step 14; may hit real AssemblyAI unless `MOCK_ASSEMBLYAI=1`) |
| `pnpm build` | production build of `apps/web` and `services/backend` |
| `pnpm dev` | local dev, all workspaces |

## Why one backend process, precisely

The brief's Step 12 event catalog and Step 8 replay flow both require the Adapter, Extractor, Gate, Repair Engine, and Regression Engine to share consistent state within a single call in real time, with no round-trip latency budget to spare (repair questions must fire within the natural turn-taking cadence). An in-process module boundary gives the ownership separation the brief asks for without paying network latency on the hot path. If a future iteration needs independent scaling (e.g. the Commerce Sandbox becoming a real multi-tenant service), the `packages/contracts` boundary is already what a network seam would be drawn along.
