# Task 64: Desktop/wide-screen Chat layout fix
Status: DONE
Can run in parallel with: NONE

**Approved** (user, this session, 2026-08-29): standalone centered
card approach confirmed (no ContextPanel/split-pane reuse for Chat).
Width revised from the originally-proposed 720px to **~800px** per
explicit user instruction — rationale: Chat is an interactive
workspace (messages + context chips + composer), not pure reading
text, so 800px balances better on a 1280px desktop while still capping
well short of 1440px+. All width references below updated to 800px.

## PLAN
- Goal: Fix the Chat screen so it reads as a deliberate, focused chat
  workspace at desktop and wide-desktop widths, instead of a full-bleed
  stretched layout, without touching the approved split-pane
  Recommendations/Provider-Details/Simulated-QA experience.
- Inputs: Existing `frontend/src/App.tsx` layout branches, existing
  `frontend/src/hooks/useIsDesktop.ts` (`DESKTOP_BREAKPOINT = 1024`,
  already used by the split-pane branch), existing
  `frontend/src/screens/ChatScreen.tsx` (unchanged internal logic).
- Outputs: A desktop-only centered, width-capped, visually-framed
  wrapper around the Chat screen's content, applied only when
  `screen === "chat"` and `isDesktop` is true and the split-pane branch
  isn't active (i.e. `providers === null`, which is always true while
  the plain fallback branch is reached for chat — see Root Cause).
- Constraints: No backend/API changes. No new navigation architecture,
  no new screen-state values. No new dependency/styling framework. Do
  not modify `ChatScreen.tsx`'s internal structure/logic/tests-facing
  testIDs — style the wrapper in `App.tsx` only, mirroring the existing
  `rightPaneInner` pattern used for the split-pane branch. Do not touch
  `ContextPanel.tsx`, `RecommendationsScreen.tsx`,
  `ProviderDetailsScreen.tsx`, `SimulatedQAScreen.tsx`, or any backend
  file. Do not change `useIsDesktop`'s breakpoint or add a new one.
- Open Questions: none — design direction below was produced via
  direct inspection of the current implementation, per the user's
  explicit instruction to act as both implementer and designer.

### Root cause (read before implementing)
`showSplitPane` in `App.tsx` is `isDesktop && providers !== null`.
During the entire requirement-gathering phase (`screen === "chat"`),
`providers` is still `null` (it's only set after a provider search
resolves), so the split-pane branch never applies to Chat — Chat always
falls into the plain fallback branch:
```
<View style={styles.container}>
  {screen !== "chat" && <ChatPill .../>}
  <View style={styles.content}>{content}</View>
</View>
```
`styles.content` is `{ flex: 1 }` with no `maxWidth`/centering, unlike
`styles.rightPaneInner` (`width: "100%", maxWidth: 900`) which the
split-pane branch already uses for Recommendations/Provider
Details/Simulated QA. So at wide viewports, `ChatScreen`'s transcript,
"what I know so far" chip bar, and input row all stretch to the full
window width — bubbles (`maxWidth: "82%"` of a ~1800px container)
balloon far past a readable line length, the text input becomes a
single oversized field, and there's no visual container giving the
conversation a boundary. This matches the reported screenshot
(disconnected message area/input, large unused space, weak focus).

### Design solution
Add a desktop-only wrapper, applied in `App.tsx`'s existing plain
fallback branch, active exactly when `isDesktop && screen === "chat"`:
- A neutral page background (`#f3f4f6`, matching the gray family
  `ContextPanel.tsx` already uses for its `#fafafa`/`#e5e7eb` chrome —
  no new palette introduced) fills the space around the column, so the
  margin reads as deliberate framing rather than empty leftover space.
- The Chat content itself sits in a centered column capped at
  `maxWidth: 800` (narrower than the 900px recommendations pane
  deliberately — Chat is an interactive workspace, not pure reading
  text, so 800px balances desktop-width use with keeping the
  conversation and composer from becoming excessively wide) with a
  white card surface: rounded corners,
  a 1px border in the same `#e5e7eb` already used by `ContextPanel`,
  and vertical margin so the card doesn't touch the viewport edges.
