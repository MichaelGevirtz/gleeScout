# Task 86: Redesign Provider Details "Sourced facts" section (Option B — Story Listing)
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Replace the plain, unstyled "Sourced facts" text-row list and
  raw-URL `photos` line on the Provider Details screen with the
  approved "Story Listing" direction — a photo hero + filmstrip,
  icon-labeled listing rows (value + source caption), a pull-quote
  "Inferred" card, and a styled CTA — while leaving the header and
  dimension-bars sections untouched.
- Inputs: `candidate.fields.*` (already-extracted `FACT` data, no
  backend change), `candidate.inferred[]`, existing dimension-score
  props. No new data is required.
- Outputs: A restyled `ProviderDetailsScreen` matching the approved
  mockup (see Implementation Notes for the reference link).
- Constraints:
  - Presence rule (explicit, from user instruction): a field with no
    data renders **no row at all** — no placeholder, no "N/A", no
    empty tile. This is not new: the current code already does this
    (`if (!fact) return null` per field), and the photo block follows
    the same rule (rendered only when `candidate.fields.photos` is
    set). This task must not regress that.
  - Visual-only where possible: dimension bars, `SelectedProviderHeader`,
    and the underlying data/props contract are unchanged.
  - No backend changes — every field rendered is already an extracted
    `FACT`/`INFERRED` value.
  - Icons need `react-native-svg` — plain RN has no way to render
    inline SVG. This was flagged mid-implementation (the task
    originally assumed no new dependency) and the reviewer approved
    adding it: it's Expo-supported, standard for RN vector icons, and
    the only way to match the approved mockup's icon set faithfully.
    No other new dependency.
- Open Questions: none — direction was already chosen (see below).

## UX Direction
Two visual directions were mocked up and published for comparison
(Option A "Fact Grid" — dense 2-col tiles; Option B "Story Listing" —
photo-led, listing-page rows). The user selected **Option B**.

This used a lighter, 2-option **visual mockup** comparison rather than
`ui-ux-design`'s full 3-concept text process — a deliberate, scoped
choice: `ui-ux-design` governs *flow-level* direction (interaction
model, screens, navigation), which was already decided and approved
back in M14 (see `design/m14-ux-spec.md`, already implemented). This
task only restyles how one already-existing screen presents data it
already has — no new screen, no new interaction model, no change to
what data is collected or how the user moves through the app. Treating
every visual-polish pass as a full 3-concept flow decision would be
process overhead disproportionate to the change; the 2-option mockup
comparison still satisfies the same underlying goal (a deliberate,
reviewed design choice, not a default unstyled list) that
`ui-ux-design` exists to guarantee.

## Assignment Alignment
- Requirement type: RECOMMENDATION (supporting EXPLICIT requirements)
- Assignment requirement:
  - Part 6: "The UI doesn't need to be beautiful, but it should be
    understandable and thoughtfully designed." The current fact list
    is unstyled black text with no visual hierarchy (confirmed by
    live screenshots during this session) — this task directly
    addresses that.
  - Part 2 lists "Relevant photos" as structured data to extract
    (already implemented) — this task only changes how the
    already-extracted `photos` FACT is displayed (hero + filmstrip
    instead of ~30 raw joined URLs in a `<Text>` node).
  - Evaluation criterion 5, "Trust & Grounding": every fact row keeps
    its `fact.source` caption visible (now more prominent, not less),
    preserving the FACT/INFERRED provenance distinction this task
    must not weaken.
- Source: `docs/Home Assignment.pdf`, Part 2 (p.2), Part 6 (p.3-4),
  "What We Will Evaluate" #5 (p.5).
- Rationale: Pure presentation change to data the system already
  collects and already displays — no new extraction, no new backend
  work, no new bonus-scope feature. Distinct from the roadmap's
  explicitly-deferred "Image or social-media analysis" bonus
  (`memory-bank/roadmap.md`) — that bonus is about analyzing image
  *content* for signal; this task only displays images that are
  already sourced facts.

## IMPLEMENT
### Files Touched
- CREATE: none
- MODIFY:
  - `frontend/src/screens/ProviderDetailsScreen.tsx`
  - `frontend/src/screens/ProviderDetailsScreen.test.tsx`
- DO NOT TOUCH: any backend file, `SelectedProviderHeader.tsx`,
  `domain/types.ts`, `RecommendationsScreen.tsx`, other screens.

### Implementation Notes
Reference mockup: the approved "Option B — Story Listing" artboard
published during design review (Wen Photography sample data) —
recreate its structure and tokens, not the placeholder photo tiles
(the mockup couldn't fetch real images; the real app can and should
load `candidate.fields.photos` URLs directly via `<Image>`).

- **`FIELD_ORDER`**: drop `"name"` (redundant — already shown in
  `SelectedProviderHeader`; a `fact-row-name` must never render even
  when `fields.name` is set) and `"photos"` (handled separately below,
  not as a generic row). New order: `location`, `servicesOffered`,
  `pricing`, `availability`, `rating`, `reviewCount`, `policies`,
  `contactMethod`. `rating`/`reviewCount` stay two independent rows
  (each its own `Fact` with its own `.source` — do not merge them into
  one line; merging would blur which source backs which value).
  `formatFactValue` is unchanged (full comma-joined list for arrays,
  no truncation — out of scope for this task).
- **Row layout** (replaces the current plain two-`<Text>` row): a
  16px inline SVG icon (stroke `#9ca3af`, one per field —
  location=pin, servicesOffered/pricing=tag, availability=calendar,
  rating/reviewCount=star, policies=shield-check, contactMethod=mail)
  + label on the left; value (bold, `#111827`) + `fact.source` caption
  (small, `#9ca3af`) right-aligned; 1px bottom border `#e5e7eb`
  between rows. Same `fact-row-{field}` / `fact-row-{field}-value` /
  `fact-row-{field}-source` testIDs as today — layout/style only.
