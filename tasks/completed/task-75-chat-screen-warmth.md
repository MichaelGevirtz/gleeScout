# Task 75: Chat screen warmth revision (Scout presence + input emphasis)
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: revise `ChatScreen.tsx`'s visual treatment per the D21 amendment
  to the frozen M14 spec — add a Scout mascot beside the latest
  assistant message only, give that message stronger visual weight,
  and enlarge the input row into a primary-input treatment — without
  changing the chat-first interaction model, state contracts,
  navigation, or any existing `testID`.
- Inputs: existing `ChatScreenProps` (`state: ConversationState`,
  `onSend`), the reference prototype's Scout artwork (to be extracted
  and saved as a project asset), `design/m14-ux-spec.md`'s amended
  screen 1 section, D21 in `memory-bank/decisions.md`.
- Outputs: updated `ChatScreen.tsx`, updated/extended
  `ChatScreen.test.tsx`, one new image asset under `frontend/assets/`.
- Constraints:
  - No backend change, no new API calls, no change to
    `ConversationState`/`onSend` contracts.
  - No change to `App.tsx`'s screen/navigation state machine, the
    desktop split-pane logic, or the existing `chatDesktopBackdrop`/
    `chatDesktopCard` wrapper (task-64) — `ChatScreen` keeps rendering
    inside that wrapper unchanged.
  - No new npm dependency, no new UI framework.
  - Every existing `testID` in `ChatScreen.tsx` must be preserved
    exactly (see list below) — this task adds visual treatment, it
    does not restructure the component's contract with its tests or
    with `App.test.tsx`.
  - No invented per-question copy (no secondary explanatory line under
    the question) — the assistant's message text is the only question
    copy, per the frozen spec's "client never composes question text"
    rule.
  - "What I know so far" chip bar behavior (hidden when zero fields
    known, one chip per known field, read-only) is unchanged.
- Open Questions: none architecture-affecting. One implementation-time
  judgment call, not blocking: exact Scout image dimensions/format —
  left to implementation, constrained only by "reasonably small file
  size, not a big loose raster dropped in unresized."

## Assignment Alignment
- Requirement type: RECOMMENDATION
- Assignment requirement: Part 6 — "The UI doesn't need to be
  beautiful, but it should be understandable and thoughtfully
  designed"; evaluation criterion 6, Taste ("Does the candidate make
  good decisions about what information matters, what the user should
  see, and what complexity should remain hidden?").
- Source: `docs/Home Assignment.pdf`, Part 6 and "What We Will
  Evaluate" §6.
- Rationale: not assignment-required, not previously a project
  decision — a scoped, light visual-warmth revision to the already-
  approved M14 chat screen, justified by a concrete usability gap (no
  assistant "presence," no visual hierarchy on the current question)
  rather than a wholesale reskin. See D21 for the full self-check,
  including what was deliberately not adopted from the reference
  prototype and why (avoids the "visual polish" over-investment the
  assignment explicitly de-emphasizes).

## IMPLEMENT
### Files Touched
- CREATE: `frontend/assets/scout.png` (or equivalent single optimized
  image asset — exact filename decided during implementation)
- MODIFY: `frontend/src/screens/ChatScreen.tsx`,
  `frontend/src/screens/ChatScreen.test.tsx`
- DO NOT TOUCH: `backend/**`, `frontend/src/App.tsx`,
  `frontend/src/App.test.tsx`, `frontend/src/components/ContextPanel.tsx`,
  `frontend/src/components/ContextPanel.test.tsx`,
  `frontend/src/screens/RecommendationsScreen.tsx`,
  `frontend/src/screens/RecommendationsScreen.test.tsx`,
  `frontend/src/hooks/**`, `frontend/src/domain/types.ts`,
  `frontend/src/api/client.ts`, any other screen component, any
  navigation/state-machine logic.

### Implementation Notes
- Preserve every existing `testID` verbatim: `chat-transcript`,
  `chat-message-{i}`, `chat-recap-chips`, `recap-chip-{key}`,
  `chat-pending-message`, `chat-failed-message`, `chat-retry`,
  `chat-chip-bar`, `chip-count`, `chip-{key}`, `chat-input`,
  `chat-send`. New elements get new `testID`s, not renames.
- Extract the Scout artwork from the reference prototype's embedded
  PNG, save as a real asset file (not an inline base64 string in
  source), sized/compressed reasonably for a mobile+web bundle.
- The Scout image and the amplified-message styling apply only to the
  message at `lastAssistantIndex` (already computed in the component)
  — earlier transcript bubbles keep today's plain styling. Mirrors the
  existing recap-chip precedent of not repeating the same treatment
  down a growing transcript.
- Input row: taller, larger font size, more prominent send affordance
  — still a single `TextInput` + `Pressable` send, same
  `onChangeText`/`handleSend` wiring, same disabled-when-empty rule.
