# Task 50: Provider comparison (Recommendations) screen component
Status: DONE
Can run in parallel with: 47, 48, 49, 51, 52, 53

## PLAN
- Goal: build State 3 — the comparison-first list of 1-5 ranked
  providers — per `design/m14-ux-spec.md` screen 3, the direct
  implementation of the assignment's "approximately 3-5 provider
  cards" requirement.
- Inputs: task-46's types (`ProviderScore`); `design/m14-ux-spec.md`
  screen 3 section in full (exact per-row field derivation rules,
  dynamic-length requirement).
- Outputs: NEW `frontend/src/screens/RecommendationsScreen.tsx`:
  ```
  Props: {
    providers: ProviderScore[];
    onSelectRow: (provider: ProviderScore) => void;
  }
  ```
  Renders `providers.length` rows (never hardcoded to 3/4/5, never
  padded with empty placeholder rows), each showing, per the spec's
  exact derivation rules:
  - Rank = 1-based index in the array (already sorted server-side).
  - Name = `candidate.fields.name?.value`, else the hostname parsed
    from `candidate.url`.
  - Price = `candidate.fields.pricing?.value`, else an em-dash — never
    invented.
  - Rating = `candidate.fields.rating?.value` (+ `reviewCount?.value`
    if present).
  - "N facts sourced" = count of non-null keys in `candidate.fields`.
  - "N inferred" = `candidate.inferred?.length ?? 0`.
  - "Signals: X / 5" = count of non-null entries in `dimensionScores`.
  - One-line rationale = `explanation`, rendered verbatim (already a
    short deterministic sentence from the backend).
  A decorative, non-functional sort control (per Open Decision #4 —
  real client-side sorting is explicitly deferred, not part of this
  baseline). Tapping a row calls `onSelectRow(provider)` with that
  row's full `ProviderScore` unchanged — the exact object gets echoed
  through Provider Details and back to the selection API call
  unmodified, so this screen must not reshape/pick fields out of it.
- Constraints:
  - No `fetch` calls — `providers` is purely a prop; fetching and
    holding it in memory across navigation is task-54's job.
  - Does not implement real sort/filter behavior (Open Decision #4).
  - Does not hardcode any row count anywhere (test this directly with
    1-row and 5-row fixtures).
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT.
- Assignment requirement: "Try to return approximately 3-5 relevant
  providers" (Part 2); "Present the user with a clear summary and
  several provider cards. Each card should help the user quickly
  understand: Who the provider is / Why they are a good match /
  Estimated or confirmed price / Rating / reputation / ... / Why this
  provider ranks where it does" (Part 6).
- Source: Home Assignment PDF, Part 2 and Part 6.
- Rationale: this screen is the literal delivery surface for Part 6's
  "several provider cards" requirement and Part 3's "rank the
  providers... with reasoning the user can evaluate" — the per-row
  fields map directly to the card's required elements (who/why/price/
  rating/rationale), and the dynamic-length rule is a direct, tested
  answer to "approximately 3-5" (not exactly 3-5) per D14's
  documented deviation.

## IMPLEMENT
### Files Touched
- CREATE: `frontend/src/screens/RecommendationsScreen.tsx`,
  `frontend/src/screens/RecommendationsScreen.test.tsx`
- MODIFY: none
- DO NOT TOUCH: any other file under `frontend/src/`

### Implementation Notes
- A small pure helper (e.g. `hostnameFromUrl(url: string): string`,
  colocated in this file or a tiny sibling module) backs the
  name-fallback rule — keep it a plain function so it's directly unit-
  testable without rendering the component for that one case.
- `testID`s: `testID="provider-row-{index}"` and per-field testIDs
  within a row (`-name`, `-price`, `-rating`, `-facts`, `-inferred`,
  `-signals`, `-rationale`) so field-derivation tests are precise.

## VALIDATE
### Unit Tests
- [x] `hostnameFromUrl` extracts the correct hostname for a few
      representative URLs.

### Component / Integration Tests
- [x] Renders exactly `providers.length` rows for fixtures of 1, 3,
      and 5 providers — no extra/placeholder rows.
