# Task 77: Bounded-concurrency parallelization of discover/enrich pipeline
Status: DONE
Can run in parallel with: task-78

## PLAN
- Goal: cut real wall-clock latency of `POST /conversation/:id/providers`
  by running each phase's independent per-candidate work concurrently
  (bounded), instead of one candidate at a time in a `for` loop.
- Inputs: `discoverProviderCandidates.ts`'s existing per-URL extraction
  loop (up to `MAX_DISCOVERY_RESULTS` = 8 sequential `extract` calls);
  `enrichProviderCandidates.ts`'s existing per-candidate loop (up to
  `MAX_ENRICHMENT_CANDIDATES` = 5 sequential search→analyze chains).
  Both loops' injected function signatures (`ExtractFn`, `EnrichmentSearchFn`,
  `AnalyzeFn`) are unchanged.
- Outputs: a small shared `mapWithConcurrency` utility; both loops
  rewritten to use it with a bounded concurrency limit; the two
  existing tests that assert strict sequential ordering rewritten to
  assert bounded-concurrency behavior instead (their intent is
  deliberately being reversed, not preserved).
- Constraints:
  - **Do not raise `MAX_DISCOVERY_RESULTS` or `MAX_ENRICHMENT_CANDIDATES`.**
    This task changes *how fast* the existing call volume runs, not
    how many calls are made.
  - **Concurrency limit must stay conservative because of a real,
    already-documented constraint**: task-08 (see `progress.md`)
    found Gemini's free tier caps `gemini-3.6-flash` at **5 requests/
    minute**. Parallelizing does not increase total Gemini call count
    (still ~8 discovery + up to 10 enrichment-phase calls per full
    request), but it does compress them into a shorter wall-clock
    window, which does not help an already-tight per-minute budget.
    Recommended default: `CONCURRENCY_LIMIT = 3` for both loops (a
    named, exported constant, same tuning-value precedent as
    `MAX_DISCOVERY_RESULTS`/`MAX_ENRICHMENT_CANDIDATES`) — enough to
    meaningfully cut wall-clock time without turning today's
    "occasional transient failure" into "usually fails."
  - Per-candidate failure handling must be preserved exactly as today:
    a single candidate's `extract`/`search`/`analyze` failure is
    caught, logged via `console.error`, and that candidate is
    dropped/passed-through unchanged — never rejects the whole batch.
    This must hold identically under concurrent execution (each
    candidate's own try/catch, not a shared one).
  - `enrichProviderCandidates`'s internal per-candidate order (search
    *then* analyze) stays sequential *within* one candidate — only
    the *across-candidate* iteration becomes concurrent.
  - Update the rationale comments in both files (currently justify
    sequential-only execution as the design) to reflect the new
    bounded-concurrency reasoning instead of leaving stale/contradicted
    comments in place.
  - Does not touch `generateProviderList.ts`, `rankProviders.ts`,
    `server.ts`, or anything trace-related — that's task-78.
- Open Questions: none — concurrency limit is a tuning constant,
  decided and justified above per this project's existing precedent
  for such values (`MAX_DISCOVERY_RESULTS`, `MAX_ENRICHMENT_CANDIDATES`
  were both decided the same way, not put to a vote each time).

## Assignment Alignment
- Requirement type: RECOMMENDATION (supports a named BONUS item)
- Assignment requirement: Bonus section lists "Parallel provider
  research" explicitly; the DESIGN.md Optimizations section separately
  names "Parallelizing searches" and "Cost or latency optimizations"
  as categories the submission should describe/consider.
- Source: `docs/Home Assignment.pdf`, Bonus section (p.8) and
  Optimizations section (p.6).
