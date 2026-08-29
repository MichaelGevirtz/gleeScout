# Task 14: Evidence/provenance model (FACT primitive)
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Define a generic, reusable `Fact<T>` Zod schema/type that
  tags any extracted value with where it came from, so M7 (provider
  research) and later M8 (enrichment) can attach provenance to
  extracted fields without inventing their own ad hoc shape.
- Inputs: none (pure domain modeling, follows the pattern already
  established by `backend/src/domain/conversation.ts` in M2).
- Outputs: `backend/src/domain/evidence.ts` exporting a `FactSchema`
  factory (parameterized over the wrapped value's Zod schema) and a
  generic `Fact<T>` TypeScript type, with `source`, `sourceUrl`,
  `retrievedAt` provenance fields alongside `value`.
- Constraints:
  - FACT only. Per project decision (see below), `INFERRED` and
    `SIMULATED` wrapper types are explicitly out of scope here — they
    land with M8 and M11 respectively, each against their own real
    consumer, not speculatively now.
  - No `Provider` entity. This task defines only the generic
    provenance primitive, not a concrete Provider schema — M7 designs
    that once it's clear what Firecrawl extraction can actually
    populate.
  - No research/HTTP/Firecrawl code. No changes to `conversation.ts`,
    the session store, or any route.
- Open Questions: none — both scope questions (FACT-only vs. all
  three buckets; primitive-only vs. minimal Provider shape) were
  raised and resolved with the reviewer before this file was written.

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: Part 5 — "The simulation should be clearly
  separated from factual information collected from the web. ...
  This distinction is important. We should always be able to
  understand which information is observed / sourced versus inferred
  / simulated." Reinforced by "What We Will Evaluate" #5, Trust &
  Grounding: "Can the system distinguish facts found online, inferred
  information and simulated provider responses? This is particularly
  important."
- Source: `docs/Home Assignment.pdf`, Part 5 (page 3) and "What We
  Will Evaluate" #5 (page 7).
- Rationale: This task builds the structural primitive that enforces
  the *structure* of provenance for a value tagged FACT — `value` +
  `source` + `sourceUrl` + `retrievedAt` must all be present — rather
  than a labeling convention applied ad hoc later once M7/M8 already
  have their own shapes. It does **not** enforce or guarantee that
  the value is actually true or that `source`/`sourceUrl` genuinely
  supports it; that grounding responsibility stays with the
  research/extraction pipeline (M7 onward), which decides what gets
  tagged FACT in the first place. Matches project decision D7
  (`memory-bank/decisions.md`), which is itself traced to this same
  assignment language.
- Gaps/conflicts found: none. This narrows D7 (which describes all
  three buckets together) to FACT-only for this task; INFERRED and
  SIMULATED remain committed scope for M8/M11, just not built here —
  not a scope reduction, a sequencing decision, confirmed with the
  reviewer.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/domain/evidence.ts`
- CREATE: `backend/src/domain/evidence.test.ts`
- DO NOT TOUCH: `backend/src/domain/conversation.ts`,
  `backend/src/store/**`, `backend/src/server.ts`, anything under
  `backend/src/llm/**` or `backend/src/conversation/**`.

### Implementation Notes
- Follow the existing style in `conversation.ts`: `z.object` schemas,
  `z.infer` for types, no classes.
- `FactSchema` is a factory function (`FactSchema(valueSchema)`),
  not a single fixed schema, since Zod doesn't support real generics
  on a plain `z.object` — this mirrors how `CategoryAttributeSlot`-
  style per-field schemas are already composed elsewhere in the
  domain layer.
- Fields, matching D7's naming: `value` (caller-supplied schema),
  `source` (`z.string()` — human-readable label, e.g. "provider
  website", "Yelp"), `sourceUrl` (`z.string().url()`), `retrievedAt`
  (`z.string().datetime()` — ISO 8601). Using `.url()`/`.datetime()`
  rather than bare `z.string()` is a deliberate small validation
  choice (assignment explicitly lists "structured output validation"
  as a desired optimization) — flag if a real Firecrawl response
  turns out to produce non-ISO timestamps or relative URLs, since
  that would need loosening in M7, not here.
- `sourceUrl` as a single required URL is a **current project
  assumption specific to web research**: a FACT is associated with
  the source URL it was retrieved from. This is not a claim that
  every possible future FACT source must have exactly one URL (e.g.
  a phone call or a PDF with no stable URL wouldn't fit) — just the
  right shape for this project's only research source today
  (Firecrawl, per D3). Worth a DESIGN.md Assumptions-section note at
  completion.
- This is an assumption worth a one-line DESIGN.md/decisions.md note
  at completion: `retrievedAt` is captured as an ISO 8601 string, not
  a `Date`, consistent with `ConversationState` already using plain
  strings for `dateTime` (everything crosses HTTP as JSON).

## VALIDATE
### Unit Tests
- [ ] A valid `Fact` object (all four fields, `value` matching the
      supplied inner schema) parses successfully.
- [ ] Missing any of `value`/`source`/`sourceUrl`/`retrievedAt` fails
      validation.
- [ ] An invalid `sourceUrl` (not a URL) fails validation.
- [ ] An invalid `retrievedAt` (not ISO 8601) fails validation.
- [ ] `FactSchema` works with at least two different inner value
      schemas (e.g. `z.string()` and `z.number()`), proving it's
      genuinely reusable and not hardcoded to one value type.

### Component / Integration Tests
- N/A — pure schema module, no consumers yet.

### E2E Tests
- N/A.

### Success Criteria
- [ ] All new tests pass; existing suite still passes (no
      regressions).
- [ ] `npm run build` clean.
- [ ] Follows the `conversation.ts` domain-module convention.
- [ ] Task scope is fully implemented (FACT primitive only, no
      Provider entity, no INFERRED/SIMULATED).

## ITERATE
### Outcome
`backend/src/domain/evidence.ts` — `FactSchema(valueSchema)` factory
returning `z.object({ value, source, sourceUrl, retrievedAt })`, plus
the generic `Fact<T>` TypeScript type. `sourceUrl` validated as
`z.string().url()`, `retrievedAt` as `z.string().datetime()` (ISO
8601). 8 new tests in `backend/src/domain/evidence.test.ts` (valid
parse with two different inner value schemas; four missing-field
rejections; invalid-URL rejection; invalid-datetime rejection).
`npm run build` clean, `npm test` 82/82 passing (74 pre-existing +
8 new), no regressions. **M6 (evidence/provenance model) is now
complete** — FACT-only scope, as decided with the reviewer before
implementation; `INFERRED`/`SIMULATED` remain scoped to M8/M11 and no
`Provider` entity was introduced here.

### Knowledge Updates
- `memory-bank/progress.md`: record task-14 completion, mark M6
  complete, note M7 (Firecrawl provider research) is next and depends
  on this FACT primitive.
- `DESIGN.md` Assumptions section: `sourceUrl` is a current
  project-specific assumption for web research — a FACT is associated
  with the single source URL it was retrieved from; not a claim that
  every possible future FACT source has exactly one URL. `retrievedAt`
  is captured as an ISO 8601 string (not a `Date`), consistent with
  `ConversationState` already using plain strings for `dateTime`
  (everything crosses HTTP as JSON).
- `memory-bank/decisions.md`: worth a short addendum to D7 noting
  that D7's three-bucket model was implemented FACT-first (this task)
  by deliberate sequencing decision, not as a scope reduction —
  `INFERRED`/`SIMULATED` wrapper types are still committed scope,
  just deferred to land with their first real consumer (M8, M11).
  Also worth noting the schema-vs-grounding distinction surfaced
  during task review: `FactSchema` enforces the *structure* of
  provenance, not that the cited source actually supports the value —
  that responsibility stays with the M7+ research/extraction
  pipeline.

### Follow-ups
- None new. M7 (Firecrawl provider research) is next per the roadmap
  and will be the first real consumer of `Fact<T>` (composing it into
  a concrete `Provider` schema).
