# Task 26: Fix Google/Yelp/provider-website source-type classification bugs
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Fix two classification bugs in `classifySourceType`
  (`backend/src/research/assembleInferredTags.ts`) found during the
  post-M8 review: (1) Google/Yelp detection uses substring
  `.includes()` instead of a proper hostname/domain-suffix match, so
  a lookalike hostname like `notgoogle.com` or `mygoogle.example.com`
  would be misclassified as `"google"`; (2) provider-website detection
  uses exact hostname string equality, so a `www.` prefix mismatch
  between M7's discovered `candidate.url` and the enrichment search's
  result URL (a realistic, observed-as-plausible scenario, not
  contrived) causes a provider's own site to be misclassified as
  `"other"` instead of `"provider_website"`.
- Inputs: existing `classifySourceType(url, providerUrl)` in
  `assembleInferredTags.ts`; existing test suite in
  `assembleInferredTags.test.ts`.
- Outputs: `classifySourceType` updated so:
  - `google.com`, `www.google.com`, `maps.google.com` → `"google"`;
    `notgoogle.com`, `mygoogle.com` → NOT `"google"`.
  - `yelp.com`, `www.yelp.com` → `"yelp"`; `notyelp.com` → NOT
    `"yelp"`.
  - `provider_website` match is insensitive to a leading `www.` on
    either side (e.g. `candidate.url` host `bouncepalace.com` vs.
    enrichment result host `www.bouncepalace.com` → still
    `"provider_website"`).
- Constraints:
  - Fix only `classifySourceType`'s matching logic. Do not change its
    signature, its call sites, the `SourceType` enum, or
    `assembleInferredTags`'s own logic beyond what's needed to call
    the fixed function.
  - Do not add a maintained TLD/domain list, a domain-parsing
    dependency, or handle multi-part public suffixes (e.g.
    `co.uk`-style) — out of scope; a simple exact-match-or-subdomain
    suffix check (`hostname === "google.com" ||
    hostname.endsWith(".google.com")`) is sufficient here, consistent
    with the project's "simplest solution that satisfies the task"
    guideline.
  - `www.` normalization: strip only a literal leading `www.` before
    comparing — no full public-suffix normalization, no handling of
    other subdomain prefixes (e.g. `m.`, `en.`) — out of scope per the
    reviewer's explicit exclusion list.
  - Explicitly DO NOT implement (per reviewer instruction): excerpt
    verification, trust scoring, source weighting, ranking, a Google
    Reviews API/integration, `"directory"` detection, retries,
    parallelism. None of these are touched by this task.
  - Do not change overall M8 architecture, file structure, or the
    `enrichProviderCandidates` orchestration flow.
  - The already-documented M8 limitation — that generic review
    enrichment can surface provider-owned testimonials rather than
    independent customer reviews — stays recorded as-is in
    `decisions.md`; this task does not attempt to resolve it (that
    would be trust/source weighting, explicitly excluded above).
- Open Questions: none. Reviewer's prior message specified exact
  input/output examples for both fixes.

## Assignment Alignment
- Requirement type: RECOMMENDATION (bug fix arising from review, not
  itself a new assignment requirement)
- Assignment requirement: supports Part 5 / "Trust & Grounding"
  evaluation criterion indirectly — `sourceType` is the mechanism M8
  uses to distinguish evidence provenance, and these are correctness
  bugs in that mechanism, not new scope.
- Source: post-M8 review (this conversation, 2026-08-28), sections 4
  and 8.
