# Task 24: Deterministic assembly of Inferred tags (evidence-wrapping)
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Deterministically wrap task-23's raw `{ tag, excerpt }[]`
  output into `Inferred<string>[]` — the M8 analog of task-19's
  `assembleCandidate`, keeping the LLM→state boundary exactly where
  D5/D7 put it: the LLM proposes content, application code owns
  provenance/shape. **Revised during M8 design review (2026-08-28)**
  to also compute each tag's `sourceType` (task-21's new field) from
  the URL alone — this task is where that classification actually
  happens, not task-23 (Gemini) and not task-25 (orchestration).
- Inputs: task-21's `Inferred<T>`/`InferredSchema` (domain), task-23's
  `ReviewAnalysisResult` (LLM output shape), the enrichment page's
  `url`, and the original M7 candidate's `providerUrl` (needed to
  detect `provider_website`, since that's a comparison between two
  URLs, not a property of the enrichment URL alone).
- Outputs: `assembleInferredTags({ url, providerUrl, analysis,
  retrievedAt }): Inferred<string>[]` **and** a separately-exported,
  separately-testable `classifySourceType(url, providerUrl):
  "google" | "yelp" | "provider_website" | "other"` in a new
  `backend/src/research/assembleInferredTags.ts`.
- Constraints: Pure function only — no Firecrawl/Gemini/network calls,
  no `Date.now()` internally (caller always supplies `retrievedAt`,
  matching task-19's determinism discipline exactly). Do not touch
  `assembleCandidates.ts`'s existing FACT-side logic. `classifySourceType`
  must never return `"directory"` in this task (see Implementation
  Notes) — the enum allows it (task-21), this function just never
  produces it yet.
- Open Questions: none — `sourceType` scope confirmed during M8 design
  review (2026-08-28): classify google/yelp/provider_website/other
  now, leave `"directory"` undetected until a real need for it shows
  up (no maintained hostname list added speculatively).

## Assignment Alignment
- Requirement type: EXPLICIT (supports)
- Assignment requirement: Eval criterion 5, Trust & Grounding — INFERRED
  must carry a pointer to the evidence it came from, and must never be
  presented as equivalent to an observed FACT.
- Source: `docs/Home Assignment.pdf`, "What We Will Evaluate" #5 (page 7).
- Rationale: This is where D7's "inferred... with a pointer to the
  evidence it came from" becomes real, deterministic code rather than
  an LLM claim — the same split already proven correct for FACT in
  task-19. `sourceType` (added during M8 design review) strengthens
  this further: provenance now says not just *which URL* but *what
  kind of source* the evidence came from, entirely from deterministic
  URL inspection — reinforcing, not replacing, the existing
  `evidenceSourceUrl`/`evidenceExcerpt`/`retrievedAt` fields.
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/research/assembleInferredTags.ts`
- CREATE: `backend/src/research/assembleInferredTags.test.ts`
- DO NOT TOUCH: `backend/src/research/assembleCandidates.ts`,
  `backend/src/research/discoverProviderCandidates.ts`,
  `backend/src/domain/**`, `backend/src/llm/**`,
  `backend/src/conversation/**`, `backend/src/server.ts`.

### Implementation Notes
- `assembleInferredTags({ url, providerUrl, analysis, retrievedAt })`
  computes `sourceType = classifySourceType(url, providerUrl)` once,
  then maps each `{ tag, excerpt }` entry to `{ value: tag,
  evidenceSourceUrl: url, evidenceExcerpt: excerpt ?? undefined,
  sourceType, retrievedAt }`.
- `classifySourceType(url, providerUrl)`, in check order:
  1. `new URL(url).hostname === new URL(providerUrl).hostname` → `"provider_website"`.
  2. hostname contains `"google."` → `"google"`.
  3. hostname contains `"yelp."` → `"yelp"`.
  4. otherwise → `"other"`.
  Deliberately does **not** check for known directory/marketplace
  hostnames (confirmed during M8 design review) — that needs a
  maintained list, which is exactly the "sophisticated source
  classification" the review explicitly said not to add without a
  demonstrated need. A real directory-hosted review page (e.g.
  WeddingWire) is classified `"other"` for now, not misclassified —
  just not distinguished from any other non-google/yelp/provider page.
  `"provider_website"` here means "same host as the page M7 originally
  discovered for this candidate" — per task-15's own existing caveat,
  that discovered page is occasionally a directory/marketplace listing
  rather than the provider's canonical site, so this label inherits
  that same known imprecision; it is not a claim of independently
  verified official-domain ownership.
- An empty `analysis.tags` array maps to an empty `Inferred<string>[]`
  — not `null`/`undefined` (unlike `assembleCandidate`'s "all-null →
  null" rule, there's no ambiguity to collapse here: zero tags found
  is a fully valid, representable result, not "nothing usable at all").
  The caller (task-25) decides whether to attach an empty array or
  omit `inferred` entirely on the candidate.

## VALIDATE
### Unit Tests
- [ ] Maps a single `{ tag, excerpt }` entry to one `Inferred<string>` with the given url/retrievedAt.
- [ ] Maps `excerpt: null` to `evidenceExcerpt: undefined` (not `null`), matching the schema's `.optional()`.
- [ ] Maps multiple tags to multiple independent `Inferred<string>` entries, each carrying the same `evidenceSourceUrl`/`retrievedAt`/`sourceType`.
- [ ] Maps an empty `tags: []` to an empty array, not `null`.
- [ ] Never mutates the input `analysis` object.
- [ ] `classifySourceType`: same hostname as `providerUrl` → `"provider_website"`.
- [ ] `classifySourceType`: a `google.*` hostname → `"google"` (checked before the provider-website match would apply, i.e. even if a candidate's own site happened to be on a google-owned domain, google-domain detection is not required to lose to the provider-website check — document whichever precedence is implemented and test it explicitly).
- [ ] `classifySourceType`: a `yelp.*` hostname → `"yelp"`.
- [ ] `classifySourceType`: an unrelated hostname (e.g. a directory site) → `"other"`, not `"directory"`.

### Component / Integration Tests
- N/A — no consumer yet (task-25 wires it in).

### E2E Tests
- N/A.

### Success Criteria
- [ ] All new tests pass; existing suite still passes.
- [ ] `npm run build` clean.
- [ ] Zero I/O, zero LLM calls, zero internal timestamp generation.

## ITERATE
### Outcome
Implemented exactly as planned, no deviations. Created
`backend/src/research/assembleInferredTags.ts` exporting
`classifySourceType(url, providerUrl)` (check order: same-hostname →
`"provider_website"`, then `google.*` → `"google"`, then `yelp.*` →
`"yelp"`, else `"other"`; never returns `"directory"`) and
`assembleInferredTags({ url, providerUrl, analysis, retrievedAt })`,
which computes `sourceType` once and maps each `{ tag, excerpt }` to
an `Inferred<string>` (`excerpt: null` → `evidenceExcerpt: undefined`).
Pure function, no I/O, no `Date.now()`. 10 new tests in
`assembleInferredTags.test.ts` (5 for `assembleInferredTags`, 5 for
`classifySourceType`, including an explicit precedence test proving
`provider_website` wins over `google` when a provider's own site
happens to be on a google-owned domain, per the task's precedence
note). `npm test` 146/146 passing (136 pre-existing + 10 new), `npm
run build` clean. `assembleCandidates.ts` untouched.

### Knowledge Updates
None beyond `progress.md`/`roadmap.md` bookkeeping — no architectural
decision made or changed during implementation (the design was fully
settled in the M8 design review referenced in `## PLAN`).

### Follow-ups
- Task 25 (enrich provider candidates orchestration) is next: it
  wires `buildEnrichmentQuery` (task-22), `analyzeReviewText`
  (task-23), and this task's `assembleInferredTags` together, and
  decides whether an empty `Inferred<string>[]` gets attached to a
  candidate as `inferred: []` or omitted entirely.
- `"directory"` sourceType classification remains speculative/unbuilt
  (no maintained hostname list) — only worth adding if a real need
  shows up, per this task's confirmed scope.