- No change to `computeKnownFields`, `findLastAssistantIndex`,
  `attemptSend`, `handleRetry`, or the chip-bar JSX beyond styling.

## VALIDATE
### Unit / Component Tests
- [x] All existing `ChatScreen.test.tsx` cases pass unmodified in
      intent (transcript order, send/retry/failed flows, chip bar
      show/hide, recap chips)
- [x] Scout image renders exactly once, attached to the latest
      assistant message only — absent on earlier assistant messages
- [x] Scout image absent (or gracefully omitted) when there is no
      assistant message yet in `state.messages`
- [x] Input still calls `onSend` with the typed text; pending/failed/
      retry behavior unchanged

### Browser Validation (manual, via Playwright/dev server where available)
- [ ] ~375px: Scout, latest-message emphasis, chip bar, and input all
      remain legible and don't overflow/clip
- [ ] ~768px, ~1280px, ~1440px+: chat stays inside the existing
      task-64 centered desktop card; no unbounded stretching
- [ ] User vs. assistant messages remain visually distinct
- [ ] "What I know so far" stays visually secondary to the transcript
      and input

### Success Criteria
- [x] `frontend`: `npm test` passes
- [x] `frontend`: `npx tsc --noEmit` clean
- [x] No regression in `App.test.tsx` (untouched, but must still pass
      given `ChatScreen`'s exported contract is unchanged)
- [x] No backend files changed
- [x] Task scope fully implemented; no unrelated refactors

## ITERATE
### Outcome
Implemented as scoped, visual treatment only. `ChatScreen.tsx`'s
message map now branches on `index === lastAssistantIndex`: the newest
assistant turn renders as a row of Scout (`chat-scout`, new testID) +
an amplified bubble (17px/500 type, wider radius, warm `#FFE0CB`
border); every earlier bubble keeps today's exact styling. The recap-
chip JSX was hoisted into a `recapChips` local so both branches share
it rather than duplicating it — no behavior change. The input row went
to 56px tall / 17px text / 2px orange border, and the send affordance
became a 48px circular orange button with a disabled tint, replacing
the bare "Send" text link (no test asserted on that string). All
existing testIDs preserved verbatim; `computeKnownFields`,
`findLastAssistantIndex`, `attemptSend`, `handleSend`, `handleRetry`
and the chip-bar JSX are untouched apart from styles.

Scout artwork: extracted from the reference prototype's single embedded
base64 PNG and saved as `frontend/assets/scout.png` (325x290 RGBA,
85KB). Shipped at source resolution — it is already close to 2x the
104x93 box it renders in, and no image tooling was available on this
machine to re-encode it (the `convert` on PATH is Windows' filesystem
converter, not ImageMagick). Not inlined as base64 in source, per the
task note.

Validation: `frontend npm test` — 14 suites / 129 tests passing (125
pre-existing + 4 new Scout tests; `ChatScreen.test.tsx` went 8 → 12).
`npx tsc --noEmit` clean. `App.test.tsx` untouched and still passing,
confirming the exported contract is unchanged. No backend file touched.
Because Jest stubs image assets, a real `npx expo export --platform
web` was also run to prove the `require("../../assets/scout.png")` path
actually resolves at bundle time — it does (218 modules, 1 asset
emitted, 85KB).

**Not done — the `### Browser Validation` checklist above is
deliberately left unchecked.** Playwright is not installed in this repo
and this session had no browser/screenshot capability, so the
breakpoint checks (375 / 768 / 1280 / 1440px) were not performed and
must not be recorded as passing. The layout was sized to survive them
(the Scout row is `alignSelf: "stretch"` with a fixed 104px image and a
`flex: 1` bubble, so at 375px the bubble still gets ~237px, and the
whole screen stays inside the untouched task-64 desktop card), but that
is reasoning, not observation.

### Knowledge Updates
- D21 moves from `PROPOSED` to `ACCEPTED` — the amendment is now
  implemented, not just specified.
- `memory-bank/progress.md` M15 entry updated with the new suite count
  (129) and the fact that the chat screen now carries the D21 warmth
  treatment.
- No `DESIGN.md` change: this is a visual-treatment task with no new
  assumption, LLM/deterministic split, or architecture point for a
  reader who hasn't seen the task history. D21 + the spec amendment
  already carry the full rationale.

### Follow-ups
- Manual browser pass over the four breakpoints in this task's Browser
  Validation checklist, plus the pre-existing (unrelated) follow-up to
  walk the whole app against a live backend dev server. Both are the
  same manual-check deferral already recorded for M15 in
  `progress.md`; neither is blocking.
- Optional, low value: re-encode `scout.png` (palette quantization
  would likely take 85KB well under 30KB) if a real image toolchain is
  ever added to the project. Not worth adding a dependency for.
