# Task 15: Provider domain schema (ProviderCandidate + DiscoveredResult)
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Define the structural Zod schemas M7's pipeline will produce
  and consume, so every later M7 task (query builder, Firecrawl
  boundary, extraction, assembly, orchestration) has a fixed shape to
  target instead of each inventing its own ad hoc types. Mirrors how
  M2 (`conversation.ts`) and M6 (`evidence.ts`) both started with a
  pure schema task before any logic/I-O landed.
- Inputs: `Fact<T>`/`FactSchema` from `backend/src/domain/evidence.ts`
  (M6, already complete).
- Outputs: `backend/src/domain/provider.ts` exporting:
  - `DiscoveredResultSchema` / `DiscoveredResult` — raw, untrusted
    search-result shape (`url`, `title`, `description`). Deliberately
    has **no** `Fact` wrapper anywhere in it — a search hit is
    discovery signal, never a confirmed fact about a provider, per
    the M7 architecture review.
  - `ProviderCandidateFieldsSchema` / `ProviderCandidateFields` — the
    nullable set of extractable fields from Part 2 of the assignment
    (`name`, `location`, `servicesOffered`, `pricing`, `availability`,
    `rating`, `reviewCount`, `photos`, `policies`, `contactMethod`),
    each wrapped in `FactSchema(...)` and optional (a given page may
    surface none, some, or all of them).
  - `ProviderCandidateSchema` / `ProviderCandidate` — `{ url: string,
    fields: ProviderCandidateFieldsSchema }`. `url` is the page that
    was actually visited (not the search-results page) and is plain
    metadata, not itself a `Fact` — it's definitionally what makes
    this object a "candidate" in the first place.
  - **Clarification (project decision, not an assignment requirement)**:
    `url` is currently used as the candidate's *only* URL
    representation — it stands in for "the provider's website" for
    now, even though the visited page may actually be a directory/
    marketplace listing (e.g. Yelp) rather than the provider's own
    domain. Resolving "what is this provider's canonical website" as
    a distinct concept from "what page did we visit" is explicitly
    deferred — no separate `websiteUrl` field is introduced here, and
    no logic attempts to detect/prefer a provider-owned domain over an
    aggregator listing. Worth a DESIGN.md Assumptions note at M7
    completion.
- Constraints:
  - Schema only. No Firecrawl client, no Gemini call, no search-query
    builder, no orchestration, no route. Those are separate follow-up
    tasks (query builder → Firecrawl boundary → extraction call →
    Fact-assembly → orchestration), each to be proposed and approved
    individually once this schema exists.
  - No dedup, capping, ranking, or identity-resolution logic here —
    pure types only.
  - Do not touch `conversation.ts`, `evidence.ts`, the session store,
    or any route.
- Open Questions: none — the field list, the search-result/candidate
  type split, and the "url is not a Fact" decision were all resolved
  during the M7 architecture review preceding this task.

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: Part 2 ("Find Relevant Providers") lists the
  structured fields to extract when possible: provider name, website,
  location/service area, services offered, approximate pricing,
  availability information, ratings, number of reviews, relevant
  photos, important policies, contact method. Reinforced by Part 5 /
  "What We Will Evaluate" #5 (Trust & Grounding): factual information
  must carry provenance and be structurally distinguishable from
  non-factual information.
- Source: `docs/Home Assignment.pdf`, Part 2 (page 2) and "What We
  Will Evaluate" #5 (page 7).
