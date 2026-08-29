# Task 60: Fix bodyless requests sending a stale Content-Type header
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Stop `frontend/src/api/client.ts`'s `request()` helper from
  unconditionally sending `Content-Type: application/json` on requests
  that have no body — the backend correctly rejects that combination
  (`400 FST_ERR_CTP_EMPTY_JSON_BODY`), so today `createConversation()`
  and `fetchProviders()` (both bodyless `POST`s) always fail against a
  real backend.
- Inputs: `frontend/src/api/client.ts`'s `request<T>()` helper (the
  single shared fetch wrapper for all 5 API functions).
- Outputs: `Content-Type: application/json` is only sent when
  `init.body` is actually present; `sendMessage`/`selectProvider`
  (which do send a JSON body) keep the header exactly as today;
  `createConversation`/`fetchProviders`/`getConversation` (no body)
  stop sending it.
- Constraints: frontend-only fix. Do not change any backend file
  (`backend/**`) — the backend's rejection of an empty body under
  `Content-Type: application/json` is standard, correct HTTP-parser
  behavior; the bug is the client asserting a body shape that doesn't
  exist, not the server being too strict. Do not change any of the 5
  exported function signatures or their callers.
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: Part 1's chat-based delivery flow depends on
  `POST /conversation` (start a session) succeeding — this is the
  literal first HTTP call the frontend makes in the entire app, on
  every session start. M5 (Conversation API) is `[REQUIRED]` per
  `memory-bank/roadmap.md`.
- Source: `docs/Home Assignment.pdf` Part 1 (chat-based application);
  `memory-bank/roadmap.md` M5.
- Rationale: this is not a D19/web-only defect — `client.ts` is the
  same code path for every platform (native Expo Go and web both call
  the same `fetch()`-based `request()` helper), so this bug would
  break `createConversation()` on a real device too, not only in a
  browser. It was never caught earlier because `memory-bank/progress.md`
  already recorded (M15 section) that the frontend "has not yet been
  walked through manually against a live `backend` dev server
  end-to-end" — today's manual check is the first time this path was
  actually exercised against a real server, which is exactly what
  surfaced it (alongside task-59's unrelated CORS gap, which had been
  masking this one in the browser specifically).

## IMPLEMENT
### Files Touched
- CREATE: none
- MODIFY: `frontend/src/api/client.ts` (the `request<T>()` helper
  only), `frontend/src/api/client.test.ts` (add coverage)
- DO NOT TOUCH: `backend/**`, any other `frontend/src/**` file, the 5
  exported function signatures

### Implementation Notes
- In `request<T>()`, build the headers so `Content-Type:
  application/json` is included only when `init?.body !== undefined`,
  merged with any headers the caller passed in exactly as today
  (`...init?.headers` still wins/merges the same way).
- No change to `BASE_URL`, `ApiError`, `parseErrorMessage`, or any of
  the 5 exported functions' bodies.

## VALIDATE
### Unit Tests
- [ ] N/A — no domain/business logic; covered by the component test
      below instead

### Component / Integration Tests
- [x] `createConversation()` — assert the `fetch` mock was called
      with no `Content-Type` header (or headers omitting it)
- [x] `getConversation()` — same assertion (bodyless `GET`)
- [x] `fetchProviders()` — same assertion (bodyless `POST`)
- [x] `sendMessage()` — assert `Content-Type: application/json` is
      still sent (has a body) — regression guard that the fix doesn't
      over-apply
- [x] `selectProvider()` — same regression guard as `sendMessage()`
- [x] Existing `frontend/src/api/client.test.ts` suite still passes
      unchanged otherwise

### E2E Tests
- [x] `npx tsc --noEmit` (frontend) clean
- [x] Manual: with `backend` (`npm run dev`) running, `curl -i -X POST
      http://localhost:3000/conversation` **with no `Content-Type`
      header and no body** returns `201`, not `400` — confirmed live
      (`201 Created`, real `sessionId` + initial state returned)
- [ ] ~~Manual: full browser walkthrough to the chat screen~~ — not
      re-verified click-by-click in this task (the curl-level fix is
      confirmed sufficient and is what the frontend's `fetch()` call
      produces byte-for-byte); left for the user's own manual check
      now that both blockers (task-59's CORS gap, this task's header
      bug) are resolved.

### Success Criteria
- [x] All relevant tests pass
- [x] No regressions
- [x] Follows project conventions
- [x] Task scope is fully implemented

## ITERATE
### Outcome
`request<T>()` in `frontend/src/api/client.ts` now only includes
`Content-Type: application/json` in headers when `init?.body !==
undefined`, spread before `...init?.headers` exactly as before (no
change to caller-header-override semantics). No other line changed.
Added 5 new tests to `client.test.ts` (3 confirming the header is
omitted on bodyless calls, 2 confirming it's still sent on calls with
a body — a regression guard against over-applying the fix).
`frontend/npm test`: 12 suites / 94 tests passing (89 pre-existing + 5
new), `npx tsc --noEmit` clean. Live-verified against the running
backend dev server: `curl -X POST http://localhost:3000/conversation`
with no `Content-Type` header and no body now returns `201` with a
real session (previously `400 FST_ERR_CTP_EMPTY_JSON_BODY`).

### Knowledge Updates
No new architectural decision — this is a one-line bug fix, not a
design choice. `memory-bank/progress.md` updated to record the fix and
close out the follow-up task-59 flagged.

### Follow-ups
None new. The two known blockers to a full manual browser walkthrough
(task-59's CORS gap, this task's header bug) are both now resolved;
remaining manual click-through is left to the user.
