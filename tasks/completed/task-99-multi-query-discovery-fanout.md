# Task 99: Multi-query provider discovery fan-out at a fixed extraction budget
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Replace the single `"{category} in {location}"` discovery search with a
  small set of deterministically-built, source-diverse queries fired concurrently,
  merged, interleaved and deduped — while holding Gemini extraction calls at
  today's cap so LLM call volume does not move.
- Inputs: `ConversationState` (`serviceCategory`, `coreAttributes.location`, and —
  newly used here — `categoryAttributes`), the existing Firecrawl search boundary
  (`searchProviderPages`), the existing `dedupByUrl` helper, the existing
  per-page extraction step (`extractProviderFacts`).
- Outputs:
  - `buildProviderSearchQueries(...)` returning an ordered, deterministic list of
    2–3 queries (broad / review-leaning / requirement-targeted).
  - `discoverProviderCandidates` firing those queries **concurrently** via
    `Promise.allSettled`, round-robin interleaving the per-query result lists,
    deduping by URL, then capping to `MAX_DISCOVERY_RESULTS` **before** extraction.
  - A `PER_QUERY_SEARCH_LIMIT` constant decoupling "results per query" from
    "pages extracted".
  - The `discover` trace step reporting every query that was issued, not one.
- Constraints:
  - **Hard: Gemini calls must not increase.** Extraction stays `<=
    MAX_DISCOVERY_RESULTS` (8) calls per request because the cap is applied to the
    merged, deduped list *before* `mapWithConcurrency(... extract)`. Firecrawl goes
    from 1 search / 8 scrapes to 3 searches / ~9 scrapes.
  - Query construction is **deterministic string building — no LLM call.** An
    LLM-generated query set is explicitly out of scope (see Implementation Notes).
  - `Promise.allSettled`, never `Promise.all` — one query failing must not lose the
    others, and a total failure must degrade to zero candidates, not a thrown error.
  - Interleave round-robin before capping. A plain `slice(0, 8)` of the concatenated
    lists would let query #1 fill every slot and reproduce today's behavior.
  - `buildProviderSearchQuery` (singular) stays exported and unchanged — it has
    tests and `generateProviderList` currently calls it.
  - Extraction, ranking, enrichment and the FACT/INFERRED/SIMULATED model are all
    untouched.
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT (Part 2), reinforcing an evaluation criterion the
  current implementation answers weakly.
- Assignment requirement: Part 2 — "find real service providers that could
  potentially fulfill the request… A strong solution should demonstrate how the
  architecture could work across many categories of event services." Evaluation
  criterion 4 (Data & Search Thinking) — "Does the candidate go beyond simply
  returning the first five Google results? Do they think creatively about search,
  extraction, enrichment and ranking?" DESIGN.md's Optimizations section names
  "Parallelizing searches", "Query generation strategies", "Provider
  deduplication" and "Limiting unnecessary LLM calls" as topics of interest.
- Source: `docs/Home Assignment.pdf` — Part 2; "What We Will Evaluate" §4;
  "DESIGN.md > Optimizations".
- Rationale: Discovery currently issues exactly one query,
  `"{serviceCategory} in {location}"`, and never uses any of the category
  attributes the conversation worked to gather — so the system literally does
  return one search engine's first N results, which is the failure mode criterion
  4 names. This also closes a gap against the project's own roadmap: M7 promised
  "query generation from EventRequirements" and shipped a single string template.
  The fan-out is bounded and the extraction cap is unchanged, so it buys search
  diversity without adding LLM cost — itself a reportable optimization.
- Gaps / conflicts found: none. No new infrastructure is introduced (no index, no
  cache, no background job), so this does not cross the assignment's explicit
  "keep the infrastructure intentionally simple" constraint.

## IMPLEMENT
### Files Touched
- MODIFY:
  - `backend/src/research/searchQuery.ts` (+ its test) — add
    `buildProviderSearchQueries`; keep `buildProviderSearchQuery` as-is.
  - `backend/src/research/discoverProviderCandidates.ts` (+ its test) — parallel
    fan-out, interleave, dedupe, cap before extraction; add
    `PER_QUERY_SEARCH_LIMIT`.
  - `backend/src/recommendation/generateProviderList.ts` (+ its test) — the
    `discover` trace step reports `queries` (array) instead of `query`.
  - `DESIGN.md` — one Optimizations bullet.
- DO NOT TOUCH:
  - `backend/src/research/assembleCandidates.ts` — `MAX_DISCOVERY_RESULTS` keeps
    its current value and meaning (the extraction budget); `dedupByUrl` is reused
    as-is.
  - `backend/src/llm/providerExtraction.ts` and the extraction path.
  - `backend/src/research/firecrawlProvider.ts` — the search boundary is unchanged;
    this task only calls it more than once.
  - `backend/src/research/enrichProviderCandidates.ts` and everything task-98
    touched.
  - All ranking, recommendation-scoring and M10/M11 simulation code.

### Implementation Notes
- **The three queries**, built deterministically from state already in hand:
  1. broad — the existing `"{serviceCategory} in {location}"`
  2. review-leaning — `"{serviceCategory} {location} reviews"`, biased toward
     directory/aggregator pages, which also feeds the reputable-source allowlist
     task-98 introduced
  3. requirement-targeted — `"{serviceCategory} {location} {value}"` for the first
     non-budget `categoryAttributes` entry with a non-null value. This is the one
     that finally puts the gathered requirements into the search. Omitted entirely
     when no such attribute exists, so the set is 2 or 3 queries, never a query
     with a dangling empty term.
- **Why no LLM for query generation**: it would add a blocking call on the critical
  path, introduce a non-deterministic input to a step that is currently trivially
  testable, and add a failure mode — for a gain over three good templates that is
  speculative at this scale. Consistent with the project's standing split (the LLM
  interprets; deterministic code decides). LLM-driven query expansion belongs in
  DESIGN.md's Production Evolution, not here.
