# Task 52: M10/M11 loading + Simulated Q&A screen component
Status: DONE
Can run in parallel with: 47, 48, 49, 50, 51, 53

## PLAN
- Goal: build States 5-6 — the cosmetic two-step pacing animation over
  the single `POST /conversation/:id/providers/select` call, followed
  by the simulated question/answer results — per
  `design/m14-ux-spec.md` screens 5-6, the direct implementation of
  Part 4 + Part 5's most trust-sensitive rendering rules.
- Inputs: task-46's types (`SimulatedAnswer`); `design/m14-ux-spec.md`
  screens 5-6 section in full, especially the "Rendering rules
  (non-negotiable)" list.
- Outputs: NEW `frontend/src/screens/SimulatedQAScreen.tsx`:
  ```
  Props:
    | { phase: "loading" }
    | { phase: "results"; providerName: string; answers: SimulatedAnswer[]; onBack: () => void }
  ```
  `phase: "loading"` renders the "preparing questions… / preparing
  simulated answers…" two-step cosmetic animation (same
  internal-timer-driven pattern as task-49's `TransitionScreen`, not
  shared code required but same discipline: cleared on unmount, no
  polling, purely decorative — there is no real intermediate state
  between M10 and M11, confirmed in the spec).
  `phase: "results"` renders, per the spec's non-negotiable rules:
  - Every answer card carries the badge **"SIMULATED · NOT CONFIRMED"**.
  - The persistent banner **"SIMULATED — NOT CONFIRMED WITH THE
    PROVIDER. We have not actually contacted [provider name]. Every
    answer below is an AI estimate; confirm directly with them before
    booking or paying anything."** shown once, with `[provider name]`
    interpolated from `providerName` — static copy otherwise, not
    derived from `answers` content.
  - Each `question`/`answer.value` pair rendered as given — the
    frontend must not rephrase/reword an answer to sound more
    confirmed (the phrasing-as-estimate work already happened
    server-side per D15/task-38; this component's job is not to
    undo it with confident-sounding chrome around it).
  - `answer.generatedAt` may be shown as decorative ("just now"-style)
    text but is never presented as a contact timestamp.
  - A "Back to your matches" CTA calling `onBack()`.
