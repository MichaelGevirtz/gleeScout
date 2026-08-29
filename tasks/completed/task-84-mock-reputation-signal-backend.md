# Task 84: Mock reputation signal — averaged Google + Yelp mocks (backend)
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Add a single blended reputation signal to each of the final
  ranked providers, computed as the average of two independently
  generated mock values (one standing in for a Google lookup, one for
  a Yelp lookup — neither is a real API call), attached after ranking
  so it can never influence `score`/`fitScore`/`matchGrade`/order.
- Inputs: `ProviderScore[]` output of `rankProviders` (already exists,
  unchanged) inside `generateProviderList.ts`.
- Outputs: `ProviderCandidateSchema` gains two new optional fields —
  `reputationRating` / `reputationReviewCount` — carrying the
  post-average result only. The two per-source mock values are an
  internal implementation detail, never separately exposed on the
  domain schema or API response (nothing in the UI shows a
  Google-vs-Yelp breakdown; only the blended number is ever needed).
- Constraints:
  - No network call, no new env var, no new npm dependency, for
    either mock source.
  - Must not touch `rankProviders.ts`, `fitScore.ts`,
    `aggregateScore.ts`, `matchAndFitScores.ts`,
    `reputationAndEvidenceScores.ts`, or any ranking dimension —
    reputation/fit/score/grade must be provably unaffected (regression
    tests, not just "we didn't call it from there").
  - Must not attach to `candidate.fields` (FACT) or `candidate.inferred`
    (INFERRED) — see Assignment Alignment/decisions.md for why.
  - Field names must NOT reference "google" or "yelp" — the exposed
    value is a blend of two fabricated numbers, not either platform's
    real data, so the name must not imply a single real source.
  - The generator and its call sites must be unmistakably named/labeled
    as mock/simulated in code (function names, file name, and a short
    comment) — this is fabricated data, not a real API result.
  - Deterministic: same `candidate.url` must always produce the same
    final `reputationRating`/`reputationReviewCount` within a process
    run (no `Math.random()`), so the same provider doesn't show a
    different number on every reload/re-search. The Google-seed and
    Yelp-seed mocks must also be independent of each other (different
    seeds), not the same value averaged with itself.
- Open Questions: none — data shape, naming, determinism, and
  averaging were all confirmed directly with the reviewer before this
  file was written (see Assignment Alignment).

## Assignment Alignment
- Requirement type: PROJECT DECISION (direct first-person user
  instruction to proceed, after review — not an EXPLICIT requirement,
  not an independent Claude recommendation).
