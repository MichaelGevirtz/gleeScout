# M14 — Frozen UX Spec (final direction for M15)

Status: **APPROVED / FROZEN** (2026-08-29). Visual reference:
`design/m14-final/` (source `.dc.html` per screen) and the published
canvas at https://claude.ai/code/artifact/e8595f6e-effa-4049-9c64-989d8eca225e

This is the spec required by `ui-ux-design` skill step 6, produced
after three concepts were explored (`design/m14-concept-1/2/3/`) and a
hybrid of Concept 1 (chat-first gathering) + Concept 2
(comparison-first discovery) was selected and refined. Do not change
the visuals described here without a concrete usability problem found
during M15 build — see CLAUDE.md/roadmap process.

No backend change is implied by anything in this document. Every data
shape below is copied from the actual current schemas/routes
(`backend/src/domain/*.ts`, `backend/src/server.ts`), not invented.

## Screen-by-screen

### 1. Chat (`design/m14-final/Main.dc.html`)

**Purpose**: State 1 — chat-first requirement gathering, the primary
interaction until the app is ready to search.

**Backend wiring**:
- `POST /conversation` once, on app open — response `{ sessionId, state }` seeds the session.
- Each send: `POST /conversation/:id/message { message: string }` → response `{ state }` replaces local state wholesale (don't hand-merge; the server is authoritative).
- On resume (app relaunch with a stored `sessionId`): `GET /conversation/:id` → `{ state }`.

**Renders from `state`**:
- `state.messages: {role: "user"|"assistant", content: string}[]` → the transcript, in order. The assistant's phrased next-question already comes back as the last `assistant` message — the client never composes question text itself.
- `state.serviceCategory`, `state.coreAttributes.{dateTime,location}`, `state.categoryAttributes: Record<name, {description, importance, value}>` → source for the "What I know so far" chip bar/sheet. A chip is shown for every field that is non-null/non-undefined; count badge = number of such fields. The whole bar is hidden when zero fields are known (e.g. on first load, before any answer) — an empty "What I know so far · 0" bar has no information value and just wastes vertical space. This bar is read-only in this frozen baseline (see Open Decisions #3).
- The "recap chips inside the assistant's bubble" (e.g. Bounce house / Austin, TX / ~30 kids / Outdoor shown together after the first rich message) are a **client-side rendering choice**, not literal message content — derive them the same way as the chip bar (diff of newly-non-null fields since the previous state), don't expect the backend to hand back a pre-formatted recap string.

**Transition out**: when `state.phase === "ready_for_search"`, move to the Transition screen and immediately call `POST /providers`.

**Errors**: `POST .../message` can 502 (Gemini failure) or 500. Show a small inline error affordance in the chat (a failed-to-send state on the last user bubble with a retry tap) — do not lose the chat itself; this is not the full-screen Error State (that's reserved for the provider-search step, see below).

**Visual-treatment amendment (task-75, 2026-08-29) — chat presence/warmth**:
this frozen screen's *structure* (bubble transcript, chip bar, input row —
the chat-first interaction model itself) is unchanged. This amends only
the *visual weight* given to two elements, per the concrete usability
problem found: the plain implementation gave no visual signal that "an
assistant is present," and the current question carried the same visual
weight as the rest of the transcript, so the screen reads as a generic
message log rather than a guided conversation. See D21 in
`memory-bank/decisions.md` for the full rationale and what was
deliberately *not* adopted from the reference prototype that prompted
this.

- A Scout mascot image appears once, alongside the **latest assistant
  message only** — not on every historical assistant bubble. This
  mirrors the existing recap-chip precedent (task-48): decoration that
  would repeat unchanged down a growing transcript is reserved for the
  newest turn.
- The latest assistant message renders with stronger visual weight
  (larger type) than earlier transcript bubbles. This is a rendering
  choice over the *same* `state.messages` content already specified
  above — no new or invented copy, no secondary explanatory line under
  the question (the frozen rule that "the client never composes
  question text itself" still holds).
- The input row becomes the primary-input treatment (taller, larger
  text, more prominent send affordance) — still a single free-text
  `TextInput` + send action, same `onSend` contract, no structured
  fields.
- The "What I know so far" chip bar is unchanged: still secondary,
  still hidden when zero fields are known, still read-only.

### 2. Transition / search loading (`Transition.dc.html`)

**Purpose**: bridges State 1 → State 2. Chat visually collapses to a
"Chat" pill (chat-bubble icon, explicitly labeled — resolved from the
open concern raised during Concept 2 review) while the board loads
underneath.

**Backend wiring**: exactly one call, `POST /conversation/:id/providers` → `{ providers: ProviderScore[] }` on success.

**Important implementation note**: the three animated steps shown
("Searching the web → Checking reviews → Ranking matches") are a
**cosmetic indeterminate-wait animation only**. The backend makes one
synchronous call that internally runs M7→M8→M9 with no progress
events/streaming — there is nothing to poll and no partial result. Do
not build any client polling logic for this; just show the animation
for the duration of the one in-flight request.

**On success** → Recommendations screen, holding `providers` in
client memory (not re-fetched again unless the user edits requirements
via chat — see Open Decisions #1).
**On failure** (502/500) → Error State, retry re-issues the same `POST /providers` call.

### 3. Provider comparison (`Recommendations.dc.html`)

**Purpose**: State 3 — comparison-first, all matches visible at once.

**Data**: `providers: ProviderScore[]`, where
```
ProviderScore = {
  candidate: ProviderCandidate,
  score: number,                              // 0–1, render as %
  dimensionScores: Record<
    "requirementMatch"|"geoFit"|"priceFit"|"reputation"|"evidenceQuality",
    number | null                              // null = "not enough data", never 0
  >,
  explanation: string                          // use verbatim as the one-line rationale
}
```

**Must render `providers.length` dynamically** — do not hardcode 3,
4, or 5 rows. `rankProviders` returns up to `MAX_RANKED_RESULTS = 5`
but can legitimately return fewer if fewer real candidates were found;
the layout must degrade gracefully to 1–5 rows with no empty
placeholder rows.

**Per row**:
- Rank = 1-based index in the (already-sorted) array.
- Name = `candidate.fields.name?.value`; if absent (schema allows it — a candidate can lack a `name` FACT), fall back to the hostname of `candidate.url`.
- Price = `candidate.fields.pricing?.value` if present, else an em-dash (never invent a number).
- Rating = `candidate.fields.rating?.value` (+ `reviewCount?.value` if present).
- "N facts sourced" = count of non-null keys in `candidate.fields`.
- "N inferred" = `candidate.inferred?.length ?? 0`.
- "Signals: X / 5" = count of non-null entries in `dimensionScores`.
- One-line rationale = `explanation`, truncated if needed (it's already a short deterministic sentence, see `backend/src/ranking/explanation.ts`).

**Tap a row** → Provider Details, passing the row's full `candidate` object (and its `dimensionScores`/`explanation`) — this exact object is what gets echoed back verbatim on selection (see below), so don't reshape it client-side.

**Sort control**: cosmetic in this frozen baseline — the array is already ranked; wiring a real client-side re-sort is deferred (Open Decisions #4), not required for M15's first pass.

### 4. Provider details (`ProviderDetails.dc.html`)

**Purpose**: State 4 — FACT vs INFERRED, clearly distinguished, INFERRED never implied confirmed.

**Data**: the `candidate: ProviderCandidate` and its `dimensionScores`/`explanation` already held from the list screen — **no separate detail endpoint exists**, nothing new to fetch here.

```
ProviderCandidate = {
  url: string,
  fields: {                      // each optional; each is a Fact<T>
    name?, location?, servicesOffered?, pricing?, availability?,
    rating?, reviewCount?, photos?, policies?, contactMethod?
  },
  inferred?: Inferred<string>[]
}
Fact<T>      = { value: T, source: string, sourceUrl: string, retrievedAt: string }
Inferred<T>  = { value: T, evidenceSourceUrl: string, evidenceExcerpt?: string, sourceType: "google"|"yelp"|"provider_website"|"directory"|"other", retrievedAt: string }
```

- **Sourced facts** section: one row per non-null `fields.*` entry, `value` as the display text, `source` as the small caption (already a hostname string).
- **Inferred from reviews** section: one card per `inferred[]` entry — `value` as the tag headline, `evidenceExcerpt` as the quoted line **only if present** (it's optional; omit the excerpt line entirely, don't show empty quotes, when absent), map `sourceType` to a friendly label (e.g. `provider_website` → "provider website review"). The fixed caption **"Inferred from review patterns — not confirmed by the provider."** is static copy, shown once whenever the section renders. **Revised by task-96**: when `inferred` is empty or absent, the entire section (heading, caption, and list) is omitted — there's nothing to disclaim, so the disclaimer doesn't render either.
- **Dimension bars**: iterate the five `dimensionScores` keys in the fixed order (requirementMatch, geoFit, priceFit, reputation, evidenceQuality); a `null` value renders the dashed "not enough data" state, never a 0-width bar.
- CTA **"Select [name]"** → `POST /conversation/:id/providers/select { candidate }`, sending the exact object received from the list (per D14, the server trusts this echo — do not let the client mutate/reshape it first) → M10/M11 loading screen.

### 5 & 6. M10/M11 loading + simulated answers (`M10Loading.dc.html`, `SimulatedQA.dc.html`)

**Critical implementation note — read before building**: the backend
has **one route, one call** for this whole step:
`POST /conversation/:id/providers/select` internally runs M10
(`prepareProviderQuestions`) then M11 (`simulateProviderResponses`)
and returns both together as a single response. **There is no
separate "M10 done, now starting M11" event from the server.** The
two-screen "preparing questions… / preparing simulated answers…"
sequence in the mocks is a **client-side cosmetic pacing animation
over one in-flight request** (same pattern as the search-loading
screen) — do not build two sequential API calls, and do not try to
show real intermediate state between M10 and M11; there isn't any.

**Response shape**:
```
{ answers: { question: string, answer: { value: string, generatedAt: string } }[] }
```
(`answer` is a `Simulated<T>` — no `source`/`sourceUrl`/`evidenceExcerpt`, by design: nothing was retrieved.)

**Rendering rules (non-negotiable per the assignment's Trust &
Grounding criterion and this task's explicit instruction)**:
- Every answer card carries the badge **"SIMULATED · NOT CONFIRMED"**, plus the persistent banner text **"SIMULATED — NOT CONFIRMED WITH THE PROVIDER. We have not actually contacted [provider name]. Every answer below is an AI estimate; confirm directly with them before booking or paying anything."** — static copy, not derived from data, shown once per screen.
- Never phrase a simulated answer as a fact (no "Available on your date," must read like an estimate — "looks likely open based on their listed availability — not a confirmed booking"). This applies to every field a simulated answer might touch, explicitly including availability, price, and policies, since those are the ones most easily misread as a commitment.
- `answer.generatedAt` may be shown (e.g. "just now") but is decorative — never implies a timestamp of real contact.

**On failure** (502/500 from the select call) → Error State; retry re-issues the same `POST /providers/select { candidate }` call.

**Return path (State 8 — "user can return to the provider comparison")**: the "Back to your matches" CTA navigates back to the Recommendations screen using the **already-held `providers` array in memory** — no new `POST /providers` call, nothing changed on the server (selection writes no session state, per D14). Selecting a different provider afterward is a fresh `POST /providers/select` call with that provider's candidate; nothing needs to be re-fetched.

### 7. Error State (`ErrorState.dc.html`)

One reusable component, used after any of: `POST /providers` failure,
`POST /providers/select` failure. Retry always **re-issues the exact
same failed request with the same inputs** — it never silently routes
elsewhere or drops what the user already entered. The chat "What I
know so far" state is never lost on this screen (nothing about a
provider-search failure invalidates the conversation).

## Cross-cutting rules

- **Never imply the provider was contacted.** No screen, anywhere,
  uses wording like "we asked them," "they said," "confirmed with
  provider" for anything in the SIMULATED bucket.
- **FACT and INFERRED are always visually distinguishable** — never
  merged into one list, never share a badge/color treatment. This
  holds even if a future screen adds new content; it's a system rule,
  not a one-screen rule.
- **The comparison list length is always data-driven** (`providers.length`, 1–5), never a hardcoded count anywhere in the implementation.
- **"What I know so far" is read-only supporting context in this
  frozen baseline** — it is never presented as a form, never blocks
  the chat, and (per Open Decisions #3) editing it directly is
  explicitly out of scope for the first M15 pass.

## Open decisions resolved for handoff

These aren't new UX — they're implementation-behavior calls needed to
build against the frozen screens without guessing:

1. **Reopening "Chat" after providers are shown** re-opens the full
   transcript on the same session. A new free-text message still goes
   through the normal `POST .../message` (which has no phase gate —
   confirmed in `server.ts`/task-12), even after `ready_for_search`.
   If that message changes anything relevant, the client re-calls
   `POST /providers` to refresh the comparison list.
2. **Selecting more than one provider in a session** is unrestricted —
   the user can open details / select any provider any number of
   times; each selection is an independent, stateless
   `POST /providers/select` call.
3. **Editing an already-known chip directly (tap-to-edit) is deferred**,
   not part of this M15 baseline. Corrections happen by saying so in
   chat — `mergeExtraction`'s "latest non-null mention wins" policy
   already supports this with no backend change.
4. **Sort/filter controls on the comparison list are decorative in
   this baseline.** The array is already ranked; building real
   client-side sort/filter is a follow-up, not required for M14's
   frozen scope.
5. **Error retry always repeats the same failed call** with the same
   inputs — never a different recovery path.

## Assignment alignment (self-check, `assignment-review`)

- Chat-based conversational gathering, one message satisfying several
  requirements, no static questionnaire: **EXPLICIT**, Part 1 items
  1–5 and the "20-question form" evaluation criterion.
- ~3–5 provider cards, comparable, showing match/price/rating/why:
  **EXPLICIT**, Part 2 ("approximately 3-5") and Part 6's example
  card fields.
- FACT vs INFERRED vs SIMULATED clearly and structurally distinct,
  simulated never implying real contact: **EXPLICIT**, Part 5 ("This
  distinction is important") and the Trust & Grounding evaluation
  criterion (explicitly called "particularly important").
- Selection-triggered M10/M11 (not run for all candidates up front):
  **PROJECT DECISION** (D14), already approved before M10/M11 were
  built — this spec doesn't change that, it documents the UI
  consequence of it (no simulated data anywhere until one provider is
  chosen).
- The "one backend call covers M10+M11" note above is a
  **RECOMMENDATION**-level implementation detail (not assignment
  text) surfaced so M15 doesn't build against a request shape that
  doesn't exist.

No gaps found against Parts 1–6 for the UI surface; no scope creep —
every screen maps to an existing, already-implemented route.

## Desktop / Wide-Screen Adaptation (addendum, non-assignment scope extension, 2026-08-29)

**Status**: Confirmed direction — Concept B ("Split-Pane Workspace"),
refined by direct user instruction. Visual reference: `design/m14-desktop/`
(source `.dc.html` per state) and the published canvas at
https://claude.ai/code/artifact/6f6873fc-b610-481d-9609-6a20c744fb58
(six states: initial chat, comparison, provider details, simulated Q&A,
reopened chat, right-pane-only error). **This section is NOT part of the
graded assignment scope.** `docs/Home Assignment.pdf` never mentions
desktop/web support; `assignment-review` confirmed it is not EXPLICIT
and not on the Bonus list, and is in tension with the assignment's own
"we care more about... than production-grade infrastructure or visual
polish" framing. Pursued anyway as a deliberate personal/portfolio
extension (the user's stated reason: an interviewer will most likely
run and evaluate the app in a desktop browser). See
`memory-bank/decisions.md` D19. **Do not cite this section in
README.md/DESIGN.md's assignment-facing text as satisfying any Part
1–6 requirement or Bonus item.**

**Does not change**: screens 1–7 above, the backend, D18's five-value
`Screen` state machine, or any API contract. This is purely a desktop
*layout* over the exact same state and screens already specified. No
grid (explicitly rejected), no React Navigation, no new persistence.

### Layout gate — no new application state

Desktop split-pane activates purely as a function of two values the
app already holds:
- viewport width ≥ `DESKTOP_BREAKPOINT` (proposed: `1024`px — a single
  binary breakpoint, no separate tablet tier)
- `providers !== null` (the same in-memory `ProviderScore[]` screen 3
  already holds once a search succeeds)

Below the breakpoint, or before `providers` is ever populated, layout
is **single-pane, full-width/centered** — identical to the mobile spec
above. This covers Chat and the Transition/loading screen, since
neither has provider data yet. Once `providers` is non-null, wide
viewports switch to the two-pane layout below, and it **stays active**
for the rest of the session — including when the user reopens chat —
because `providers` is never cleared once fetched (existing rule, see
screen 5/6's return-path note).

No new `Screen` value and no new boolean (e.g. `isSplitOpen`) are
introduced. The existing `screen` state still drives *what* renders,
exactly as today; the desktop layout only decides *where* it renders
(full pane vs. right pane) and adds one always-visible left pane once
the gate above is open.

### Left pane — Context Panel (new presentational component only)

Purely derived from data the app already has — nothing new to fetch:
- Header: `state.serviceCategory` + `state.coreAttributes.{dateTime,location}`.
- Requirement list: the same fields already driving the mobile "What I
  know so far" chips (screen 1) — read-only, same Open Decision #3
  (no inline editing) — rendered as a compact list instead of chips.
- "`{providers.length}` matches found" once `providers` exists.
- When `screen` is `providerDetails`, the M10/M11 loading state, or
  `simulatedQA`: a "Currently viewing: `{candidate.fields.name?.value
  ?? hostname(candidate.url)}`" line, derived from the already-held
  `selectedCandidate` local variable — not new state, just a new place
  to surface something already tracked.
- One button: **"Back to chat"** (when `screen !== "chat"`) / **"Back
  to matches"** (when `screen === "chat"`) — the explicit "Back to"
  wording on both states makes clear pressing it returns you
  somewhere, not that it opens something new. Styled as a light
  accent (not solid black) to de-emphasize it relative to the primary
  content. Clicking it only ever sets `screen` — the same transition
  D18 already performs for reopening chat / returning to the list; no
  new transition logic.

The panel never disappears once shown, regardless of which right-pane
screen is active — that's what makes context "always visible" rather
than "sometimes visible."

### Right pane — existing screens, internally unchanged

Renders exactly the current `screen`'s existing component
(`ChatScreen`, `RecommendationsScreen`, `ProviderDetailsScreen`, the
M10/M11 loading animation, `SimulatedQAScreen`, or `ErrorState`),
constrained to a max content width (proposed ~900px, centered within
the pane) so it doesn't stretch edge-to-edge on very wide monitors.
**`RecommendationsScreen` keeps its existing vertical-list rendering
(screen 3 above, unchanged) — no grid.** All `providers.length` (1–5)
rows stay visible, same as mobile.

### Screen-by-screen desktop behavior

1. **Chat, before `providers` exists** — single-pane, centered,
   identical to mobile screen 1. No left panel yet — nothing stable to
   summarize until at least one search has run.
2. **Transition/search loading** — still single-pane (`providers` is
   still `null` here) — identical to mobile screen 2.
3. **Recommendations** — the layout gate opens the instant this screen
   is reached (the `POST /providers` call that got here is what
   populated `providers`). Left pane appears; right pane shows the
   same vertical ranked list as mobile screen 3, unchanged.
4. **Provider details** — right pane swaps to `ProviderDetailsScreen`
   (mobile screen 4); left pane stays, now showing "Currently viewing:
   `<name>`". **Revised by task-62**: the screen itself now opens with
   a `SelectedProviderHeader` (eyebrow label + provider name) at the
   top, rendered identically on mobile and desktop — see task-62's
   Assignment Alignment for the rationale (the missing-header
   readability gap existed identically on both surfaces, so a
   desktop-only fix would have left mobile, the assignment's actual
   required delivery surface, with the same gap).
5. **M10/M11 loading + simulated answers** — right pane swaps through
   the same cosmetic loading animation then `SimulatedQAScreen`
   (mobile screens 5/6); left pane stays, same "Currently viewing"
   line. **Revised by task-62**: `SimulatedQAScreen`'s results phase
   also now opens with the same `SelectedProviderHeader`, before the
   frozen SIMULATED banner (banner copy itself unchanged) — same
   mobile/desktop-identical rationale as screen 4 above.
6. **Reopening chat** — left pane's button sets `screen = "chat"`;
   right pane swaps to `ChatScreen`; the left pane's requirement list
   and provider count are untouched (derived from `state`/`providers`,
   neither of which changes just because chat is open). A message that
   changes requirements re-triggers `POST /providers` exactly as today
   (mobile Open Decision #1); right pane cycles `chat →
   (in-pane loading indicator) → recommendations`; left pane's
   requirement list updates live as new `state` comes back.
7. **Errors** — if `POST /providers` fails before `providers` ever
   existed, it's the existing full single-pane `ErrorState` (mobile
   screen 7). If `POST /providers/select` fails after `providers`
   already exists, only the **right pane** shows `ErrorState` — the
   left pane and its context stay visible, an improvement over
   mobile's full-screen error for this case, at no extra cost (same
   component, just pane-constrained).

### Desktop-only open decision — resolved

- **Mid-session refresh loading state (item 6 above)**: **Resolved,
  confirmed by test, not built as new code** (task-58). Since
  `providers` is never nulled out while a chat-triggered refresh is in
  flight, `showSplitPane` (`isDesktop && providers !== null`) never
  flips back to `false` mid-refresh — the existing `TransitionScreen`
  simply renders inside the already-open right pane for free, with no
  special-cased loading component or container-width change needed.
  Verified by `frontend/src/App.test.tsx`'s "a chat-triggered refresh
  shows TransitionScreen in the right pane while ContextPanel stays
  mounted throughout" test.

### Assignment alignment (self-check)

No backend change, no new persistence, no new application state beyond
deriving layout from `providers !== null` + viewport width (both
already-held/available values), no React Navigation, no grid, and
screens 1–7 / D18's state machine unchanged. This entire addendum is
**NOT** assignment-required or bonus-listed.

## Next step

M15 (frontend implementation) task files are not created by this
document — per this project's one-milestone-at-a-time task-creation
convention, that's a separate PIV cycle to start when explicitly
requested. The same applies to this desktop addendum: a task file (or
set of task files) implementing it must be proposed and approved
separately before any frontend code changes.
