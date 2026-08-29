# Task 17: Firecrawl ResearchProvider boundary (search + scrape)
Status: DONE
Can run in parallel with: task-18 (different files —
`research/firecrawlProvider.ts` vs `llm/providerExtraction.ts` —
neither depends on the other's output; both are only consumed
together by task-20)

## PLAN
- Goal: A thin, injectable wrapper around Firecrawl's search
  capability that returns, per result, both the discovery metadata
  and the scraped page content — the sole external research
  integration, isolated behind D3's boundary.
- Inputs: a query string (from task-16) and a result-count `limit`;
  no `ConversationState` dependency — this module knows nothing about
  conversations.
- Outputs: `backend/src/research/firecrawlProvider.ts` exporting:
  - `SearchedPage` type: `{ result: DiscoveredResult; markdown: string
    | null }` (`DiscoveredResult` reused from task-15's
    `backend/src/domain/provider.ts`; `markdown: null` means Firecrawl
    surfaced the URL but scraping that specific page failed — the
    overall request still succeeded).
  - `FirecrawlClient` interface: the minimal shape this module needs
    from the Firecrawl SDK/HTTP client, kept separate from Firecrawl's
    own types (mirrors `GeminiClient` in `geminiClient.ts`).
  - `searchProviderPages({ query, limit, client? }):
    Promise<SearchedPage[]>` — `client` injectable, defaults to a real
    client built from `FIRECRAWL_API_KEY`.
  - `FirecrawlConfigError` — thrown if `FIRECRAWL_API_KEY` is unset
    (mirrors `GeminiConfigError`).
- Constraints:
  - No Gemini call, no dedup/cap logic (task-19's job), no
    orchestration.
  - Whole-request failure (network/auth/API error) propagates to the
    caller as a thrown error — does not get caught/swallowed here.
  - A single result within an otherwise-successful response having no
    scraped content is represented as `markdown: null`, not an
    exception — deciding what to do with it (skip, keep) is task-19/20's
    job, not this boundary's.
  - **This whole-request-failure vs. per-result-scrape-failure
    distinction is load-bearing and must be preserved exactly** —
    it's what lets task-20 treat "Firecrawl is down" (operation-level,
    propagate) differently from "this one page didn't scrape"
    (candidate-level, skip and continue). Collapsing the two into one
    failure mode would break that separation.
  - **The exported boundary (`SearchedPage`, `searchProviderPages`'s
    signature) must stay stable regardless of what the live API
    verification finds** — if combined search+scrape turns out
    unsupported and this module falls back to two sequential Firecrawl
    calls internally (per the Open Questions note below), that is an
    internal implementation detail; callers (task-20) must not need to
    change.
  - Do not touch `backend/src/domain/**` (beyond importing
    `DiscoveredResult`), `backend/src/llm/**`,
    `backend/src/conversation/**`, `backend/src/server.ts`.
- Open Questions: the exact current Firecrawl Node SDK package name
  and `/search` request/response shape (including whether it truly
  supports combined search+scrape via a single call with
  `scrapeOptions`, as assumed in the M7 architecture review) must be
  verified live at implementation time — per D2a's precedent
  (Gemini's SDK/model name was verified live rather than assumed from
  training data). If combined search+scrape turns out unsupported,
  fall back to two sequential Firecrawl calls per result (search, then
  scrape) inside this same module — that's an implementation detail,
  not a scope change, since the exported `SearchedPage` shape stays
  the same either way.

## Assignment Alignment
- Requirement type: PROJECT DECISION (mechanism), reinforcing an
  EXPLICIT requirement
- Assignment requirement: Part 2 allows "search APIs... or any other
  data source you believe is useful" for finding providers.
