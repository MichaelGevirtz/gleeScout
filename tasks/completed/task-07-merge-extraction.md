# Task 07: Deterministic merge of extraction into conversation state
Status: DONE
Can run in parallel with: NONE (depends on Task 06)

## PLAN
- Goal: A pure, deterministic function that takes the current
  `ConversationState`, an `ExtractionResult` (Task 06's output), and
  the raw user message, and returns a *new* `ConversationState` with
  the extracted information applied — no LLM call, no I/O, fully
  unit-testable from hand-built fixtures. This is the concrete
  implementation of D5 ("the LLM proposes, the application owns the
  merge into state").
- Inputs: `backend/src/domain/conversation.ts` (Task 03 —
  `ConversationState`, `CategoryAttributeSlot`, read-only),
  `backend/src/llm/extraction.ts` (Task 06 — `ExtractionResult` type,
  read-only).
- Outputs: `mergeExtraction({ state, extraction, userMessage }):
  ConversationState` in a new `backend/src/conversation/` directory
  (deterministic orchestration-adjacent logic — distinct from
  `domain/` schemas and `llm/` calls, matching the assignment's
  emphasis on separating LLM reasoning from deterministic logic).

  Merge policy (this is the substantive design of this task, not
  incidental detail):
  - **User message**: appended to `messages` as `{ role: "user",
    content: userMessage }`.
  - **`serviceCategory`**: once set, never changed by a later
    extraction. If currently `null` and the extraction proposes one,
    adopt it. (Mid-conversation category changes, e.g. "actually,
    forget the bounce house, find me a clown," are an explicit
    out-of-scope assumption for this iteration — noted as a
    limitation, not silently ignored.)
  - **Core attributes (`dateTime`, `location`) and category attribute
    `value`s**: "latest non-null mention wins" — if the extraction's
    value for an attribute is non-null, it replaces whatever was
    there before (this is what lets a user correct themselves, e.g.
    "actually make it Saturday"); if the extraction's value is
    `null` (not mentioned this turn), the existing value is left
    unchanged. One rule, no special-casing between "fill missing" and
    "correct existing."
  - **Category attribute definitions** (`description`, `importance`):
    *refreshed* from the latest extraction, not frozen after first
    proposal — revised per review feedback. `description`/
    `importance` are non-nullable in `ExtractionResult` (unlike
    `value`, an attribute only appears in the extraction's
    `categoryAttributes` array at all when the LLM currently
    considers it relevant), so the rule is simply: for every
    attribute name present in the latest extraction, adopt its
    `description`/`importance` as given — no null-preservation logic
    needed for these two fields, unlike `value`. This lets the LLM
    sharpen its own earlier read as the conversation reveals more
    (e.g. `style: optional` on turn 1 becoming `style: required` by
    turn 3), with the application deciding to accept that revision —
    the LLM proposes a better interpretation, deterministic code
    decides how it changes authoritative state.
  - **Attributes absent from a later extraction**: never removed.
    Once an attribute name has been introduced to
    `categoryAttributes`, it stays (value and all) even if a later
    turn's extraction doesn't re-propose it — since category
    attributes are re-derived fresh each call (no cross-turn cache
    yet, per D6/task-06), an attribute dropping out of one turn's
    proposed list is ordinary LLM inconsistency, not a signal to
    forget a requirement or discard an answer already given. The
    known-attribute set only grows or gets refined, never shrinks.
  - **`phase`**: left unchanged. Deciding whether the conversation is
    ready to move past `"gathering"` is the readiness gate — that's
    M4, not this task.
- Constraints:
  - Must not mutate the input `state` object — return a new object.
    (This directly follows from the concurrency discussion recorded
    in D11: callers may hold a reference across an `await`, and
    in-place mutation of a stale reference is exactly how state gets
    silently corrupted. This function must not be a source of that.)
  - No LLM calls, no session-store access (no `updateSession` call
    here) — this function's caller (a later M5 route) is responsible
    for persisting the result. Keeping this pure is what makes it
    cheaply testable.
  - No phase-transition / readiness-gate logic — M4.
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: Part 1, item 6 — "Maintain structured event
  and requirement data behind the conversation" — and items 4–5
  ("Ask only the important missing questions," "Avoid unnecessarily
  long questionnaires") depend on this merge being correct, since
  M4's missing-attribute detection reads whatever this function
  produces.
- Source: Home Assignment PDF, Part 1, page 2.
- Rationale: This is the deterministic half of the architecture's
  central design question the assignment explicitly asks about ("how
  do you balance LLM reasoning vs. structured data vs. deterministic
  application logic," per D5) — the LLM (Task 06) proposes what it
  found; this function is the only thing that decides what actually
  becomes state.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/conversation/mergeExtraction.ts`,
  `backend/src/conversation/mergeExtraction.test.ts`
- MODIFY: none
- DO NOT TOUCH: `backend/src/domain/`, `backend/src/llm/`,
  `backend/src/store/`, `backend/src/server.ts`,
  `backend/src/index.ts`, `DESIGN.md`, `docs/`, `.claude/`

### Implementation Notes
- Build the new state via object/array spreads (or an equivalent
  non-mutating approach) throughout — no `.push`/property assignment
  on the input `state` or its nested objects/arrays.
- Keep this to the one merge function — no generic "deep merge"
  utility; the policy above is specific enough that a generic merge
  would either not implement it correctly or would need so much
  configuration it stops being simpler than just writing it directly.

## VALIDATE
### Unit Tests
- [ ] Category attribute definitions are adopted when
      `categoryAttributes` starts empty.
- [ ] A core attribute already set (e.g. `location`) is preserved
      when the extraction returns `null` for it.
- [ ] A core attribute already set is overwritten when the extraction
      returns a new non-null value (the "correction" case).
- [ ] A category attribute's `value` moves from `null` to a value
      when the extraction supplies one.
- [ ] A category attribute's `importance` (e.g. `optional` →
      `required`) is updated when a later extraction revises it for
      an attribute name already present in state.
- [ ] A category attribute present in state but absent from a later
      extraction's `categoryAttributes` array is left unchanged (not
      removed).
- [ ] `serviceCategory`, once set, is not changed by a later
      extraction proposing a different category.
- [ ] The user message is appended to `messages`.
- [ ] `phase` is unchanged by the merge.
- [ ] The input `state` object is not mutated (e.g. `result` is a
      different object reference than the input, and the input still
      deep-equals its pre-call snapshot after the call).

### Component / Integration Tests
- [ ] N/A — pure function, fully covered by unit tests.

### E2E Tests
- [ ] N/A.

### Success Criteria
- [ ] `npm run build` (backend) succeeds with no TypeScript errors.
- [ ] `npm test` (backend) passes, including the new merge tests.
- [ ] No unrelated files modified.

## ITERATE
### Outcome
- Created `backend/src/conversation/mergeExtraction.ts` exporting
  `mergeExtraction({ state, extraction, userMessage }): ConversationState`,
  a pure function implementing the task's merge policy exactly:
  - user message appended to `messages`;
  - `serviceCategory` adopted only while still `null` (`state.serviceCategory ?? extraction.serviceCategory`),
    never overwritten once set;
  - core attributes and category-attribute `value`s use "latest
    non-null mention wins" (`extraction value ?? existing value`);
  - category-attribute `description`/`importance` are always
    refreshed from the latest extraction for any attribute name it
    lists;
  - attributes present in state but absent from a later extraction's
    list are left untouched (map built via spread of existing
    entries, only overwriting entries the extraction actually lists);
  - `phase` untouched.
  - No mutation: built entirely via object/array spreads; the input
    `state`, its `coreAttributes`, `categoryAttributes`, and
    `messages` are never assigned into or pushed onto directly.
- Created `backend/src/conversation/mergeExtraction.test.ts`: 10
  tests, one per policy point listed in `## VALIDATE`, including a
  mutation check that asserts the input `state` deep-equals a
  pre-call JSON snapshot after the call and that the result is a
  distinct object reference.
- `npm run build` (backend): clean, no TypeScript errors.
- `npm test` (backend): 31/31 passing (6 test files), all pure/unit —
  no LLM calls, no I/O, as scoped.
- No unrelated files modified — only
  `backend/src/conversation/mergeExtraction.ts` and
  `backend/src/conversation/mergeExtraction.test.ts` created (new
  `backend/src/conversation/` directory); `domain/`, `llm/`, `store/`,
  and server/index files untouched.

### Knowledge Updates
- No architectural decisions changed; this task is the concrete
  implementation of D5's "LLM proposes, application owns the merge"
  split, and directly satisfies D11's non-mutation requirement for
  any function that touches `ConversationState`.
- Recorded, per the task's own note, that mid-conversation service-
  category changes (e.g. "actually, forget the bounce house, find me
  a clown") are explicitly out of scope for this iteration — the
  first-set category is sticky for the life of the session. Worth
  remembering if a future task considers "let the user switch what
  they're booking mid-conversation" — that would require a deliberate
  new decision, not an incidental fix here.

### Follow-ups
- None new. The next milestone (M4 — readiness gate / missing-
  attribute question selection) is the next consumer of the
  `ConversationState` this function produces.