- Constraints:
  - No `fetch` calls — the parent (task-54) owns the
    `POST .../select` call and switches this component's `phase` prop;
    this component only renders.
  - Never uses phrasing implying real contact ("we asked them," "they
    said," "confirmed with provider") anywhere in this file's own
    static copy — test the banner/badge text explicitly against this.
  - Does not touch FACT/INFERRED rendering — that's task-51's screen
    entirely; this screen only ever shows SIMULATED data.
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT.
- Assignment requirement: "Instead of actually contacting providers,
  simulate their responses using an LLM. The simulation should be
  clearly separated from factual information collected from the web...
  This distinction is important" (Part 5); "We want to see the agent
  reasoning about what it knows, what it doesn't know, and what
  information it still needs" (Part 4).
- Source: Home Assignment PDF, Part 4 and Part 5 (including Part 5's
  worked example, which this screen's badge/banner requirement
  operationalizes).
- Rationale: this is the single highest-stakes screen for the Trust &
  Grounding evaluation criterion — it is the only place in the app
  where SIMULATED data is shown at all (per D14, no simulated data
  appears anywhere before selection), so the non-negotiable
  badge/banner rules from the frozen spec are treated as hard
  acceptance criteria, not stylistic suggestions.

## IMPLEMENT
### Files Touched
- CREATE: `frontend/src/screens/SimulatedQAScreen.tsx`,
  `frontend/src/screens/SimulatedQAScreen.test.tsx`
- MODIFY: none
- DO NOT TOUCH: any other file under `frontend/src/`

### Implementation Notes
- `testID`s: `testID="qa-loading"`, `testID="qa-banner"`,
  `testID="qa-card-{index}"`, `testID="qa-badge-{index}"`,
  `testID="qa-back"`.
- Use fake timers for the loading-phase animation test, same pattern
  as task-49.

## VALIDATE
### Unit Tests
- N/A.

### Component / Integration Tests
- [x] `phase: "loading"` renders the cosmetic animation and cleans up
      its timer on unmount (no leaked interval).
- [x] `phase: "results"` renders one card per `answers[]` entry, each
      carrying the "SIMULATED · NOT CONFIRMED" badge.
- [x] The persistent banner renders exactly once, with the provider's
      name correctly interpolated.
- [x] Question/answer text renders verbatim, unmodified from props.
- [x] Tapping "Back to your matches" calls `onBack()`.
- [x] Neither the badge nor the banner text contains any of the
      forbidden real-contact phrases ("we asked them", "they said",
      "confirmed with provider") — assert against the actual rendered
      strings, not just eyeball the copy.

### E2E Tests
- N/A (covered by task-54's integration wiring).

### Success Criteria
- [x] TS compiles with no errors.
- [x] `npm test` passes, including new tests, no regressions.
- [x] No files outside `Files Touched` modified.

## ITERATE
### Outcome
Built exactly per plan:
- `frontend/src/screens/SimulatedQAScreen.tsx` — single component,
  discriminated-union props (`{ phase: "loading" }` |
  `{ phase: "results"; providerName; answers; onBack }`).
  - `phase: "loading"`: `LoadingPhase` sub-component, a two-step
    cosmetic pacing animation ("Preparing questions…" / "Preparing
    simulated answers…", 1200ms interval) using the same
    `useEffect` + `setInterval`/`clearInterval` discipline as
    task-49's `TransitionScreen` (independently written, no shared
    code/import). `testID="qa-loading"` on the container plus
    per-step testIDs for the cycling-state test.
  - `phase: "results"`: `ResultsPhase` sub-component. Frozen banner
    copy assembled from constants (`simulatedBannerText` helper,
    exported for reuse if task-54 ever needs it) with
    `providerName` interpolated — never derived from `answers`.
    Every card gets the literal `"SIMULATED · NOT CONFIRMED"` badge
    (exported as `SIMULATED_BADGE_TEXT`). `question` / `answer.value`
    rendered verbatim, no rephrasing. `answer.generatedAt` is not
    read/displayed as a real value — rendered as a static decorative
    "Generated just now" string, so it can never be misread as a
    contact timestamp regardless of the actual field value.
  - testIDs match the task's Implementation Notes exactly:
    `qa-loading`, `qa-banner`, `qa-card-{index}`, `qa-badge-{index}`,
    `qa-back` (plus a few extra, non-required testIDs —
    `qa-question-{index}`, `qa-answer-{index}`,
    `qa-generated-{index}`, `qa-loading-step-*` — added only to make
    the verbatim-text and animation-cycling assertions precise).
- `frontend/src/screens/SimulatedQAScreen.test.tsx` — 9 tests, one
  per VALIDATE checklist item plus two extra (step-cycling over fake
  timers, empty-`answers[]` array doesn't crash and still shows the
  banner).

Deviation from the plan (minor, mechanical): the "clears its internal
timer on unmount" test needed `unmount()` wrapped in
`await act(async () => { unmount(); })`, whereas task-49's
`TransitionScreen.test.tsx` calls bare `unmount()` successfully for
the structurally identical effect/cleanup. Root-caused this before
accepting it: it is not a difference in the component's timer logic
(the `useEffect`/`setInterval`/`clearInterval` shape is identical to
`TransitionScreen`) — it reproduces specifically because
`SimulatedQAScreen` renders `LoadingPhase` as a nested child of a
wrapper component (the discriminated-union dispatch), whereas
`TransitionScreen` is itself the directly-rendered root. Wrapping
`unmount()` in `act()` is the documented, correct RNTL pattern for
flushing effect cleanups outside of `render`/`fireEvent` (see this
task's own briefing, point 2) and does not change what's being
asserted — `clearInterval` is still asserted to have been called.

Test/tsc results:
- `npm test -- src/screens/SimulatedQAScreen.test.tsx`: 9/9 passed.
- `npm test` (full suite): 9 suites / 63 tests passed, no
  regressions (other parallel tasks' screens — `ChatScreen`,
  `ErrorState`, `ProviderDetailsScreen`, `TransitionScreen` — were
  already present and green).
- `npx tsc --noEmit`: no output, no errors.
- Confirmed no files outside `Files Touched` were modified (only the
  two `CREATE` files were written; `types.ts`, `client.ts`, other
  screens, `package.json`, etc. untouched).

### Knowledge Updates
- Possible addendum to D17 (Jest/RNTL quirks): when the
  timer-owning component is rendered as a nested child of a wrapper
  (e.g. a discriminated-union dispatcher) rather than being the
  direct root passed to `render()`, the "assert `clearInterval` was
  called after bare `unmount()`" pattern from task-49 can flake/fail
  unless `unmount()` is wrapped in `await act(async () => {...})`.
  Worth confirming whether this is deterministic (nesting depth) or
  timing-sensitive if another task hits it — left as a note rather
  than editing D17 directly, per instructions not to touch
  memory-bank/ from this task.

### Follow-ups
- None required for this task's scope. If task-54 wants richer
  decorative timestamp copy (e.g. actually relative-formatting
  `generatedAt` instead of a static "Generated just now" string),
  that's a cosmetic enhancement outside this task's non-negotiable
  rendering rules and was intentionally left minimal to avoid any
  risk of the decorative timestamp reading as a real one.