- Rationale: `ProviderCandidateFieldsSchema` directly encodes Part 2's
  field list (minus `website`, which is represented by the candidate's
  own `url`, and folding "anything else useful" out of scope for a
  first pass — additional fields can be added later without breaking
  this shape, since every field is independently optional). Wrapping
  each field in `Fact<T>` (M6) is how this task satisfies the
  provenance requirement structurally, matching the project's D7
  decision. `DiscoveredResult` having no `Fact` wrapper is the
  concrete mechanism for the M7 review's "a search result is not
  automatically evidence for a provider attribute" principle.
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/domain/provider.ts`
- CREATE: `backend/src/domain/provider.test.ts`
- DO NOT TOUCH: `backend/src/domain/conversation.ts`,
  `backend/src/domain/evidence.ts`, `backend/src/store/**`,
  `backend/src/server.ts`, anything under `backend/src/llm/**` or
  `backend/src/conversation/**`.

### Implementation Notes
- Follow the existing domain-module style (`z.object` + `z.infer`, no
  classes), matching `conversation.ts`/`evidence.ts`.
- `DiscoveredResultSchema`: `{ url: z.string().url(), title:
  z.string(), description: z.string().optional() }`.
- Per-field types for `ProviderCandidateFieldsSchema` (all
  `.optional()`, each is `FactSchema(<inner>)`):
  - `name`: `FactSchema(z.string())`
  - `location`: `FactSchema(z.string())`
  - `servicesOffered`: `FactSchema(z.array(z.string()))`
  - `pricing`: `FactSchema(z.string())` (free text — normalization is
    explicitly out of scope per the assignment's own Bonus list "cost
    normalization," not attempted here)
  - `availability`: `FactSchema(z.string())`
  - `rating`: `FactSchema(z.number())`
  - `reviewCount`: `FactSchema(z.number())`
  - `photos`: `FactSchema(z.array(z.string().url()))`
  - `policies`: `FactSchema(z.string())`
  - `contactMethod`: `FactSchema(z.string())`
- `ProviderCandidateSchema`: `{ url: z.string().url(), fields:
  ProviderCandidateFieldsSchema }`.
- No `id` field — no persistence per the assignment's explicit
  constraints; `url` is the natural key for a single candidate record
  within one in-memory run.

## VALIDATE
### Unit Tests
- [ ] A minimal valid `DiscoveredResult` (`url` + `title` only) parses.
- [ ] A `DiscoveredResult` with a non-URL `url` fails validation.
- [ ] A `ProviderCandidate` with an empty `fields` object (`{}`)
      parses successfully — a candidate with zero extracted facts is
      structurally valid (represents a page that yielded nothing
      useful; the orchestration task decides later whether to keep or
      drop it).
- [ ] A `ProviderCandidate` with several fields populated (e.g. `name`,
      `rating`, `photos`) parses, and each populated field is a valid
      `Fact` (has `value`/`source`/`sourceUrl`/`retrievedAt`).
- [ ] A `ProviderCandidate` fields object with an invalid inner value
      for one field (e.g. `rating.value` as a string, not a number)
      fails validation.
- [ ] `ProviderCandidateSchema`'s `url` follows the same
      `.url()`-validation rule as `DiscoveredResultSchema`.

### Component / Integration Tests
- N/A — pure schema module, no consumers yet.

### E2E Tests
- N/A.

### Success Criteria
- [ ] All new tests pass; existing suite still passes (no
      regressions).
- [ ] `npm run build` clean.
- [ ] Follows the `conversation.ts`/`evidence.ts` domain-module
      convention.
- [ ] Task scope is fully implemented (schema only — no Firecrawl
      client, no Gemini call, no query builder, no orchestration).

## ITERATE
### Outcome
`backend/src/domain/provider.ts` — `DiscoveredResultSchema`
(`url`/`title`/`description`, no `Fact` wrapper anywhere), and
`ProviderCandidateFieldsSchema`/`ProviderCandidateSchema` (`url` +
`fields`), with all ten Part 2 fields optional and each wrapped in
`FactSchema` from M6's `evidence.ts`. No changes to
`conversation.ts`, `evidence.ts`, the session store, or any route. 6
new tests in `backend/src/domain/provider.test.ts` (minimal valid
`DiscoveredResult`; non-URL rejection; empty-`fields` candidate;
multi-field populated candidate with `Fact` shape checks; invalid
inner-value rejection; non-URL candidate `url` rejection). `npm test`
88/88 passing (82 pre-existing + 6 new), `npm run build` clean, no
regressions.

### Knowledge Updates
- `memory-bank/progress.md`: record task-15 completion; M7 is now
  underway (schema landed), tasks 16-20 remain, each individually
  approved before implementation.
- DESIGN.md Assumptions: worth a bullet at M7 completion noting `url`
  is currently the candidate's only URL representation (stands in for
  "provider website" even when the visited page is a directory/
  marketplace listing) — canonical-website resolution is deferred, not
  attempted.

### Follow-ups
- Next M7 tasks (each to be proposed/approved individually, not
  bundled): deterministic search-query builder
  (`buildProviderSearchQuery(state): string`, category+location only);
  Firecrawl `ResearchProvider` boundary wrapping combined search+scrape
  (verify Firecrawl's actual current API shape live, per D2a's
  precedent, rather than assuming); Gemini structured extraction of
  `ProviderCandidateFields` from scraped page content (reusing
  `generateStructuredJson` from task-05); deterministic assembly
  (dedup-by-URL, cap at a named constant e.g. `MAX_DISCOVERY_RESULTS`,
  Fact-wrapping); orchestration wiring it all together with per-
  candidate error handling (skip on scrape/extraction failure).
- Roadmap correction recommended (pending your approval, not yet
  applied): `memory-bank/roadmap.md`'s M7 row currently says "dedup;
  cap at 3–5" — recommend replacing with "URL-level dedup only
  (identity dedup deferred to M9); cap discovery at a wider constant
  (e.g. ~8) — the final 3–5 recommendation count emerges only after
  M9 (dedup) and M10 (ranking) run."
