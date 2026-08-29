# Task 25: Enrichment orchestration (enrichProviderCandidates)
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Wire tasks 22/23/24 together into the M8 analog of task-20's
  `discoverProviderCandidates` — given M7's `ProviderCandidate[]`
  output, enrich a capped subset with `Inferred<string>[]` tags mined
  from a second, review-targeted Firecrawl search+scrape per
  candidate.
- Inputs: `ProviderCandidate[]` (M7's output, already discovered/deduped/Fact-wrapped).
- Outputs: `enrichProviderCandidates({ candidates, search?, analyze?
  }): Promise<ProviderCandidate[]>` in a new
  `backend/src/research/enrichProviderCandidates.ts`, returning the
  **same array shape** with `inferred` populated on enriched
  candidates (unenriched candidates pass through unchanged, no
  `inferred` field).
- Constraints:
  - **Cap enrichment at `MAX_ENRICHMENT_CANDIDATES = 5`** (named
    constant in this file, same pattern as
    `assembleCandidates.ts`'s `MAX_DISCOVERY_RESULTS`) — confirmed
    during M8 planning: enriching all 8 M7-discovery candidates would
    push per-session sequential Gemini calls to ~16 (M7's up to 8 +
    M8's up to 8), against a free-tier cap already shown empirically
    (M7 real-API validation, 2026-08-28) to produce transient
    failures at half that volume. Capping at 5 keeps total per-session
    Gemini calls around ~13 and roughly matches the assignment's final
    3-5 target. The first 5 candidates in M7's existing output order
    are enriched — no new ranking/selection logic is introduced here;
    that ordering is simply whatever M7 already produced.
  - **One new Firecrawl search+scrape per enriched candidate**
    (confirmed during M8 planning) — reuses `searchProviderPages`
    unchanged, with a query built by task-22's
    `buildEnrichmentQuery`.
  - **Name fallback**: when a candidate's `fields.name` FACT is
    absent (M7 explicitly allows this), use the candidate's hostname
    (`new URL(candidate.url).hostname`) as the `providerName` passed
    to `buildEnrichmentQuery`, so every capped candidate still gets an
    enrichment attempt rather than being silently skipped for lacking
    a name.
  - **Location fallback**: when `fields.location` is absent, omit the
    location term rather than inventing one — `buildEnrichmentQuery`
    already takes plain strings with no normalization, so this task
    decides what to pass, not task-22.
  - Sequential (not parallel) per-candidate processing — same
    deliberate Gemini-rate-limit-driven choice as task-20, not
    revisited here.
  - **Log (not just swallow) a per-candidate enrichment failure** —
    `console.error` with the candidate URL and error, then continue
    without `inferred` on that candidate. This directly addresses the
    "silent failure swallowing has no operational visibility" finding
    recorded in `decisions.md`'s M7 real-API validation section, but
    only for this **new** M8 code path — M7's existing
    `discoverProviderCandidates.ts` catch block is explicitly **not**
    touched by this task (that finding recorded no retries/redesign
    call, and this task doesn't modify M7 files either — see DO NOT
    TOUCH).
  - No retry/backoff logic — logging only, per the same finding's
    explicit scope ("do NOT add retries... yet").
  - Whole-request Firecrawl/search failure for one candidate's
    enrichment attempt is caught (logged, skipped) same as an
    extraction failure — enrichment is best-effort per candidate, not
    all-or-nothing for the whole batch (unlike task-20's `search`,
    which is the single upstream discovery call and correctly still
    propagates uncaught there).
- Open Questions: none — both scope decisions (cap size, new-scrape-per-candidate)
  explicitly confirmed with the reviewer during M8 planning (2026-08-28).

## Assignment Alignment
- Requirement type: EXPLICIT (supports), PROJECT DECISION (cap size, ordering, fallback rules)
- Assignment requirement: Part 3 (enrichment); eval criterion 5 (Trust & Grounding).
- Source: `docs/Home Assignment.pdf`, Part 3 (page 2-3); "What We Will Evaluate" #5 (page 7).
- Rationale: Completes M8 by tying the schema (task-21), query
  builder (task-22), Gemini analysis (task-23), and deterministic
  assembly (task-24) into one orchestration function, mirroring
  task-20's already-approved shape. The cap-at-5 and
  new-scrape-per-candidate decisions were made explicitly during
  planning rather than assumed, given the real, already-observed
  Gemini rate-limit fragility from the M7 real-API validation.
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/research/enrichProviderCandidates.ts`
- CREATE: `backend/src/research/enrichProviderCandidates.test.ts`
- DO NOT TOUCH: `backend/src/research/discoverProviderCandidates.ts`,
  `backend/src/research/assembleCandidates.ts`,
  `backend/src/research/firecrawlProvider.ts`, `backend/src/domain/**`,
  `backend/src/llm/providerExtraction.ts`,
  `backend/src/conversation/**`, `backend/src/server.ts`.

### Implementation Notes
- Signature mirrors task-20's injectable-dependency pattern:
  `search`/`analyze` default to the real `searchProviderPages`/`analyzeReviewText`,
  overridable in tests.
- Not wired into any HTTP route or the conversation flow — same
  explicit scope boundary task-20 set for `discoverProviderCandidates`;
  the real consumer is deferred to whichever milestone assembles the
  final recommendation (M12, or wherever M9's rank-and-trim step ends
  up living).
- This task does **not** address the "first-party vs. third-party
  rating claims" finding from the M7 real-API validation — that's a
  ranking-input concern for M9/M10, not something the enrichment step
  itself resolves. `inferred` tags here are qualitative signal
  (task-23 explicitly instructs Gemini not to restate FACT fields
  like `rating`); the numeric FACT `rating`/`reviewCount` provenance
  question stays open for M9/M10 to decide.
- **Revised during M8 design review (2026-08-28)**: when calling
  task-24's `assembleInferredTags`, this task passes `providerUrl:
  candidate.url` (the M7-discovered candidate's own URL) alongside the
  enrichment page's `url` — this is what lets task-24's
  `classifySourceType` detect `"provider_website"`. This task does
  **not** do any source-type classification itself; it only threads
  the two URLs through to task-24, keeping classification logic in
  exactly one place.
- This task's generic enrichment query (task-22, `"<name> reviews
  <location>"`) may surface a Google result, a Yelp result, the
  provider's own site, or something else entirely — that's expected
  and acceptable for M8 (confirmed during design review); `sourceType`
  records whatever was actually found rather than assuming or
  requiring a specific source. A **future, not-yet-scoped task** would
  investigate a mechanism specifically for Google reviews (see
  `decisions.md`'s Open/Deferred entry) — out of scope here, and this
  task must not be implemented as if Firecrawl's generic search were
  already a Google-specific integration.

## VALIDATE
### Unit Tests
- [ ] Enriches at most the first `MAX_ENRICHMENT_CANDIDATES` candidates, in input order; remaining candidates pass through unchanged (no `inferred` field).
- [ ] Falls back to hostname when a candidate has no `fields.name`.
- [ ] Omits the location term when a candidate has no `fields.location`.
- [ ] Calls `search`/`analyze` sequentially, not concurrently, per candidate.
- [ ] A candidate whose `search` or `analyze` call throws is logged and skipped (no `inferred` field), without rejecting the overall call or dropping the candidate itself from the output.
- [ ] Successfully enriched candidates carry `inferred` built via task-24's `assembleInferredTags`, called with `providerUrl` set to the candidate's own `url`.
- [ ] Does not mutate the input `candidates` array/objects.

### Component / Integration Tests
- [ ] End-to-end with fakes only: `discoverProviderCandidates`-shaped input → `enrichProviderCandidates` → schema-valid `ProviderCandidate[]` with `inferred` populated on the capped subset.

### E2E Tests
- N/A. Manual real-API check optional at completion (`FIRECRAWL_API_KEY`/`GEMINI_API_KEY` now both available locally per the M7 real-API validation), non-blocking.

### Success Criteria
- [ ] All new tests pass; existing suite still passes.
- [ ] `npm run build` clean.
- [ ] No live network calls in `npm test`.
- [ ] `backend/src/research/discoverProviderCandidates.ts` is byte-for-byte unchanged.

## ITERATE
### Outcome
Implemented as planned, one small implementation-level decision made
while coding (not a scope/architecture change, so no reviewer check-in
was needed): the per-candidate query for the location-missing case is
built directly as `` `${providerName} reviews` `` rather than routed
through `buildEnrichmentQuery` with an empty string, since
`buildEnrichmentQuery` does no normalization (confirmed by its own
tests — an empty string would produce a trailing-space artifact like
`"Bounce Palace reviews "`). This matches the task's own instruction
that this task, not task-22, decides what to pass.

Created `backend/src/research/enrichProviderCandidates.ts` exporting
`MAX_ENRICHMENT_CANDIDATES = 5` and `enrichProviderCandidates({
candidates, search?, analyze? })`. Per candidate (first 5 only, input
order): builds a query (name-or-hostname fallback + optional location
term) → one `search` call with `limit: 1` → if a page with non-null
markdown comes back, one `analyze` call → `assembleInferredTags`
(task-24) with `providerUrl: candidate.url` → new candidate object
with `inferred` attached. A thrown `search`/`analyze` error is caught,
logged via `console.error` (candidate URL + error), and the candidate
passes through unchanged. Candidates beyond index 4, and any candidate
where the search returns no scrapable page, also pass through
unchanged with no `inferred` field. No mutation of input
candidates/array. Sequential per-candidate processing (search then
analyze, one candidate fully resolved before the next starts).

9 new tests (7 unit + 1 mutation + 1 end-to-end integration test with
schema validation via `ProviderCandidateSchema.parse`), `npm test`
155/155 passing (146 pre-existing + 9 new), `npm run build` clean, no
live network calls. `discoverProviderCandidates.ts` was only read for
reference during this task, never edited — confirmed unchanged.
Manual real-API check (optional per `## VALIDATE`) was not run this
session — deferred, non-blocking, same as several prior M7/M8 tasks'
manual-check deferrals under Gemini's free-tier daily quota.

### Knowledge Updates
**M8 (Enrichment) is now fully complete** — tasks 21-25 all `DONE`.
`enrichProviderCandidates` mirrors task-20's `discoverProviderCandidates`
shape exactly (injectable `search`/`analyze`, sequential processing,
per-item try/catch) but is not wired into any HTTP route or the
conversation flow — same explicit scope boundary as task-20. The real
consumer (recommendation assembly) is still undetermined and deferred
to M9/M10/M12 per the roadmap's dependency chain.

### Follow-ups
- No consumer yet: whichever milestone assembles the final
  recommendation needs to call `discoverProviderCandidates` then
  `enrichProviderCandidates` in sequence, and decide how `inferred`
  tags factor into ranking/display.
- Deferred from this task's own scope notes (not new discoveries):
  the "first-party vs. third-party rating claims" question and a
  future Google-reviews-specific mechanism both remain open for
  M9/M10 planning, as already recorded in `decisions.md`.
- Manual real-API smoke test of `enrichProviderCandidates` against the
  live Firecrawl/Gemini APIs is still outstanding (optional per this
  task's `## VALIDATE`, non-blocking).