- The cap does not grow with viewport width, so very-wide monitors get
  more surrounding margin, not a wider conversation — directly
  addressing "the conversation is spread across too much horizontal
  space."
- Below `DESKTOP_BREAKPOINT` (1024), nothing changes: full-bleed
  single column exactly as today (mobile stays mobile).
- `ChatScreen.tsx` itself is untouched — its bubble `maxWidth: "82%"`
  is already relative to its container, so capping the container at
  800px naturally caps bubble width too, with zero changes to that
  file (zero risk to its 7 existing tests).

### Why not just "add max-width and center"
A bare centered column with no distinct page background/border reads
as a narrow strip of the same stretched page — still no boundary or
hierarchy, same "mobile-screen-with-padding" feeling the user flagged.
The neutral page background + bordered white card give the column a
visible edge (figure/ground separation), which is what actually
produces a "workspace" feel rather than whitespace. It's still a small,
low-risk change (one wrapping `View` + a handful of `StyleSheet`
properties in `App.tsx`, reusing colors already in the codebase) — not
a new component, pattern, or dependency.

### Responsive behavior
- ~375px / ~768px (below 1024): unchanged, full-bleed single column.
- ~1280px: centered ~800px-wide bordered card on a `#f3f4f6` background.
- ~1440px+: identical ~800px cap — extra width becomes margin, not a
  wider conversation.

## Assignment Alignment
- Requirement type: PROJECT DECISION
- Assignment requirement: none directly — desktop/wide-screen support
  was already confirmed as **non-assignment scope** by `assignment-review`
  during the original desktop addendum (D19): not listed in Parts 1-6
  or the Bonus list, and in tension with the assignment's "we care
  more about [functionality/reasoning] than... visual polish" framing.
  Only loosely touches Part 6's "doesn't need to be beautiful, but...
  understandable and thoughtfully designed" — already satisfied by the
  frozen M14 spec; this task doesn't add new UI, it fixes a layout bug
  in the already-approved, already-non-assignment desktop extension.
- Source: `memory-bank/decisions.md` D19 (confirms desktop scope is
  non-assignment); Part 6 (tangential, already satisfied).
- Rationale: This is a bug fix requested directly by the user
  (first-person, this session) against the desktop addendum they
  already explicitly authorized (D19). No new scope is added — the
  fix is confined to layout/styling of an existing, already-shipped
  screen (tasks 55-58, 61-63).

## IMPLEMENT
### Files Touched
- MODIFY: `frontend/src/App.tsx` (add the desktop chat wrapper +
  styles; no logic/state changes)
- DO NOT TOUCH: `frontend/src/screens/ChatScreen.tsx`,
  `frontend/src/screens/ChatScreen.test.tsx`,
  `frontend/src/components/ContextPanel.tsx`,
  `frontend/src/screens/RecommendationsScreen.tsx`,
  `frontend/src/screens/ProviderDetailsScreen.tsx`,
  `frontend/src/screens/SimulatedQAScreen.tsx`,
  `frontend/src/hooks/useIsDesktop.ts`, any `backend/**` file.

### Implementation Notes
- New styles only in `App.tsx`'s `StyleSheet.create` block: a page
  background style and a card wrapper style (`maxWidth: 800`,
  centered, white background, `#e5e7eb` border, rounded corners,
  vertical margin).
- Apply the wrapper conditionally: `isDesktop && screen === "chat"` in
  the plain fallback branch only — the split-pane branch
  (`showSplitPane`) and non-chat screens in the fallback branch
  (transitionLoading, error overlays reached via other flows) are
  unaffected, per "keep the change narrowly scoped to the Chat
  workspace."
- No new state, no new props threaded into `ChatScreen`.

## VALIDATE
### Unit Tests
- N/A (no new pure logic; the change is layout/styling in `App.tsx`)