- Rationale: directly implements a named bonus item and closes two
  named optimization categories, while fixing an observed real
  problem — a live "clown, New York" request traced to up to 19 fully
  sequential network/LLM round trips in this exact pipeline. Small,
  additive, low-risk (bounded pool + existing per-candidate error
  isolation), not a new subsystem.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/shared/concurrency.ts`
- CREATE: `backend/src/shared/concurrency.test.ts`
- MODIFY: `backend/src/research/discoverProviderCandidates.ts`
- MODIFY: `backend/src/research/discoverProviderCandidates.test.ts`
- MODIFY: `backend/src/research/enrichProviderCandidates.ts`
- MODIFY: `backend/src/research/enrichProviderCandidates.test.ts`
- DO NOT TOUCH: `backend/src/recommendation/generateProviderList.ts`,
  `backend/src/ranking/rankProviders.ts`, `backend/src/server.ts`,
  `backend/src/domain/trace.ts`, `backend/src/store/traceStore.ts`,
  `MAX_DISCOVERY_RESULTS`, `MAX_ENRICHMENT_CANDIDATES`

### Implementation Notes
- `mapWithConcurrency<T, R>(items, limit, fn)` belongs in
  `backend/src/shared/` per this project's existing precedent
  (`shared/hostname.ts`, task-29): domain-agnostic, zero deps, usable
  by both `research/` call sites without `ranking/`↔`research/`
  coupling concerns.
- Each item's own error must stay isolated (caught inside the mapped
  function itself, same as today), not caught only at the pool level
  — a `Promise.allSettled`-style pool, not `Promise.all`.

## VALIDATE
### Unit Tests
- [ ] `mapWithConcurrency` runs at most `limit` items concurrently,
      preserves each result's association with its input, and one
      item's rejection doesn't stop the others from running (if the
      per-item error handling stays inside the mapped `fn`, this may
      simply mean rejections propagate per-item as today's callers
      already expect).
- [ ] `discoverProviderCandidates`'s existing "sequential" ordering
      test is replaced with a test asserting **bounded** concurrency
      (e.g., no more than `CONCURRENCY_LIMIT` `extract` calls in
      flight at once) rather than strict one-at-a-time ordering.
- [ ] Same replacement for `enrichProviderCandidates`'s "sequential
      across candidates" test — bounded concurrency across candidates,
      still sequential (search→analyze) within one candidate.
- [ ] Both existing "logs and skips a candidate whose
      extract/search/analyze call throws, without rejecting or
      dropping the rest" tests still pass under concurrent execution.
- [ ] `MAX_DISCOVERY_RESULTS`/`MAX_ENRICHMENT_CANDIDATES` capping
      behavior (existing tests) unaffected.

### Component / Integration Tests
- [ ] `discoverProviderCandidates` and `enrichProviderCandidates`
      integration tests (schema-valid end-to-end output) still pass
      unchanged in observable behavior/output shape.

### Success Criteria
- [ ] `npm run typecheck` and `npm run build` clean
- [ ] `npm test` passes, no unexplained regressions (the two
      sequential-ordering tests are *expected* to be rewritten, not a
      regression)
- [ ] No change to `MAX_DISCOVERY_RESULTS`, `MAX_ENRICHMENT_CANDIDATES`,
      response shapes, or error-mapping behavior

## ITERATE
### Outcome
Implemented as scoped. New `backend/src/shared/concurrency.ts` exports
`mapWithConcurrency<T, R>(items, limit, fn)` — a bounded worker pool
returning results in input order regardless of completion order,
fail-fast if `fn` rejects (every current caller already catches its
own per-item errors, so this never fires in practice today).
`discoverProviderCandidates.ts` and `enrichProviderCandidates.ts` each
gained their own exported `CONCURRENCY_LIMIT = 3` and now run their
per-candidate loop bodies through the pool instead of a plain `for`
loop; per-candidate try/catch/log/skip behavior is unchanged (moved
into the mapped function, not removed). `enrichProviderCandidates`
splits candidates into the first `MAX_ENRICHMENT_CANDIDATES` (pooled)
and the remainder (passed through by reference, unchanged, exactly as
before). Rationale comments in both files updated to explain the new
bounded-concurrency reasoning instead of leaving them contradicted by
the code. Two existing tests that asserted strict one-at-a-time
ordering were rewritten to assert bounded concurrency instead (a
deliberate reversal of test intent); `enrichProviderCandidates.test.ts`
also gained a narrower test isolating the still-true "search before
analyze within one candidate" property. `npm test`: 39 files / 346
tests passing (5 new in `shared/concurrency.test.ts`). `npm run
typecheck` and `npm run build` both clean. No live-server before/after
latency measurement was taken — no real `GEMINI_API_KEY`/
`FIRECRAWL_API_KEY` calls were made this session, so the improvement is
architectural (fewer sequential round trips: discovery's 8 extraction
calls now run in ~3 batches instead of 8 sequential steps), not
benchmark-verified.

### Knowledge Updates
`memory-bank/decisions.md` D23 added (full rationale, including the
5-requests/minute Gemini free-tier constraint that shaped the
concurrency limit choice). `memory-bank/progress.md` updated with this
task's entry. `DESIGN.md`'s Optimizations section's stale
"runs sequentially... a deliberate choice" bullet (written before this
task existed) rewritten to describe the new bounded-concurrency
behavior instead of contradicting the code.

### Follow-ups
- No live-request latency measurement exists yet for the "clown, New
  York" scenario that originally motivated this task — worth a manual
  check against a real backend (real `GEMINI_API_KEY`/
  `FIRECRAWL_API_KEY`) to confirm the expected wall-clock improvement,
  not just the architectural reasoning.
- task-78 (real per-step trace timing) is the natural next step to
  actually observe/quantify this improvement from the trace endpoint
  once implemented, rather than guessing from the code.
- `selectProvider.ts`'s own pipeline (M10/M11, one provider at a time)
  was not touched — it has no per-candidate loop to parallelize (only
  ever runs for the single selected provider), so it's out of scope
  for this kind of change entirely, not merely deferred.
