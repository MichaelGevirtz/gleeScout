# Task 01: Backend project scaffold
Status: DONE
Can run in parallel with: NONE

> Approved 2026-08-27 with adjustments (see below): no
> `@fastify/type-provider-zod` yet (no real schema needs it), and a
> real `.inject()` test for `/health` instead of a placeholder test
> runner.

## PLAN
- Goal: Stand up a minimal, runnable Fastify + TypeScript backend (no
  business logic yet) so subsequent tasks (domain models, conversation
  state, Gemini integration) have a project to build in.
- Inputs: Stack decision D1/D2/D3 in `memory-bank/decisions.md`
  (Fastify, TypeScript, Zod, Gemini + Firecrawl env vars).
- Outputs:
  - `backend/` npm project with TypeScript configured.
  - A Fastify server with a single `GET /health` route returning
    `{ status: "ok" }`. Plain Fastify, no Zod type-provider yet —
    there's no real request/response schema to justify it at this
    stage; it's introduced with the first real domain schema (M2).
  - `.env.example` at repo root listing `GEMINI_API_KEY` and
    `FIRECRAWL_API_KEY` (values empty/placeholder).
  - `npm run dev`, `npm run build`, `npm test` scripts wired, with
    one real lightweight integration test using Fastify's
    `.inject()`: `GET /health` → HTTP 200 → `{ status: "ok" }`.
  - `.claude/CLAUDE.md` "Commands" section updated to reflect the
    real commands once confirmed working.
- Constraints:
  - No domain models, no conversation logic, no Gemini/Firecrawl
    client code — that's later milestones (M2/M3/M7).
  - No database, auth, or persistence (assignment constraint).
  - Do not touch `docs/`, `memory-bank/*` (other than the CLAUDE.md
    commands update described above), `.claude/skills/*`, or
    `tasks/*`.
- Open Questions: none — this is pure scaffolding with no ambiguous
  product/architecture decisions.

## Assignment Alignment
- Requirement type: PROJECT DECISION (supporting an EXPLICIT
  requirement)
- Assignment requirement: "Please submit the solution as a GitHub
  repository that we can clone and run locally" and "Clear
  instructions in the README for running it locally" (Technical
  Expectations section).
- Source: Home Assignment PDF, page 4 ("Technical Expectations").
- Rationale: A runnable backend is a prerequisite for every other
  explicit requirement (conversation flow, provider research,
  ranking, etc.). The specific choice of Fastify/TypeScript/Zod is a
  project decision (see `memory-bank/decisions.md` D1), not mandated
  by the assignment, but some working backend scaffold is required to
  satisfy "clone and run locally."

## IMPLEMENT
### Files Touched
- CREATE: `backend/package.json`, `backend/tsconfig.json`,
  `backend/src/server.ts`, `backend/src/index.ts` (or equivalent
  entrypoint split), `backend/.gitignore`, `.env.example` (repo
  root)
- MODIFY: `.claude/CLAUDE.md` (Commands section only)
- DO NOT TOUCH: `docs/`, `memory-bank/`, `.claude/skills/`,
  `tasks/`, any `frontend/` path

### Implementation Notes
- Plain `fastify`, no Zod/type-provider integration in this task —
  add it in the task that introduces the first real domain/API
  schema (M2), where it will have actual value.
- Load env vars via `dotenv` (or Node's built-in env loading) —
  reading `GEMINI_API_KEY`/`FIRECRAWL_API_KEY` is fine to stub now
  even though nothing uses them yet; just don't throw if they're
  missing at this stage (that becomes relevant once M3/M7 actually
  call those APIs).
- Keep `src/server.ts` (Fastify instance + route registration)
  separate from `src/index.ts` (listen/startup) so the server
  instance is importable for tests later.

## VALIDATE
### Unit Tests
- [ ] N/A — no business logic yet.

### Component / Integration Tests
- [ ] `GET /health` returns HTTP 200 and `{ status: "ok" }`, verified
      by a real automated test using Fastify's `.inject()` (not a
      manual check).

### E2E Tests
- [ ] N/A.

### Success Criteria
- [ ] `npm install && npm run build` succeeds with no TypeScript
      errors.
- [ ] `npm run dev` starts the server and `GET /health` responds
      correctly.
- [ ] No unrelated files modified.
- [ ] `.claude/CLAUDE.md` commands section matches the real,
      working commands.

## ITERATE
### Outcome
Implemented exactly as adjusted and approved. Created:
`backend/package.json`, `backend/tsconfig.json`, `backend/src/server.ts`
(Fastify instance + `GET /health`, no Zod/type-provider),
`backend/src/index.ts` (env loading via `dotenv` + listen),
`backend/src/server.test.ts` (real vitest + `.inject()` test),
`backend/.gitignore`, `.env.example` (repo root). Chose `tsx` for dev
watch mode and `vitest` for tests (both lightweight, TS-native, no
extra config beyond what's in this task).

Validation, all passed:
- `npm install` — 132 packages installed. `npm audit` reports 6
  pre-existing vulnerabilities (2 moderate, 3 high, 1 critical) in
  transitive dependencies — not investigated/fixed as part of this
  task (out of scope for a scaffold task); flagged as a follow-up.
- `npm run build` — no TypeScript errors.
- `npm run dev` — server starts, `curl http://localhost:3000/health`
  returned `{"status":"ok"}`; dev process stopped after verification.
- `npm test` — 1/1 test passed (`GET /health` → 200 →
  `{ status: "ok" }` via Fastify `.inject()`).
- `.claude/CLAUDE.md` Commands section updated with the real, verified
  commands.

### Knowledge Updates
- `memory-bank/progress.md`: backend scaffold implemented and
  validated; real commands now exist.
- `memory-bank/decisions.md` D6 already revised prior to
  implementation per review feedback (date/time + location only as
  deterministic core; budget and all other attributes are
  LLM-proposed per category).
- `memory-bank/roadmap.md` already annotated with scope-discipline
  guidance (bonus cut-first, embedded tests/error-handling,
  incremental docs) prior to this task.

### Follow-ups
- `npm audit` flagged 6 vulnerabilities in transitive deps (2
  moderate, 3 high, 1 critical) — worth a `npm audit` look before
  final submission, but not blocking further feature work; not a
  regression introduced by this task, present from the base
  `fastify`/`vitest`/`tsx` dependency tree.
- M2 (domain models & conversation state) is the next roadmap item —
  not started, awaiting approval per PIV process.
