# Task 48: Chat screen component
Status: DONE
Can run in parallel with: 47, 49, 50, 51, 52, 53

## PLAN
- Goal: build State 1 — the primary chat-first requirement-gathering
  screen — as a presentational component driven entirely by props, so
  it's testable without mocking `fetch`/`AsyncStorage`, per
  `design/m14-ux-spec.md` screen 1.
- Inputs: task-46's types; `design/m14-ux-spec.md` screen 1 section in
  full (transcript rendering, "What I know so far" chip bar, recap
  chips, inline send-failure affordance).
- Outputs: NEW `frontend/src/screens/ChatScreen.tsx`:
  ```
  Props: {
    state: ConversationState;
    onSend: (message: string) => Promise<ConversationState>; // task-47's hook.sendMessage
  }
  ```
  Renders:
  - The transcript from `state.messages` (`role: "user"|"assistant"`),
    in order — the assistant's phrased next-question is just the last
    `assistant` message; the component never composes question text.
  - A text input + send control. On send: optimistically appends a
    local "pending" user bubble (not yet in `state.messages` — the
    server hasn't confirmed it), calls `onSend(message)`. On success,
    the pending bubble is dropped (the next `state.messages` from the
    resolved value already contains it, and a re-render with the new
    `state` prop supersedes local pending state). On failure, that
    bubble is marked "failed to send" with a retry tap that re-calls
    `onSend` with the same text — the chat is never cleared/lost on a
    failure, matching the spec's explicit instruction.
  - "What I know so far" chip bar: one chip per non-null/non-undefined
    field across `state.serviceCategory`,
    `state.coreAttributes.dateTime`, `state.coreAttributes.location`,
    and every `state.categoryAttributes[name]` whose `.value` is
    non-null; count badge = number of such chips. Read-only in this
    baseline (no tap-to-edit — Open Decision #3 in the UX spec).
  - Recap chips inside the assistant's most recent bubble: derived by
    diffing the current `state` against the previously-rendered
    `state` (tracked via a `useRef`/`usePrevious`-style pattern inside
    this component) for newly-non-null fields since the last render —
    a client-side rendering choice per the spec, not literal message
    content from the backend.
- Constraints:
  - No `fetch`, no `AsyncStorage`, no session-bootstrap logic in this
    file — `state` and `onSend` are the only inputs from the outside
    world.
  - No screen-transition logic (deciding when `phase === "ready_for_search"`
    means "move on") — that's task-54's job; this component only
    renders whatever `state` it's given.
  - Does not attempt "editing an already-known chip directly" — out of
    scope per the UX spec's Open Decision #3.
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT.
- Assignment requirement: "Build a small chat-based application where
  the user describes a service they need for an event... Ask only the
  important missing questions. Avoid unnecessarily long
  questionnaires." Also the "20-question form" language in "What We
  Will Evaluate" → "1. Product Judgment".
- Source: Home Assignment PDF, "The Assignment" intro and Part 1.
- Rationale: this is the direct UI expression of Part 1's core
  requirement — a real chat transcript driving requirement gathering,
  not a form; the chip bar is explicitly "supporting context," never
  the primary interaction, per the UX constraints in the M15 kickoff
  and the frozen spec's cross-cutting rules.

## IMPLEMENT
### Files Touched
- CREATE: `frontend/src/screens/ChatScreen.tsx`,
  `frontend/src/screens/ChatScreen.test.tsx`
- MODIFY: none
- DO NOT TOUCH: `frontend/src/hooks/`, `frontend/src/api/`,
  any other file under `frontend/src/screens/`

### Implementation Notes
- Give the transcript list, input, send button, and each chip a
  `testID` (e.g. `testID="chat-message-{index}"`,
  `testID="chat-input"`, `testID="chat-send"`,
  `testID="chip-{fieldName}"`) so tests query deterministically rather
  than by rendered text, which will change with copy edits.
- The pending/failed bubble is local component state
  (`useState<{text: string; status: "pending"|"failed"} | null>`) —
  not lifted to props; this is deliberately screen-local per the task
  boundary.

## VALIDATE
### Unit Tests
- N/A (no non-component logic to isolate).

### Component / Integration Tests
- [x] Renders every message in `state.messages` in order.
- [x] Typing + sending calls `onSend` with the typed text.
- [x] A successful `onSend` clears the input and does not leave a
      lingering pending/failed bubble.
- [x] A rejected `onSend` marks the attempted bubble as failed, keeps
      it visible (transcript is not cleared), and shows a retry
      control; tapping retry calls `onSend` again with the same text.
- [x] Chip bar renders exactly one chip per non-null/non-undefined
      known field, with the correct count badge, for a state with a
      mix of known/unknown fields.
- [x] Chip bar renders zero chips (and a `0` badge, not an error) for
      a state with nothing known yet.
- [x] Recap-chip diffing: rendering with an updated `state` prop
      (previously-unknown field now known) shows that field as a
      "newly known" recap chip on the latest assistant bubble.

### E2E Tests
- N/A (covered by task-54's integration wiring).

### Success Criteria
- [x] TS compiles with no errors.
- [x] `npm test` passes, including new tests, no regressions.
- [x] No files outside `Files Touched` modified.

## ITERATE
### Outcome
Built `frontend/src/screens/ChatScreen.tsx` as a pure presentational
component (`{ state, onSend }` props only — no `fetch`/`AsyncStorage`
anywhere in the file) and
`frontend/src/screens/ChatScreen.test.tsx` (7 tests, all VALIDATE
checklist items mapped 1:1 to a test).

Implementation matches the plan as written:
- Transcript renders `state.messages` in order with
  `testID="chat-message-{index}"`; the component never composes
  question text — it just renders `message.content`.
- Send flow: local `useState<{text, status: "pending"|"failed"} |
  null>` pending bubble, optimistically shown on submit, cleared on
  `onSend` success, flipped to `"failed"` with a retry control
  (`testID="chat-retry"`) on rejection — retry re-calls `onSend` with
  the same stored text. Input clears synchronously on submit.
- "What I know so far" chip bar: `computeKnownFields()` walks
  `serviceCategory` → `coreAttributes.dateTime` →
  `coreAttributes.location` → `categoryAttributes` entries with
  non-null `.value`, emitting one chip per field
  (`testID="chip-{fieldName}"`) plus a `testID="chip-count"` badge.
  Read-only, no tap-to-edit, per Open Decision #3.
- Recap chips: `usePrevious`-style pattern — a `useRef<Set<string>>`
  holding the known-field-key set as of the last *committed* render,
  compared against the current render's known-field set via
  `useMemo`, with the ref only written inside a `useEffect` (so the
  comparison is genuinely against the prior commit, not a same-render
  self-comparison — an earlier draft mutated the ref directly during
  render body, which is a React anti-pattern under double-invoked
  renders; fixed before finalizing). Newly-known fields are rendered
  as `testID="recap-chip-{fieldName}"` inside the last `assistant`
  message bubble (found via a manual reverse scan since
  `Array.prototype.findLast` isn't used elsewhere in this codebase).
  On the very first render (ref starts empty), every already-known
  field shows as "newly known," which matches the spec's own example
  ("Bounce house / Austin, TX / ~30 kids / Outdoor shown together
  after the first rich message") rather than being a bug.

Deviations from the plan: none material. One implementation choice
the plan left open — whether to trim the typed message before calling
`onSend` — was resolved by calling `onSend` with the exact typed text
(only trimming to decide whether the send button is enabled/a no-op
on whitespace-only input), since the plan's send test asserts `onSend`
is called with "the typed text" verbatim.

Test/tsc results:
- `npm test -- src/screens/ChatScreen.test.tsx`: 7/7 passed.
- `npm test` (full suite): 52/53 passed. The 1 failure
  (`src/screens/SimulatedQAScreen.test.tsx` › "clears its internal
  timer on unmount") is in a file outside this task's `Files Touched`
  list, written/still-in-flight from a concurrently-running parallel
  task (file mtimes confirm it was last written after this task's
  files were already complete) — not a regression introduced here,
  and out of scope to fix per the DO NOT TOUCH constraint.
- `npx tsc --noEmit`: exit 0, no errors.
- No files outside `Files Touched` were created or modified.

### Knowledge Updates
None — no new architectural finding beyond what M14/D17 already
documented. The ref-mutate-during-render vs. `useEffect` distinction
for the "previous render" comparison is implementation detail local
to this file, not a project-wide decision.

### Follow-ups
- The `SimulatedQAScreen.test.tsx` failure noted above should be
  checked once that parallel task settles — if it's still failing
  after task-52 (or whichever task owns that file) reaches DONE, it
  needs its own fix, not bundled into this task.
- Tap-to-edit on chips (Open Decision #3) and a real client-side
  sort/filter are already tracked as out-of-scope in the frozen UX
  spec — no new follow-up needed here beyond what M14 already logged.
