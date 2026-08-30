# DESIGN.md

This document explains the thinking behind GleeScout: the
assumptions made where the assignment left things open, the
architectural decisions and why, the optimizations considered, and
how the system would evolve for production. It's kept intentionally
high-level — implementation-level rationale and alternatives lives in
the project's internal decision log, not here.

This document grows incrementally as the project is built, rather
than being written after the fact.

## Assumptions

- Only event date/time and location are treated as universally
  required before a search can happen. Every other attribute —
  including budget — is determined dynamically per service category,
  not assumed to matter for every request.
- Any service category the user names is treated as valid; there is
  no fixed list of "supported" services.
- "Enough information to search" is a deterministic check against a
  dynamically-determined set of important attributes, not a
  fixed-length questionnaire.
- A fact's provenance is tied to a single source URL, since the
  project's only research source (web scraping) always retrieves
  information from one — not a claim that every conceivable future
  source of a fact would fit that same shape.
- Simulated information is deliberately absent from the initial
  provider-list response, even though the example provider card in
  the assignment shows a simulated field ("Available for your date
  (simulated)") on every card up front. Simulation only runs for the
  one provider the user actually selects, so the initial list is FACT
  + INFERRED + ranking rationale only, and simulated answers appear
  once a provider is selected — trading strict fidelity to the example
  layout for not spending several LLM simulation calls on candidates
  the user may never look at twice.
- Every provider card also shows a second, clearly labeled
  "(simulated)" reputation number — a deterministic blend of two
  fabricated mock lookups standing in for a Google-like and a
  Yelp-like source. This is a cosmetic, portfolio-completeness touch,
  not a real Google/Yelp integration and not a claim that either
  platform was queried; it never overwrites or merges with the
  existing FACT rating pulled from the provider's own site, and it
  plays no role in ranking or the match grade. The provider's own
  detail view repeats this same number with a quieter disclosure line
  instead of the word "(simulated)" — still honest about it being mock
  data, but visually distinct from the stronger simulated/not-confirmed
  treatment used where a user could otherwise mistake a fabricated
  answer for a real one.
- Selecting a provider means the client sends back the exact provider
  data it was already given in the list response; the server doesn't
  re-verify that data against what it originally returned. In a
  prototype with no accounts or authentication, the client and the
  server are the same trust boundary, so this is treated as
  acceptable rather than something requiring its own verification
  mechanism.
- The mobile client remembers its session id locally (so relaunching
  the app resumes the same conversation) even though the backend
  itself keeps no persistence — this is a device-local convenience for
  the person using the app, not a contradiction of the "no database/
  persistence" constraint, which is about the server. If the backend
  process has since restarted and lost that session, the app silently
  starts a fresh one rather than showing an error, since losing
  server-side state on restart is expected behavior here, not a fault.
- Resuming a session that already has enough information gathered
  (e.g. the user closed and reopened the app after finishing the
  conversation) goes straight to searching for providers rather than
  leaving the user sitting on an empty-looking chat screen with no
  next step.

## Architecture Decisions

- The LLM is responsible for understanding user intent, proposing
  which attributes matter for a given service, and phrasing
  questions and analysis in natural language. The application owns
  merging that into structured state, deciding what's still missing,
  and deciding when to move the conversation forward — the LLM never
  directly controls workflow transitions.
- Provider information is kept in three distinct categories —
  observed facts, inferred signals, and simulated responses — and
  they are never merged together, so it's always clear which is
  which.
- All session state lives in memory only, per the assignment's
  explicit constraints; nothing persists across a process restart.
- Web research is isolated behind a small, swappable boundary, so the
  specific research source is a replaceable implementation detail
  rather than something woven throughout the codebase.
- Which missing attribute gets asked about next follows a fixed,
  deterministic order rather than an LLM- or signal-informed
  priority — trivially explainable and testable, at the cost of not
  adapting to context (e.g. user-signaled urgency on a particular
  attribute). A production version could layer a scored priority on
  top without handing ordering to the LLM outright.
- Per-page provider-fact extraction is explicitly instructed to
  report a field only when the page clearly states it, returning null
  for anything absent, unclear, or merely inferred — the LLM is never
  allowed to guess or fill gaps from general knowledge about a
  business. This is what keeps extracted facts grounded before the
  application wraps them with provenance.
- A scraped page counts as a usable candidate provider as soon as it
  yields at least one useful extracted fact — not only when it yields
  a business name. Discarding a page over one missing field would
  throw away real, already-paid-for signal (e.g. pricing or rating)
  on a stricter bar than the assignment actually requires.
- A provider's reputation score is a confidence-weighted signal, not
  a raw star rating: it only counts a rating that's independently
  sourced (a Google/Yelp page, not the provider's own site) and that
  the review count backing it comes from that exact same page — a
  rating and a review count from two different pages, even if each
  looks trustworthy on its own, aren't treated as one coherent piece
  of evidence. A high rating with few reviews scores lower than the
  same rating with many.
- Matching a provider against the user's stated requirements is done
  with plain case-insensitive substring matching against the
  provider's listed services and policies, not semantic similarity —
  simple, deterministic, and testable, at the cost of missing a
  paraphrase (e.g. "kid-friendly" vs. "family-friendly"). The user's
  budget is deliberately excluded from this match so it doesn't get
  scored twice against the same requirement — it already has its own
  dedicated price-fit score, which only trusts a price when exactly
  one dollar amount can be parsed from the text and treats a range or
  multi-price listing as unparseable rather than guessing a bound.
- A provider's overall ranking score is a transparent weighted average
  of five equally-weighted dimensions (requirement match, geo fit,
  price fit, reputation, evidence quality), not a black-box model —
  any ranking can be explained by reading five numbers and one
  formula. When a dimension can't be computed for a candidate it's
  excluded and the remaining weights renormalize, so different
  candidates with different missing data stay comparable. A candidate
  with fewer than two computable dimensions scores `0` outright rather
  than renormalizing down to just one — otherwise evidence-quality
  alone (which is never missing) could carry the entire score for a
  candidate with no validated fit to what the user actually asked for.
- The provider card's user-facing match grade (Wonderful/Good/Average/
  Poor) is a deliberately narrower number than the overall ranking
  score: it's built only from how well a provider matches the user's
  stated requirements (service fit, location, price), leaving out
  reputation and evidence completeness entirely — a well-reviewed or
  well-documented provider isn't a "better match" for what the user
  specifically asked for, so those two stay visible on the card as
  their own separate signals instead of quietly inflating the grade.
  A provider with too little data on those three fit dimensions gets
  an honest "not enough information" label rather than being folded
  into "poor," which would misrepresent missing data as a bad fit.
- Each provider card shows exactly which of the user's stated
  requirements (the service, the location, each service-specific
  detail) were actually confirmed by evidence about that provider —
  not a generic dump of everything known about them. A provider that
  confirms none of the user's requirements is left out of the
  recommendation list entirely, and that exclusion happens before the
  list is capped to its final size, so a weaker-looking but genuinely
  relevant provider can take the place of a stronger-looking one that
  matched nothing the user actually asked for.
- The "why this provider ranks where it does" explanation shown to a
  user is built from plain deterministic sentence templates over the
  already-computed dimension scores, not a separate LLM call — it
  costs nothing extra at ranking time and is trivially testable. A
  dimension the app couldn't compute for a candidate contributes no
  clause rather than an "unknown" filler, and a lexical `0` (e.g. no
  detected location overlap) is never phrased as a confirmed negative
  claim, since a simple heuristic can't support that certainty. The
  background completeness signal (how many fields are known about a
  provider) deliberately never appears in this user-facing text — it
  has nothing meaningful to say to a user.
- "Ready to search" is deliberately not the same claim as "complete."
  It's true either when everything important is known, or when a
  turn-count cap is reached and the app deliberately proceeds with a
  best-effort search rather than gathering forever — preventing a
  single unanswerable required attribute from trapping a conversation
  indefinitely. Either way, a known service category and a known
  location are hard preconditions — the turn-count cap can excuse a
  missing optional attribute, or even a missing required one, but
  never an unidentified service or an unknown location, since a
  search has nothing to search for or search in without them. A
  missing event date/time, by contrast, doesn't block the search
  itself and is not held to the same rule.
- The provider-list endpoint returns its ranked results to the caller
  only — it never writes them back into the conversation's own state.
  The conversation state stays small and focused on gathering
  requirements; the ranked list (with its facts, inferred signals, and
  rationale) is the client's to hold onto, which is also what lets a
  later provider-selection call work from a client-supplied provider
  rather than a server-side lookup.
- The mobile app's screen flow (chat → loading → comparison → details
  → loading → simulated answers, with a way back to comparison) is
  driven by a small hand-written state machine in the app's root
  component rather than a navigation library — the flow is a short,
  mostly linear sequence with no deep linking or complex back-stack
  needs, so a dedicated routing dependency would add ceremony without
  adding capability the app actually uses.