- Rationale: The M8 review was accepted as PASS WITH ISSUES
  specifically conditioned on these two fixes before M8 is considered
  closed. No new capability is added; existing intended behavior
  (correct Google/Yelp/provider-website detection) is restored.
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/research/assembleInferredTags.ts`
- MODIFY: `backend/src/research/assembleInferredTags.test.ts`
- DO NOT TOUCH: `backend/src/domain/evidence.ts`,
  `backend/src/domain/provider.ts`,
  `backend/src/llm/reviewAnalysis.ts`,
  `backend/src/research/enrichProviderCandidates.ts`,
  `backend/src/research/enrichProviderCandidates.test.ts`,
  `backend/src/research/enrichmentQuery.ts`, `backend/src/server.ts`,
  `backend/src/conversation/**`.

### Implementation Notes
- Suggested shape (not prescriptive of exact code, but the intended
  approach): a small local helper, e.g.
  `hostnameMatches(hostname, domain)` returning
  `hostname === domain || hostname.endsWith("." + domain)`, used for
  the Google (`"google.com"`) and Yelp (`"yelp.com"`) checks in place
  of `.includes()`.
- For provider-website comparison: strip a literal leading `"www."`
  from both `hostname` and `providerHostname` (via a small
  `stripWww(hostname)` helper or inline `.replace(/^www\./, "")`)
  before the equality check.
- Keep `classifySourceType`'s existing check order (provider_website
  → google → yelp → other) and its `"directory"` non-detection
  unchanged.

## VALIDATE
### Unit Tests
- [ ] `google.com` → `"google"`.
- [ ] `maps.google.com` → `"google"`.
- [ ] `notgoogle.com` → NOT `"google"` (falls through to `"other"`
      given an unrelated `providerUrl`).
- [ ] `mygoogle.com` (or similar substring-only lookalike) → NOT
      `"google"`.
- [ ] `yelp.com` → `"yelp"`.
- [ ] `www.yelp.com` → `"yelp"`.
- [ ] `notyelp.com` → NOT `"yelp"`.
- [ ] `providerUrl` host `bouncepalace.com` vs. evidence `url` host
      `www.bouncepalace.com` → `"provider_website"` (and the reverse:
      `providerUrl` with `www.`, `url` without).
- [ ] Exact-hostname-match case (both with or both without `www.`)
      still classifies as `"provider_website"` (no regression).
- [ ] Existing pre-fix tests in `assembleInferredTags.test.ts` (google/
      yelp/other/provider_website happy paths, `assembleInferredTags`
      wrapping behavior) still pass unmodified in intent, updated only
      if their fixture data was itself relying on the old buggy
      behavior.

### Component / Integration Tests
- N/A — `classifySourceType` is a pure function with no I/O; existing
  `enrichProviderCandidates` integration tests already cover it
  indirectly and should continue passing unchanged.

### E2E Tests
- N/A.

### Success Criteria
- [ ] All new/updated tests pass.
- [ ] Full existing suite still passes (155 pre-existing + new).
- [ ] `npm run build` clean.
- [ ] No behavior change to anything other than `classifySourceType`'s
      matching logic.

## ITERATE
### Outcome
Implemented exactly as planned, no deviations. In
`backend/src/research/assembleInferredTags.ts`, `classifySourceType`
now uses two small local helpers instead of `.includes()`/exact
equality:
- `hostnameMatches(hostname, domain)` — `hostname === domain ||
  hostname.endsWith(`.${domain}`)`, used for `"google.com"` and
  `"yelp.com"` checks.
- `stripWww(hostname)` — strips a literal leading `"www."` — applied
  to both sides before the provider-website equality check.

Check order (provider_website → google → yelp → other) and the
`"directory"` non-detection are unchanged, per constraint.

10 new tests added to `assembleInferredTags.test.ts`'s
`classifySourceType` describe block: bare `google.com`,
`maps.google.com` subdomain, `notgoogle.com`/`mygoogle.com` lookalikes
(both correctly NOT `"google"`), bare `yelp.com`, `www.yelp.com`,
`notyelp.com` lookalike (NOT `"yelp"`), `www.`-prefix mismatch in
both directions for provider_website, and a no-regression check for
the already-exact-match case. All 10 pass. No existing test needed
modification — none of the pre-existing tests relied on the buggy
substring/exact-match behavior.

`npm run build` clean. `npm test`: 165/165 passing (155 pre-existing +
10 new), no live network calls, no regressions.

### Knowledge Updates
- `decisions.md`: no new architectural decision — this is a bug fix
  to already-decided behavior (D7 addendum's provenance-structure
  scope), not a new tradeoff. No entry needed beyond `progress.md`.
- `progress.md`: record task-26 as DONE, closing out M8 per the
  reviewer's post-M8-review conditions. The M8 finding that generic
  review enrichment can surface provider-owned testimonials rather
  than independent third-party reviews remains recorded as-is in
  `decisions.md`'s M8-review-adjacent findings — not addressed by
  this task (explicitly out of scope: trust scoring/source weighting
  were excluded by the reviewer).
- `DESIGN.md`: not touched — this is an internal correctness fix with
  no new assumption, deterministic/LLM split, optimization, or
  production-evolution point to surface; the existing DESIGN.md
  content (if any) about source-type classification already describes
  intended behavior, which this task now actually delivers.

### Follow-ups
- None new. Previously identified and explicitly deferred (per
  reviewer's do-not-implement list, unchanged by this task): excerpt
  verification, trust scoring, source weighting, ranking, a dedicated
  Google Reviews mechanism, `"directory"` detection, retries,
  parallelism.