- [x] A candidate with `fields.name` present shows that name; one
      without falls back to the URL's hostname.
- [x] A candidate with `fields.pricing` absent shows an em-dash, never
      a fabricated number.
- [x] "N facts sourced" / "N inferred" / "Signals: X / 5" counts match
      a fixture with a known mix of present/absent fields.
- [x] `explanation` is rendered verbatim per row.
- [x] Tapping a row calls `onSelectRow` with that exact `ProviderScore`
      object (reference/deep-equality check, confirming no reshaping).

### E2E Tests
- N/A (covered by task-54's integration wiring).

### Success Criteria
- [x] TS compiles with no errors.
- [x] `npm test` passes, including new tests, no regressions.
- [x] No files outside `Files Touched` modified.

## ITERATE
### Outcome
Built exactly per plan, no deviations.

- Created `frontend/src/screens/RecommendationsScreen.tsx`: a
  presentational component taking `{ providers: ProviderScore[],
  onSelectRow: (provider: ProviderScore) => void }`, rendering
  `providers.length` rows inside a `ScrollView` (plain `.map()`, not
  `FlatList`, to avoid virtualization skipping off-screen rows in
  tests and because there's no fetch/pagination concern here — the
  array is already small and fully in memory). Includes a decorative,
  non-functional `testID="sort-control"` per Open Decision #4.
  Exported `hostnameFromUrl` as a standalone pure function (try
  `new URL(url).hostname`, catch → return the raw input unchanged) so
  it's unit-testable without rendering. Field derivation implemented
  exactly per `design/m14-ux-spec.md` §3: rank = 1-based index; name =
  `fields.name?.value` else hostname fallback; price =
  `fields.pricing?.value` else em-dash (`—`, U+2014); rating =
  `fields.rating?.value` (+ `reviewCount?.value` in parens if
  present), em-dash if rating itself is absent (not explicitly
  required by the VALIDATE checklist but consistent with the
  "never invent" rule for pricing); facts sourced = non-null values in
  `candidate.fields`; inferred count = `candidate.inferred?.length ??
  0`; signals = non-null entries in `dimensionScores` out of the fixed
  `DIMENSION_COUNT = 5`; rationale = `explanation` rendered verbatim.
  Tapping a row (`Pressable`, `testID="provider-row-{index}"`) calls
  `onSelectRow(provider)` with the untouched array element — no
  spread/pick — confirmed by a reference-equality (`toBe`) test.
- Created `frontend/src/screens/RecommendationsScreen.test.tsx`
  covering every VALIDATE checkbox as a real test (12 tests total):
  `hostnameFromUrl` (3 representative URLs, including a malformed-URL
  fallback case beyond what the checklist strictly required); 1-, 3-,
  and 5-row dynamic-length rendering with explicit "no row N" checks
  at each boundary; name-present vs. hostname-fallback; pricing-absent
  em-dash; a mixed-fixture test asserting exact facts/inferred/signals
  counts (3 facts, 2 inferred, 3/5 signals against a fixture built to
  produce exactly those numbers); explanation rendered verbatim;
  tap-row reference-equality check via `onSelectRow.mock.calls[0][0]`
  compared with `toBe`.

Test/tsc results:
- `npm test -- src/screens/RecommendationsScreen.test.tsx`: 12/12
  passed.
- `npm test` (full suite, checking for regressions against the other
  in-flight parallel tasks' output — `TransitionScreen`, `ErrorState`,
  `client`, `useSession`, `App`): 6 suites / 37 tests, all passed, 0
  failures.
- `npx tsc --noEmit`: no errors, no output.

No files outside the task's `Files Touched` list were modified — only
the two CREATE targets plus this task file.

### Knowledge Updates
None beyond what D17 already documents — no new tooling gotchas hit
during this task; the async `render`/`fireEvent` requirement and the
RNTL testID-regex/TextMatch query support were the only stack details
exercised, both already known from D17.

### Follow-ups
- None from this task's own scope. Real sort/filter behavior for the
  comparison list remains an explicitly deferred follow-up per Open
  Decision #4 (m14-ux-spec.md), not raised here as new — already
  tracked at the design-doc level.
