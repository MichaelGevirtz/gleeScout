# Task 59: CORS support for browser-based (web) clients
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Let a browser-based frontend client (Expo web, `localhost:8081`)
  successfully call the backend API (`localhost:3000`) — currently
  every cross-origin call fails at the browser's CORS preflight before
  it reaches any route handler.
- Inputs: existing `backend/src/server.ts` (Fastify v4 app, 5 routes:
  `/health`, `/conversation`, `/conversation/:id`,
  `/conversation/:id/message`, `/conversation/:id/providers`,
  `/conversation/:id/providers/select`).
- Outputs: the backend responds to CORS preflight (`OPTIONS`) requests
  and sends `Access-Control-Allow-Origin` on actual responses, so a
  browser client on a different origin can complete real requests.
- Constraints: dev-enablement only — no auth, no origin allowlist logic,
  no cookie/credentials handling (none of the existing routes use
  cookies or session auth; sessions are addressed by id in the URL, per
  D9). Do not touch route logic, request/response shapes, or any
  `frontend/**` file.
- Open Questions: none — permissive CORS (`origin: true` or default) is
  consistent with D14's addendum, which already establishes there is no
  auth/multi-tenant trust boundary in this prototype.

## Assignment Alignment
- Requirement type: PROJECT DECISION
- Assignment requirement: none. `docs/Home Assignment.pdf` does not
  mention CORS, browsers, or cross-origin access — the assignment's
  target delivery surface is a chat-based app (Part 1/Part 6), and the
  project's own D4 targets Expo Go on a real device/simulator, where
  CORS does not apply at all (it's a browser-only enforcement
  mechanism).
- Source: N/A — see `memory-bank/decisions.md` D19.
- Rationale: This task exists solely to support D19 (desktop/wide-screen
  web-browser support), which is itself already recorded as a
  **non-assignment, personal/portfolio scope extension** — confirmed by
  this same `assignment-review` skill before D19 was approved. Without
  this fix, task-55's web-platform enablement and D19's split-pane
  desktop UI cannot actually exchange data with the backend in a real
  browser (confirmed live: browser preflight `OPTIONS /conversation`
  currently 404s, causing every API call to fail with "Failed to
  fetch"). Must never be cited as satisfying any Part 1–6 requirement
  or Bonus item, consistent with D19's own framing.

## IMPLEMENT
### Files Touched
- CREATE: none
- MODIFY: `backend/package.json` (add `@fastify/cors` dependency),
  `backend/src/server.ts` (register the CORS plugin on the existing
  `app` instance, near the top of `buildServer`, before routes are
  registered)
- DO NOT TOUCH: `frontend/**`, any other `backend/src/**` file, route
  logic/response shapes

### Implementation Notes
- Use `@fastify/cors` (the official Fastify CORS plugin), version
  compatible with the installed `fastify@^4.28.1` (v9.x line).
- Register with permissive settings appropriate for a no-auth,
  single-machine local prototype (e.g. `app.register(cors)` with no
  origin restriction, or `origin: true`) — do not build an
  environment-driven allowlist; that would be speculative complexity
  with no current multi-environment deployment to justify it.
- No changes to any route handler's behavior, status codes, or body
  shape.

## VALIDATE
### Unit Tests
- [ ] N/A — no application/business logic changed

### Component / Integration Tests
- [ ] Existing backend suite (`npm test` in `backend/`) still passes
      unchanged — proves no regression to existing routes

### E2E Tests
- [ ] `npm run typecheck` (backend) clean
- [x] Manual: with `npm run dev` running, `curl -i -X OPTIONS
      http://localhost:3000/conversation -H "Origin:
      http://localhost:8081" -H "Access-Control-Request-Method: POST"`
      returns a 2xx/204 with an `Access-Control-Allow-Origin` header
      (not the current 404) — confirmed: `204 No Content`,
      `access-control-allow-origin: *`
- [ ] ~~Manual: with both `backend` and `frontend` running, the web app
      can create a conversation and send a message without "Failed to
      fetch"~~ — CORS itself is fixed (verified: the actual `POST
      /conversation` response also now carries
      `access-control-allow-origin: *`), but a separate, pre-existing
      bug (unrelated to CORS, out of this task's scope) independently
      blocks this exact flow — see Follow-ups. Not re-checked end-to-end
      in the browser since that second bug would fail it regardless of
      this task's fix.

### Success Criteria
- [x] All relevant tests pass
- [x] No regressions
- [x] Follows project conventions
- [x] Task scope is fully implemented

## ITERATE
### Outcome
Added `@fastify/cors@^9` (compatible with the installed `fastify@^4.28.1`)
and registered it with default/permissive settings
(`app.register(cors)`) at the top of `buildServer`, before any routes.
No route logic, response shapes, or status codes changed. `npm run
typecheck` is clean; `npm test` passes unchanged (36 suites / 301
tests, same as before this change). Live-verified against the running
dev server: a real CORS preflight (`OPTIONS /conversation` with
`Origin: http://localhost:8081`) now returns `204` with
`access-control-allow-origin: *` (previously `404`, per the Fastify
access log captured during manual testing), and the actual `POST
/conversation` response also carries the same CORS header.

### Knowledge Updates
- `backend/package.json` gained `@fastify/cors` as a runtime
  dependency; `backend/src/server.ts` now registers it before route
  registration. No new project decision beyond what D19 already
  frames — CORS is dev-enablement for that existing decision, not a
  new architectural choice, so no new `decisions.md` entry was added.
- CLAUDE.md's backend command list needed no changes (no new command
  introduced).

### Follow-ups
**New bug found during this task's own manual validation, out of
scope for task-59 and NOT fixed here**: `POST /conversation` (and by
inspection, likely every route that accepts a JSON body under the same
condition) returns `400 FST_ERR_CTP_EMPTY_JSON_BODY` when the client
sends `Content-Type: application/json` with no request body — which is
exactly what `frontend/src/api/client.ts`'s `request()` helper does for
`createConversation()` (`fetch(..., { method: "POST" })` with no
`body`, but `Content-Type: application/json` always set
unconditionally). Confirmed live via `curl -X POST
http://localhost:3000/conversation -H "Content-Type: application/json"`
→ `400`. This was previously masked in browser testing because the
CORS preflight failure (this task's fix) blocked the request even
earlier in the pipeline; backend `vitest` tests didn't catch it either
because Fastify's `.inject()`-based tests in `server.test.ts` don't
replicate a browser `fetch()`'s default header behavior exactly. This
blocks the user's manual browser check independent of CORS and needs
its own task (fix is either: don't send `Content-Type: application/json`
on bodyless requests in `client.ts`, or configure Fastify to tolerate
an empty JSON body on routes that don't require one — a design choice
for that task, not decided here).
