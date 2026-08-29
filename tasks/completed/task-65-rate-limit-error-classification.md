# Task 65: Backend rate-limit detection with a clear, user-facing message
Status: DONE
Can run in parallel with: task-66, task-67, task-68 (disjoint files)

## PLAN
- Goal: when a Gemini or Firecrawl call fails specifically because the
  API's rate limit was hit (HTTP 429), the backend returns a distinct,
  clear message (not the generic "Upstream ... call failed." /
  "Unexpected server error.") so the end user can be told plainly that
  they hit a rate limit, per direct user report (screenshot: a chat
  send shows a generic "Failed to send" with no indication it was a
  rate limit).
- Inputs: `@google/genai`'s exported `ApiError` class (`status: number`
  field, confirmed via `backend/node_modules/@google/genai/dist/genai.d.ts`
  line 538); the Firecrawl SDK's internal `SdkError` (has a `status?:
  number` field but is NOT exported from `@mendable/firecrawl-js`, per
  `dist/index.d.ts` line 1305 — must be duck-typed, not `instanceof`-checked).
- Outputs: `GeminiRateLimitError` and `FirecrawlRateLimitError` classes;
  both wrapping modules (`geminiClient.ts`, `firecrawlProvider.ts`)
  detect a 429 from their respective SDK call and throw the new class
  instead of letting the raw SDK error propagate; `server.ts`'s three
  action routes (`/message`, `/providers`, `/providers/select`) map
  either new class to `429` with a clear body message.
- Constraints: only handle the specific, detectable 429/rate-limit
  case — do NOT build a general "wrap every SDK error" mechanism (that
  was explicitly scoped OUT as a low-priority, not-worth-it item in the
  M16 audit's Recommended Changes #4). Do not touch
  `discoverProviderCandidates.ts`'s or `enrichProviderCandidates.ts`'s
  per-candidate catch-and-continue batch resilience — a per-candidate
  429 during background discovery/enrichment still silently drops that
  one candidate, by existing, already-approved design (D-series
  decisions); this task only changes what happens when a failure
  already propagates to a route handler today (message send, provider
  search, provider selection — the three user-blocking, non-batched
  calls). No frontend changes in this task (see task-66).
- Open Questions: none — the SDK shapes were directly inspected rather
  than assumed, per the project's existing D2a precedent.

## Assignment Alignment
- Requirement type: PROJECT DECISION (implements the already-approved
  M16 audit findings) + RECOMMENDATION (the specific 429 message
  wording is a UX call, not assignment text).
- Assignment requirement: "Error handling" — Technical Expectations
  (`docs/Home Assignment.pdf`). Already satisfied at the "fails safely"
  level per the M16 audit; this task improves message accuracy for a
  real, user-reported case, it does not close an assignment gap.
- Source: this session's M16 audit (GAP findings #1 and #3); direct
  user report (screenshot) in this session.
- Rationale: A 429 is exactly the failure mode `decisions.md`'s M7
  real-API validation already observed live (a real Gemini 503/429
  during a multi-candidate run) — not a hypothetical case being
  speculatively handled ahead of need.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/llm/geminiClient.ts` (add `GeminiRateLimitError`
  class; wrap the `generateContent` call in try/catch, detect
  `error instanceof ApiError && error.status === 429` from `@google/genai`,
  rethrow as `GeminiRateLimitError`)
- MODIFY: `backend/src/research/firecrawlProvider.ts` (add
  `FirecrawlRateLimitError` class; wrap the `app.search(...)` call,
  duck-type check `typeof (error as { status?: unknown })?.status === "number"
  && status === 429`, rethrow as `FirecrawlRateLimitError`)
- MODIFY: `backend/src/server.ts` (all three action routes: check
  `instanceof GeminiRateLimitError || instanceof FirecrawlRateLimitError`
  BEFORE the existing config/parse/validation check, return `429` with
  a clear body, e.g. `{ error: "You've hit the rate limit — please wait
  a moment and try again." }`)
- MODIFY: `backend/src/llm/geminiClient.test.ts`,
  `backend/src/research/firecrawlProvider.test.ts`, `backend/src/server.test.ts`
  (new tests for the 429 path)
- DO NOT TOUCH: `discoverProviderCandidates.ts`, `enrichProviderCandidates.ts`
  (their catch-and-continue blocks are unrelated to this task — see
  Constraints), any frontend file.

### Implementation Notes
- Both new error classes extend `Error`, matching the existing
  `GeminiConfigError`/`GeminiParseError`/`GeminiValidationError` /
  `FirecrawlConfigError` pattern already in the codebase — no new
  error-handling abstraction.
- `server.ts`'s existing catch blocks already check specific classes
  before falling to the generic 500 — add the rate-limit check as an
  earlier branch in the same `if/else` chain, same shape as the
  existing checks, not a new mechanism.

## VALIDATE
### Unit Tests
- [ ] `geminiClient.ts`: a fake client whose `generateContent` rejects
      with `new ApiError({ message: "...", status: 429 })` →
      `generateStructuredJson` rejects with `GeminiRateLimitError`.
- [ ] `firecrawlProvider.ts`: a fake client whose `search` rejects with
      an object carrying `status: 429` → `searchProviderPages` rejects
      with `FirecrawlRateLimitError`.
- [ ] Existing config/parse/validation-error tests in both files still
      pass unchanged.

### Component / Integration Tests
- [ ] `server.test.ts`: for each of `/message`, `/providers`,
      `/providers/select`, a faked `orchestrate`/`generateList`/
      `selectProvider` that rejects with `GeminiRateLimitError` →
      route returns `429` with a clear, non-internal-detail message.

### Success Criteria
- [ ] `npm run build` clean (backend).
- [ ] `npm test` (backend) passes, no regressions.
- [ ] No frontend changes.

## ITERATE
### Outcome
Implemented as planned, with one correction found during validation:
the first draft wrapped `app.search(...)` only inside
`createDefaultClient()`'s returned client — invisible to any test (or
future caller) that injects its own `FirecrawlSearchClient`, since
`searchProviderPages` calls `activeClient.search(...)` directly. Moved
the try/catch + `isRateLimitError` check to wrap
`activeClient.search(...)` inside `searchProviderPages` itself instead,
so detection applies uniformly regardless of which client is active —
caught by the existing "propagates a whole-request failure" test
pattern immediately flagging the new 429 test as failing, fixed before
this task was marked done. `backend npm run build` clean; `backend npm
test` 310/310 passing (304 pre-existing + 6 new: 2 in
`geminiClient.test.ts`, 2 in `firecrawlProvider.test.ts`, 2 route-level
in `server.test.ts`; the `/providers` route's own 429 test also serves
as the `FirecrawlRateLimitError` route-level check). No frontend
changes (see task-66 for how the resulting message actually reaches
the UI).

### Knowledge Updates
See `memory-bank/decisions.md` D20 and `DESIGN.md`'s new Architecture
Decisions bullet.

### Follow-ups
None required. Optional, explicitly not pursued: extending the same
wrap-and-classify pattern to non-429 raw SDK failures — both existing
fallback branches (429, generic 500) already fail safely; see D20's
rationale for why this was left undone.