- Source: `docs/Home Assignment.pdf`, Part 2 (page 2).
- Rationale: Confirms existing decision D3 (Firecrawl is the sole
  research integration, isolated behind a small boundary module) —
  the M7 architecture review independently verified this is still the
  right call rather than assuming it (Firecrawl's own search already
  covers general web search; direct Google/Bing/social integrations
  would be redundant/out of scope, per that review).
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/research/firecrawlProvider.ts`
- CREATE: `backend/src/research/firecrawlProvider.test.ts`
- MODIFY: `backend/package.json` (add the Firecrawl SDK dependency,
  same pattern as `@google/genai` in task-05)
- DO NOT TOUCH: `backend/src/domain/conversation.ts`,
  `backend/src/domain/evidence.ts`, `backend/src/llm/**`,
  `backend/src/conversation/**`, `backend/src/server.ts`.

### Implementation Notes
- Mirror `geminiClient.ts`'s exact shape: a minimal client interface
  + one exported function + an injectable `client` param defaulting to
  a real client, no SDK types leaking past this file.
- `FIRECRAWL_API_KEY` is already documented in `.claude/CLAUDE.md`'s
  Environment section — no new env var naming decision needed.
- Tests use an injected fake client (no live network calls in the
  automated suite), same as `geminiClient.test.ts` — a manual
  real-API check is a separate, non-blocking validation step (same
  pattern as task-05's outcome).

## VALIDATE
### Unit Tests
- [ ] A fake client returning N results with scraped content maps
      correctly into N `SearchedPage` objects (`result` + `markdown`
      populated).
- [ ] A fake client returning a result with no scraped content for one
      URL maps that entry to `markdown: null`, not an exception.
- [ ] Missing `FIRECRAWL_API_KEY` (no injected client, no env var)
      throws `FirecrawlConfigError`.
- [ ] A fake client that throws (simulating a whole-request failure)
      causes `searchProviderPages` to reject — the error propagates,
      it is not caught/swallowed.
- [ ] `limit` is passed through to the underlying client call
      unchanged.

### Component / Integration Tests
- N/A — no consumers yet (task-20 wires it in).

### E2E Tests
- N/A. Manual real-API smoke check recommended at completion (non-
  blocking, same as task-05/06's pattern), not required for automated
  `npm test`.

### Success Criteria
- [ ] All new tests pass; existing suite still passes.
- [ ] `npm run build` clean.
- [ ] No live network calls in `npm test`.
- [ ] SDK types never leak past `firecrawlProvider.ts`.

## ITERATE
### Outcome
`backend/src/research/firecrawlProvider.ts` — `searchProviderPages({
query, limit, client? }): Promise<SearchedPage[]>`, `SearchedPage` (`{
result: DiscoveredResult; markdown: string | null }`),
`FirecrawlConfigError`. Live API verification performed (per D2a's
precedent) by installing `@mendable/firecrawl-js` (v4.30.0) and
reading its shipped type declarations directly, rather than assuming
the shape discussed in the M7 review:
- Combined search+scrape **is** real and supported:
  `firecrawl.search(query, { limit, scrapeOptions: { formats:
  ["markdown"] } })` — the assumption held, no two-call fallback
  needed.
- **One correction found and applied**: the real SDK exports its own
  class literally named `FirecrawlClient`. Naming this module's own
  minimal boundary interface `FirecrawlClient` (the task's original
  working name) would have collided/shadowed the real export it's
  meant to stay decoupled from — renamed to `FirecrawlSearchClient`.
  Purely a naming fix; the exported `SearchedPage`/`searchProviderPages`
  contract is unchanged.
- **One shape nuance not anticipated in planning**: when
  `scrapeOptions` is requested, Firecrawl's `search()` response items
  come back as `Document` objects with `url`/`title`/`description`
  nested under `metadata`, not at the top level (top-level shape is
  only used for un-scraped results). Handled via `mapFirecrawlItem`,
  which normalizes both possible item shapes into one internal
  `FirecrawlSearchResultItem` before anything crosses this module's
  public boundary — SDK types (`SearchResultWeb`, `Document`) are used
  only inside that one internal function, never in the exported
  interface, preserving the "SDK types never leak past this file"
  success criterion.
`backend/package.json` gained `@mendable/firecrawl-js` as a
dependency. 5 new tests (N-result mapping; no-scraped-content →
`markdown: null`; missing `FIRECRAWL_API_KEY` → `FirecrawlConfigError`;
whole-request failure propagates unchanged; `limit` passed through
unchanged), all against an injected fake client — no live network
calls (no real `FIRECRAWL_API_KEY` was available in this environment,
so the manual real-API smoke check from Success Criteria's "non-
blocking" allowance is deferred, same pattern as task-05/06/11/12's
Gemini quota-blocked manual checks). `npm test` 101/101 passing (96
prior + 5 new), `npm run build` clean, no regressions. Whole-request-
failure-vs-per-result-scrape-failure distinction preserved exactly as
specified.

### Knowledge Updates
- `memory-bank/decisions.md`: D3 addendum worth recording —
  `firecrawlProvider.ts` confirms Firecrawl's real `/search` endpoint
  supports combined search+scrape via `scrapeOptions`, and documents
  the `FirecrawlClient` naming collision correction and the
  `metadata`-nested-fields shape nuance, for anyone touching this file
  later.
- `memory-bank/progress.md`: record task-17 completion.

### Follow-ups
- Manual real-API smoke check against a real `FIRECRAWL_API_KEY` is
  still outstanding (no key available in this environment) — non-
  blocking, same status as several prior Gemini-integration tasks'
  deferred manual checks.
