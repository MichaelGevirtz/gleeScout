# Task 43: Provider list route (M12, route 1)
Status: DONE
Can run in parallel with: NONE (depends on task-42's readiness
guarantee; shares `server.ts` with task-44 — sequential, not parallel)

## PLAN
- Goal: expose the M9-ranked provider list over HTTP for a conversation
  that has reached `ready_for_search` — the first of M12's two routes
  per D14/roadmap. Wires M7 (discovery) → M8 (enrichment) → M9
  (ranking) for one session's requirements.
- Inputs (all read-only): `backend/src/research/discoverProviderCandidates.ts`
  (M7), `backend/src/research/enrichProviderCandidates.ts` (M8),
  `backend/src/ranking/rankProviders.ts` +
  `backend/src/ranking/types.ts`'s `deriveRankingRequirements` (M9),
  `backend/src/domain/conversation.ts` (`ConversationState`),
  `backend/src/store/sessionStore.ts` (`getSession`),
  `backend/src/server.ts` (existing Fastify app, to extend).
- Outputs:
  - NEW `backend/src/recommendation/generateProviderList.ts` exporting
    `generateProviderList({ state, discover?, enrich?, rank? }):
    Promise<ProviderScore[]>`. Reads `state.serviceCategory` and
    `state.coreAttributes.location`, throws a plain descriptive `Error`
    if either is missing (a "should never happen" defensive assertion —
    the route below is what actually guarantees this via the phase
    check, matching `orchestrateMessage.ts`'s existing
    invariant-assertion precedent rather than re-deriving readiness
    inside this function). Otherwise calls
    `discover({ serviceCategory, location })` →
    `enrich({ candidates })` →
    `rank({ candidates, requirements: deriveRankingRequirements(state) })`
    and returns the result as-is — `rankProviders` already caps at
    `MAX_RANKED_RESULTS = 5` and already produces exactly FACT
    (`candidate.fields`) + INFERRED (`candidate.inferred`) +
    `score`/`dimensionScores`/`explanation`, no SIMULATED data, so no
    further shaping is needed here (satisfies D14's "list route: FACT +
    INFERRED + rationale only").
  - MODIFY `backend/src/server.ts`: new route
    `POST /conversation/:id/providers` — 404 if session unknown; 409
    if `state.phase !== "ready_for_search"` (this route is the first
    place any code reads `phase` for a real decision); otherwise calls
    `generateProviderList({ state })` and returns
    `{ providers: ProviderScore[] }` with 200. Error mapping: known
    Gemini errors (`GeminiConfigError`/`GeminiParseError`/
    `GeminiValidationError`, raised inside M7/M8's LLM calls) → 502;
    `FirecrawlConfigError` → 502; generic catch-all → 500. No internal
    error detail in the response body, same convention as the existing
    message route.
- Constraints:
  - Writes nothing back to session state — no `updateSession` call.
    The ranked list is returned to the client only; per D14, caching it
    server-side would be duplicated state the client already has to
    hold onto anyway (to echo one candidate back to task-44's route).
  - Does not use `runSerialized` — D11's read→await→write race doesn't
    apply here since this route never writes the session.
  - Does not modify `rankProviders`, `discoverProviderCandidates`,
    `enrichProviderCandidates`, or any M7/M8/M9 file — pure wiring.
  - Does not add a minimum-result-count check — `rankProviders`'s
    existing cap already satisfies "approximately 3-5"; a session with
    genuinely fewer usable candidates returns fewer, not an error.
  - Does not gate on task-42 at the code level (nothing here re-checks
    `location`) — it depends on task-42 having already made
    `phase === "ready_for_search"` imply both `serviceCategory` and
    `location` are present; the defensive throw above is the safety
    net if that invariant is ever violated, not a substitute for it.
- Open Questions: none.

## Assignment Alignment
- Requirement type: **EXPLICIT** (Part 2 — provider search/discovery;
  Part 3 — enrichment and ranking; Part 6 — presenting several provider
  cards with FACT/rationale) **+ PROJECT DECISION** (D14's specific
  two-route split and the "list route has no SIMULATED data" framing).
- Assignment requirement: "Once enough information has been collected,
  find real service providers..." (Part 2); "rank the providers based
  on the user's specific requirements... we care about your reasoning
  here" (Part 3); "Present the user with a clear summary and several
  provider cards" showing FACT-derived fields, rating, "why this
  provider ranks where it does" (Part 6).
- Source: Home Assignment PDF, Part 2 (page 2–3), Part 3 (page 3),
  Part 6 (page 4).
- Rationale: this route is the delivery surface that makes M7/M8/M9's
  already-implemented, already-tested pure functions reachable by a
  real client for the first time — no new domain logic, purely
  wiring + HTTP concerns, matching every prior route-introduction task
  (task-12 for M5).

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/recommendation/generateProviderList.ts`,
  `backend/src/recommendation/generateProviderList.test.ts`
- MODIFY: `backend/src/server.ts`, `backend/src/server.test.ts`
- DO NOT TOUCH: everything under `backend/src/research/`,
  `backend/src/ranking/`, `backend/src/providerQuestions/`,
  `backend/src/llm/` (all read-only dependencies), `backend/src/conversation/`,
  `backend/src/domain/`, `backend/src/store/`

### Implementation Notes
- `generateProviderList`'s injected params (`discover`, `enrich`,
  `rank`) default to the real M7/M8/M9 functions, matching every prior
  orchestrator's DI pattern (`orchestrateMessage`, `discoverProviderCandidates`,
  etc.) — tests inject fakes, no live network/LLM calls in the
  automated suite.
- New `backend/src/recommendation/` directory — this milestone's own
  home, matching the roadmap's own "M12 | Recommendation API" naming
  and the established one-directory-per-milestone convention
  (`research/` for M7, `ranking/` for M9, `providerQuestions/` for
  M10/M11).
- Route test doubles inject a fake `generateProviderList`-shaped
  function the same way `server.test.ts` already injects a fake
  `orchestrate` for the message route (`BuildServerDeps` gains a
  second optional field, e.g. `generateList`).

## VALIDATE
### Unit Tests
- [ ] `generateProviderList` calls `discover` with the state's
      `serviceCategory`/`location`, then `enrich` with `discover`'s
      result, then `rank` with `enrich`'s result and
      `deriveRankingRequirements(state)`, returning `rank`'s result
      unchanged (all three faked).
- [ ] `generateProviderList` throws a clear error if `serviceCategory`
      is `null` (defensive assertion, `discover`/`enrich`/`rank` never
      called).
- [ ] `generateProviderList` throws a clear error if `location` is
      `undefined` (same).
- [ ] A rejection from any of `discover`/`enrich`/`rank` propagates
      without being swallowed.

### Component / Integration Tests
- [ ] `POST /conversation/:id/providers` returns 404 for an unknown
      session without calling `generateProviderList`.
- [ ] Returns 409 (not 200) when the session's `phase` is still
      `"gathering"`, without calling `generateProviderList`.
- [ ] Returns 200 with `{ providers: [...] }` from a faked
      `generateProviderList` when `phase === "ready_for_search"`.
- [ ] Returns 502 with a generic body when `generateProviderList`
      rejects with a known Gemini/Firecrawl config/validation error;
      internal detail not present in the response body.
- [ ] Returns 500 with a generic body for an unrelated rejection;
      internal detail not present in the response body.

### E2E Tests
- [ ] N/A — manual real-API check optional/deferred, same convention
      as prior LLM/Firecrawl-touching tasks (non-blocking).

### Success Criteria
- [ ] `npm run build` (backend) succeeds with no TypeScript errors.
- [ ] `npm test` (backend) passes, including new tests, with no live
      network calls and no regressions elsewhere.
- [ ] No files outside `Files Touched` modified.

## ITERATE
### Outcome
Implemented as planned, one naming detail decided during
implementation (not a deviation from scope): the route is
`POST /conversation/:id/providers`, since the task file described the
route's behavior precisely but left the exact path implicit.

`backend/src/recommendation/generateProviderList.ts` (new directory)
exports `generateProviderList({ state, discover?, enrich?, rank? })`,
with `DiscoverFn`/`EnrichFn`/`RankFn` injection types matching every
prior orchestrator's DI pattern, defaulting to the real
`discoverProviderCandidates`/`enrichProviderCandidates`/`rankProviders`.
Throws a plain `Error` if `state.serviceCategory` is `null` or
`state.coreAttributes.location` is `undefined` before calling any of
the three, per the task's defensive-assertion design. Otherwise wires
discover → enrich → rank and returns `rankProviders`'s result
unchanged — no reshaping needed, confirming the task's prediction that
`rankProviders`'s existing output already satisfies "FACT + INFERRED +
rationale, no SIMULATED."

`backend/src/server.ts`: `BuildServerDeps` gained `generateList`
(defaults to the real function, same pattern as `orchestrate`). New
route reads the session (404 if unknown), checks
`state.phase === "ready_for_search"` (409 otherwise — the first place
any route reads `phase` for a real decision), then calls
`generateList({ state })` and returns `{ providers: [...] }`. Catch
block maps `GeminiConfigError`/`GeminiParseError`/`GeminiValidationError`/
`FirecrawlConfigError` to 502, anything else to 500, no internal detail
in the response body — the existing message route's catch block was
left untouched (Firecrawl errors aren't relevant to it).

`backend/src/recommendation/generateProviderList.test.ts`: 6 tests
(wiring order + argument shapes; both defensive-assertion throws;
rejection propagation from each of discover/enrich/rank, including a
*synchronous* throw from `rank` since it's the one non-async
dependency — confirmed it still surfaces as a rejected promise given
`generateProviderList` itself is `async`).

`backend/src/server.test.ts`: 6 new tests in a new
`describe("POST /conversation/:id/providers")` block (404 unknown
session; 409 when not ready; 200 with the faked list; 502 for a known
Gemini error; 502 for `FirecrawlConfigError`; 500 for an unrelated
error). Reaching a `ready_for_search` session required a faked
`orchestrate` returning a ready state through the existing message
route first — no route creates one directly — same technique the
pre-existing "processes a message normally... when phase is already
ready_for_search" test already used.

`npm run build`: clean. `npm test`: 293/293 passing (281 pre-existing +
12 new: 6 + 6), no live network calls, no regressions. No files
outside `Files Touched` modified — confirmed `research/`, `ranking/`,
`providerQuestions/`, `llm/`, `conversation/`, `domain/`, `store/` all
untouched.

### Knowledge Updates
- `DESIGN.md`'s Architecture Decisions gained one bullet: the
  provider-list endpoint returns its ranked results to the client only
  and never writes them into `ConversationState`, matching D14's
  "client holds the list, server doesn't cache it" reasoning restated
  here for a reader who hasn't seen D14 itself.
- `state.phase` now has its first real consumer — until this task it
  was set by `orchestrateMessage` but nothing ever branched on it.

### Follow-ups
None new. task-44 (provider selection route) is next, per the approved
implementation order.
