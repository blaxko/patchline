# TASKS.md

Ordered checklist matching `PRD.md` §9 build steps. Update each item in place as work happens: what was implemented, tests run, test result, manual verification performed, unresolved issues. Do not delete failed-attempt history — append corrections instead, so this file stays an honest record.

- [ ] **Step 1 — Lock the product contract** — *Status: done.* Artifacts: `PRD.md` §0, `DECISIONS.md`. No code.
- [x] **Step 2 — Commerce sandbox**
  - Implemented: `prisma/schema.prisma` (`customers, orders, products, order_items, tool_call_audit`), `prisma/seed.ts`, `fixtures/commerce/seed.json` (6 customers incl. `Siobhan Mercer` and a digit/letter email trap on Renata Kowalski, 8 orders incl. the 3 confusable pairs from PRD §4, 10 SKUs incl. `WBH-100`/`WBH-100X`, refund eligibility mix of full/partial/ineligible). `services/commerce-sandbox/src/tools/*.ts` — typed, zod-validated functions for all 8 tools (`lookupOrder`, `lookupCustomer`, `checkTracking`, `lookupProduct`, `requestRefund`, `updateShippingAddress`, `createSupportCase`, `escalateToHuman`); Levenshtein-based close-match logic for order/tracking/SKU lookups; `tool_call_audit` row written for every mutating-tool call (`simulated: true` for `request_refund`/`update_shipping_address`, which never write to `orders`). Thin `POST /internal/tools/:name` Fastify wrapper (`src/server.ts`) for manual testing.
  - Tests: `services/commerce-sandbox/tests/*.test.ts` (vitest, real SQLite test DB via `tests/global-setup.ts` which runs `prisma db push` + the seed script against `prisma/test.db`) — 28 tests covering every seeded lookup success, all 3 confusable-pair structured failures with close-match candidates, invalid-format inputs (no throws), the SKU trailing-character pair, and refund eligibility (full/partial/ineligible/exceeds-eligible/not-found). Result: **28/28 passed**, 2026-09-09. `tsc --noEmit`: clean.
  - Manual verification: started `services/commerce-sandbox/src/server.ts` locally; `curl localhost:8081/internal/tools/lookup_order -d '{"order_id":"BRK-7109"}'` returned `{"found":false,"reason":"NOT_FOUND","close_matches":[{"order_id":"BRK-71Q9","distance":1}]}`, matching PRD §4's expected structure; `BRK-71Q9` returned the full order record. Confirmed 2026-09-09.
  - Unresolved: none.
- [ ] **Step 3 — Live voice session**
- [ ] **Step 4 — Entity evidence layer**
- [ ] **Step 5 — Action gating**
- [ ] **Step 6 — Focused repair conversations**
- [ ] **Step 7 — Automatic regression creation**
- [ ] **Step 8 — Regression Lab (replay)**
- [ ] **Step 9 — Safe configuration promotion**
- [ ] **Step 10 — Close the learning loop live**
- [ ] **Step 11 — Operator dashboard**
- [ ] **Step 12 — Observability and evidence (coverage audit)**
- [ ] **Step 13 — Privacy and security controls**
- [ ] **Step 14 — Adversarial tests**
- [ ] **Step 15 — Deterministic judge demo**

Each unchecked item, when completed, should be edited in place to include:

```
- [x] **Step N — Name**
  - Implemented: <files/modules>
  - Tests: <what was added> — Result: <pass/fail, date>
  - Manual verification: <what was checked, outcome>
  - Unresolved: <none, or specific open issue>
```

## Planning audit (performed before implementation begins, per operating instructions)

1. **Every hackathon requirement covered?** Yes — `PRD.md` §10 Acceptance Criteria maps 1:1 to brief §19.
2. **AssemblyAI load-bearing?** Yes — Universal-Streaming is the source of every entity, every gate decision, and the entire replay/promotion mechanism (`PRD.md` §1, §8, §9 Steps 3/8). Nothing routes around it.
3. **One dominant mechanism?** Yes — `live speech → entity → validate → gate → repair → regression → replay → promote → improved call`, stated once in the brief's opening and preserved verbatim as the spine of `PRD.md` §9.
4. **No critical action relies on unverified speech?** Yes — Action Gate (`PRD.md` §7) is the sole path to tool execution; enforced by tests in `TESTING.md`.
5. **Regression truth has provenance?** Yes — `regressions.repair_method` enum has no LLM-guess member (`DECISIONS.md` D8).
6. **Configuration promotion evidence-backed?** Yes — promotion gate requires full-suite non-regression + latency threshold (`PRD.md` §9 Step 9).
7. **Demo reproducible?** Yes — `prerecorded_clip` mode + `/api/demo/reset` (`PRD.md` §9 Step 15, `DEMO.md`).
8. **Every UI state maps to real backend data?** Yes — Dashboard is read-only over `audit_events`/primary tables, no hardcoded metrics (`PRD.md` §8, §11).
9. **Every major dependency has a failure path?** Yes — `TESTING.md` failure-injection table covers AssemblyAI, Groq (LLM + TTS), validators/DB, audio storage, replay.
10. **Understandable/runnable from the public repo?** Yes — `README.md` + `ARCHITECTURE.md` bootstrap instructions, `.env.example`, seeded fixtures, no external services beyond AssemblyAI/Groq API keys.

Audit result: **plan is internally consistent.** Implementation may proceed step by step per `PRD.md` §9, in order, updating this file after each step.