- Each screen is built and tested as a standalone component that only
  receives data and callbacks as inputs — it has no knowledge of the
  network or of which screen comes before or after it. The root
  component is the only place that knows about the backend API and
  decides which screen is currently showing, which is what let the six
  screens be built and verified independently and in parallel.
- The frontend's originally planned test tooling (Vitest) turned out to
  be a poor fit for React Native's own package format and was swapped
  for Jest, the standard tooling choice for Expo/React Native projects,
  once that mismatch was confirmed rather than fought further.
- A rate limit hit on the underlying LLM or search API is detected and
  surfaced to the end user as a specific, plain-language message,
  rather than the same generic failure message used for every other
  kind of error — the one failure mode a user is likely to actually
  hit (and retry into again immediately) gets to say what happened,
  without building a general system for classifying every possible
  upstream failure.

## Optimizations

- The set of attributes that matter for a given service category is
  determined once per category per session and reused for the rest
  of that session, instead of being re-derived on every turn.
- Caching or persistence across separate runs is intentionally not
  implemented — the assignment treats a fresh start on every run as
  acceptable, so building for cross-run reuse would be solving a
  problem that doesn't exist here.
- Per-candidate provider-fact extraction and per-candidate review
  enrichment each now run with bounded concurrency (a small worker
  pool, 3 candidates in flight at a time) instead of one candidate at
  a time — implementing the assignment's named "Parallel provider
  research" bonus. The concurrency limit stays conservative rather
  than "as parallel as possible" because Gemini's free tier is
  documented at 5 requests/minute — parallelizing cuts wall-clock time
  for a fixed number of calls, it doesn't reduce that call volume, so
  going wider risks turning today's occasional rate-limit failure into
  a routine one.
- Enriching a provider with qualitative review signal is capped to a
  smaller subset of the already-discovered candidates, rather than
  enriching everything discovery found — discovery and enrichment
  together would otherwise push per-session LLM calls well past a
  rate limit already observed to cause failures at a lower volume.
- Considered, not implemented: a client-supplied idempotency key on
  message POSTs, so a retried request (timeout, double-tap) is
  recognized as the same logical message rather than processed
  twice. Deferred rather than built, since there's no frontend yet to
  demonstrate the failure mode is real, and it would need its own
  in-memory tracking structure — not worth the added complexity on
  spec for this prototype.

## Production Evolution

This section will grow as provider research, ranking, and simulation
are built out. Intended direction: persistent provider profiles
(rather than re-researching every session), real provider
communication in place of simulation, and confidence/observability
around extracted data.

- A failure discovering or enriching one provider is now logged rather
  than silently swallowed, so a partial-failure batch is visible to
  whoever's watching the process rather than looking identical to a
  fully successful one. No retry/backoff yet — that's a real
  production gap this only makes visible, not one it closes.
