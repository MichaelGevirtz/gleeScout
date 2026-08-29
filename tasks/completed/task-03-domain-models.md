# Task 03: Domain models — conversation & requirement schemas
Status: DONE
Can run in parallel with: NONE

> Approved 2026-08-27 ("Task 03 approved. Implement exactly the
> revised task.").

## PLAN
- Goal: Define the Zod schemas that structured conversation state
  will be built from — `ConversationState`, `ConversationPhase`, and
  the requirement-attribute shapes — with no merge/extraction/store
  logic yet.
- Inputs: `memory-bank/decisions.md` D5 (LLM proposes, app owns
  merge/state), D6 (only date/time + location are deterministic
  core; everything else, including budget, is LLM-proposed per
  category and cached per session).
- Outputs:
  - `zod` added as a backend dependency.
  - Schema module(s) under `backend/src/domain/` defining:
    - `ConversationPhase`: `"gathering" | "ready_for_search"` (only
      the two phases needed right now — more are added when the
      milestones that need them, M7+, actually land, not
      speculatively now).
    - Core attributes: `dateTime?: string`, `location?: string`. No
      `importance` field — these are unconditionally required by
      definition, so a slot wrapper would just carry a constant.
    - Category attributes: a flexible record of attribute name →
      `CategoryAttributeSlot`, where
      `CategoryAttributeSlot = { description: string; importance:
      "required" | "optional"; value: string | null }`. The key's
      presence means "the LLM determined this matters for the
      category"; `value: null` means "known to matter, not yet
      answered"; a non-null string means "known." This is the fix
      for the conflation bug caught in review: a required attribute
      must be representable *before* its value is known, since that's
      exactly the case M4's missing-attribute detection needs to find.
      `description` is a short human-readable label (e.g. "whether a
      water slide is wanted") so M4's question-phrasing has something
      concrete to work from instead of re-deriving meaning from a bare
      key every time.
    - `ConversationState`: session id, phase, service category
      (free-form string, nullable until identified — no fixed
      category enum, per D6's "almost any service" requirement), core
      attributes, category attributes, and message history
      (`role: "user" | "assistant"`, `content: string`). No
      per-category attribute cache and no turn counter — see
      Constraints below.
  - A `createInitialState(sessionId: string): ConversationState`
    factory function.
- Constraints:
  - No merge logic, no readiness-gate logic, no Gemini calls, no
    session store, no API routes — those are Task 04 (store) and
    later M3–M5 tasks.
  - Attribute `value` is a plain string for now (everything at this
    stage comes from natural-language conversation) — not a
    typed/numeric union. Flagged as a simplifying assumption, not a
    permanent constraint.
  - **No per-category attribute cache in this task.** On review, the
    cache isn't per-conversation state at all — within one
    conversation the category doesn't change, so there's nothing to
    cache; the actual value is reusing a category's attribute
    definitions *across different sessions* in the same process run.
    That's a process-level structure with zero consumers until M3
    (extraction) exists, so it doesn't belong in `ConversationState`
    or in this task. It's introduced in M3, where it's first used.
  - **No `turnCount` field.** No current logic consumes it. If a
    future turn cap is ever needed (M4's readiness gate), it can be
    derived from `messages.filter(m => m.role === "user").length`
    rather than a second field that could drift out of sync with the
    message list.
  - Do not add phases or fields speculatively for milestones that
    haven't been approved yet.
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: "Maintain structured event and requirement
  data behind the conversation" (Part 1, item 6), and the broader
  Part 1 requirement that the system "identify what information is
  already known" and "avoid unnecessarily long questionnaires" —
  both depend on there being a structured place to record what's
  known.
- Source: Home Assignment PDF, Part 1 ("The system should..."), page
  2.
- Rationale: This is the structured-state backbone every later
  conversation task (extraction, question policy, API) reads from and
  writes to. Zod is the project's chosen validation layer (D1) so LLM
  output can be validated against these exact shapes before entering
  state (D5).

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/domain/conversation.ts` (or split further if
  it reads cleaner, e.g. a `types.ts` + `state.ts`), a corresponding
  test file (e.g. `backend/src/domain/conversation.test.ts`)
- MODIFY: `backend/package.json` (add `zod`)
- DO NOT TOUCH: `backend/src/server.ts`, `backend/src/index.ts`,
  `DESIGN.md`, `docs/`, `.claude/`

### Implementation Notes
- Export both the Zod schemas and their inferred TypeScript types
  (`z.infer<...>`) so later tasks import types, not raw shapes.
- Keep this to schemas + one factory function — no other helpers
  yet; anything else discovered as "would be useful" goes in
  Follow-ups, not into this task.

## VALIDATE
### Unit Tests
- [ ] `createInitialState` output parses successfully against
      `ConversationState` schema.
- [ ] A minimal valid `ConversationState` object parses successfully.
- [ ] A category attribute with `value: null` (required-but-unanswered)
      parses successfully — this is the case the schema revision exists
      to support.
- [ ] An invalid object (e.g. bad `phase` value, missing `sessionId`,
      or a category attribute missing `description`/`importance`)
      fails schema validation.

### Component / Integration Tests
- [ ] N/A — no store or API wiring yet.

### E2E Tests
- [ ] N/A.

### Success Criteria
- [ ] `npm run build` (backend) succeeds with no TypeScript errors.
- [ ] `npm test` (backend) passes, including the new schema tests.
- [ ] No unrelated files modified.

## ITERATE
### Outcome
Implemented exactly as revised, no scope expansion. Created
`backend/src/domain/conversation.ts` with `ConversationPhaseSchema`
(`"gathering" | "ready_for_search"`), `CoreAttributesSchema`
(`dateTime?`, `location?`, no importance wrapper), `CategoryAttributeSlotSchema`
(`description`, `importance`, `value: string | null`), `MessageSchema`,
`ConversationStateSchema`, all with inferred `z.infer` types exported
alongside the schemas, and a single `createInitialState(sessionId)`
factory — no other helpers. Added `zod` to `backend/package.json`.
Created `backend/src/domain/conversation.test.ts` with 6 tests
covering: `createInitialState` output validity, a minimal valid
state, a required-but-unanswered (`value: null`) category attribute,
an invalid phase value, a missing `sessionId`, and a category
attribute missing `description`/`importance`.

Validation, all passed:
- `npm install` (added 1 package: `zod`).
- `npm run build` — no TypeScript errors.
- `npm test` — 7/7 passing (6 new domain tests + the existing
  `/health` test, unaffected).
- No files outside the task's declared scope were touched;
  `server.ts`/`index.ts`/`DESIGN.md`/`docs/`/`.claude/` untouched.

### Knowledge Updates
- `memory-bank/progress.md`: domain schemas implemented and
  validated; D6's refined cache/nullable-value design is now
  reflected in real code, not just the decision record.
- `memory-bank/decisions.md`: no further change — the D6 refinement
  was already recorded before implementation and matches what was
  built.
- `DESIGN.md`: no change needed for this task. It's a schema-shape
  implementation of assumptions/decisions already summarized there
  (D6's attribute-determination assumption); nothing new at the
  product/architecture level was introduced.

### Follow-ups
- Task 04 (in-memory session store, keyed by session id) is the next
  roadmap item — not started, awaiting task creation + approval.
- The process-level per-category attribute cache remains explicitly
  deferred to M3 (extraction), per D6's refinement — not a gap in
  Task 03, a deliberate exclusion.
