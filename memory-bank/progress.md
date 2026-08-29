# Progress

## Implemented

- **Task 01 — Backend project scaffold** (DONE, see
  `tasks/completed/task-01-backend-scaffold.md`): Fastify + TypeScript
  backend in `backend/`, `GET /health` route, `dotenv` env loading,
  `tsx` dev watch, `vitest` test runner with a real `.inject()` test.
  No Zod/type-provider yet (deferred to M2, where it has real value).
- **Task 02 — DESIGN.md scaffold and backfill** (DONE, see
  `tasks/completed/task-02-design-doc-scaffold.md`): `DESIGN.md`
  created at repo root with the four required sections (Assumptions,
  Architecture Decisions, Optimizations, Production Evolution),
  backfilled from existing decisions. `piv-task-management` skill
  updated so every future task's completion step checks whether a
  short DESIGN.md bullet is warranted — no separate DESIGN.md task
  should be needed again.
- **Task 03 — Domain models (conversation & requirement schemas)**
  (DONE, see `tasks/completed/task-03-domain-models.md`): Zod schemas
  in `backend/src/domain/conversation.ts` — `ConversationPhase`,
  `CoreAttributes`, `CategoryAttributeSlot` (with nullable `value` so
  a required-but-unanswered attribute is representable, per D6's
  refinement), `Message`, `ConversationState`, plus
  `createInitialState`. 6 new tests, all passing. No merge logic,
  store, or API wiring yet — schemas only, as scoped.
- **Task 04 — In-memory session store** (DONE, see
  `tasks/completed/task-04-session-store.md`): 
  `backend/src/store/sessionStore.ts` — a module-level
  `Map<string, ConversationState>` with `createSession`/
  `getSession`/`updateSession`. No repository interface, persistence,
  TTL/eviction, or API routes. 5 new tests, all passing. **M2 is now
  complete.**
- **Task 05 — Gemini structured-output client wrapper** (DONE, see
  `tasks/completed/task-05-gemini-client.md`):
  `backend/src/llm/geminiClient.ts` exports
  `generateStructuredJson<T>({ schema, prompt, systemInstruction?,
  client? })` — requests JSON from Gemini, parses it, validates it
  against a caller-supplied Zod schema, and throws distinct
  `GeminiConfigError` / `GeminiParseError` / `GeminiValidationError`
  errors. SDK client is injectable (defaults to a real `GoogleGenAI`
  client built from `GEMINI_API_KEY`); SDK types never leak past this
  file. Added `@google/genai` as a dependency. 5 new tests (all
  against an injected fake, no live network calls), plus a manual
  real-API check that passed. Default model corrected mid-task from
  the planned `gemini-2.5-flash` (confirmed dead via a live 404) to
  `gemini-3.6-flash`, overridable via `GEMINI_MODEL`.
- **Task 06 — Requirement extraction (LLM call)** (DONE, see
  `tasks/completed/task-06-extraction.md`):
  `backend/src/llm/extraction.ts` exports `ExtractionResultSchema` /
  `ExtractionResult` (array-shaped `categoryAttributes`) and
  `extractRequirements({ message, state, generate? })`, which builds a
  state-aware prompt and calls Task 05's `generateStructuredJson`
  (injectable via `generate`, defaulting to the real wrapper). Returns
  only what the current message states — never backfills from known
  state; that reconciliation is explicitly Task 07's job. 4 new tests,
  all against injected fakes/a fake SDK client (no live network
  calls) — one of them exercises Task 05's real
  `GeminiValidationError` path via a fake client rather than
  reimplementing validation in the test.
- **Task 07 — Deterministic merge of extraction into conversation
  state** (DONE, see `tasks/completed/task-07-merge-extraction.md`):
  `backend/src/conversation/mergeExtraction.ts` — pure function
  `mergeExtraction({ state, extraction, userMessage })` implementing
  D5's merge policy: sticky `serviceCategory` once set, "latest
  non-null mention wins" for core/category attribute values, category
  attribute `description`/`importance` refreshed from each extraction,
  attributes never dropped once introduced, `phase` untouched, no
  input mutation (D11). New `backend/src/conversation/` directory. 10
  new tests (one per merge-policy point plus a non-mutation check),
  31/31 passing overall, no LLM calls/I-O (pure function).