- Assignment requirement referenced: Part 2 lists "Ratings"/"Number of
  reviews" as extractable fields (already satisfied by the existing
  Firecrawl+Gemini FACT `rating`/`reviewCount` pipeline, task-15/18/19);
  Part 6 lists "Rating / reputation" as a card element (already
  satisfied by `RecommendationsScreen.tsx`'s existing `deriveRating`).
  Part 3 separately *suggests* "Google reviews"/"Yelp" as enrichment
  sources. **This task does not satisfy that Part 3 suggestion** — no
  real Google or Yelp data is fetched or used, and the field naming was
  deliberately chosen (see above) to avoid implying otherwise. This is
  a cosmetic, clearly-labeled reputation display, not a data-enrichment
  feature, and must never be described (in README/DESIGN.md/commit
  messages) as satisfying "enrich using Google reviews"/"Yelp."
- Source: `docs/Home Assignment.pdf` Part 2 p.2, Part 3 p.2-3, Part 6
  p.3-4.
- Rationale: the reviewer initially asked for a real Google Places API
  (New) integration; after review (Google Cloud Billing required even
  for free-tier usage, and the assignment's own Part 2/6 rating
  requirements are already met by the existing pipeline), the reviewer
  chose to keep the visual feature but replace the real API call with
  deterministic mock data, then extended it to blend a second mocked
  source (standing in for Yelp) into one averaged number, rather than
  build either real integration. This is explicitly NOT presented as
  satisfying any assignment requirement about Google/Yelp/enrichment —
  it exists for visual/portfolio completeness only, same category as
  D19/D21/D25.
- Conflict explicitly surfaced and resolved (assignment-review step 7):
  showing a fabricated number that reads like a real aggregated rating
  is in direct tension with Part 5 / evaluation criterion 5 ("Trust &
  Grounding... particularly important") and this project's own D7/D15
  FACT/INFERRED/SIMULATED discipline. Resolved by the reviewer's own
  decision (confirmed via AskUserQuestion, twice — once for the
  single-source version, again for the blended naming) to (a) label it
  "(simulated)" on the card, reusing the project's existing
  SIMULATED-data convention, and (b) use a source-neutral field name
  rather than naming it after either mocked platform.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/recommendation/mockReputationSignals.ts` — pure,
  deterministic, no I/O. File-level comment stating plainly this
  simulates two review-platform lookups (Google-like and Yelp-like)
  with no real API calls to either. Exports:
  - `generateMockReputation(seed: string): { rating: number;
    reviewCount: number }` — the shared generator, seeded by a simple
    string hash (e.g. two independent hashes of `` `${seed}:rating` `` /
    `` `${seed}:reviewCount` ``). `rating` in `[1, 5]`, `reviewCount` in
    `[10, 1000]` (integer).
  - `computeMockReputation(url: string): { reputationRating: number;
    reputationReviewCount: number }` — calls
    `generateMockReputation` twice with distinct seeds (e.g.
    `` `${url}:google` `` and `` `${url}:yelp` ``), averages each of
    `rating`/`reviewCount` across the two results, and rounds
    (`rating` to 1 decimal place, `reviewCount` to the nearest
    integer). Only this function's output is ever attached to a
    candidate — the two per-source mock values never leave this file.
- MODIFY: `backend/src/domain/provider.ts` — add
  `reputationRating: z.number().min(1).max(5).optional()` and
  `reputationReviewCount: z.number().int().min(10).max(1000).optional()`
  to `ProviderCandidateSchema`, as siblings of `fields`/`inferred`
  (not inside `fields`).
- MODIFY: `backend/src/recommendation/generateProviderList.ts` — after
  `rank()` produces `providers`, map over them attaching
  `reputationRating`/`reputationReviewCount` (from
  `computeMockReputation(candidate.url)`) onto each `candidate` (same
  `{ ...candidate, ... }` spread pattern `enrichProviderCandidates.ts`
  already uses for `inferred`). No new trace event (this step is
  instantaneous synthetic computation, not worth a trace entry — keep
  scope small).
- DO NOT TOUCH: `ranking/**` (all files), `research/**` (all files —
  this is deliberately not a research-provider boundary, see
  Implementation Notes), `providerQuestions/**`, `server.ts` (route
  shape/response body is unchanged — `providers` already flows through
  as-is).

### Implementation Notes
- Deliberately not placed under `backend/src/research/` — that
  directory is reserved for real external-I/O boundaries (Firecrawl)
  per D3. This has no I/O, so giving it a `research/`-style injectable
  client interface would be speculative abstraction for two
  integrations that were explicitly decided against.
- Attach the blended values to the `candidate` object (sibling to
  `fields`/`inferred`), not to `ProviderScore` directly — consistent
  with how `inferred` was added in M8: this is provider data, not a
  ranking computation output. Also means it round-trips correctly
  through `POST /conversation/:id/providers/select`'s existing
  `ProviderCandidateSchema` validation (D14's client-resend pattern)
  with zero extra work.
- One shared generator function used for both mocked sources (not two
  near-duplicate implementations) — "same calculation, different
  seed" per the reviewer's instruction — keeps the file small and
  avoids drift between a "Google mock" and "Yelp mock" that are
  supposed to behave identically.
- Hash function: a small self-contained string hash (e.g. a `for` loop
  over char codes, no library) — do not add a hashing dependency.

## VALIDATE
### Unit Tests
- [ ] `generateMockReputation(seed)` returns `rating` in `[1, 5]` and
      `reviewCount` in `[10, 1000]` (integer) for several sample seeds.
- [ ] Same `seed` called twice returns identical values (determinism).
- [ ] Two different seeds return different values (not a constant
      function) — at least in a small sample, not a statistical proof.
- [ ] `computeMockReputation(url)` returns values equal to the average
      of `generateMockReputation(`${url}:google`)` and
      `generateMockReputation(`${url}:yelp`)` for both `rating` and
      `reviewCount`, with correct rounding.
- [ ] `computeMockReputation(url)`'s two internal seeds produce
      different underlying values for a representative sample of URLs
      (guards against an accidental same-seed bug that would silently
      turn "average of two" into "one value doubled").
- [ ] `ProviderCandidateSchema` accepts a candidate with
      `reputationRating`/`reputationReviewCount` present, and still
      accepts one without them (optional).

### Component / Integration Tests
- [ ] `generateProviderList` (with `discover`/`enrich`/`rank` faked, as
      the existing tests already do) returns candidates carrying
      `reputationRating`/`reputationReviewCount`.
- [ ] Regression: given two fixtures identical except for the mock
      reputation values, `rankProviders`'s `score`, `dimensionScores`,
      `fitScore`, `matchGrade`, and sort order are byte-identical
      (proves attachment happens strictly after ranking and never
      influences it — do not just assert "ranking code doesn't import
      the new file," assert the actual output is unaffected).
- [ ] Existing `generateProviderList.test.ts` / `rankProviders.test.ts`
      / `provider.test.ts` fixtures still pass unmodified except where
      the new optional fields require a fixture update.

### E2E Tests
- [ ] None required for this backend-only task.

### Success Criteria
- [ ] `backend/npm test` full suite green, no regressions.
- [ ] `backend/npm run typecheck` and `npm run build` clean.
- [ ] Follows project conventions (pure functions, no I/O, explicit
      mock-labeling comment, source-neutral field naming).
- [ ] Task scope fully implemented; frontend display is task-85, not
      this task.

## ITERATE
### Outcome
Implemented exactly as planned, no deviations:
- `backend/src/recommendation/mockReputationSignals.ts` (new):
  `generateMockReputation(seed)` uses a small self-contained string
  hash (`for` loop over char codes, no library) to derive `rating`
  (`[1, 5]`) and `reviewCount` (`[10, 1000]` integer), deterministic,
  no `Math.random()`. `computeMockReputation(url)` calls it twice with
  distinct seeds (`` `${url}:google` `` / `` `${url}:yelp` ``) and
  averages/rounds each field.
- `backend/src/domain/provider.ts`: added optional
  `reputationRating`/`reputationReviewCount` to `ProviderCandidateSchema`
  as siblings of `fields`/`inferred`.
- `backend/src/recommendation/generateProviderList.ts`: `rank()`'s
  output is mapped to attach `computeMockReputation(candidate.url)`
  onto each `candidate` *after* ranking; the pre-attachment `ranked`
  array (score/dimensionScores/fitScore/matchGrade/order) is what
  feeds the trace, so ranking is provably untouched.
- Tests added: `mockReputationSignals.test.ts` (6 tests — range,
  determinism, distinctness, averaging correctness, independent seeds),
  2 new `provider.test.ts` cases (accepts populated / accepts omitted),
  1 new `generateProviderList.test.ts` case proving attachment doesn't
  alter score/dimensionScores/fitScore/matchGrade/order across two
  fixture candidates, plus one existing test's assertion changed from
  `toBe(ranked)` (identity) to `toEqual` (the new mapping necessarily
  creates new objects).
- `backend/npm test`: 372/372 passing (360 pre-existing + 12 new).
  `backend/npm run typecheck` and `npm run build`: clean.
- `ranking/**`, `research/**`, `providerQuestions/**`, and `server.ts`
  were not touched, per the task's DO NOT TOUCH list.

### Knowledge Updates
- Recorded as decisions.md D26 and a progress.md entry. Did not add a
  DESIGN.md bullet for this task — there is no user-visible surface
  yet (the "(simulated)" label and any reader-facing note belong with
  task-85, which is where the feature actually becomes visible).

### Follow-ups
- Task-85 (frontend display) is next: render the blended
  `reputationRating`/`reputationReviewCount` with a "(simulated)"
  label, and add the DESIGN.md Assumptions bullet at that point since
  that's when the feature becomes reader-visible.