- **Budget arithmetic** (state it in the code comment, it is the point of the
  task): `PER_QUERY_SEARCH_LIMIT = 3` x 3 queries = up to 9 raw results ->
  dedupe -> interleave -> `slice(0, MAX_DISCOVERY_RESULTS /* 8 */)` -> at most 8
  extractions. Today's single query already yields up to 8 extractions, so the
  Gemini ceiling is unchanged; only the *diversity* of the 8 pages improves.
- **Interleaving**: round-robin across the per-query result lists (first result of
  q1, q2, q3, then second of each, …) before the cap, so every query contributes
  before any query contributes twice. Deduping must happen across the merged set,
  keeping the earliest occurrence so interleave order is preserved.
- **Failure isolation**: a rejected settlement is logged (matching the
  `console.error` convention already used in `discoverProviderCandidates` and
  `enrichProviderCandidates`) and contributes no results. All queries failing
  yields an empty candidate list, which `generateProviderList` and the
  recommendations empty state already handle.
- **Trace**: `generateProviderList` currently rebuilds the query itself purely for
  the trace, duplicating discovery's internal call. Switch its `detail` to
  `{ queries, candidatesFound }`. `TraceEventSchema.detail` is
  `z.record(z.string(), z.unknown())`, so no schema change is needed. The trace
  screen renders detail generically — confirm it, do not redesign it.

## VALIDATE
### Unit Tests
- [ ] `buildProviderSearchQueries` returns the three documented queries when a
      usable category attribute exists.
- [ ] It returns exactly two queries (no dangling term) when no non-budget
      category attribute has a value.
- [ ] A budget attribute is never used as the requirement-targeted term.
- [ ] `buildProviderSearchQuery` (singular) is unchanged and still exported.
- [ ] All queries are issued, and they **overlap in time** (assert concurrency with
      deferred promises, not call count alone).
- [ ] Results are interleaved round-robin across queries, not concatenated.
- [ ] A URL returned by two different queries is extracted once.
- [ ] The merged list is capped to `MAX_DISCOVERY_RESULTS`, and extraction is
      called at most that many times even when the raw result count is higher.
- [ ] One query rejecting still yields candidates from the others, and logs.
- [ ] All queries rejecting yields an empty array rather than throwing.
- [ ] Pages with `markdown === null` are still dropped before extraction.

### Component / Integration Tests
- [ ] `generateProviderList`'s `discover` trace step reports every issued query.
- [ ] Ranking, enrichment and the returned `ProviderScore[]` shape are unaffected.

### Success Criteria
- [ ] `cd backend && npm test && npm run typecheck && npm run build` all pass
- [ ] `cd frontend && npm test && npm run typecheck` all pass (trace detail shape)
- [ ] Gemini extraction calls per provider-list request are unchanged (still
      `<= MAX_DISCOVERY_RESULTS`); Firecrawl searches go 1 -> 3
- [ ] No regressions in task-98's enrichment behavior
- [ ] `DESIGN.md` Optimizations gains the fan-out-at-fixed-extraction-budget note

## ITERATE
### Outcome
Implemented as scoped, plus one fix outside the listed `Files Touched`.
`buildProviderSearchQueries` added to `searchQuery.ts`;
`discoverProviderCandidates.ts` fans out via `Promise.allSettled`,
round-robin interleaves per-query `SearchedPage[]` lists, dedupes, then
slices to `MAX_DISCOVERY_RESULTS` before extraction, with a new
`PER_QUERY_SEARCH_LIMIT = 3`; `generateProviderList.ts`'s `discover`
trace step now reports `detail.queries` (array). All unit/integration
tests from the VALIDATE checklist were written, including concurrency
via deferred/timed promises (not call-count alone), interleave-order
assertion, cross-query dedup, the cap-before-extraction case, and both
partial- and total-search-failure cases.

Also fixed `frontend/src/screens/TraceScreen.tsx` and its test, outside
this task's listed files: the task's Implementation Notes claimed "the
trace screen renders detail generically — confirm it, do not redesign
it," but `EventDetail` actually switches on `event.step` and hardcoded
`String(detail.query)` for the `"discover"` case. That premise was
checked against the real file and found false. Left alone, the running
app would have shown "undefined" for the search-query line the moment
the backend started emitting `queries` instead of `query`, and no
existing test would have caught it (the screen's own test builds a
self-contained mock event). Changed the discover case to render
`(detail.queries as string[]).join(", ")` and updated its test's fixture
accordingly — a minimal, in-scope-of-intent fix to satisfy the task's
own "no regressions" success criterion, not a redesign.

Validation: `cd backend && npm test && npm run typecheck && npm run
build` — 45 files / 459 tests passing, both clean. `cd frontend && npm
test && npm run typecheck` — 18 suites / 183 tests passing, clean.

### Knowledge Updates
- `memory-bank/decisions.md` D31 records the fan-out design and the
  corrected trace-screen premise.
- `memory-bank/progress.md` Implemented list updated with task-99.
- `DESIGN.md` Optimizations gained a plain-language bullet on the
  fan-out-at-fixed-extraction-budget approach.

### Follow-ups
- Not yet validated against the real Firecrawl API — `discoverProviderCandidates.test.ts`
  and the integration test in this task use fakes only, same as the
  existing suite's convention. Worth a manual real-API smoke check
  (`npm run eval:extraction`-style) if the discovery step is ever
  suspected of query-string issues in production use.
- The task's own claim about `TraceScreen.tsx` being generic was wrong;
  worth a quick pass next time a trace-shape-changing task is planned to
  actually re-read that switch statement rather than assume it from a
  prior description.