### Component / Integration Tests
- [ ] Existing `App.test.tsx` "wide viewport, providers === null
      (initial chat): split pane does not render" case still passes
      unchanged (asserts `context-panel` absent, `chat-transcript`
      present, `chat-pill` absent) — confirms the fix doesn't
      accidentally trigger split-pane behavior on Chat.
- [ ] Full existing `App.test.tsx` and `ChatScreen.test.tsx` suites
      pass unchanged (no testID or behavior changes expected).

### E2E Tests
- [ ] Manual/Playwright browser check: run the web app, inspect Chat
      at ~375px, ~768px, ~1280px, ~1440px+. Confirm centered/framed
      column at desktop widths, full-bleed at mobile/tablet, no
      regression to Recommendations/Provider Details split-pane at
      desktop widths.

### Success Criteria
- [ ] `npm test` (frontend) passes, no regressions.
- [ ] `npx tsc --noEmit` clean.
- [ ] Chat screen at desktop/wide-desktop reads as a framed, centered
      conversation column, not a stretched full-bleed layout.
- [ ] Mobile/tablet Chat layout unchanged.
- [ ] Recommendations/Provider Details/Simulated QA desktop split-pane
      layout unchanged.

## ITERATE
### Outcome
Implemented exactly as approved (800px, not the originally-proposed
720px). `frontend/src/App.tsx`: added `isDesktopChat = isDesktop &&
screen === "chat"`; when true, the plain fallback branch wraps
`content` in `chatDesktopBackdrop` (neutral `#f3f4f6` background,
centered, padded) → `chatDesktopCard` (`maxWidth: 800`, white,
`#e5e7eb` 1px border, 16px radius, `overflow: "hidden"`, internal
padding). No other branch, file, or piece of state touched —
`ChatScreen.tsx`, `ContextPanel.tsx`, the split-pane branch, and all
other screens are byte-for-byte unchanged.

Validation:
- `npm test` (frontend): 13 suites / 101 tests, all passing, no
  changes needed to any existing test (including the
  `App.test.tsx` case explicitly asserting no `context-panel` renders
  on wide-viewport initial chat).
- `npx tsc --noEmit`: clean.
- Real-browser Playwright validation (chromium, one-off scripts
  installed to the session scratchpad, not added to the repo — same
  pattern as task-58) against the actual running `expo start --web`
  dev server on `localhost:8081`, with `POST /conversation` (and
  `.../providers`) intercepted via `page.route` to avoid needing a
  live backend/Gemini/Firecrawl:
  - Chat screen screenshotted at 375/768/1280/1440/1920px: full-bleed
    unchanged below 1024px; centered ~800px bordered card on the gray
    backdrop at 1280px+, with the card **not** growing at 1920px
    (confirmed the "very wide monitor" requirement — extra width
    becomes margin, not a wider conversation).
  - Recommendations + Provider Details screenshotted at 1280/1440px
    (mocked a `ready_for_search` session + provider list): ContextPanel
    left rail + 900px-capped right pane rendered identically to
    pre-task-64 behavior — no regression.
  - Reopened-chat-via-ContextPanel screenshotted at 1440px (chat opened
    from Recommendations, i.e. `providers !== null`): confirmed it
    still takes the **original** split-pane branch (ContextPanel
    visible, no new card) — the new wrapper only ever applies to the
    `providers === null` initial-gathering case, per design.

### Knowledge Updates
- `memory-bank/decisions.md` D19 given a dated addendum: corrects its
  original "initial requirement gathering stays single-pane/
  full-width" clause, which task-64 found produced a real UX bug at
  wide desktop widths, and records the new three-state desktop layout
  model (full-bleed / chat-card / split-pane).
- No `DESIGN.md` change — the desktop addendum was never referenced
  there in the first place (correctly: D19 is explicitly non-assignment
  scope, must not appear in DESIGN.md's assignment-facing sections),
  and this task doesn't change that boundary.

### Follow-ups
None raised. The "reuse ContextPanel for Chat" and "wider sidebar"
alternatives were explicitly considered and rejected (by the user) as
part of this task's own design discussion, not deferred for later.