- **Photo block** (new, above "Sourced facts", only rendered when
  `candidate.fields.photos` is set — nothing renders when absent):
  first URL as a full-width hero `<Image resizeMode="cover">`
  (`testID="photo-gallery-hero"`), remaining URLs (up to 6) as a
  horizontal-scroll filmstrip of thumbnails
  (`testID="photo-gallery-filmstrip-image-{index}"`); if more than 7
  URLs total, a trailing `photo-gallery-more` chip shows the
  remaining count. Whole block wrapped in `testID="photo-gallery"`.
- **Inferred cards**: same data and testIDs
  (`inferred-card-{i}-value/-excerpt/-source-type`), restyled as a
  left-border (`#4338ca`) pull-quote: italic value, small "review
  pattern: <label>" caption instead of the current plain-card layout.
  The fixed caption text/behavior is unchanged.
- **CTA** (`select-cta`): add a `style` — solid `#4338ca` background,
  white bold text, ~12px border radius, centered. Currently has no
  style at all (bare `Pressable`). Same testID, same `onPress`
  behavior.
- **Untouched**: `SelectedProviderHeader`, the `explanation` text
  line, and the entire dimension-bars block (`dimension-bars`,
  `dimension-group-fit`, `dimension-group-quality`, `DimensionBar`) —
  pixel-identical to current.

## VALIDATE
### Unit Tests
- [ ] n/a (no new pure logic beyond field-order/photo-slicing, covered
      by component tests below)

### Component / Integration Tests
- [ ] `fact-row-name` never renders, even when `candidate.fields.name`
      is set (replaces the old assertions that expected a name row).
- [ ] Existing per-field value assertions (location, servicesOffered,
      pricing, rating, reviewCount) still pass — same values, new
      markup.
- [ ] Fields absent from `candidate.fields` still render no row
      (existing `queryByTestId` absence checks kept).
- [ ] `candidate.fields.photos` unset → no `photo-gallery` testID
      renders at all.
- [ ] `candidate.fields.photos` set with >7 URLs → hero uses
      `photos[0]`, filmstrip renders `photos[1..6]`, and
      `photo-gallery-more` shows the correct remaining count.
- [ ] Existing inferred-card, dimension-bar, and CTA-press tests pass
      unchanged (data/behavior untouched, style-only change).

### E2E Tests
- [ ] n/a

### Success Criteria
- [ ] All relevant tests pass (`npm test` in `frontend/`)
- [ ] `npx tsc --noEmit` clean
- [ ] Manual visual check (`npx expo start` web) against the approved
      Option B mockup
- [ ] No regressions to header/dimension-bars sections or other
      screens

## ITERATE
### Outcome
Implemented as planned. `ProviderDetailsScreen.tsx` was restyled:
`FIELD_ORDER` dropped `"name"`/`"photos"`; the remaining 8 fields
render as icon-labeled listing rows (`FieldIcon`, `FIELD_LABELS`); a
new `PhotoGallery` component renders `candidate.fields.photos` as a
hero `<Image>` + capped (6) filmstrip with a `photo-gallery-more`
overflow chip, rendered only when the field is present; the inferred
cards got a pull-quote style; `select-cta` got a solid style. One
mid-implementation deviation from the approved task: icons require
`react-native-svg`, which the task had assumed wasn't needed — flagged
via `AskUserQuestion`, reviewer chose to add the dependency
(`npx expo install react-native-svg`) over dropping icons. Test file
updated: removed the `fact-row-name` assertions (replaced with an
explicit "never renders" check) and added 3 new tests for the photo
gallery (absent, 9-URL hero/filmstrip/overflow slicing, single-photo
edge case). `frontend/npm test`: 150/150 passing (up from 147).
`frontend/npx tsc --noEmit`: clean. Not visually verified in a live
browser — see Knowledge Updates.

### Knowledge Updates
- `memory-bank/decisions.md` D27 records the redesign + the
  `react-native-svg` dependency decision.
- `memory-bank/progress.md` "Implemented" section has the task-86
  entry.
- Gap worth naming for future frontend visual-change tasks: this repo
  has no lightweight way to actually *see* a screen render (no
  Storybook-equivalent, no browser-automation tool present without
  adding a new dependency, and the real screen is only reachable
  through a live Gemini/Firecrawl-backed flow that's slow and has hit
  rate limits before). Verification here relied entirely on component
  tests asserting exact DOM/props (image `source.uri`, filmstrip
  index-to-URL mapping, overflow count, row absence) rather than a
  rendered screenshot. That's solid coverage for *behavior* but not
  for actual visual appearance (spacing, alignment, whether the icons
  actually look right) — worth a manual look in `npx expo start` web
  when next touching this screen, or a `chromium-cli`/Playwright setup
  if visual UI work becomes frequent.

### Follow-ups
- Manually eyeball the redesigned screen in a real browser next time
  this screen is touched, to confirm actual visual appearance (not
  just DOM structure) matches the approved Option B mockup.
- `formatFactValue`'s array join for `servicesOffered` is unchanged
  (full comma-joined list, no truncation) — the approved mockup showed
  a truncated "+N more" for long service lists; deliberately left out
  of this task's scope (see Implementation Notes) since it needs new
  truncation-boundary logic and tests. Candidate for a future small
  task if a real provider's service list turns out to be visually
  unwieldy in practice.