- **Task 08 — On-demand extraction evaluation script** (DONE, see
  `tasks/completed/task-08-extraction-eval.md`): PROJECT
  RECOMMENDATION, not assignment-required. `backend/scripts/` (new,
  outside `tsconfig.json`'s `include` and never swept into `npm
  test`): `extractionGoldenSet.ts` (9 realistic hand-picked cases —
  bounce house, wedding photographer, taco truck, bartender, face
  painter, ambiguous request, multi-requirement message, multi-turn
  correction, missing-information) and `evalExtraction.ts` (runner —
  drives `extractRequirements`/`mergeExtraction` per turn against the
  **real** Gemini API, scores loose PASS/REVIEW/FAIL structural
  checks, no exact-string matching, no LLM-as-judge). New
  `npm run eval:extraction` script. Full real-API run: 9/9 cases
  completed, 4 PASS/5 REVIEW/0 FAIL, manually verified sensible
  including a correct end-to-end multi-turn merge-policy check.
  Discovered mid-task that Gemini's free tier caps
  `gemini-3.6-flash` at 5 requests/minute; added a 13s inter-call
  pacing delay inside the script (not retry/fallback logic, and no
  change to production `src/` code).
- **Task 09 — Deterministic missing-attribute selection + readiness
  gate** (DONE, see
  `tasks/completed/task-09-question-policy.md`):
  `backend/src/conversation/questionPolicy.ts` exports
  `selectNextMissingAttribute(state)` (fixed check order: `dateTime`
  → `location` → required category attributes in insertion order;
  optional category attributes never proactively selected) and
  `isReadyForSearch(state)` (true via either a complete path or a
  `MAX_GATHERING_TURNS = 8` turn-count fallback path — deliberately
  not synonymous with "complete"). Both pure, read-only, no LLM call.
  This is the deterministic half of M4. 11 new tests, 42/42 passing
  overall. `DESIGN.md` and `memory-bank/decisions.md` (D12) updated
  with the two documented interview tradeoffs (fixed ordering;
  two-path readiness gate + turn-cap).
- **Task 11 — LLM phrases the next missing-attribute question**
  (DONE, see `tasks/completed/task-11-question-phrasing.md`):
  `backend/src/llm/questionPhrasing.ts` exports
  `generatePendingQuestion({ target, state, generate? })` — takes
  Task 09's `MissingAttributeTarget` (already decided) and calls
  Gemini via Task 05's wrapper to phrase it as one natural
  conversational question; never reassesses *which* attribute to ask
  about (D5's phrasing-only boundary, enforced via system
  instruction). Post-validation sanity check: empty/whitespace
  question throws. This is the LLM half of M4 (task-09 is the
  deterministic half). 7 new tests, 49/49 passing overall, no live
  network calls in the automated suite. Manual real-API check was
  attempted but blocked by Gemini's free-tier daily quota
  (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, already
  documented in D2b as exhausted earlier the same day by prior
  eval/validation activity) — reported honestly rather than claimed;
  not a code defect, the request construction matches the
  already-proven-live pattern from task-06/08. Re-run deferred to
  next quota reset (follow-up, non-blocking).
- **Task 12 — Conversation API routes + single-turn orchestration**
  (DONE, see `tasks/completed/task-12-conversation-routes.md`):
  `backend/src/conversation/orchestrateMessage.ts` — the single-turn
  glue wiring Tasks 06/07/09/11 together (extract → merge → ready?
  transition phase : select+phrase next question). `backend/src/server.ts`
  now exposes `POST /conversation`, `POST /conversation/:id/message`,
  `GET /conversation/:id`, with error mapping (404 unknown session,
  400 bad body, 502 known Gemini errors, 500 generic catch-all for
  anything else, no internal detail ever leaked in the response
  body). Deliberately does **not** gate on the session's current
  `phase` — a message posted after `"ready_for_search"` (e.g. a
  correction) is processed through the exact same path, no 409.
  Deliberately does **not** yet add per-session concurrency
  protection — that's task-13, immediately next. 18 new tests
  (9 orchestration unit tests + 9 route tests), 67/67 passing
  overall, no live network calls in the automated suite. Manual
  real-API smoke test partially blocked by the same daily Gemini
  quota as task-11 (D2b) — `POST /conversation` and `GET
  /conversation/:id` confirmed live; `POST .../message` reached the
  real Gemini API (confirmed via log) before hitting the quota,
  which also proved the 500 catch-all correctly handles a real
  unforeseen SDK error class with no leak.
- **Task 13 — Per-session request serialization + concurrency
  integration test** (DONE, see
  `tasks/completed/task-13-session-serialization.md`):
  `backend/src/conversation/sessionQueue.ts` exports
  `runSerialized<T>(key, fn)` — a per-key promise chain
  (`Map<string, Promise>`) so same-session requests process strictly
  in order while different sessions stay fully concurrent; a settled
  entry is removed via a race-safe check-then-delete so the map
  doesn't grow unbounded. `backend/src/server.ts`'s message route now
  wraps `getSession` (read **fresh inside** the serialized closure,
  not captured beforehand) → `orchestrate` → `updateSession` in
  `runSerialized(sessionId, ...)`, implementing D11. **M5
  (Conversation API) is now fully complete.** 5 new queue unit tests +
  2 new route-level concurrency integration tests (same-session
  data-loss prevention; cross-session non-blocking), 74/74 passing,
  repeated 5x with no flakiness. Notably, self-verification against
  two deliberately-broken implementations caught that the first draft
  of *both* integration tests were passing without actually proving
  anything (microtask-flush timing wasn't advancing Fastify's real
  request pipeline, and one test resolved its blocking promise before
  confirming the blocked request had even started) — both fixed using
  an explicit "reached this point" deferred-promise signal instead of
  a guessed flush count, then re-verified to fail against the broken
  versions and pass against the real one.
- **Task 14 — Evidence/provenance model (FACT primitive)** (DONE, see
  `tasks/completed/task-14-evidence-model.md`):
  `backend/src/domain/evidence.ts` exports `FactSchema(valueSchema)`
  (a Zod factory returning `{ value, source, sourceUrl, retrievedAt }`)
  and the generic `Fact<T>` type. Scoped to FACT only, per project
  decision confirmed with the reviewer before implementation —
  `INFERRED`/`SIMULATED` wrapper types are deferred to their first
  real consumer (M8, M11), and no `Provider` entity was introduced
  (that's M7's job). `sourceUrl` validated as `z.string().url()`,
  `retrievedAt` as `z.string().datetime()` (ISO 8601). Reviewer
  correction applied before approval: the schema enforces the
  structure of provenance, not that the value is actually true or
  that the source supports it - that stays the research pipeline's
  responsibility (see D7 addendum). 8 new tests, all passing. **M6
  (evidence/provenance model) is now complete.**

- **Task 15 — Provider domain schema (ProviderCandidate +
  DiscoveredResult)** (DONE, see
  `tasks/completed/task-15-provider-domain-schema.md`): first task of
  M7. `backend/src/domain/provider.ts` — `DiscoveredResultSchema`
  (raw, untrusted search-result shape, no `Fact` wrapper — a search
  hit is discovery signal, never a confirmed provider fact) and
  `ProviderCandidateSchema` (`url` + `fields`), where `fields` covers
  all ten of Part 2's extractable attributes (name, location,
  servicesOffered, pricing, availability, rating, reviewCount, photos,
  policies, contactMethod), each optional and wrapped in M6's
  `FactSchema`. `url` currently stands in for "provider website" even
  when the visited page is a directory/marketplace listing — canonical
  website resolution is explicitly deferred. Preceded by an
  independent M7 architecture review (challenging the roadmap's
  original M7 wording) and two rounds of explicit design-decision
  confirmation with the reviewer: deterministic category+location-only
  search queries (no LLM call), Firecrawl as the sole discovery source
  (confirms D3), a discovery cap wider than the final 3-5
  (`MAX_DISCOVERY_RESULTS = 8`, a tuning value not an assignment
  requirement), search snippets never treated as `Fact`s, domain-name
  provenance labels, sequential (not parallel) per-candidate
  extraction given Gemini's documented free-tier rate limit (D2b), and
  a revised candidate bar (URL + at least one useful extracted field,
  not "must have a name" — relaxed after review because discarding
  real extracted data over one missing field wastes an already-paid-
  for scrape+extraction call). 6 new tests, `npm test` 88/88 passing,
  `npm run build` clean.
- **Task 16 — Deterministic provider search query builder** (DONE,
  see `tasks/completed/task-16-search-query-builder.md`):
  `backend/src/research/searchQuery.ts` exports
  `buildProviderSearchQuery({ serviceCategory, location })`, a pure
  function returning the `` `${serviceCategory} in ${location}` ``
  template — no LLM call, no I/O, no normalization. New
  `backend/src/research/` directory. 3 new tests, `npm test` 91/91
  passing, `npm run build` clean.
- **Task 18 — Gemini per-page provider-fact extraction** (DONE, see
  `tasks/completed/task-18-provider-extraction.md`):
  `backend/src/llm/providerExtraction.ts` exports
  `ProviderExtractionResultSchema`/`ProviderExtractionResult` (bare
  nullable fields — `name`, `location`, `servicesOffered`, `pricing`,
  `availability`, `rating`, `reviewCount`, `photos`, `policies`,
  `contactMethod` — matching task-15's `ProviderCandidateFieldsSchema`
  field set minus the `Fact<T>` wrapper) and `extractProviderFacts({
  url, markdown, generate? })`, reusing task-05's
  `generateStructuredJson` on one already-scraped page's markdown
  rather than a chat message. System instruction explicitly forbids
  guessing — a field absent, unclear, or merely inferred on the page
  must come back null, per the M7 architecture review's Q&A. No
  Fact-wrapping, dedup, capping, or Firecrawl call in this file — pure
  extraction over content already fetched by task-17. 5 new tests, all
  against injected fakes/a fake SDK client (no live network calls),
  96/96 passing overall, `npm run build` clean.
- **Task 19 — Deterministic candidate assembly (dedup, cap,
  Fact-wrapping)** (DONE, see
  `tasks/completed/task-19-assemble-candidates.md`):
  `backend/src/research/assembleCandidates.ts` exports
  `MAX_DISCOVERY_RESULTS = 8` (same tuning-value caveat as task-17),
  `dedupByUrl` (exact-URL dedup, first occurrence wins — no fuzzy
  matching, that's M9's job), and `assembleCandidate({ url,
  extraction, retrievedAt })` — Fact-wraps every non-null field from
  task-18's `ProviderExtractionResult` (`source` = hostname parsed
  from `url`), returning `null` only when every field is null (true
  empty). Implements the revised candidate bar from the M7 review:
  "URL + at least one useful extracted field," not "must have a
  name" — a candidate can be kept with `name` absent if e.g.
  `pricing`/`rating` are populated. Pure functions only, no
  Firecrawl/Gemini/network/timing side effects — caller always
  supplies `retrievedAt`. 7 new tests, 108/108 passing overall,
  `npm run build` clean.

- **Task 21 — Inferred evidence schema (Inferred<T> + ProviderCandidate.inferred)**
  (DONE, see `tasks/completed/task-21-inferred-evidence-schema.md`):
  first task of M8. `backend/src/domain/evidence.ts` now exports
  `SourceTypeSchema`/`SourceType` (`"google" | "yelp" |
  "provider_website" | "directory" | "other"`), `InferredSchema<T>`
  (`{ value, evidenceSourceUrl, evidenceExcerpt?, sourceType,
  retrievedAt }`), and `Inferred<T>` — the second of D7's three
  FACT/INFERRED/SIMULATED buckets, deferred since task-14 to land with
  its first real consumer. `ProviderCandidateSchema` gained an
  optional `inferred: Inferred<string>[]` field, a sibling of `fields`
  (not nested inside it) — `fields` (FACT) is untouched.
  `sourceType`'s value set and "app-computed only, never
  LLM-produced" rule were confirmed during a second M8 design review
  round (2026-08-28) before this task was written: the enum keeps
  `"directory"` as a valid future value even though nothing computes
  it yet (no maintained hostname list added speculatively — see
  task-24's scope). 12 new tests (10 in `evidence.test.ts`, 2 in
  `provider.test.ts`). `npm test` 131/131 passing (116 pre-existing +
  12 new here + 3 from task-22, implemented concurrently in a separate
  session — disjoint files, no conflict), `npm run build` clean.
- **Task 22 — Deterministic enrichment search query builder** (DONE,
  see `tasks/completed/task-22-enrichment-query-builder.md`):
  `backend/src/research/enrichmentQuery.ts` exports
  `buildEnrichmentQuery({ providerName, location })`, a pure function
  returning the `` `${providerName} reviews ${location}` `` template —
  the M8 analog of task-16's `buildProviderSearchQuery`, aimed at
  finding review content about an already-discovered provider rather
  than businesses in a category. No LLM call, no I/O, no candidate
  selection/fallback logic (that's task-25's job). 3 new tests, `npm
  test` 131/131 passing, `npm run build` clean.

- **Task 23 — Gemini review-text analysis (raw tag+excerpt
  extraction)** (DONE, see
  `tasks/completed/task-23-review-analysis.md`):
  `backend/src/llm/reviewAnalysis.ts` exports
  `ReviewAnalysisResultSchema`/`ReviewAnalysisResult` (`{ tags: {
  tag: string, excerpt: string | null }[] }`) and `analyzeReviewText({
  url, markdown, generate? })` — the M8 analog of task-18's
  `extractProviderFacts`, but for qualitative/reputation signal (Part
  3's "good with toddlers" / "frequently late" example) instead of the
  ten structured FACT fields. Reuses task-05's `generateStructuredJson`
  exactly as `providerExtraction.ts` does; same injectable `generate`
  pattern. Raw extraction only — no `Inferred<T>` wrapping (task-24's
  job) and no `sourceType`/source-like field in the schema or prompt,
  by design: `sourceType` is always computed deterministically from
  the URL, never proposed by the LLM. 5 new tests (all against
  injected fakes/a fake SDK client, no live network calls), `npm test`
  136/136 passing overall, `npm run build` clean. No consumer wired in
  yet — task-24/25 are next.
- **Task 24 — Deterministic assembly of Inferred tags
  (evidence-wrapping)** (DONE, see
  `tasks/completed/task-24-assemble-inferred-tags.md`):
  `backend/src/research/assembleInferredTags.ts` exports
  `assembleInferredTags({ url, providerUrl, analysis, retrievedAt })`
  — the M8 analog of task-19's `assembleCandidate`, wrapping task-23's
  raw `{ tag, excerpt }[]` into `Inferred<string>[]` — and a
  separately-exported, separately-testable `classifySourceType(url,
  providerUrl)` (check order: same hostname as `providerUrl` →
  `"provider_website"`, then `google.*` → `"google"`, then `yelp.*` →
  `"yelp"`, else `"other"`; deliberately never returns `"directory"`,
  which stays unbuilt until a real need shows up — no maintained
  hostname list added speculatively). Pure function, no
  Firecrawl/Gemini/network calls, no internal `Date.now()`. An empty
  `tags: []` maps to `[]`, not `null` (unlike `assembleCandidate`'s
  all-null → null collapse — zero tags found is fully representable,
  not "nothing usable"). 10 new tests, `npm test` 146/146 passing (136
  pre-existing + 10 new), `npm run build` clean. No consumer yet —
  task-25 wires this in.
- **Task 25 — Enrichment orchestration (enrichProviderCandidates)**
  (DONE, see `tasks/completed/task-25-enrich-provider-candidates.md`):
  `backend/src/research/enrichProviderCandidates.ts` exports
  `MAX_ENRICHMENT_CANDIDATES = 5` and `enrichProviderCandidates({
  candidates, search?, analyze? })` — the M8 analog of task-20's
  `discoverProviderCandidates`, wiring tasks 22/23/24 together. Enriches
  only the first 5 candidates (input order); per candidate, builds an
  enrichment query (name-or-hostname fallback, location term omitted
  rather than invented when absent), makes one Firecrawl search+scrape
  (`limit: 1`), analyzes the page via task-23's `analyzeReviewText`, and
  wraps the result via task-24's `assembleInferredTags` with
  `providerUrl: candidate.url`. A per-candidate `search`/`analyze`
  failure is caught, logged via `console.error` (URL + error, no
  retry), and that candidate passes through with no `inferred` field
  rather than failing the whole batch — addressing the "silent failure
  swallowing" finding from the M7 real-API validation, but only for
  this new M8 path (M7's own catch block untouched). Sequential (not
  parallel) per-candidate processing, same Gemini-rate-limit rationale
  as task-20. Not wired into any HTTP route or the conversation flow —
  same explicit scope boundary task-20 set. 9 new tests (7 unit + 1
  mutation-safety + 1 end-to-end integration test validated against
  `ProviderCandidateSchema`), `npm test` 155/155 passing (146
  pre-existing + 9 new), `npm run build` clean, no live network calls.
  `discoverProviderCandidates.ts` confirmed unchanged (only read for
  reference). **M8 (Enrichment) is now fully complete.**
- **Task 26 — Fix Google/Yelp/provider-website source-type
  classification bugs** (DONE, see
  `tasks/completed/task-26-fix-sourcetype-classification.md`):
  post-M8-review fix. `classifySourceType` in
  `backend/src/research/assembleInferredTags.ts` previously used
  substring `.includes("google.")`/`.includes("yelp.")` (would
  misclassify lookalikes like `notgoogle.com`) and exact hostname
  equality for provider-website detection (would misclassify a
  provider's own site as `"other"` on a `www.` prefix mismatch
  between M7's `candidate.url` and the enrichment search's result
  URL). Fixed with a domain-suffix `hostnameMatches` helper
  (`hostname === "google.com" || hostname.endsWith(".google.com")`,
  same for yelp.com) and a `stripWww` helper applied to both sides of
  the provider-website comparison. Check order and `"directory"`
  non-detection unchanged. 10 new tests, `npm test` 165/165 passing
  (155 pre-existing + 10 new), `npm run build` clean. Explicitly out
  of scope (per reviewer instruction): excerpt verification, trust
  scoring, source weighting, ranking, a Google Reviews
  API/integration, `"directory"` detection, retries, parallelism.
  **M8 is now considered fully closed** (post-review conditions met).
- **Task 27 — Ranking domain types (RankingRequirements, ProviderScore)**
  (DONE, see `tasks/completed/task-27-ranking-domain-types.md`): first
  task of M9. New `backend/src/ranking/` directory.
  `backend/src/ranking/types.ts` exports `RankingRequirements` (a
  narrow type — `location` + `categoryAttributes` only, deliberately
  decoupled from `ConversationState`'s full shape and excluding
  `dateTime`, which none of M9's five dimensions use),
  `deriveRankingRequirements(state)` (pure mapping),
  `RankingDimension` (the five-dimension literal union), and
  `ProviderScore` (`candidate` + `score` + `dimensionScores` +
  `explanation`, using `null` — not `0` — to represent an
  excluded/missing dimension). Preceded by a two-round M9 design
  review (see `decisions.md`'s D13a-h) resolving budget
  double-counting, a minimum-evidence floor, reputation source
  consistency, and a ranking→research layering concern before any
  code was written. 4 new tests, `npm test` 169/169 passing (165
  pre-existing + 4 new), `npm run build` clean, no I/O/LLM calls.
- **Task 29 — Reputation and evidence-quality dimension scores** (DONE,
  see `tasks/completed/task-29-reputation-evidence-scores.md`):
  `backend/src/shared/hostname.ts` (new `shared/` directory,
  domain-agnostic, zero deps) — `hostnameMatches`/`stripWww` relocated
  verbatim out of `assembleInferredTags.ts` (pure move, its behavior
  and existing test file unchanged) so `ranking/` never imports from
  `research/`. `backend/src/ranking/reputationAndEvidenceScores.ts`
  exports `REVIEW_COUNT_CONFIDENCE_CAP = 20`, `reputationScore(candidate)`
  (`null` unless `rating`/`reviewCount` are both present, share the
  literal same `sourceUrl`, and that source is `google.com`/`yelp.com`
  — D13a plus its two addenda: same-source consistency and the
  `research/`→`ranking/` layering fix — otherwise
  `(rating/5) * min(reviewCount/20, 1)`), and
  `evidenceQualityScore(candidate)` (populated-FACT-field ratio,
  denominator derived from `ProviderCandidateFieldsSchema.shape`
  rather than hardcoded, deliberately excludes `candidate.inferred`
  per D13b so M8's enrichment cap can't inflate the score). All pure,
  no I/O/LLM. 17 new tests, `npm test` 208/208 passing (191
  pre-existing + 17 new), `npm run build` clean, confirmed no
  `ranking/**` → `research/**` import.

- **Task 28 — Requirement-match, geo-fit, and price-fit dimension
  scores** (DONE, see
  `tasks/completed/task-28-match-geo-price-scores.md`):
  `backend/src/ranking/matchAndFitScores.ts` exports three pure
  scoring functions plus `parseDollarAmount`. `requirementMatchScore`
  does case-insensitive substring matching between non-null
  `categoryAttributes` values and the combined `servicesOffered`/
  `policies` FACT text, excluding the budget attribute (found via a
  private `findBudgetAttribute` helper shared with `priceFitScore`) so
  budget doesn't double-count against requirement match. `geoFitScore`
  does case-insensitive substring overlap between requirement/provider
  location (either direction). `priceFitScore` locates the budget,
  parses one dollar amount from it and from `candidate.fields.pricing`
  via `parseDollarAmount` (regex-extracts `$`-prefixed amounts; exactly
  one match required, else `null` — deliberately never averages or
  picks a bound from a range like `"$200-$300"`), then applies a linear
  falloff above budget floored at 0. All three return `null` (not `0`)
  when a dimension can't be computed for a candidate, per D13's
  missing-data rule. 22 new tests (all VALIDATE checklist cases plus
  a policies-only match-score case), `npm test` 208/208 passing
  (22 of them new here — task-29 landed concurrently with its own 17,
  see task-29 outcome), `npm run build` clean, pure functions only —
  no I/O, no LLM call, no `Date.now()`.
- **Task 30 — Weighted aggregate score (exclude + renormalize on
  missing dimensions)** (DONE, see
  `tasks/completed/task-30-weighted-aggregate-score.md`):
  `backend/src/ranking/aggregateScore.ts` exports `DIMENSION_WEIGHTS`
  (all five dimensions equal at `0.2`, per D13f), `MIN_MEANINGFUL_DIMENSIONS
  = 2` (D13h), and `computeAggregateScore(dimensionScores)` — counts
  non-null dimensions, returns `0` immediately if below the floor
  (D13h's hard floor, not a graduated confidence factor), otherwise
  accumulates `weight * score` and `weight` over the non-null
  dimensions and divides. Implemented exactly per the already-approved
  M9 design (D13f/D13h), no new decisions. 8 new tests, `npm test`
  224/224 passing (216 pre-existing + 8 new), `npm run build` clean,
  pure function only.
- **Task 31 — Deterministic ranking-explanation builder** (DONE, see
  `tasks/completed/task-31-ranking-explanation.md`):
  `backend/src/ranking/explanation.ts` exports
  `buildRankingExplanation(candidate, dimensionScores)` — plain
  sentence-template clauses (no LLM call) over four of the five
  dimensions (requirementMatch/geoFit/priceFit/reputation);
  `evidenceQuality` is deliberately never phrased into the text (a
  background completeness signal, not user-facing). A `null` score
  contributes no clause; `geoFit = 0` is omitted rather than asserted
  as a negative (a lexical heuristic can't support "does not serve
  your area"); all-null falls back to a fixed string. The price-fit
  clause pulls the real parsed `pricing.value` string into the
  sentence per the task's own instruction, and the reputation clause
  cites the real `rating.value`/`reviewCount.value` numbers. 6 new
  tests, `npm test` 222/222 passing (216 pre-existing + 6 new), `npm
  run build` clean, pure function only.
- **Task 32 — rankProviders orchestration (score all candidates, sort,
  cap to top 5)** (DONE, see
  `tasks/completed/task-32-rank-providers.md`): last task of M9.
  `backend/src/ranking/rankProviders.ts` exports `MAX_RANKED_RESULTS =
  5` and `rankProviders({ candidates, requirements })` — the single M9
  entry point wiring tasks 27-31 together: computes all five dimension
  scores per candidate (once, reused for both aggregation and
  explanation), aggregates via task-30, builds the explanation via
  task-31, sorts descending by score, returns the top 5. No filtering
  by whether a candidate has `inferred` data (D13c) — an unenriched
  candidate competes on its FACT data alone, same as any other
  candidate. Standalone function only, no HTTP route wiring (deferred
  to M12, same M7/M8 precedent). 4 new integration-style tests (>5-
  candidate cap-and-sort, D13c unenriched-beats-weaker-enriched
  regression, exact dimensionScores shape + explanation check, D13a
  self-reported-rating flow-through), all passing on the first run.
  `npm test` 226/226 passing (222 pre-existing + 4 new), `npm run
  build` clean, pure function only. **M9 (Ranking) is now fully
  complete.**

- **Task 33 — Provider-question domain types + deterministic gap
  analysis** (DONE, see
  `tasks/completed/task-33-provider-gap-analysis.md`): first task of
  M10. New `backend/src/providerQuestions/` directory.
  `backend/src/providerQuestions/types.ts` (`ProviderGapTopic`,
  `ProviderGap`) and `analyzeGaps.ts` export
  `analyzeProviderGaps({ candidate, state })` — three fixed, pure
  presence/lexical-match gap topics (`availability`, `requirementFit`,
  `pricing`), generalizing Part 4's three worked examples with no LLM
  involved in deciding what's missing (D5). Per D14 (confirmed before
  this task was implemented), this always runs for a single provider —
  the one selected in the UI — never as a batch across all ranked
  candidates; that only affects who calls this function and when, not
  its own single-candidate signature. 13 new tests, `npm test` 239/239
  passing, `npm run build` clean.
- **Task 34 — LLM phrasing of provider gap questions (batched per
  provider)** (DONE, see
  `tasks/completed/task-34-provider-question-phrasing.md`):
  `backend/src/llm/providerQuestionPhrasing.ts` exports
  `ProviderQuestionsResultSchema`/`generateProviderQuestions({
  candidate, gaps, state, generate? })`, reusing task-05's
  `generateStructuredJson`. One Gemini call per provider (not per gap);
  short-circuits with **no** Gemini call at all when `gaps` is empty
  (confirmed via a `vi.fn` spy, not just an empty result) — a direct,
  tested answer to the assignment's "limiting unnecessary LLM calls"
  optimization interest. Post-validation guards both a blank question
  and a response/gap-count mismatch; a genuine `GeminiValidationError`
  (malformed shape) is confirmed to propagate unchanged via a fake
  client, same pattern as task-06/task-11. 6 new tests, `npm test`
  245/245 passing, `npm run build` clean, no live network calls.
- **Task 35 — prepareProviderQuestions orchestration** (DONE, see
  `tasks/completed/task-35-prepare-provider-questions.md`): last task
  of M10. `backend/src/providerQuestions/prepareProviderQuestions.ts`
  exports `prepareProviderQuestions({ candidate, state, analyze?,
  phrase? })` — a two-step pipeline (task-33's `analyzeProviderGaps` →
  task-34's `generateProviderQuestions`) for **one** candidate, with no
  try/catch: a failure in either step propagates to the caller
  unchanged, rather than being silently swallowed. This is narrower
  than the array-based, catch-and-continue orchestrator this task was
  originally drafted as (task-20/task-25's precedent) — revised under
  D14, since batch resilience across 5 background candidates doesn't
  make sense for the one thing the user is actively waiting on after
  selecting a provider. 5 new tests (happy path, zero-gap path, both
  error-propagation cases, one end-to-end test combining the real
  `analyzeProviderGaps` with a fake `phrase`). `npm test` 250/250
  passing, `npm run build` clean, no live network calls. **M10
  (Provider-specific questions) is now fully complete.**
  `prepareProviderQuestions` is a standalone function only — not wired
  to any HTTP route; per D14, its real caller is M12's future
  provider-selection route, invoked with exactly the one client-echoed
  `ProviderCandidate` the user selected.
- **Task 36 — M10 post-review fixes** (DONE, see
  `tasks/completed/task-36-m10-post-review-fixes.md`): a post-M10
  independent review (PASS WITH ISSUES) found `requirementFit` gap
  analysis ignored `candidate.inferred` (M8's INFERRED tags) entirely,
  and that no test covered the realistic "provider already knows most
  things, exactly one gap remains" scenario end-to-end. Reviewer
  approved fixing exactly those two findings, deferring four others
  (duplicated budget-lookup helper, no per-provider gap cap, exposing
  `ProviderGap.topic` to M11, general follow-ups) unless M11 later
  proves they're needed. `analyzeRequirementFitGaps` now also searches
  INFERRED tags' `value`/`evidenceExcerpt` text — read-only, never
  promoted to FACT, confirmed by a test that asserts `candidate.fields`/
  `candidate.inferred` are unchanged after a gap is closed via INFERRED
  signal. 5 new tests (4 in `analyzeGaps.test.ts`, 1 end-to-end in
  `prepareProviderQuestions.test.ts` combining real gap analysis with a
  fake phrasing step). `npm test` 255/255 passing (250 pre-existing + 5
  new), `npm run build` clean.

- **Task 37 — Simulated<T> schema (SIMULATED evidence primitive)**
  (DONE, see `tasks/completed/task-37-simulated-evidence-schema.md`):
  first task of M11. `backend/src/domain/evidence.ts` now exports
  `SimulatedSchema<T>` (`{ value, generatedAt }`) and `Simulated<T>` —
  the third and final bucket of D7's FACT/INFERRED/SIMULATED trio,
  deliberately narrower than Fact/Inferred (no `source`/`sourceUrl`/
  `evidenceExcerpt`/`sourceType`, per D15 — nothing was retrieved or
  excerpted). `ProviderCandidateSchema` in `provider.ts` confirmed
  unchanged — per D15, SIMULATED data is never attached to the
  candidate object. 5 new tests, `npm test` 260/260 passing (255
  pre-existing + 5 new), `npm run build` clean. No consumer wired in
  yet — task-38/39/40 are next.

- **Task 38 — Gemini call: simulate raw answers to a provider's
  questions** (DONE, see
  `tasks/completed/task-38-simulate-provider-answers.md`): one of
  M11's tasks (run in parallel with task-37 — disjoint files).
  `backend/src/llm/providerResponseSimulation.ts` exports
  `SimulatedAnswersResultSchema`/`simulateProviderAnswers({
  candidate, questions, state, generate? })` — the M11 analog of
  task-34's `generateProviderQuestions`, reusing task-05's
  `generateStructuredJson` with the same injectable `generate`
  pattern. One batched Gemini call per provider (not per question);
  short-circuits with **no** Gemini call when `questions` is empty
  (confirmed via a spy). System instruction explicitly frames the
  task as a deliberate hypothetical simulation (per Part 5's worked
  example — concrete-sounding, specific values, no hedging/refusal
  because "no real provider was contacted"), grounded only in the
  candidate's known FACT context (name/pricing) + the user's
  requirements — `candidate.inferred` deliberately excluded, per the
  M11 planning discussion. Same two post-validation guards as
  task-34 (answer-count mismatch throws; blank answer throws). Raw
  `string[]` output only — no `Simulated<T>` wrapping (that's
  task-39's job). 6 new tests (empty short-circuit via spy, single
  question, multiple questions in order, blank-answer throw,
  count-mismatch throw, real `GeminiValidationError` propagation via
  a fake client), `npm test` 266/266 passing (260 pre-existing + 6
  new), `npm run build` clean, no live network calls.

- **Task 41 — `serviceCategory` is a mandatory readiness condition**
  (DONE, see
  `tasks/completed/task-41-service-category-readiness-gate.md`):
  post-M11-review fix to Task 09's readiness gate.
  `isReadyForSearch` (`backend/src/conversation/questionPolicy.ts`)
  now returns `false` whenever `state.serviceCategory === null`, ahead
  of both the complete-path and `MAX_GATHERING_TURNS` fallback-path
  checks — closing a real gap where a conversation with
  `dateTime`/`location` known and no missing required category
  attribute could reach `ready_for_search` having never identified
  the service being requested (contradicting Part 1 item 1;
  `buildProviderSearchQuery` already requires a non-null
  `serviceCategory: string`). `selectNextMissingAttribute` unchanged.
  3 new tests in `questionPolicy.test.ts` (2 requested + 1 covering
  the turn-cap-fallback-specific case) plus 2 existing
  `questionPolicy.test.ts` fixtures and 4 existing
  `orchestrateMessage.test.ts` fixtures updated to set
  `serviceCategory`, since none of those were testing the category
  gate itself. `npm run build` clean, `npm test` 279/279 passing (276
  pre-existing + 3 new), no regressions. **Accepted, documented
  consequence** (explicit reviewer decision, not an oversight): a
  conversation whose category the LLM can never identify, once
  core/required attributes are otherwise satisfied, now surfaces a
  500 via `orchestrateMessage.ts`'s pre-existing invariant check
  rather than silently searching with no category —
  `orchestrateMessage.ts` itself was deliberately left unmodified. See
  D12's addendum in `decisions.md` and this task's own Follow-ups for
  the deferred graceful-resolution idea.

- **Task 42 — `location` is a mandatory readiness condition** (DONE,
  see `tasks/completed/task-42-location-readiness-gate.md`): the
  `location` half of the same class of gap task-41 closed for
  `serviceCategory`. `isReadyForSearch` now also returns `false`
  whenever `state.coreAttributes.location === undefined`, ahead of the
  complete-path/fallback-path checks — found while scoping M12's list
  route (task-43), since `discoverProviderCandidates` requires a
  non-undefined `location: string` exactly as it requires a non-null
  `serviceCategory`. `dateTime` deliberately excluded — the search
  query doesn't use it, so it isn't a structural precondition the way
  category/location are. 2 new `questionPolicy.test.ts` tests; unlike
  task-41, **zero** existing tests needed fixture changes (every
  "ready" fixture already set `location`). `npm run build` clean, `npm
  test` 281/281 passing (279 pre-existing + 2 new), no regressions.
  Combined with task-41, `isReadyForSearch() === true` now reliably
  guarantees `serviceCategory` and `location` are both safe to read as
  present — the exact precondition task-43 depends on.

- **Task 43 — Provider list route (M12, route 1)** (DONE, see
  `tasks/completed/task-43-provider-list-route.md`): first M12 task.
  `backend/src/recommendation/generateProviderList.ts` (new
  `recommendation/` directory) wires M7 `discoverProviderCandidates` →
  M8 `enrichProviderCandidates` → M9 `rankProviders` for one session,
  with a defensive throw if `serviceCategory`/`location` are somehow
  missing despite the route's phase check (tasks 41/42 make this
  should-never-happen in practice). `backend/src/server.ts` gained
  `POST /conversation/:id/providers` — 404 unknown session, 409 if
  `phase !== "ready_for_search"` (first real consumer of `phase`),
  200 with `{ providers: ProviderScore[] }` otherwise; 502 for known
  Gemini/Firecrawl errors, 500 catch-all, no internal detail leaked.
  Writes nothing back to session state (D14) — no `runSerialized`
  needed. 12 new tests (6 orchestration unit tests + 6 route tests),
  `npm test` 293/293 passing (281 pre-existing + 12 new), `npm run
  build` clean, no live network calls, no regressions.

- **Task 44 — Provider selection route (M12, route 2)** (DONE, see
  `tasks/completed/task-44-provider-selection-route.md`): second and
  final M12 task. `backend/src/recommendation/selectProvider.ts` wires
  M10 `prepareProviderQuestions` → M11 `simulateProviderResponses` for
  one client-supplied candidate, generating its own `generatedAt`
  internally. `backend/src/server.ts` gained
  `POST /conversation/:id/providers/select` — 404 unknown session, 400
  if the body fails `ProviderCandidateSchema`, 200 with
  `{ answers: [...] }` otherwise; 502 for known Gemini errors, 500
  catch-all. No `phase` gate (D14), no session writes, no
  `runSerialized`. The route's body validation is explicitly
  structural only — per D14's addendum, it never re-verifies a
  client-echoed candidate against what the server originally returned
  (no auth/multi-tenant boundary in this prototype, so acceptable).
  8 new tests (3 orchestration unit tests + 5 route tests), `npm test`
  301/301 passing (293 pre-existing + 8 new), `npm run build` clean,
  no live network calls, no regressions. **M12 (Recommendation API) is
  now fully complete** — both routes are live.

- **M14 (UI/UX design) is fully complete and frozen.** Three
  substantially different concepts were built as Claude Design
  canvases via the `ui-ux-design` skill process
  (`design/m14-concept-1/2/3/`), reviewed, and refined; the final
  direction is an approved hybrid — Concept 1's chat-first interaction
  for requirement gathering, Concept 2's comparison-first list for
  provider discovery/selection/investigation. Frozen spec:
  `design/m14-ux-spec.md` (screen-by-screen, with exact backend data
  per screen); visual source: `design/m14-final/`, published at
  https://claude.ai/code/artifact/e8595f6e-effa-4049-9c64-989d8eca225e.
  See `decisions.md` D16 for the full rationale and the notable
  corrections made during review (form-like patterns removed twice,
  the chat/search input-affordance ambiguity resolved, a user-supplied
  real-company mockup declined as a design source per IP policy). No
  frontend code written; no M15 task files created yet.

- **Task 45 — Frontend project scaffold** (DONE, see
  `tasks/completed/task-45-frontend-scaffold.md`): first M15 task.
  `frontend/` — Expo TypeScript app (`expo` ~57, React 19.2.3, React
  Native 0.86.3), `src/App.tsx` placeholder, `src/App.test.tsx` (a real
  RNTL render + `fireEvent.press` interaction test, not a trivial
  assertion). Test stack is **Jest + `jest-expo` + RNTL**, not Vitest —
  the M15 kickoff's stated Vitest constraint was attempted first,
  genuinely blocked (React Native's Metro-authored CJS+Flow package
  source vs. Vite/Vitest's ESM-first SSR module runner — four
  escalating fix attempts, each correctly diagnosed, none fully closing
  the gap), reported back per the task's pre-agreed stop condition, and
  revised to Jest by the reviewer in the same session — see D17. No
  navigation library (React Navigation/expo-router) — a hand-rolled
  screen-state machine in the root component is the confirmed M15
  architecture (task-54). Verified: `npm test` (2/2 passing), `npx tsc
  --noEmit` (clean, needed `"types": ["jest", "node"]` added to
  `tsconfig.json`), `CI=1 npx expo start` (Metro boots cleanly), `npx
  expo install --check` (dependencies aligned). `.claude/CLAUDE.md`'s
  Commands section updated with real frontend commands plus two notes
  future tasks depend on: Jest-not-Vitest, and RNTL v14's `render()`/
  `fireEvent.*()` being async under React 19 (every test must `await`
  them). A genuinely separate environment finding surfaced and fixed
  along the way (then reverted once Vite/Rollup were removed): this
  machine's Windows Application Control policy blocks `dlopen`-loaded
  native Node addons outright — see D17 for the `@rollup/wasm-node`
  workaround, kept on record for reuse if any future tool hits it.

- **Tasks 46-54 — remaining M15 frontend implementation** (all DONE,
  see `tasks/completed/task-46-*.md` through `task-54-*.md` for full
  detail): built on task-45's Jest+jest-expo+RNTL scaffold.
  - Task 46: `frontend/src/domain/types.ts` (hand-written mirror of
    every backend Zod-inferred shape) + `frontend/src/api/client.ts`
    (`ApiError` + 5 typed functions for all M5/M12 routes), 13 tests.
  - Task 47: `frontend/src/hooks/useSession.ts` — session bootstrap
    (create-or-resume via AsyncStorage, graceful fallback to a fresh
    session on a stale/404'd stored id) and `sendMessage`, 9 tests.
    Surfaced two more Jest/RNTL gotchas (bare `jest.mock` breaking a
    real class's `instanceof` chain; `clearAllMocks` not clearing
    queued once-values) — see D17's addenda.
  - Tasks 48-53 — six presentational, prop-driven screen/component
    files, implemented **in parallel** (disjoint files, no
    cross-dependencies): `ChatScreen.tsx` (7 tests — transcript,
    "what I know so far" chips with recap-diffing, optimistic
    pending/failed send bubble with retry), `TransitionScreen.tsx`
    (3 tests — cosmetic 3-step loading cycle),
    `RecommendationsScreen.tsx` (12 tests — dynamic 1-5 row list,
    exact per-row field-derivation rules from `design/m14-ux-spec.md`),
    `ProviderDetailsScreen.tsx` (10 tests — FACT/INFERRED structurally
    separate sections, fixed dimension-bar order, dashed "not enough
    data" state for `null` dimensions), `SimulatedQAScreen.tsx` (9
    tests — the one screen that ever shows SIMULATED data; frozen
    badge/banner copy verified against the assignment's Trust &
    Grounding criterion, including an explicit check that no
    real-contact phrasing appears anywhere), `ErrorState.tsx` (2
    tests — reusable retry component). 46 new tests total across the
    six.
  - Task 54: `frontend/src/App.tsx` — the single root component
    wiring all of the above into a 5-value hand-rolled screen-state
    machine (no navigation library, confirmed with the reviewer before
    task-45), plus an `errorContext`-as-overlay pattern so a retry
    always lands back on the right screen. Consolidated the frozen
    spec's two separately-worded transition-trigger rules (auto-
    transition-when-ready; reopened-chat-refresh) into one code path
    since they're the same event by construction, and added one
    small beyond-the-letter case (resuming into an already-ready
    session auto-runs the provider search instead of dead-ending) —
    both explained in D18. 12 new integration tests in
    `frontend/src/App.test.tsx`, replacing task-45's toolchain-proof
    test. Manually verified Metro compiles the real app end-to-end
    (763 modules, real bundle served over HTTP) beyond just the Jest
    suite.
  - **`npm test` (full `frontend/` suite): 9 suites / 73 tests, all
    passing.** `npx tsc --noEmit`: clean. No regressions across any of
    the ten tasks.
  - **M15 (frontend implementation) is now fully complete.**

- **Task 55 — Enable the Expo web target (react-native-web)** (DONE,
  see `tasks/completed/task-55-web-platform-enablement.md`): first of
  a four-task desktop/wide-screen split-pane addendum (tasks 55-58) —
  a non-assignment, personal/portfolio scope extension per D19, not a
  new M-numbered milestone. Installed `react-native-web` + `react-dom`
  via `npx expo install` (versions resolved automatically for SDK 57);
  no `src/**` or `app.json` changes needed. `npx expo install --check`
  clean, `npx tsc --noEmit` clean, existing Jest suite unchanged (9
  suites / 73 tests passing), `CI=1 npx expo export -p web` bundles
  and exports successfully (207 modules). Proves the toolchain only —
  no desktop-specific layout yet (tasks 56-58 build that).
- **Task 56 — `useIsDesktop` viewport-width hook** (DONE, see
  `tasks/completed/task-56-use-is-desktop-hook.md`): second of the
  desktop addendum tasks. `frontend/src/hooks/useIsDesktop.ts` exports
  `DESKTOP_BREAKPOINT = 1024` and `useIsDesktop(): boolean` — a
  one-line derivation from React Native's `useWindowDimensions()`, no
  stored state. 3 new tests; `npm test` 10 suites / 76 tests passing,
  `npx tsc --noEmit` clean. Surfaced a new Jest/RNTL mocking gotcha not
  previously documented: mocking the top-level `"react-native"` module
  (even spreading `jest.requireActual`) crashes jest-expo's native
  module virtualization — the correct mock target is the specific
  submodule `react-native/Libraries/Utilities/useWindowDimensions`
  (what `react-native/index.js`'s lazy getter actually requires),
  with an explicit `__esModule: true` in the factory and the mock
  reference pulled via untyped `jest.requireMock(...)` rather than a
  static import (which fails `tsc` — no type declarations for that
  internal path). Flagged as a follow-up to fold into
  `.claude/CLAUDE.md`'s gotcha list, not done inline since CLAUDE.md
  wasn't in this task's `Files Touched`.
- **Task 57 — `ContextPanel` component (desktop left pane)** (DONE,
  see `tasks/completed/task-57-context-panel-component.md`): third of
  the desktop addendum tasks. `frontend/src/components/ContextPanel.tsx`
  — purely presentational, prop-driven (`state`, `matchCount`,
  `currentlyViewing?`, `isChatOpen`, `onOpenChat`, `onBackToMatches`),
  no fetching/no `useSession` import, matching the M15 screen
  convention. Reuses `ChatScreen`'s known-field inclusion rule
  (serviceCategory → dateTime → location → categoryAttributes,
  skipping null values) rendered as label+value rows instead of chips;
  category-attribute rows use the attribute's own object key as label
  since no fixed label set exists for LLM-proposed attributes. 7 new
  tests, all passing first run; `npm test` 11 suites / 83 tests, `npx
  tsc --noEmit` clean. Not mounted anywhere yet — task-58 wires it in.
- **Task 58 — Wire the desktop split-pane layout into App.tsx** (DONE,
  see `tasks/completed/task-58-desktop-split-pane-wiring.md`): last of
  the four-task desktop addendum. `frontend/src/App.tsx` now derives
  `isDesktop` (task-56) and `showSplitPane = isDesktop && providers
  !== null`; when true, renders task-57's `ContextPanel` + a
  width-capped (max 900px, centered) right pane instead of the
  original single-pane markup — zero new `Screen` values, zero new
  stored booleans, no React Navigation,
  `RecommendationsScreen`/other screens untouched. All 12 pre-existing
  `App.test.tsx` tests pass completely unchanged (the test
  environment's default window width, 750px, is already below the
  1024px breakpoint, so the real/mocked hook's default behavior
  matches); 6 new tests cover every VALIDATE case including the
  addendum's flagged "mid-session refresh" open decision, which is
  confirmed **resolved for free** by test rather than built as new
  code (see `design/m14-ux-spec.md`'s Desktop addendum, now updated).
  `npm test` 11 suites / 89 tests, `npx tsc --noEmit` clean. Also ran
  a real-browser E2E check (Playwright, one-off script, network calls
  mocked — no real backend/Gemini/Firecrawl needed): resized an actual
  `npx expo start --web` page across 1024px three times, confirmed the
  split pane appears/disappears live in both directions with the two
  panes genuinely rendering side-by-side (screenshot-verified) and
  zero console errors. **The four-task desktop/wide-screen addendum
  (tasks 55-58) is now fully complete** — non-assignment,
  personal/portfolio scope extension per D19, no roadmap milestone
  number by design.

- **Task 59 — CORS support for browser-based (web) clients** (DONE,
  see `tasks/completed/task-59-cors-support.md`): found and fixed
  during a manual browser check of the app. `backend/src/server.ts`
  registers `@fastify/cors` (v9, matching `fastify@^4.28.1`) with
  default/permissive settings, before any route registration — no
  route logic, response shapes, or status codes changed. Live-verified
  against the running dev server: `OPTIONS /conversation` from
  `Origin: http://localhost:8081` now returns `204` with
  `access-control-allow-origin: *` (previously `404`, since Fastify
  had no route for the browser's CORS preflight at all — every
  cross-origin call from the Expo web target was silently failing at
  the browser level as "Failed to fetch," never reaching a route
  handler). `npm run typecheck` clean, `npm test` 301/301 passing
  (unchanged from before this task — no regressions). PROJECT DECISION,
  not an assignment requirement — exists solely to support D19's
  already-approved, non-assignment desktop/web scope extension; native
  Expo Go clients (the project's actual D4 target) were never affected
  since CORS is a browser-only enforcement mechanism.
  **Follow-up bug found during this task's own validation, fixed
  separately in task-60** (see below): `POST /conversation` (and
  likely any bodyless JSON-content-typed request) returned `400
  FST_ERR_CTP_EMPTY_JSON_BODY` because `frontend/src/api/client.ts`
  always sent `Content-Type: application/json` even when there's no
  body (e.g. `createConversation()`).

- **Task 60 — Fix bodyless requests sending a stale Content-Type
  header** (DONE, see
  `tasks/completed/task-60-fix-bodyless-content-type.md`): the
  follow-up bug task-59 surfaced. `frontend/src/api/client.ts`'s
  `request<T>()` helper now only includes `Content-Type:
  application/json` in headers when `init?.body !== undefined` — no
  change to any of the 5 exported function signatures, `BASE_URL`, or
  `ApiError`. Classified **EXPLICIT** scope (not project-decision, per
  task-59's precedent) — `client.ts` is the same code path for native
  Expo Go and web, so this defect would have broken
  `createConversation()` (the app's very first API call) on a real
  device too, not just in a browser; it was never caught earlier
  because the frontend had never been manually walked through against
  a live backend end-to-end until this session (already a known,
  recorded gap in the M15 section above). 5 new tests in
  `client.test.ts` (3 confirming the header is omitted on bodyless
  calls — `createConversation`, `getConversation`, `fetchProviders` —
  2 confirming it's still sent on calls with a body —
  `sendMessage`/`selectProvider` — as a regression guard). `frontend
  npm test` 12 suites / 94 tests passing (89 pre-existing + 5 new),
  `npx tsc --noEmit` clean. Live-verified against the running backend:
  `curl -X POST http://localhost:3000/conversation` with no
  `Content-Type` header and no body now returns `201` with a real
  session (previously `400`). Together with task-59, both known
  blockers to a full manual browser walkthrough of the app are now
  resolved.

- **Task 61 — Style the desktop ContextPanel (sidebar)** (DONE, see
  `tasks/completed/task-61-context-panel-styling.md`): fixes a
  bug-report finding that the desktop sidebar (task-57's
  `ContextPanel`) rendered as raw/unstyled content — confirmed root
  cause: the component had **zero** `StyleSheet` styling anywhere,
  and no explicit width, so it shrank to hug its own unstyled text in
  `App.tsx`'s flex row. Added a full `StyleSheet`: fixed `width: 280`
  root container with padding/background/right-border (no `App.tsx`
  change needed), typographic hierarchy (bold brand, uppercase muted
  row labels, normal-weight values), a bordered/tinted "currently
  viewing" chip as the strongest visual signal, and an action button
  matching `App.tsx`'s existing chat-pill treatment — all reusing the
  neutral chrome palette already established elsewhere in the app
  (`#111827`/`#9ca3af`/`#e5e7eb`-family), no new palette. Style-only —
  same information architecture, no new props/behavior. Self-caught
  and fixed one regression during implementation: an initial pass
  split the "currently viewing" line into two separate `Text`
  elements, which changed its rendered text and broke two exact-string
  test assertions (`ContextPanel.test.tsx`, `App.test.tsx`) — fixed by
  nesting label/value as sibling `Text` children inside one parent
  `Text` (RN's standard mixed-style-inline-text pattern), restoring
  the original concatenated string. `npx tsc --noEmit` clean; final
  `npm test` (after task-62 landed concurrently) is 13/13 suites, 99/99
  tests passing, no regressions. PROJECT DECISION — D19-scoped (the
  component only exists to support the non-assignment desktop
  extension); no manual browser resize check performed by Claude this
  session (no browser automation available), left for the user.

- **Task 62 — "Selected provider" header on details/QA screens** (DONE,
  see `tasks/completed/task-62-selected-provider-header.md`): fixes a
  bug-report finding that `ProviderDetailsScreen` (M9 details) and
  `SimulatedQAScreen`'s results phase (M11 simulated answers) never
  render the selected provider's name as a distinct header — both
  computed `providerName` already but only used it inline (a button
  label, one banner sentence). New purely-presentational
  `frontend/src/components/SelectedProviderHeader.tsx`
  (`{ providerName: string }`, no fetching, matching the M15 screen
  convention) renders an eyebrow label + strong title in its own
  bordered container, reusing task-57's `ContextPanel` chrome palette
  (`#111827` primary text, `#9ca3af` muted label). Mounted at the top
  of both screens — before `ProviderDetailsScreen`'s `explanation`
  text, and before `SimulatedQAScreen`'s frozen SIMULATED banner
  (banner copy itself untouched). By direct instruction, renders
  identically on mobile and desktop — a confirmed, reasoned revision
  of `design/m14-ux-spec.md`'s "mobile screen 4, unchanged" note (see
  the task's own Assignment Alignment section), not an oversight. 5 new
  tests (1 in a new `SelectedProviderHeader.test.tsx`, 2 in
  `ProviderDetailsScreen.test.tsx` — FACT-name and hostname-fallback
  cases, 2 in `SimulatedQAScreen.test.tsx` — results-phase render with
  the given provider name, absent during `phase: "loading"`).
  `frontend npm test` 13 suites / 99 tests passing (94 pre-existing + 5
  net new — one loading-phase test needed an explicit `unmount()`
  inside `act()` to avoid a pre-existing fake-timers/RNTL-autocleanup
  ordering issue in that describe block, not a new defect), `npx tsc
  --noEmit` clean, no regressions. Manual desktop/mobile visual check
  not run this session (structural/unit coverage only).

- **Task 63 — Web platform always starts a fresh conversation** (DONE,
  see `tasks/completed/task-63-web-always-fresh-session.md`):
  demo/interviewer-testing usability fix, direct first-person
  instruction. `frontend/src/hooks/useSession.ts`'s `bootstrap()` now
  skips the stored-session `AsyncStorage.getItem`/`setItem` calls
  entirely when `Platform.OS === "web"`, always creating a fresh
  conversation on web instead of resuming whatever session was last
  left in browser storage — native platforms keep resuming exactly as
  before (task-47's spec-mandated "resume on relaunch" behavior,
  untouched). PROJECT DECISION, distinct from D9 (backend persistence,
  already fully satisfied regardless of client behavior) — this only
  concerns the client-side convenience cache task-47 added. 2 new
  tests (`useSession.test.ts`'s new `describe("on web")` block,
  temporarily overriding `Platform.OS` and restoring it in
  `afterEach` — confirmed via a throwaway test that jest-expo's
  default test platform is `"ios"`, so none of the 5 existing
  bootstrap tests needed changes). `frontend npm test` 13 suites / 101
  tests passing (99 pre-existing + 2 new), `npx tsc --noEmit` clean,
  no regressions. Manual browser reload check left to the user (no
  browser automation available this session).

- **Task 64 — Desktop/wide-screen Chat layout fix** (DONE, see
  `tasks/completed/task-64-desktop-chat-layout.md`): bug-report fix,
  direct first-person instruction. Root cause: the split-pane branch
  in `frontend/src/App.tsx` only activates once `providers !== null`,
  so the Chat screen — active for the entire requirement-gathering
  phase — always fell into the plain fallback branch, whose `content`
  style has no `maxWidth`/centering, stretching the transcript, chip
  bar, and input row edge-to-edge on wide viewports (message bubbles
  ballooning past readable width). Fixed with a new, Chat-only desktop
  wrapper: when `isDesktop && screen === "chat"` (i.e. exactly the
  `providers === null` case), `content` renders inside a centered
  `#f3f4f6`-backdrop, ~800px-max-width white card with a `#e5e7eb`
  border and rounded corners — reusing the neutral chrome palette
  `ContextPanel.tsx` already established, mirroring the existing
  `rightPaneInner` max-width pattern. `ChatScreen.tsx` itself is
  completely untouched (zero risk to its own tests); the split-pane
  branch (Recommendations/Provider Details/Simulated QA, and Chat
  reopened via `ContextPanel` once `providers` exists) is unaffected —
  confirmed via three separate real-browser Playwright checks (see
  outcome section of the task file) that the split-pane layout is
  pixel-identical to before, and that reopened chat still takes that
  branch rather than the new card. Design/width (~800px, revised up
  from an initially-proposed 720px per direct user instruction) was
  approved explicitly by the user before implementation, per this
  project's approval-gate convention. `npm test` 13 suites / 101 tests
  passing (unchanged — no test needed updating), `npx tsc --noEmit`
  clean. `memory-bank/decisions.md` D19 given a dated addendum
  correcting its original "initial gathering stays full-width" clause
  and recording the resulting three-state desktop layout model.

- **M16 error-handling audit + tasks 65-68** (all DONE, see
  `tasks/completed/task-65-rate-limit-error-classification.md` through
  `task-68-recommendations-empty-state.md`): a bounded, read-only audit
  of M3/M4/M7/M8/M12's existing Gemini/Firecrawl/empty-result/HTTP
  error paths (per the roadmap's M16 row — embedded within those
  milestones, not a fresh design) found PASS WITH GAPS: every path
  already failed safely, all findings were observability/messaging
  polish, none were assignment-required. A direct user bug report
  (screenshot: a failed chat send always showed the hardcoded "Failed
  to send" with no real cause) drove four small follow-up tasks:
  - **Task 65**: `GeminiRateLimitError`/`FirecrawlRateLimitError`
    (`backend/src/llm/geminiClient.ts`,
    `backend/src/research/firecrawlProvider.ts`) detect a 429 from
    each SDK (Gemini's exported `ApiError.status`; Firecrawl's
    unexported `SdkError` duck-typed via `status`) and all three action
    routes in `server.ts` now return `429` with a clear "You've hit the
    rate limit..." message ahead of the existing 502/500 branches. One
    implementation correction during validation: the rate-limit check
    initially wrapped the wrong call site (inside
    `createDefaultClient()`, invisible to any injected/test client) —
    moved to wrap `activeClient.search(...)` in `searchProviderPages`
    itself once the new test caught it.
  - **Task 66**: the actual reported bug — `ChatScreen.tsx`'s
    `attemptSend` catch block discarded the caught error completely.
    Now captures and renders the real `error.message` (same pattern as
    `App.tsx`'s existing `errorMessage()`), so task-65's rate-limit
    message (or any other real failure message) is what the user
    actually sees, not a generic hardcoded string.
  - **Task 67**: `discoverProviderCandidates.ts`'s per-candidate catch
    block now logs via `console.error`, mirroring
    `enrichProviderCandidates.ts`'s already-shipped pattern (closes a
    gap `decisions.md` had already recorded and deliberately deferred
    at task-25). Added the previously-missing zero-search-results test.
  - **Task 68**: `RecommendationsScreen.tsx` now shows an explicit "no
    matching providers found" message for a legitimate `providers: []`
    response, instead of a near-blank screen.
  `backend npm run build` clean, `backend npm test` 310/310 passing (16
  new); `frontend npx tsc --noEmit` clean, `frontend npm test` 103/103
  passing (4 new — 2 wired to task-65's rate-limit copy). No
  regressions. See `decisions.md` D20 for full rationale.

## Current State

- `docs/Home Assignment.pdf` in place.
- Memory bank initialized and current (`context.md`, `progress.md`,
  `decisions.md`, `roadmap.md`).
- Project skills created (`assignment-review`,
  `piv-task-management`, `ui-ux-design`).
- `.claude/CLAUDE.md` created and updated with real, verified backend
  commands.
- Roadmap revised with explicit scope-discipline guidance (bonus is
  cut-first, tests/error-handling are embedded per milestone rather
  than batched at the end, docs maintained incrementally).
- D6 (category attribute determination) revised: only date/time +
  location are deterministic core; budget and every other attribute
  are LLM-proposed per category, not hardcoded.
- `backend/` is runnable: `npm run build`, `npm run dev` (verified
  `GET /health` → `200 {"status":"ok"}`), and `npm test` (1/1 passing)
  all confirmed working.
- `DESIGN.md` exists at repo root (Assumptions, Architecture
  Decisions, Optimizations, Production Evolution), kept current
  incrementally as part of each task's completion step.
- `backend/.env` now also holds a real `FIRECRAWL_API_KEY` (added
  2026-08-28, gitignored, never committed), enabling real-API
  validation of M7 — previously only `GEMINI_API_KEY` was configured.
- Approval-gate rule clarified in `piv-task-management`: only the
  reviewer's own first-person words count as approval — relayed/
  pasted third-party "approved" text does not.

## Validation Status

- Backend scaffold: build, dev server, and test suite all verified
  passing (see task-01 outcome for exact commands/output).
- Domain schemas + session store: `npm run build` clean, `npm test`
  12/12 passing (see task-03/task-04 outcomes).
- Gemini client wrapper: `npm run build` clean, `npm test` 17/17
  passing (no live network calls), plus a manual real-API call
  verified against the live Gemini API (see task-05 outcome).
- Requirement extraction: `npm run build` clean, `npm test` 21/21
  passing (no live network calls; see task-06 outcome).
- Merge extraction into state: `npm run build` clean, `npm test`
  31/31 passing, pure-function unit tests only (see task-07 outcome).
- Extraction eval script: `npm run build` and `npm test` unaffected
  (31/31, unchanged); `npm run eval:extraction` verified end-to-end
  against the real Gemini API, 9/9 cases completed (see task-08
  outcome).
- `npm audit` on `backend/` reports 6 pre-existing transitive-dep
  vulnerabilities (2 moderate, 3 high, 1 critical) — not yet
  investigated; flagged as a follow-up, not blocking.
- Question policy (deterministic missing-attribute selection +
  readiness gate): `npm run build` clean, `npm test` 42/42 passing
  (see task-09 outcome).
- Question phrasing (LLM phrases the selected missing attribute):
  `npm run build` clean, `npm test` 49/49 passing (no live network
  calls); manual real-API check blocked by Gemini's daily free-tier
  quota, not yet completed (see task-11 outcome).
- Conversation API routes + orchestration: `npm run build` clean,
  `npm test` 67/67 passing (no live network calls); manual real-API
  smoke test partially blocked by the same daily quota as task-11 —
  `POST /conversation` and `GET /conversation/:id` confirmed live,
  `POST .../message` reached the real Gemini API before hitting the
  quota (see task-12 outcome).
- Per-session request serialization: `npm run build` clean, `npm
  test` 74/74 passing, repeated 5x with no flakiness; both new
  concurrency integration tests independently self-verified against
  deliberately-broken implementations (assertion failure and timeout,
  respectively) before being confirmed against the real one (see
  task-13 outcome).
- Evidence/provenance model (FACT primitive): `npm run build` clean,
  `npm test` 82/82 passing (74 pre-existing + 8 new), no live network
  calls, pure schema module (see task-14 outcome).
- Provider search query builder: `npm run build` clean, `npm test`
  91/91 passing (82 prior + 6 from task-15's `provider.ts`, which
  landed in between + 3 new), pure-function unit tests only, no LLM
  call/I-O (see task-16 outcome).
- Candidate assembly (dedup, cap, Fact-wrapping): `npm run build`
  clean, `npm test` 108/108 passing, pure-function unit tests only,
  no LLM call/I-O (see task-19 outcome).
- Enrichment search query builder: `npm run build` clean, `npm test`
  131/131 passing, pure-function unit tests only, no LLM call/I-O
  (see task-22 outcome).
- Review-text analysis (raw tag+excerpt extraction): `npm run build`
  clean, `npm test` 136/136 passing (131 pre-existing + 5 new), no
  live network calls (see task-23 outcome).
- Inferred-tags assembly (evidence-wrapping + sourceType
  classification): `npm run build` clean, `npm test` 146/146 passing
  (136 pre-existing + 10 new), pure-function unit tests only, no LLM
  call/I-O (see task-24 outcome).
- Enrichment orchestration (enrichProviderCandidates): `npm run build`
  clean, `npm test` 155/155 passing (146 pre-existing + 9 new), no
  live network calls (fakes only for both `search` and `analyze`);
  manual real-API smoke test deferred, non-blocking (see task-25
  outcome).
- **Post-M8 review (2026-08-28)**: manual real-API validation run
  against live Firecrawl + Gemini (`backend/scripts/m8ManualEval.ts`,
  new — mirrors `m7ManualEval.ts`'s existing precedent, outside
  `tsconfig.json`'s include, no `npm test`/`build` impact): 3 seed
  candidates (bounce house rental / Austin, TX), 3 enrichment
  searches, 2/3 enriched with real inferred tags (5 tags total), 1/3
  enriched with zero tags (valid "no signal" outcome). Review
  accepted as PASS WITH ISSUES, conditioned on two fixes — see
  task-26 below. Two real findings recorded in `decisions.md`: (1)
  `classifySourceType` used substring/exact-match hostname checks
  vulnerable to lookalike domains and `www.` mismatches (fixed by
  task-26); (2) no code verifies `evidenceExcerpt` is actually a
  substring of the analyzed markdown — the LLM is instructed not to
  fabricate but nothing checks (explicitly NOT fixed — reviewer
  excluded excerpt verification from task-26's scope; remains open
  for future consideration, not blocking M8 closure).
- Task 26 (fix Google/Yelp/provider-website classification bugs):
  `npm run build` clean, `npm test` 165/165 passing (155 pre-existing
  + 10 new), pure-function unit tests only, no LLM/network call (see
  task-26 outcome). **M8 is now fully closed.**
- Provider discovery orchestration (wires search → dedup → sequential
  per-candidate extraction → assembly): `npm run build` clean, `npm
  test` 116/116 passing, no live network calls (fakes only for both
  `search` and `extract`). **M7 (Firecrawl provider research) is fully
  complete** (see task-20 outcome). Note: task-20's own outcome text
  states "124/124 (116 pre-existing + 8 new)" — that arithmetic is
  wrong (108 pre-existing + 8 new = 116); corrected here after
  re-running the suite directly during the post-M7 review
  (2026-08-28). Cosmetic discrepancy only, no functional impact.
- **M7 real-API validation (2026-08-28, post-M7 review)**:
  `discoverProviderCandidates` run against the real Firecrawl and
  Gemini APIs (not fakes) across 3 categories — bounce house
  rental/Austin TX, wedding photographer/Tel Aviv, taco truck
  catering/Denver CO. Results: 24 search results, 18 scraped
  successfully, 17/18 Gemini extractions succeeded, 16 usable
  `ProviderCandidate`s returned, 1 all-null extraction correctly
  dropped by `assembleCandidate`. Confirms the pipeline works
  end-to-end against live APIs (previously only verified against
  fakes). See `decisions.md`'s "Observed Findings — M7 real-API
  validation" section for the issues this run surfaced (silent
  failure visibility, first-party vs. third-party rating claims,
  discovery-quality variance by category) — all recorded as OBSERVED
  FINDINGS / DESIGN CONSIDERATIONS for M8/M10 planning, not
  implemented, no M7 code changed.

- **M10 (Provider-specific questions) is fully complete.** Tasks 33-35
  are all `DONE` and moved to `tasks/completed/`:
  `backend/src/providerQuestions/types.ts` and `analyzeGaps.ts`
  (task-33), `backend/src/llm/providerQuestionPhrasing.ts` (task-34),
  and `backend/src/providerQuestions/prepareProviderQuestions.ts`
  (task-35, the single entry point). `npm test` 250/250 passing, `npm
  run build` clean, no live network calls in the automated suite (all
  three tasks tested against fakes only; no manual real-API check
  attempted yet — non-blocking, same precedent as prior LLM-wrapper
  tasks). `prepareProviderQuestions` is a standalone function only —
  not wired into any HTTP route or the conversation flow yet; per D14,
  it's invoked per-selection (one candidate at a time) by M12's future
  provider-selection route, not automatically for all of M9's ranked
  candidates. `tasks/current/` is now empty.

## Remaining Work

- **M15 (frontend implementation) is fully complete.** All ten tasks
  (45-54) are `DONE` and moved to `tasks/completed/`. `frontend/` is a
  runnable Expo/TypeScript app: `npm install`, `npx expo start`, `npm
  test` (Jest + jest-expo + RNTL, 73/73 passing) all verified working,
  including a real Metro bundle-compile check beyond the Jest suite.
  `tasks/current/` is now empty. Remaining optional follow-ups (not
  blocking): the `hostnameFromUrl` helper is duplicated between
  `RecommendationsScreen.tsx` and `ProviderDetailsScreen.tsx` (a small
  future extraction to `frontend/src/shared/hostname.ts`, mirroring
  the backend's own `shared/hostname.ts` precedent); a full manual
  walkthrough against a live `backend` dev server has not been run yet
  (the bundle-compiles-and-serves check already confirms the wiring is
  structurally sound).
- **M16 (error handling, embedded per milestone) is satisfied.** Not a
  standalone milestone by design (per the roadmap's Scope Discipline
  note) — verified present at every integration point it applies to:
  502 mapping for known Gemini/Firecrawl errors and a 500 catch-all
  with no internal detail leaked (M5/task-12, M12/tasks 43-44),
  per-candidate discovery/enrichment failures logged rather than
  swallowed (M7/task-20, M8/task-25), and a rate-limit hit surfaced to
  the end user as a specific plain-language message rather than the
  generic failure path (documented in `DESIGN.md`'s Architecture
  Decisions).
- **M18 (README & DESIGN.md final coherence pass) is confirmed done**
  (verified 2026-08-29). `README.md` (setup, running, architecture,
  API table, design-artifact links, FACT/INFERRED/SIMULATED
  explanation) and `DESIGN.md` (Assumptions, Architecture Decisions,
  Optimizations, Production Evolution) both read as current and
  internally coherent against the now-complete M0-M15 state, including
  the desktop/web addendum's presence in README's architecture section
  ("iOS / Android / web"). No further edits needed.
- **M13 (agent trace bonus) is now fully complete** (2026-08-29) — not
  committed scope per the roadmap (cut-first if time were constrained),
  but built end-to-end per direct user instruction. Assignment re-read
  directly for this milestone (page 8): "An agent trace/debug view
  showing how the recommendation was produced." Scope narrowed from
  the roadmap's original broader wording ("per-session trace of
  orchestrator steps," implying the whole conversation flow) to
  exactly the two functions that produce a recommendation —
  `generateProviderList` (M7 discovery → M8 enrichment → M9 ranking)
  and `selectProvider` (M10 gap analysis → M11 simulation) — not the
  M3/M4/M5 requirement-gathering turns. Also, per direct user
  instruction, scope was **widened** beyond a JSON-only debug endpoint
  to include a human-readable frontend trace view, since "debug/
  **view**" is the assignment's own word. Full rationale in D10's
  2026-08-29 addendum, `decisions.md`.
  - **Task 69 — Trace domain schema + in-memory per-session trace
    store** (DONE, `tasks/completed/task-69-trace-domain-and-store.md`):
    `backend/src/domain/trace.ts` (`TraceEventSchema`/`TraceEvent` —
    `step`, `summary`, optional `detail: Record<string, unknown>`, ISO
    `timestamp`) and `backend/src/store/traceStore.ts`
    (`appendTraceEvents`/`getTrace` — a separate, append-only,
    per-session `Map`, mirroring `sessionStore.ts` but deliberately not
    a field on `ConversationState`). Pure schema + storage only. 11 new
    tests.
  - **Task 70 — Instrument `generateProviderList`** (DONE,
    `tasks/completed/task-70-instrument-generate-provider-list.md`):
    now returns `{ providers, trace }` — four events (`discover`,
    `enrich`, `rank`, `recommend`) built entirely from data already
    visible to the function, with **no changes to M7/M8's own files**
    (a deliberate boundary: trace detail is only as granular as what's
    already observable from their existing return values — no separate
    pre-/post-dedup count, enrichment bucketed into
    with-signal/no-signal-found/not-enriched by inspecting
    `.inferred`). `/providers` route writes the trace via
    `appendTraceEvents`; response body unchanged. 1 new test + 1 new
    route assertion.
  - **Task 71 — Instrument `selectProvider`** (DONE,
    `tasks/completed/task-71-instrument-select-provider.md`): now
    returns `{ answers, trace }` — two events (`prepareQuestions` —
    lists the literal phrased questions, even at zero;
    `simulateAnswers` — count only, no answer text, to avoid showing
    SIMULATED content in two places). No M10 files touched (gap
    *topics* aren't exposed outside `prepareProviderQuestions`, so the
    trace shows the phrased questions instead — equally informative for
    Part 4's "what information it still needs," no reopening needed).
    `/providers/select` route writes the trace. 2 new tests + 1 new
    route assertion.
  - **Task 72 — `GET /conversation/:id/trace` debug route** (DONE,
    `tasks/completed/task-72-trace-debug-route.md`): 404 unknown
    session, 200 `{ events: TraceEvent[] }` otherwise (`[]` for "no
    trace yet," not an error). Read-only, no phase gate, no
    `runSerialized`. 3 new route tests.
  - **Task 73 — `TraceScreen` + `fetchTrace` API client function**
    (DONE, `tasks/completed/task-73-trace-screen-and-api-client.md`):
    new presentational `frontend/src/screens/TraceScreen.tsx` (props
    `{ events, onBack }`) — a "Debug / Transparency View" banner, one
    numbered section per event in arrival order, a per-`step` detail
    renderer for all six known shapes. `frontend/src/api/client.ts`
    gained `fetchTrace`; `frontend/src/domain/types.ts` gained
    `TraceEvent`. No `App.tsx` wiring yet (that's task-74, same split
    M15 used between building screens and wiring them in). Surfaced a
    new RNTL gotcha: `toHaveTextContent` is **exact**-match by default
    in this project's RNTL version (confirmed by reading
    `node_modules/@testing-library/react-native/dist/matches.js`
    directly), not substring — every multi-content assertion needed
    `{ exact: false }`. 10 new tests.
  - **Task 74 — Wire `TraceScreen` into `App.tsx`** (DONE,
    `tasks/completed/task-74-wire-trace-into-app.md`): last M13 task.
    `RecommendationsScreen` gained `onViewTrace` + a "How was this
    recommendation produced?" link (both populated and empty-state
    branches). `App.tsx` gained a `"trace"` screen state and
    `runFetchTrace` (same set-error-null → loading → fetch →
    result-or-error shape as `runProviderSearch`/`runSelectProvider`);
    loading reuses `TransitionScreen`, back reuses
    `handleBackToMatches`. The desktop split-pane branch needed zero
    special-casing — it already covers any screen once
    `providers !== null`. 6 new tests (2 component + 4 App-level
    integration, including a desktop-split-pane case).
  - **End-to-end result**: `frontend npm test` 14 suites / 121 tests
    passing (all M13 frontend work, 0 regressions); `backend npm test`
    327/327 passing (all M13 backend work, 0 regressions); both
    `npx tsc --noEmit`/`npm run typecheck` and `npm run build` clean.
    The full flow works end to end: Recommendations → "How was this
    recommendation produced?" → a labeled debug/transparency view
    showing discovery → enrichment → ranking → recommendation, and
    (once a provider has been selected) the questions identified and
    simulated-answer count — satisfying the assignment's exact bonus
    wording ("an agent trace/debug **view**"), not just an API
    response. Not manually walked through against a live backend by
    Claude this session (same non-blocking precedent as other
    frontend-facing work in this project — see M15's own note).
- M2 (domain models & conversation state) is complete.
- Task 05 (Gemini client wrapper) is complete; this is shared
  plumbing, not itself a milestone.
- Task 06 (requirement extraction LLM call) is complete. It produces
  a candidate `ExtractionResult` only.
- Task 07 (merge extraction into `ConversationState`) is complete.
  `ConversationState` can now be built up turn-by-turn from
  extraction results, but nothing yet decides readiness/what to ask
  next, and there is no HTTP route wiring these pieces together.
- Task 08 (extraction eval script, RECOMMENDATION) is complete —
  tooling only, not part of the M3/M4 required path.
- Task 09 (deterministic missing-attribute selection + readiness
  gate) is complete — the deterministic half of M4.
- Task 11 (LLM phrases the next missing-attribute question) is
  complete — the LLM half of M4. Manual real-API sensibility check
  is deferred to the next Gemini daily quota reset (non-blocking; see
  task-11 outcome).
- Task 12 (conversation API routes + single-turn orchestration) is
  complete — `POST /conversation`, `POST /conversation/:id/message`,
  `GET /conversation/:id` now exist and wire Tasks 06/07/09/11
  together end-to-end. Full manual happy-path verification (an actual
  phrased question from the real API) deferred to the next Gemini
  daily quota reset (non-blocking; see task-12 outcome).
- Task 13 (per-session request serialization) is complete — same-
  session requests now process strictly in order, different sessions
  stay concurrent. **M5 (Conversation API) is fully complete.**
- Task 14 (evidence/provenance model, FACT primitive) is complete.
  **M6 (evidence/provenance model) is fully complete.**
- **M7 (Firecrawl provider research) is fully complete** — tasks
  15–20 are all `DONE` and moved to `tasks/completed/`:
  `backend/src/domain/provider.ts` (schema, task-15),
  `backend/src/research/searchQuery.ts` (query builder, task-16),
  `backend/src/research/firecrawlProvider.ts` (Firecrawl boundary,
  task-17), `backend/src/llm/providerExtraction.ts` (Gemini
  extraction, task-18), `backend/src/research/assembleCandidates.ts`
  (dedup/cap/assembly, task-19), and
  `backend/src/research/discoverProviderCandidates.ts` (end-to-end
  orchestration, task-20). `discoverProviderCandidates` is a
  standalone function only — not wired into any HTTP route or the
  conversation flow yet; that's deferred to whichever of M8/M9/M10 or
  a future Recommendation API becomes the real consumer, per task-20's
  explicit scope. M8 (Enrichment) is next per the roadmap's dependency
  column.
- **M8 (Enrichment) is fully complete** — tasks 21-25 are all `DONE`
  and moved to `tasks/completed/`: `backend/src/domain/evidence.ts`
  (Inferred<T> schema, task-21), `backend/src/research/enrichmentQuery.ts`
  (query builder, task-22), `backend/src/llm/reviewAnalysis.ts` (Gemini
  raw tag+excerpt extraction, task-23),
  `backend/src/research/assembleInferredTags.ts` (evidence-wrapping +
  sourceType classification, task-24), and
  `backend/src/research/enrichProviderCandidates.ts` (end-to-end
  orchestration, task-25). `enrichProviderCandidates` is a standalone
  function only — not wired into any HTTP route or the conversation
  flow yet, same explicit scope boundary as M7's
  `discoverProviderCandidates`. The real consumer is deferred to
  whichever of M9/M10/M12 assembles the final recommendation, per the
  roadmap's dependency column.
- **M9 (Ranking) is fully complete.** Tasks 27-32 are all `DONE` and
  moved to `tasks/completed/`: `backend/src/ranking/types.ts`
  (task-27), `backend/src/ranking/matchAndFitScores.ts` (task-28),
  `backend/src/ranking/reputationAndEvidenceScores.ts` (task-29),
  `backend/src/ranking/aggregateScore.ts` (task-30),
  `backend/src/ranking/explanation.ts` (task-31), and
  `backend/src/ranking/rankProviders.ts` (task-32, the single entry
  point). `rankProviders` is a standalone function only — not wired
  into any HTTP route or the conversation flow yet; that's deferred to
  M12, same explicit scope boundary as M7/M8's discovery/enrichment
  orchestrators.
- **M10 (Provider-specific questions) is fully complete.** Tasks 33-35
  are all `DONE` and moved to `tasks/completed/`:
  `backend/src/providerQuestions/types.ts`/`analyzeGaps.ts` (task-33),
  `backend/src/llm/providerQuestionPhrasing.ts` (task-34), and
  `backend/src/providerQuestions/prepareProviderQuestions.ts`
  (task-35). Per D14, M10 (and M11 next) run only for a single,
  user-selected provider, on-demand — not automatically for all of M9's
  ranked candidates; `prepareProviderQuestions` awaits M12's future
  selection route for HTTP wiring. `tasks/current/` is now empty.
- **M11 (Provider response simulation) is fully complete.** Tasks
  37-40 are all `DONE` and moved to `tasks/completed/`:
  `backend/src/domain/evidence.ts` (`Simulated<T>` schema, D7's third
  evidence bucket, task-37), `backend/src/llm/providerResponseSimulation.ts`
  (`simulateProviderAnswers`, the batched Gemini simulation call,
  task-38), `backend/src/providerQuestions/assembleSimulatedAnswers.ts`
  (deterministic question/answer pairing + `Simulated<T>` wrapping,
  analogous to task-19/task-24's Fact/Inferred-wrapping role, task-39),
  and `backend/src/providerQuestions/simulateProviderResponses.ts`
  (the single M11 entry point — two-step `simulate` → `assemble`
  pipeline for one selected provider, mirroring task-35's role for
  M10, task-40). `simulateProviderResponses` is a standalone function
  only — not wired into any HTTP route yet; that's M12's job, same
  explicit scope boundary as M7/M8/M9/M10's orchestrators.
  `tasks/current/` is now empty.
- M12 (Recommendation API) also has no task files yet. Per D14 it now
  covers two routes (initial FACT+INFERRED list; on-demand selection
  route composing M10+M11 for one client-echoed candidate) rather than
  one, and its future task file must state the D14 addendum's trust-
  boundary clarification explicitly (client-echoed candidate data is
  Zod-validated for shape only, never verified as genuine — not a
  security boundary in this no-auth prototype).

- **M15 (frontend implementation)**: `frontend/npm test` — 14 suites /
  129 tests passing as of task-75 (the 9-suite/73-test figure below was
  the count when M15's first slice landed; suites have since grown with
  the M13 trace view and the task-75 chat warmth revision). The chat
  screen now carries the D21 warmth treatment: Scout beside the latest
  assistant turn only, that turn amplified, and a primary-input row.
  Its four-breakpoint browser check is still outstanding — Playwright
  is not installed, so it joins the manual-check deferral noted below.
  Historic detail: `frontend/npm test` — 9 suites /
  73 tests passing (Jest + `jest-expo` + RNTL; no live network calls,
  `api/client`/`useSession` mocked in component tests). `npx tsc
  --noEmit` clean. Manual check beyond the Jest suite: `CI=1 npx expo
  start` + a direct bundle request confirmed Metro compiles the real
  app (763 modules, HTTP 200) — the app has not yet been walked through
  manually against a live `backend` dev server end-to-end (non-blocking
  follow-up, same precedent as prior manual-check deferrals elsewhere
  in this project).

- **Backend (task-76)**: `backend/npm test` — 38 files / 340 tests
  passing, `npm run typecheck` clean. New sessions now open with a
  deterministic Scout greeting seeded in `createSession()` (see D22),
  so the chat screen is never blank on first open and Scout appears
  immediately. No LLM call is involved, so this holds even when Gemini
  is unavailable. `createInitialState()` deliberately still returns an
  empty transcript and is test-guarded to stay that way.

- **Task 77 — Bounded-concurrency parallelization of discover/enrich**
  (DONE, see `tasks/completed/task-77-parallelize-discover-enrich.md`):
  found while investigating a real, user-reported slow "clown, New
  York" request — `POST /conversation/:id/providers` traced to up to
  19 fully sequential network/LLM round trips. New
  `backend/src/shared/concurrency.ts` exports `mapWithConcurrency`, a
  small bounded worker-pool helper (input-order results, fail-fast on
  a rejecting `fn`); `discoverProviderCandidates.ts` and
  `enrichProviderCandidates.ts` each now run their per-candidate work
  through it with their own `CONCURRENCY_LIMIT = 3`, deliberately
  conservative given Gemini's documented 5-requests/minute free-tier
  cap (task-08) — parallelizing cuts wall-clock time, not total call
  volume. `MAX_DISCOVERY_RESULTS`/`MAX_ENRICHMENT_CANDIDATES` and all
  per-candidate error isolation (catch, log, skip/pass-through)
  unchanged. Two existing tests that asserted strict one-at-a-time
  ordering were deliberately rewritten to assert bounded concurrency
  instead (not a regression — see D23). 5 new tests
  (`shared/concurrency.test.ts`), `npm test` 39 files / 346 tests
  passing (340 pre-existing + 5 new + 1 net test-count change from the
  enrichment ordering test split), `npm run typecheck` and `npm run
  build` both clean. No live-server before/after latency measurement
  taken (no real API keys used this session) — see D23.

- **Task 78 — Real per-step timing in generateProviderList's trace
  events** (DONE, see
  `tasks/completed/task-78-trace-step-timing.md`): the other half of
  the "clown, New York" latency investigation. `TraceEventSchema`
  (`backend/src/domain/trace.ts`) gained an optional
  `durationMs: number` field; `generateProviderList.ts` now stamps
  each of its four trace events (`discover`/`enrich`/`rank`/
  `recommend`) with the real time that step completed and how long it
  took, instead of one shared `new Date().toISOString()` computed
  after everything had already finished (today's actual bug — the
  trace could show *that* discovery/enrichment/ranking happened, never
  *which one was slow*). `recommend` (no real work of its own) gets
  `durationMs: 0` rather than an invented duration. Scoped to
  `generateProviderList.ts` only — `selectProvider.ts`'s own trace
  events likely have the same gap but that's a separate follow-up
  (see D24). 5 new tests (4 in `domain/trace.test.ts`, 1 in
  `recommendation/generateProviderList.test.ts` using injected
  `discover`/`enrich` fakes with artificial delay to prove real timing
  instead of four identical timestamps), `npm test` 39 files / 350
  tests passing, `npm run typecheck` and `npm run build` both clean.
  Not yet observed against a live request with real API keys.

## Blocked Work

- None.
