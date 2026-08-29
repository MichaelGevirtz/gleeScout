# Architectural Decisions

## D1 — Stack choice: Node/TypeScript/Fastify/Zod backend

**Decision**: Fastify + TypeScript + Zod on the backend, npm as
package manager.
**Rationale**: Fastify is lightweight, has first-class TypeScript
support, and low ceremony compared to NestJS — appropriate for a
focused prototype where a large framework would add structure the
assignment doesn't need. Zod gives runtime validation for LLM
output, which is central to the "LLM output must be validated before
entering state" principle.
**Status**: Project decision, not assignment-mandated. Revisit only
if implementation evidence shows friction.

## D2 — LLM: Google Gemini

**Decision**: Use Gemini for all reasoning steps (extraction,
question generation, review analysis, provider question generation,
simulation), via structured output (JSON schema / function-calling
style) wherever the SDK supports it, always re-validated with Zod on
receipt.
**Rationale**: Assignment allows any LLM provider; Gemini structured
output support fits the "validate everything before it becomes
state" principle well.

## D2a — Gemini SDK and default model, confirmed at task-05 implementation time

**Decision**: Use `@google/genai` (the current official Google Gen AI
Node SDK) via `backend/src/llm/geminiClient.ts`. Default model is
read from `GEMINI_MODEL`, falling back in code to `gemini-3.6-flash`.
**Rationale**: The package name and model were verified live rather
than assumed from training knowledge, per this task's explicit
instruction. During manual real-API validation, the originally
planned default (`gemini-2.5-flash`) returned a live 404 from the
Gemini API stating it "is no longer available to new users" and
directing callers to `gemini-3.6-flash`; the code default was updated
accordingly. Since the model is an env-var-overridable default, not a
schema or interface, this is a low-cost correction, not a redesign —
recorded here so a future reader doesn't assume the original PLAN
text (which still says `gemini-2.5-flash` as an illustrative example)
reflects the shipped default.
**Status**: Project decision. Revisit only if Gemini deprecates
`gemini-3.6-flash` in turn — the fix is a one-line constant change.

## D2b — On-demand extraction eval script; Gemini free-tier rate limit noted

**Decision**: `backend/scripts/evalExtraction.ts` +
`extractionGoldenSet.ts` run ~9 hand-picked cases through the real
`extractRequirements`/`mergeExtraction` against the live Gemini API,
scoring loose PASS/REVIEW/FAIL structural checks (no exact-string
matching, no LLM-as-judge). Invoked manually via
`npm run eval:extraction`; never runs as part of `npm test` or
`npm run build` (kept outside `tsconfig.json`'s `include`).
**Rationale**: PROJECT RECOMMENDATION (see task-08's Assignment
Alignment) — not required by any Part, but gives a concrete answer to
"how do you know the LLM extracted the service category correctly,"
which the fake-backed automated tests structurally cannot answer, and
seeds the assignment's own "Evaluation" Production Evolution bullet
with a working artifact instead of only a described idea.
**Empirical finding recorded here for future reference**: Gemini's
free tier caps `generateContent` at 5 requests/minute per model
(confirmed via a live 429 during task-08's first full run). The
script paces itself with a 13s delay between calls; any future
script making several sequential real Gemini calls in a short burst
(not application request-handling, which is one call per user
message and unaffected) should account for this same limit.
**Second empirical finding (2026-08-27, post-task-08)**: the free
tier separately caps `gemini-3.6-flash` at **20 `generateContent`
requests/day** (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`).
Unlike the per-minute cap, this cannot be paced around in-process —
it only resets on Google's daily window (observed to still be in
effect same-day after ~2 full eval runs + manual checks already
consumed most of the day's quota). A third same-day eval run partially
failed (4/9 cases completed, 5/9 hit the daily 429) purely due to this
quota, not an extraction defect. Anyone re-running
`eval:extraction` (or any manual real-API check) repeatedly in one
day on a free-tier key should expect this.
**Status**: Project decision. Tooling only — no production code
(`backend/src/**`) changed to support this.

## D3 — Web research: Firecrawl, isolated behind a provider boundary

**Decision**: Firecrawl is the initial/only research integration,
accessed through a small `ResearchProvider` interface/module so it
is not woven throughout the codebase.
**Rationale**: The assignment explicitly allows many possible
research sources and does not require Firecrawl specifically. A thin
boundary lets it be swapped (e.g. for a search API or browser
automation) without a rewrite, satisfying the "can new data sources
be added without rewriting everything" evaluation criterion, without
building multiple providers we don't need for a prototype.

## D4 — Frontend: React Native + Expo

**Decision**: Mobile-targeted chat UI built with Expo-managed React
Native, kept independent of backend implementation details (talks to
the Fastify API over HTTP only).
**Rationale**: Project decision favoring a consumer-app feel over a
web admin-panel feel, matching the "AI event-planning assistant"
framing. Expo-managed workflow avoids native tooling overhead for a
short assignment timeline.

## D5 — Conversation state: LLM extracts, app owns the state machine

**Decision**: The Gemini call for requirement extraction returns a
*proposed* structured patch (service category + attribute values +
confidence). The Fastify orchestrator, not the LLM, merges that
patch into `ConversationState`, decides which attributes are still
missing, and decides whether the conversation is ready to move to
search. The LLM is asked to phrase the next question(s), but does
not choose *which* attributes are asked about, nor does it decide
phase transitions.
**Rationale**: Directly answers the assignment's explicit interest in
"how do you balance LLM reasoning vs. structured data vs.
deterministic application logic" and prevents the LLM from becoming
an uncontrolled source of truth for state/workflow, per the
project's architectural principle.

## D6 — Only date/time and location are deterministic core; every other attribute (including budget) is LLM-proposed per category, cached per session

**Revised 2026-08-27** (see rationale below — narrows the original
version of this decision, which incorrectly hardcoded budget as
universally relevant).

**Decision**: The deterministic core is limited to the two attributes
that are structurally required to run *any* provider search
regardless of category — event date/time and location. Everything
else, **including budget**, is treated as service-specific and is
proposed by the LLM the first time a category appears in a session
(then cached in memory for the rest of that session run so the same
category isn't re-reasoned about repeatedly). Deterministic
application code still owns, independent of what's in that list:
- merging LLM-extracted values into structured state
- diffing known-vs-missing against whatever attribute list (global +
  LLM-proposed) is currently active
- selecting which single missing attribute to ask about next
- the readiness gate (e.g. all "important" attributes present, or a
  turn-count cap)

**Rationale**: The assignment explicitly requires the system to
"dynamically reason about what information matters for the requested
service" and to avoid a static/generic form. Budget matters a lot for
a photographer or bartender and much less for, say, a face-painting
add-on to an existing party — it is not universally important, so
hardcoding it as always-relevant risks turning the conversation into
a partially hardcoded questionnaire, which the assignment explicitly
warns against. Date/time and location are the only attributes kept
deterministic because a provider search is structurally impossible
without them, independent of category — that's a different kind of
requirement (searchability) than "importance to this particular
service," which is squarely the LLM's job to determine.
**Status**: Project decision. Caching the LLM's proposed attribute
list per category is a cost/latency optimization, acceptable given
the assignment's "no persistence" / fresh-per-run constraint — it
does not change *which* attributes are considered, only avoids
re-asking the LLM the same categorical question twice in one run.

**Reconsidered 2026-08-27** (during M4 task planning, before
implementation): a task for the cross-session cache was drafted
(process-level `Map<category, AttributeDefinition[]>`, definitions
only — never values, never session-specific data), then removed on
review. Reasoning: the within-conversation case this refinement
already covers is free via `ConversationState` itself, and the
cross-session case has no demonstrated concrete benefit — no evidence
yet that the LLM's per-turn attribute proposals actually drift
enough across sessions to matter. Building it now would be
speculative optimization ahead of a real need, which this same D6
entry already explicitly warns against ("not built speculatively
ahead of that"). Deferred, not abandoned: worth revisiting if real
usage (or the eval script in `backend/scripts/`) ever shows a
category's LLM-proposed attribute set varying enough between sessions
to be a genuine consistency problem — at that point it becomes a
concrete-benefit-demonstrated task, not a speculative one.

**Refinement 2026-08-27** (from domain-model review before Task 03
implementation):
- A category attribute's *existence* in state (that the LLM
  determined it's relevant, with a name/description/importance) is
  represented independently of whether its *value* is known yet —
  the value is nullable. This is required for M4's missing-attribute
  detection to work: a "required" attribute has to be representable
  before it has an answer, not only after.
- The cache itself is **not per-conversation state**. Within a single
  conversation the service category doesn't change, so there's
  nothing to cache there — the state naturally holds the category's
  attributes once, for free. The cache only earns its keep *across
  different sessions* within the same backend process run (e.g. two
  unrelated users both asking about a "bounce house" shouldn't each
  trigger a fresh LLM call to figure out what matters for that
  category). That makes it a process-level structure, separate from
  `ConversationState`, introduced in M3 (extraction) where it has its
  first actual consumer — not built speculatively ahead of that.

## D7 — FACT / INFERRED / SIMULATED are distinct, never-merged categories

**Decision**: Provider data model keeps three separate buckets:
`facts` (sourced, with `source`, `sourceUrl`, `retrievedAt`),
`inferred` (derived from evidence, e.g. review analysis, with a
pointer to the evidence it came from), and `simulated` (LLM
hypothetical, tagged and never written into `facts`). Ranking and
card rendering read from all three but the UI/response always labels
which bucket a given piece of information came from.
**Rationale**: Assignment Part 5 and the "Trust & Grounding"
evaluation criterion explicitly require this separation; simulated
responses must never be presented as real confirmations.

**Addendum (2026-08-28, task-14)**: implemented FACT-first —
`backend/src/domain/evidence.ts` ships a generic `Fact<T>` schema
(`value`/`source`/`sourceUrl`/`retrievedAt`) now; `INFERRED` and
`SIMULATED` wrapper types remain committed scope, deliberately
deferred to land with their first real consumer (M8's review
analysis, M11's response simulation) rather than built speculatively
ahead of need. This is a sequencing decision, not a scope reduction.
Also clarified during task review: `FactSchema` enforces the
*structure* of provenance for a value tagged FACT — it does not and
cannot enforce that the value is true or that `source`/`sourceUrl`
actually supports it. That grounding responsibility stays with
whatever pipeline decides to tag something FACT in the first place
(M7's research/extraction step onward). `sourceUrl` is a single
required URL as a project assumption specific to web research (this
project's only research source, per D3) — not a claim that every
possible future FACT source has exactly one URL.

## D8 — Ranking is a small, explainable weighted score, not a star-rating sort

**Decision**: Ranking combines requirement-match, service-area/
geographic fit, price fit against stated budget, reputation
(rating + review count as a confidence-weighted signal), and evidence
completeness, as a transparent per-provider score with a
human-readable rationale string, computed deterministically in
application code (LLM may contribute qualitative tags like "good
with toddlers" as inferred signals feeding the score, but the scoring
function itself is deterministic).
**Rationale**: Assignment explicitly says "a generic sort by star
rating is not enough" and asks for ranking reasoning that can be
explained. A deterministic, inspectable scorer is easier to justify
and debug than an LLM-driven ranking call.

## D9 — Session state: in-memory Map keyed by session id, no persistence

**Decision**: A single in-memory `Map<sessionId, SessionState>` on
the backend process; no database, no disk persistence.
**Rationale**: Explicit assignment constraint ("no database... no
persistence... acceptable for all conversations, provider research,
extracted data and simulated responses to disappear when the process
restarts").

## D10 — Agent trace is included as a lightweight bonus

**Decision**: Each orchestrator step (LLM call type, condensed
input/output, timestamp) is appended to a per-session trace array,
exposed via a debug endpoint, rather than building a full
observability stack.
**Rationale**: Assignment lists "an agent trace/debug view" as a
bonus; a simple in-memory list is low-cost and directly supports the
"how does the agent decide what to do next" evaluation criterion
without over-building.

**Addendum (2026-08-29, M13 kickoff)**: two corrections made before
M13's first task was written, both against a direct re-read of the
assignment PDF rather than this decision's original paraphrase:

1. **Scope narrowed.** The bonus text is "how **the recommendation**
   was produced," not "how the whole conversation was conducted."
   This entry's original wording ("each orchestrator step") was
   broader than that. M13 traces exactly the two functions that
   produce a recommendation — `generateProviderList` (M7 discovery →
   M8 enrichment → M9 ranking) and `selectProvider` (M10 gap analysis
   → M11 simulation) — not the M3/M4/M5 requirement-gathering
   conversation turns.
2. **Scope widened, per direct user instruction.** "Debug endpoint" (a
   JSON API only) does not satisfy "debug/**view**" literally. M13 now
   also includes a small human-readable frontend `TraceScreen`
   (presentational, prop-driven, reachable from the Recommendations
   screen), not just the endpoint. Still explicitly a bonus/cut-first
   item — the widening adds one more small presentational task
   (task-73), not a redesign of the main UX.

**M13 is now fully complete** (2026-08-29) — see
`memory-bank/progress.md`'s M13 section for the full six-task
breakdown (tasks 69-74, all `DONE`) and `tasks/completed/task-69-*`
through `task-74-*` for each task's detail.

## D11 — Per-session request serialization belongs to M5 orchestration, not the session store

**Decision**: The session store (Task 04) stays a plain
`Map<string, ConversationState>` with no locking, TTL, or concurrency
control — that responsibility does not belong there, and Task 04 is
not modified to add it. Instead, when M5 (conversation API /
orchestration) is designed, it will add a lightweight, dependency-free
per-session request serialization mechanism (e.g. a small per-session
promise queue keyed by session id) so that requests for the *same*
session are processed strictly one at a time, while requests for
*different* sessions continue to run concurrently. M5 will also
include an integration test that fires two concurrent messages at the
same session and asserts that both messages' extracted information
survive — i.e. the second write doesn't silently discard what the
first extracted.

**Rationale**: The `Map` itself is safe — Node's single-threaded event
loop guarantees no torn reads/writes on it. The actual risk is the
read → await-LLM-call → write pattern every conversation turn follows:
between the read and the write, the event loop is free to run other
requests, so two concurrent messages to the same session (double-click,
client retry, a fast typist) can both read the same starting state,
and whichever `updateSession` call lands last silently overwrites the
other's extracted information. That's a real, user-visible bug (a
message's content disappearing from state), not a theoretical edge
case, because it falls directly out of the async LLM architecture
already decided in D5. Since the cause is request interleaving during
an `await`, not anything about the `Map` construct, the fix belongs at
the orchestration layer that owns request sequencing (M5), not inside
the storage primitive (Task 04) — keeping the store dependency-free and
dumb, per its original scope, while making the concurrency guarantee an
explicit contract the orchestrator provides on top of it.

**Status**: Project decision, not yet implemented. No code changes
result from this entry; it's recorded now so it isn't left as an
undocumented implementation detail once M5 is built.

## D12 — Question policy: fixed deterministic selection order; readiness gate is two independent paths, not "complete"

**Decision**: `selectNextMissingAttribute` (Task 09) checks in a fixed
order — `dateTime` → `location` → required category attributes in
`categoryAttributes` insertion order — and returns the first missing
one, or `null`. Optional category attributes are never proactively
selected, even if they're the only thing missing (they can still be
filled if the user volunteers the info; extraction/merge already
handles that). `isReadyForSearch` returns `true` via either of two
independent paths: (a) *complete* — core attributes and all required
category attributes are known; or (b) *fallback* — a fixed
turn-count cap (`MAX_GATHERING_TURNS = 8`, a named constant in
`questionPolicy.ts`, counting `messages` entries with
`role: "user"`) has been reached, so the app deliberately proceeds
with a best-effort search on incomplete information. No new
`ConversationPhase` value was introduced — this function only decides
*when* to make the existing `"gathering"` → `"ready_for_search"`
transition from Task 03, not what value `phase` takes. Both functions
are pure and read-only against `ConversationState`, with no LLM call.

**Rationale**:
1. *Fixed selection ordering* over an LLM- or signal-informed
   priority: explainability and reproducibility — a fixed rule is
   trivially inspectable and testable, and keeps the LLM out of
   conversation-flow control per D5, at zero extra LLM cost. What's
   sacrificed: no context-sensitive reprioritization (can't bump
   budget ahead of location just because the user emphasized cost;
   no adaptive read of user hesitation on a specific question), and
   insertion-order tie-break among same-importance category
   attributes isn't necessarily "most valuable to ask first."
   Production evolution: an LLM- or analytics-informed priority
   *score* per missing attribute feeding a still-deterministic
   ranking function — preserving D5's split rather than handing
   ordering to the LLM outright — or drop-off-informed reordering
   once there's real usage data on which questions cause
   abandonment.
2. *Readiness gate's two-path definition and turn-cap fallback*:
   "ready to proceed" is deliberately not synonymous with "complete."
   Without the fallback path, a single required attribute the user
   can never supply (doesn't know it, won't answer) could trap a
   session in `"gathering"` indefinitely. This is a deliberate
   best-effort tradeoff (proceed with a known gap rather than never
   proceed), not an oversight. A caller that needs to know which path
   fired inspects `selectNextMissingAttribute` on the same state
   (non-null return means something is genuinely still missing even
   though `isReadyForSearch` said to proceed) rather than inferring it
   from `isReadyForSearch`'s boolean alone.

**Status**: Project decision (mechanism); the underlying behavioral
requirement — ask only important missing questions, avoid long
questionnaires, eventually proceed to research — is assignment
EXPLICIT (Part 1, items 4–5; Part 2 opening line). See task-09.

**Addendum (2026-08-28, task-41) — `serviceCategory` is a mandatory
readiness precondition, closing a gap in the original gate.**
**Finding**: a post-implementation review (following M11) found that
`isReadyForSearch`, as originally implemented, never checked
`state.serviceCategory` — it could return `true` via either path
(complete, or the turn-count fallback) while `serviceCategory` was
still `null`, as long as `dateTime`/`location` were known and no
required category attribute was missing. Since `categoryAttributes`
is only populated once a category is identified (D6), a genuinely
ambiguous first message (extraction never proposes a category, so
never proposes any category attributes either) could reach
`ready_for_search` having never identified what service was being
requested — directly contradicting Part 1 item 1 ("Identify the type
of service being requested") and Part 2's "once enough information has
been collected" framing; `buildProviderSearchQuery` already requires a
non-null `serviceCategory: string`, so this was a real, not
theoretical, gap.
**Fix**: `isReadyForSearch` now short-circuits to `false` whenever
`state.serviceCategory === null`, ahead of both the complete-path and
turn-count-fallback checks — so the turn-count cap can excuse a
missing optional or even missing required *attribute*, but never an
unidentified *service*. `selectNextMissingAttribute` is unchanged; it
still only ever targets `dateTime`/`location`/required category
attributes, per its original D12 scope.
**Accepted consequence, not fixed here**: a conversation that supplies
`dateTime`+`location` but whose category the LLM genuinely can never
identify (and which therefore has no required category attribute to
ask about instead) now hits `orchestrateMessage.ts`'s existing
invariant check (`"isReadyForSearch was false but
selectNextMissingAttribute returned null"`) and throws, surfaced as a
500. This was a deliberate reviewer decision at task-41's approval
step: `orchestrateMessage.ts` itself was intentionally left unchanged
(fixing it would mean adding a new conversational branch — e.g. a
targeted "what service is this?" question — which is more than a
readiness-gate correction and was explicitly out of this task's
scope). Failing loud here is preferred over the prior behavior
(silently proceeding to search with no category), and matches this
project's existing no-retry/fail-loud precedent elsewhere (Tasks
05/06/11). A graceful resolution remains an open follow-up, not
committed.
**Status**: PROJECT DESIGN DECISION (bug fix + explicit reviewer
tradeoff), confirmed 2026-08-28, implemented in task-41.

**Addendum 2 (2026-08-28, task-42) — `location` gets the same
treatment, `dateTime` deliberately does not.**
**Finding**: the same class of gap existed for
`state.coreAttributes.location` as task-41 closed for
`serviceCategory` — the turn-count fallback could return `true` while
`location` was still `undefined`, and `buildProviderSearchQuery`
requires a non-undefined `location: string` exactly as it requires a
non-null `serviceCategory: string`. Found while scoping M12's list
route (task-43), before any M12 code was written.
**Fix**: `isReadyForSearch` gained a second guard,
`if (state.coreAttributes.location === undefined) return false;`,
alongside task-41's guard, both ahead of the complete-path/fallback
logic. `dateTime` was deliberately **not** given the same treatment —
`buildProviderSearchQuery` doesn't use `dateTime` at all, so a missing
`dateTime` doesn't block a search the way a missing `serviceCategory`
or `location` structurally does; extending the guard to `dateTime`
would have been over-fixing a gap that doesn't exist for that field.
**Consequence**: combined with task-41, `isReadyForSearch() === true`
now reliably implies both `serviceCategory` and `location` are safe to
read as present — the precondition M12's list route (task-43) is built
on. Unlike task-41, no existing test fixture needed changes; every
fixture that already asserted readiness happened to already set
`location`.
**Status**: PROJECT DESIGN DECISION, confirmed 2026-08-28, implemented
in task-42.

## Observed Findings — M7 real-API validation (2026-08-28)

The three entries below are **OBSERVED FINDINGS / DESIGN
CONSIDERATIONS** from a manual post-M7 review run against the real
Firecrawl and Gemini APIs (3 categories, 24 pages total — see
`progress.md`'s Validation Status entry for the raw counts). None of
these are explicit assignment requirements, and none prompted any
change to M7's implementation — they are inputs for future M8/M10
planning, not decisions made yet. A single 3-category run is
informative, not statistically conclusive.

**Finding 1 — silent per-candidate failure swallowing has no
operational visibility (confirmed in practice, not hypothetical).**
`discoverProviderCandidates`'s per-candidate `try { ... } catch {
continue; }` (bare skip, no logging) was exercised for real during
this run: one of 18 extraction calls failed with a genuine Gemini
`503 UNAVAILABLE` ("model is currently experiencing high demand"),
not the 429 rate-limit previously flagged as a risk in D2b. The
candidate was silently dropped exactly as designed and tested — safe
behavior (no crash, no corrupted state), but it currently gives zero
indication, even in logs, that a failure occurred versus the page
simply having no useful data. DESIGN CONSIDERATION for M8 planning:
add minimal logging/observability on this path. Explicitly **not** a
call to add retries or redesign the failure architecture — that
remains a separate, larger decision this finding does not make.

**Finding 2 — first-party provider claims vs. third-party reputation
evidence are not currently distinguished (DESIGN CONSIDERATION for
M8/M10).** One real extracted candidate (a bounce-house rental site)
returned `rating: 5, reviewCount: 1000` — suspiciously round numbers
consistent with self-reported marketing copy ("5-star rated, 1000+
happy customers") rather than an aggregated third-party platform
rating, contrasted against another real candidate in the same run
(`rating: 4.76, reviewCount: 932`) that reads as a genuine aggregated
figure. Because `FactSchema` only enforces provenance *structure*
(per D7's addendum), a page's own claim about itself currently enters
the system as an equally-weighted FACT as an independently-sourced
rating would — both are "factual claims made by the source," but not
equivalent evidence. DESIGN CONSIDERATION: M8 (enrichment) and/or M10
(ranking) should consider distinguishing first-party self-reported
claims from third-party reputation evidence before ratings/review
counts feed into ranking. Relevant to the assignment's explicit
"Trust & Grounding" evaluation criterion, but not itself an explicit
requirement. Not implemented; no M7 code changed.

**Finding 3 — discovery quality varies by category/location, not just
by architecture (observed, not assumed).** The deterministic
`${category} in ${location}` query template (`searchQuery.ts`)
produced materially different candidate quality across the three real
categories tested: "bounce house rental in Austin, TX" and "taco
truck catering in Denver, CO" surfaced almost entirely individual
business sites with rich, useful fields; "wedding photographer in Tel
Aviv" surfaced mostly directory/listicle aggregator pages (e.g. "Top
10 photographers in Israel") with `name: null` and coarse `location:
"Israel"`. OBSERVED FINDING, not a defect: the current fixed query
template's effectiveness appears to depend on how directory-saturated
a given category/market is on the open web — not something M7's
simple deterministic query builder was ever designed to solve, and
not a regression from any decision made. Recorded as an input for
later query-strategy planning, not a reason to touch M7 now.

**Status**: All three findings are from a single real-API validation
run. None require or justify any M7 implementation change. No new
tasks were created as a result.

## Observed Findings — post-M8 review (2026-08-28)

A manual real-API validation of `enrichProviderCandidates` was run
during the post-M8 review (previously untested against live APIs —
task-25 had deferred this) via a new `backend/scripts/m8ManualEval.ts`
(mirrors `m7ManualEval.ts`'s existing pattern; outside `tsconfig.json`'s
include, no production-code or test-suite impact). 3 seed candidates
(bounce house rental / Austin, TX) → 3 real enrichment searches → 2/3
enriched with real inferred tags, 1/3 enriched with zero tags (a valid
"no signal found" outcome, not a failure).

**Finding 1 — `classifySourceType` hostname-matching bugs (FIXED,
task-26).** Google/Yelp detection used substring `.includes("google.")`
/`.includes("yelp.")`, which would misclassify a lookalike hostname
(`notgoogle.com`, `mygoogle.com`) as the real thing. Provider-website
detection used exact hostname string equality, which would
misclassify a provider's own site as `"other"` on a plain `www.`
prefix mismatch between M7's discovered `candidate.url` and the
enrichment search's result URL — a realistic scenario (confirmed
live: the real validation run's one successful `provider_website`
classification only worked because both URLs happened to share the
identical hostname). Fixed in task-26 with a domain-suffix match
(`hostname === "google.com" || hostname.endsWith(".google.com")`) and
a `www.`-stripping comparison for provider-website. Deliberately not
extended to a maintained TLD/public-suffix list (e.g. `google.co.uk`)
or other subdomain-prefix normalization (`m.`, `en.`) — out of scope,
per explicit reviewer instruction to keep this a small, targeted fix.

**Finding 2 — evidence-excerpt grounding is unverified (OPEN,
explicitly not fixed).** `analyzeReviewText`'s system instruction
tells Gemini "never fabricate a tag... include a short supporting
excerpt... if one exists," but no code checks that a returned
`evidenceExcerpt` is actually a substring of the markdown Gemini was
given. In the real validation run the excerpts looked genuinely
verbatim, but that reflects the model behaving well, not the system
enforcing it. The reviewer explicitly excluded "excerpt verification"
from task-26's scope, so this remains an open, undecided item — not a
rejected idea, just not yet scheduled.

**Finding 3 — generic review enrichment can surface provider-owned
testimonials, not independent customer reviews (OPEN, kept as a
documented limitation, not fixed).** Confirmed live during this
validation: all 5 real inferred tags for one candidate
(`sandismoonwalk.com`) came back `sourceType: "provider_website"` —
meaning the enrichment query surfaced testimonials the business chose
to publish about itself on its own site, not independent third-party
review-platform content. `sourceType` correctly labels this as
`provider_website` rather than conflating it with a genuine
third-party source, but the underlying limitation — a generic
`"<provider> reviews <location>"` search has no guarantee of finding
independent evidence at all — is not solved by that label alone.
Reviewer explicitly excluded trust scoring/source weighting/ranking
from task-26, so this stays a documented limitation for M9/M10 to
account for, not something M8 attempts to resolve.

**Status**: Finding 1 is closed (task-26). Findings 2 and 3 are
recorded as open limitations, not implemented, no new tasks created —
per reviewer instruction, M9's architecture is to be reviewed
separately before any new task is scoped against these.

## D13 — M9 ranking design decisions (resolved during M9 planning, before task-27)

Seven points raised during M9 planning review, resolved before any M9
task file was written. Applies to the not-yet-created tasks 27-32.

**D13a — Reputation counts only independently-sourced ratings; a
provider-published rating is still shown, but not scored as
reputation evidence.**
**Decision**: `reputationScore` only uses a candidate's `rating`/
`reviewCount` FACT pair when that FACT's own provenance (`source`,
the hostname captured at Fact-wrap time per task-19) is an
independently-operated ratings platform — reusing task-26's
`hostnameMatches` domain-suffix check against `google.com`/
`yelp.com` (to be exported from `assembleInferredTags.ts` for this
reuse, not reimplemented). If the rating FACT's source is any other
hostname (typically the provider's own site, or an unrecognized
directory), `reputationScore` returns `null` for that candidate —
handled by the already-agreed missing-data rule (excluded, remaining
dimensions renormalized), not scored as 0 and not scored from the
self-reported number.
**Rationale**: Directly answers the M7 real-API Finding 2 (a
bounce-house site self-reporting "5 stars / 1000 customers" vs. a
genuine third-party 4.76/932 figure observed in the same run) using
data the system already has — no new scraping, no new extraction
call, no trust-scoring subsystem. Works today because M7's
discovered `candidate.url` is sometimes itself a third-party
aggregator/directory page (Finding 3 — e.g. photographer listicles),
so its own extracted rating genuinely can carry independent
provenance; when it's the provider's own domain, the rating is
correctly excluded from scoring rather than trusted at face value.
The rating value itself is never discarded — it stays a normal FACT
field, fully visible on the provider card (M12/M15) with its
provenance; this decision only concerns whether it counts as ranking
*evidence*. Explicitly not addressing Finding 2's broader "detect
suspiciously round numbers" idea — that would be a heuristic with no
validated accuracy from a single 3-category observation, out of
scope per the "no trust-scoring subsystem" instruction.

**Addendum 1 — same-source consistency (post-task-file review, before
implementation)**: `rating` and `reviewCount` are independently
`Fact`-wrapped fields (`ProviderCandidateFieldsSchema` applies
`FactSchema` per-field, with no schema-level guarantee they share a
source), even though today's only producer (`assembleCandidate`,
task-19) happens to always give every field on one candidate the same
`source`/`sourceUrl`, since they all come from one page-extraction
call. `reputationScore` must not rely on that as an implicit,
unchecked assumption. **Decision**: in addition to each individually
passing the google/yelp `hostnameMatches` check, `reputationScore`
requires `rating.sourceUrl === reviewCount.sourceUrl` — i.e. the
rating and its review count must come from the literal same scraped
page, not merely from "a" trustworthy-looking hostname each. If they
differ (or either is absent), `reputationScore` returns `null`.
**Rationale**: "A 4.8 rating from Google combined with a review count
from Yelp" would not be one coherent piece of reputation evidence even
though each half individually looks independent — it's two different
numbers from two different populations glued together. Checking
`sourceUrl` equality (rather than inventing a source-identity model)
is the simplest possible way to guarantee "same evidence," reusing
fields that already exist on `Fact<T>`.

**Addendum 2 — avoid a ranking→research layering violation (post-task-
file review, before implementation)**: `hostnameMatches` (and its
sibling `stripWww`) were originally task-26 additions private to
`backend/src/research/assembleInferredTags.ts`; the original task-29
draft planned to export and import it directly from `research/` into
`ranking/`, which makes the ranking layer depend on the research
layer for what is really a generic, domain-agnostic URL utility with
no research-specific meaning. **Decision**: relocate `hostnameMatches`
and `stripWww` into a new `backend/src/shared/hostname.ts` (a small,
dependency-free utility module both `research/` and `ranking/` import
from); `assembleInferredTags.ts` is updated to import them from there
instead of defining them locally, with no change to its own exported
behavior. **Rationale**: This is a two-function, zero-logic-change
move — trivial to do now, not a "large refactoring task" — that
removes the layering smell entirely rather than documenting it as
accepted debt. Both `research/` and `ranking/` end up depending
downward on a neutral shared utility instead of one depending
sideways on the other.

**D13b — Evidence quality measures FACT coverage only, not M8
enrichment coverage.**
**Decision**: `evidenceQualityScore = (# non-null FACT fields in
candidate.fields) / 10`. Deliberately excludes M8's `inferred` tag
count from the formula.
**Rationale**: M8's `enrichProviderCandidates` (task-25) enriches
only the first `MAX_ENRICHMENT_CANDIDATES = 5` candidates by input
order — a candidate having `inferred` tags at all is partly an
artifact of enrichment-batch position, not provider quality. Folding
that count into evidence quality would let ranking reward "we
happened to enrich this one" over genuine per-provider signal. FACT
coverage, by contrast, comes from task-18's per-candidate extraction,
which runs against every M7-discovered candidate uncapped (M7's cap
is `MAX_DISCOVERY_RESULTS = 8` at discovery, not per-candidate
extraction) — a uniformly-available signal across all candidates
regardless of M8's later, capped enrichment pass. Consequence: M8's
inferred tags do not feed any M9 scoring dimension in this milestone
(they remain visible directly on the provider card via M12/M15,
independent of ranking) — accepted as the simplest fix that removes
the bias, not a complicated confidence model. Revisit only if a
future task gives inferred tags their own justified, bias-free
signal (e.g. once enrichment is no longer capped/order-dependent).

**D13c — M8's enrichment cap is not an M9 ranking-input filter.**
**Decision**: `rankProviders` (task-32) scores every
`ProviderCandidate` M7 discovered, including ones M8 never enriched
(no `inferred` field, possibly no rating from any source). A
candidate is never excluded from ranking merely for lacking
enrichment — missing dimensions for it are handled by the standard
missing-data rule (excluded + renormalized), same as any other
missing FACT. The output is capped to the top 3-5 only as the very
last step, after all candidates are scored.
**Rationale**: Conflating "wasn't enriched" with "ranks last" would
silently make M8's arbitrary 5-candidate processing order into a
ranking decision, which it was never designed to be (task-25's cap
is a cost/rate-limit control, not a quality signal).

**D13d — Requirement match is lexical, not semantic; documented
limitation, not a defect.**
**Decision**: `requirementMatchScore` (task-28) does case-insensitive
substring/keyword matching between the user's category-attribute
values and the provider's `servicesOffered`/`policies` FACT text — no
LLM call added for ranking.
**Rationale**: Consistent with D5/D8's LLM-out-of-the-scoring-loop
principle: adding an LLM call per candidate per ranking pass would
reintroduce non-determinism and latency/cost into a function that's
supposed to be inspectable and cheap to re-run. Known, accepted
limitation: "bounce house" won't match "inflatable" even though a
human would consider them the same request — recorded here and in
DESIGN.md's Assumptions section, not treated as a bug.

**Addendum (post-task-file review, before implementation)**: the
`categoryAttributes` entry identified as the user's budget (via
D13g's `/budget/i` lookup) is explicitly excluded from the set of
values `requirementMatchScore` checks — it reuses the same
budget-detection logic as `priceFitScore` (task-28) purely to filter
it out, not to score it here. **Correction to the original task-28
draft**, caught during task review before implementation: without
this exclusion, a dollar-amount string like `"$500"` would almost
never appear verbatim in `servicesOffered`/`policies` text, so
including it would count as an automatic non-match on every
candidate — double-counting budget's influence (it already has its
own `priceFitScore` dimension) while artificially depressing every
candidate's requirement-match score for a reason that has nothing to
do with service/category fit.

**D13e — Price parsing returns `null` on any string that isn't
exactly one confident dollar amount; no range-guessing logic.**
**Decision**: The price-parsing helper (used by `priceFitScore`,
task-28) extracts `$`-prefixed numeric amounts from a pricing string.
If it finds exactly one, that's the price. If it finds zero, or more
than one (e.g. a range like `"$200-$300"`, or a multi-value string
like `"$175... to $365-$1,095"`), it returns `null` — treated as
missing data (excluded + renormalized), never an average, a low
bound, a high bound, or any other guess.
**Rationale**: The reviewer explicitly required "must return null
when pricing cannot be confidently converted into a comparable
numeric value" and "do not guess from ambiguous strings." Picking a
side of a range (or averaging it) would itself be an unstated
guessing rule with no way to justify why that particular
interpretation is "the" price. The simplest safe rule — exactly one
match or `null` — needs no range-interpretation logic to design,
test, or defend, at the cost of losing signal on the (likely common)
"$X-$Y" range-priced provider, which falls back to the same
already-accepted missing-data path as no pricing at all. Documented
as a known limitation, not a defect.

**D13f — Equal 0.2 dimension weights are an explainable-baseline
project decision, not an assignment requirement or a claim of
optimality.**
**Decision**: `rankProviders`'s five dimensions (requirement match,
geo fit, price fit, reputation, evidence quality) are weighted
equally (0.2 each) as named, easily-tunable constants.
**Rationale**: There is no real usage or outcome data from which to
derive differential weights, and inventing a specific unequal split
(e.g. "requirement match matters 1.5x more than reputation") would be
an unvalidated guess dressed up as precision — worse than an honest
uniform baseline. This is explicitly a PROJECT DECISION, not
something the assignment specifies, and not a claim that equal
weighting is objectively correct. Production Evolution (DESIGN.md)
is where weight-tuning from real outcome data or a learning-to-rank
approach belongs — not built now, consistent with the project's
existing precedent (D6, D8) of not building speculative optimization
ahead of demonstrated need.

**D13g — Locating "budget" inside `categoryAttributes` for price fit
is a lexical heuristic, not a guaranteed key.**
**Decision**: `categoryAttributes` is LLM-proposed per category (D6)
with no enforced canonical key — the attribute the LLM calls the
user's budget could in principle be named anything. `priceFitScore`
(task-28) locates it by a case-insensitive substring match on the
attribute *name* (`/budget/i`), consistent with every real example
observed so far (extraction prompts, task-09/11 tests) using the
literal name `"budget"`. If no `categoryAttributes` key matches, price
fit is treated as missing data for that candidate (same
excluded-and-renormalized path as D13e), not an error.
**Rationale**: Surfaced while defining `RankingRequirements` (task-27)
— D6 explicitly never promised a stable key, so assuming
`categoryAttributes.budget` literally exists would be a silent,
undocumented assumption. A lexical name-match is the same kind of
simple, deterministic, no-LLM-call heuristic already used for D13a/d/e,
and degrades safely (missing, not wrong) if the LLM ever names the
attribute something budget-adjacent without the substring (e.g.
"priceRange") — an accepted, documented limitation rather than a
guarantee.

**D13h — Minimum-evidence floor: a candidate needs at least 2 non-null
dimensions before it receives a normal aggregate score.**
**Decision**: `computeAggregateScore` (task-30) counts how many of the
five dimensions are non-null for a candidate. If that count is `< 2`
(named constant `MIN_MEANINGFUL_DIMENSIONS = 2`), the aggregate score
is `0` — the normal weighted-renormalize computation is not applied at
all, regardless of what the one available dimension's value is.
**Rationale**: `evidenceQualityScore` is never `null` (D13b), so a
candidate missing every other dimension (`requirementMatch`, `geoFit`,
`priceFit`, `reputation` all `null`) still has exactly one non-null
dimension — under plain renormalization, that dimension's weight
inflates to 100% of the total, letting `evidenceQualityScore` alone
(a FACT-*coverage* signal, never meant to indicate fit) fully
determine the candidate's rank. `MIN_MEANINGFUL_DIMENSIONS = 2` closes
this specific degenerate case: since `evidenceQuality` always counts
as one of the two, the practical effect is "at least one *fit-related*
dimension (requirement match, geo fit, price fit, or reputation) must
also be known" — a candidate we know things about but have validated
against none of the user's actual requirements is treated as
unrankable-with-confidence (score `0`) rather than scored as if
coverage alone were meaningful. Rejected alternative: a proportional
"confidence factor" scaling the aggregate by how many dimensions are
known — explicitly avoided as a complicated confidence model with no
demonstrated need beyond closing this one edge case; a hard floor is
simpler to state, test, and defend. Consequence: candidates below the
floor tie at `0` and are not further distinguished from each other —
accepted, since ordering within a "we don't know enough about this one
either" group has no clear meaning to design for in a prototype.
**Status**: PROJECT DESIGN DECISION (not an assignment requirement —
the assignment does not mention minimum-evidence thresholds; this is
an internal ranking-robustness fix for a renormalization edge case
this project's own D8/D13 design created).

**Status**: All eight D13 sub-decisions (plus two addenda to D13a and
one to D13d) are project decisions finalized during M9 planning
(2026-08-28), before implementation of tasks 27-32 began. None
required an assignment-review re-check beyond the one already run
against Part 3 (no scope change — these are implementation-level
resolutions of already-approved M9 scope, not new requirements or new
bonuses).

## Observed Findings — post-M9 review (2026-08-28)

Two findings from a post-M9 architecture/implementation review (not a
real-API run — a code/design review of tasks 27-32 against the actual
implementation). Both are accepted consequences of already-approved
D13 decisions, not defects. M9 was **not** modified as a result of
either finding — reviewer explicitly instructed no scoring change
absent a material correctness problem, and none was found.

**Finding 1 — a candidate can receive a fully-renormalized aggregate
score from as few as 2 of 5 known dimensions (`MIN_MEANINGFUL_DIMENSIONS`,
D13h), which can let strong reputation evidence alone outrank a
candidate with confirmed requirement/geo/price fit.** Concrete
example: a candidate with only `rating`/`reviewCount` known (no
confirmed location, price, or requirement match) can score higher than
a candidate with confirmed matches on requirement/geo/price but a
weaker rating or lower evidence completeness — because each renormalizes
over only its own known dimensions, not a shared denominator. This is
inherent in the combination of D13f (equal weights) and D13h (hard
floor, not a graduated confidence factor) — not a bug, and not
something this finding asks to fix in M9's scoring. **Deferred to the
response layer**: the recommendation-card response should make a
low-known-dimension result visible to the user (e.g. "known
dimensions: 2/5", or a short caveat sentence), reusing M9's existing
`dimensionScores` non-null count and `explanation` string as input —
explicitly without building a new confidence-scoring subsystem. See
the routing note below for which milestone owns this.

**Finding 2 — `geoFitScore`'s bidirectional substring match can produce
false positives on same-named locations in different regions** (e.g.
`"Austin"` would match both `"Austin, TX"` and `"Austin, GA"`). Known
prototype limitation, symmetric to D13d's already-documented
false-negative lexical-matching limitation. Not fixed — a maps/geocoding
dependency is explicitly out of scope unless a future milestone
demonstrates a genuine need for it.

**Routing correction (independent check against `roadmap.md`)**:
Finding 1 was originally framed as "M10" work. Per this project's own
roadmap, M10 is **"Provider-specific questions"** — Part 4's
deterministic gap analysis (user requirements vs. known provider
FACTs) plus LLM phrasing of only the gap questions — which has nothing
to do with displaying ranking confidence. Making a low-dimension result
visible to the user is a **Part 6 / M12 (Recommendation API)** concern:
M12 is where provider cards are assembled with FACT/INFERRED/SIMULATED
labeling and "ranking rationale" for display, per Part 6's explicit
text. Recorded here as M12 planning input, not folded into M10 scope,
so the M10 task file doesn't take on functionality it doesn't own.

**Status**: Both findings are project-recorded observations, not new
tasks. No M9 code changed.

## D14 — Provider-specific work (M10/M11) is selection-triggered, not run automatically for all ranked candidates

**Decision**: M10 (provider-specific questions) and M11 (provider
response simulation) run only for the single provider the user
explicitly selects in the UI after M9's ranked list is returned — not
automatically for all 3-5 ranked candidates. The selection is a
synchronous, stateless HTTP call: the client resends the full
`ProviderCandidate` object it already received in the M9-ranked list
(not just an id/URL); the server gains no new session-state field for
"which providers were shown" or "which one was selected" — it reads
`ConversationState` only for the user's requirements (to run gap
analysis) and writes nothing back. task-33
(`analyzeProviderGaps`)/task-34 (`generateProviderQuestions`) are
unaffected by this — both already operated on one candidate. task-35
(`prepareProviderQuestions`) changes from an array-based batch function
with per-candidate catch-and-continue resilience to a single-candidate
function that lets a failure propagate as a real error (to be mapped to
a client-visible 502/500 by M12's route, same precedent as task-12) —
batch resilience made sense for "quietly skip one of five background
candidates," not for "the one thing the user is actively waiting on
right now."

**Rationale**: User-driven product-flow decision, confirmed via two
rounds of review (selection-lookup mechanism, state write-back) before
any task file changed. Avoids 4/5 wasted LLM simulation passes for
providers the user never revisits, doesn't delay the initial
recommendation behind the slowest part of the pipeline (Part 4 + Part 5
LLM calls), and matches the assignment's "Ownership" evaluation
criterion (a sensible product decision on open-ended scope) plus its
"Optimizations" DESIGN.md prompt ("limiting unnecessary LLM calls,"
"cost or latency optimizations"). Client-resend (vs. server-side
caching of the ranked list) was chosen over adding a `ConversationState`
field: the recommendation-list response already contains every
`ProviderCandidate` the client needs to echo back, so caching it
server-side too would be duplicated state with a staleness question
("what if the user keeps chatting before selecting") that resending
sidesteps entirely — simpler, and consistent with keeping
`ConversationState` narrow (same precedent as D6/D9).

**Assignment-text tension, resolved as a documented deviation, not a
silent one**: Part 6's example provider card (`docs/Home
Assignment.pdf`) shows simulated fields (e.g. "Available for your date
(simulated)", "Estimated total: $425") as standard bullets present on
every card in the *initial* "several provider cards" view. This
project's selection-triggered flow means the initial M9-ranked list
shows **FACT + INFERRED + rationale only** — no simulated data on any
card until one is selected. This is a deliberate, reasoned deviation
from the literal example (see Rationale above), not an oversight —
recorded here and to be restated in `DESIGN.md`'s Assumptions section
once M12 is implemented.

**Status**: PROJECT DESIGN DECISION, confirmed 2026-08-28, before
implementation of tasks 33-35 began. Roadmap's M10/M11/M12 rows and
task-33/34/35 updated accordingly; M11 and M12 have no task files yet
(per the project's one-milestone-at-a-time task-creation convention) —
this entry is forward-looking guidance for when they're planned.

**Addendum (2026-08-28, pre-implementation review) — client-echoed
candidate is trusted input, not a verified one; this is not a security
boundary.**
**Clarification**: D14's client-resend design means M12's future
selection route will accept the `ProviderCandidate` the client sends
back **as-is**, beyond ordinary Zod structural validation against
`ProviderCandidateSchema` (the same "reject malformed bodies with 400"
pattern every existing route already applies, per task-12). Nothing
checks that the resent object matches what the server actually returned
earlier in the session, or that its FACT-tagged fields are genuine — a
client could in principle resend a `ProviderCandidate` with a
fabricated `rating`/`pricing`/`servicesOffered` value and M10/M11 would
reason over it exactly as if it were real. This mirrors D7's addendum's
already-accepted distinction almost exactly: schema validation enforces
*structure*, never *truth* — that was already true of every FACT in
this system (the research pipeline's extraction step is what's trusted
to be honest, not a runtime check); D14 simply extends "trusted,
unverified input" one hop further, from "trusted because Firecrawl +
Gemini produced it" to "trusted because the client echoed back what the
server itself just sent it."
**Why acceptable here**: there is no auth, no user accounts, and no
multi-tenant boundary in this prototype (explicit assignment
constraint) — the person running the client and the person running the
server are the same trust domain, so "the client could lie to the
server" carries none of the weight it would in a real multi-user
system. This was a considered tradeoff — D14 explicitly rejected
server-side caching, the only mechanism that would close this gap — not
an unnoticed one.
**What this explicitly is NOT**: not a security boundary, not a
substitute for authentication, not evidence that client input is
checked for correctness beyond shape. M12's future task file must state
this plainly rather than letting the Zod check read as a trust check.
**Production Evolution note** (for `DESIGN.md`, once M12 lands): a real
multi-tenant system would need a short-lived, session-scoped
server-side candidate cache (keyed by an opaque id handed to the
client, not the full object) so selection re-reads authoritative data
instead of trusting an echo — the exact mechanism D14 declined for this
prototype in favor of simplicity.
**Status**: PROJECT DESIGN CLARIFICATION, confirmed 2026-08-28, before
implementation of tasks 33-35 began. No change to D14's core decision or
to task-33/34/35 — this is documentation, not a design reversal.

## D15 — M11 (provider response simulation): shape, interface, and error handling

**Decision**: Three design points confirmed before task-37 through
task-40 were written, closing D7's addendum's deferred `Simulated<T>`
question:

1. **`Simulated<T>` shape**: `{ value, generatedAt }` — deliberately
   minimal, no `source`/`sourceUrl` (nothing was retrieved from
   anywhere) and no `evidenceExcerpt`/`sourceType` (nothing to
   excerpt or classify by domain). `generatedAt` instead of
   `retrievedAt` names the distinction directly: this value was
   produced, not observed.
2. **SIMULATED data is never attached to `ProviderCandidate`.** M8's
   `candidate.inferred` precedent is deliberately not repeated here.
   Per the M12 roadmap row, the selection route returns
   `{ questions, simulatedAnswers }` as fields of the route response,
   separate from the `ProviderCandidate` object — so a SIMULATED value
   can never end up co-located on the same entity as FACT/INFERRED
   data, structurally reinforcing Part 5's "clearly separated"
   requirement rather than relying on callers to keep buckets straight
   within one object.
3. **M11's input is `questions: string[]`** (M10's actual
   `prepareProviderQuestions` output), not `ProviderGap[]`. M11 stays
   decoupled from M10's gap-analysis internals — it answers whatever
   questions it's given, with no dependency on gap topics existing.
4. **A simulation failure propagates uncaught**, same precedent as
   task-35's `prepareProviderQuestions` — no per-question
   catch-and-continue. M12's future route maps it to a 502/500 the
   same way it already does for M10/task-12 failures. Rationale
   carried over from D14: batch resilience makes sense for background
   candidates the user may never revisit, not for the one thing the
   user is actively waiting on after selecting a provider.

**Rationale**: Directly implements Part 5 ("simulate their responses
using an LLM," "clearly separated from factual information," "we
should always be able to understand which information is observed/
sourced versus inferred/simulated") and the "Trust & Grounding"
evaluation criterion. Point 2 in particular is a stricter structural
guarantee than M8's `inferred` field pattern, chosen because Part 5
calls this distinction "particularly important" — worth the extra
rigor of never letting SIMULATED and FACT/INFERRED share an object at
all, rather than just labeling them accurately within one.

**Status**: PROJECT DESIGN DECISION, confirmed 2026-08-28, before
implementation of tasks 37-40 began.

## D16 — M14 UX direction: frozen hybrid of Concept 1 (chat-first gathering) + Concept 2 (comparison-first discovery)

**Decision**: Per the `ui-ux-design` skill process, three substantially
different concepts were produced and published as Claude Design
canvases — Concept 1 "Chat-First Concierge" (single interaction model:
chat transcript throughout), Concept 2 "Comparison-First Shortlist"
(persistent comparison board throughout, chat compressed to a search-
style bar), Concept 3 "Event Workspace" (the event as a persistent
object with sections/drill-downs). Concepts 1 and 2 were separately
approved as valid directions; Concept 3 was explored for comparison
but not selected. The final, frozen direction is a deliberate hybrid,
not a fourth from-scratch concept: Concept 1's chat interaction for
requirement gathering (State 1), transitioning to Concept 2's
comparison-list interaction for provider discovery/selection/
investigation (States 2-4). The complete screen-by-screen spec,
including exact backend data per screen, is
`design/m14-ux-spec.md`; visual source is `design/m14-final/`
(published: https://claude.ai/code/artifact/e8595f6e-effa-4049-9c64-989d8eca225e).

**Rationale**: The assignment only requires the UI be "understandable
and thoughtfully designed" (Part 6) — it does not mandate one
interaction model for the whole app. A hybrid was chosen over forcing
a single model end-to-end because the two phases have genuinely
different jobs: gathering benefits from a real conversational feel
(the assignment's own "chat-based application" framing, Part 1's
emphasis on dynamic, non-form-like question asking), while comparing
3-5 ranked providers benefits from seeing them side-by-side rather
than one at a time — Concept 1's single-focus deck and Concept 3's
carousel were both explicitly rejected for the comparison step because
they hide the other candidates while one is in view, working against
Part 3's "rank... with reasoning the user can evaluate" framing.

**Notable refinements made during the concept review process** (kept
here since they're non-obvious and would otherwise be lost):
- The initial Concept 1 draft asked a specific first question
  ("What's your budget?") and offered tap-to-select quick-reply
  buttons — both were corrected as form-like/non-conversational before
  approval; the frozen version opens with a generic prompt and free
  text only.
- The initial Concept 1 "requirements" screen was a separate
  full-page checklist with Required/Optional badges and a "Continue"
  button — corrected to a compact bottom-sheet overlay with no
  required/optional badges, no missing-field rows, and no button
  between chat turns.
- Concept 2's review flagged that its top input bar looked like a
  generic search field while also being used to answer conversational
  questions — resolved in the final hybrid by giving the persistent
  post-gathering control an explicit chat-bubble icon and "Chat"
  label, never a magnifying-glass/search affordance.
- A `.dc.html`/Claude Design mockup provided by the user for aesthetic
  reference (screenshots, a described screen, and later a full
  compiled production stylesheet from a real company's site) was
  **not used as a design source** — recreating a real company's
  distinctive UI, copy, brand name, or licensed typefaces was declined
  per this environment's IP-recreation policy, since the account is
  not verified as belonging to that company; only an abstracted,
  non-identifying token layer (a warm coral/orange accent family, pill
  shapes, soft decorative blobs, rounded cards) was carried forward,
  and even that is a cosmetic choice, not what differentiates the
  three concepts from each other.

**A cross-milestone implementation note surfaced while writing the
spec, not itself a UX decision**: `POST /conversation/:id/providers/select`
(task-44, M12) runs M10 then M11 internally and returns one combined
response — there is no backend event between "questions prepared" and
"answers simulated." The frozen screens show two loading states for
narrative clarity, but M15 must implement that as one client-side
cosmetic animation over a single in-flight request, not two sequential
API calls.

**Addendum (task-62, post-freeze)**: A bug report noted that neither
`ProviderDetailsScreen` nor `SimulatedQAScreen`'s results phase ever
renders the selected provider's name as a distinct header — the frozen
spec's "mobile screen 4, unchanged" / "mobile screens 5/6, unchanged"
notes (screen-by-screen desktop section) said these two screens needed
no changes for the desktop split-pane addendum, but that note never
addressed this readability gap, which exists identically on mobile.
Per direct first-person reviewer instruction, both screens now render
a small `SelectedProviderHeader` at the top, identically on mobile and
desktop (not a desktop-only cosmetic fix) — see task-62's own
Assignment Alignment section for the full rationale and
`design/m14-ux-spec.md`'s screen 4/5-6 entries, updated in place to
reflect this. This is a scoped, reasoned correction to a real
understandability gap (Part 6), not a new redesign — no new screens,
navigation, or interaction model.

**Status**: PROJECT DESIGN DECISION, confirmed 2026-08-29 (reviewer's
own words: "The final UX direction is approved... Freeze this design
as the M14 baseline for implementation"). M14 is complete.
`design/m14-ux-spec.md` is the authoritative reference for M15 task
scoping; no M15 task files exist yet (one-milestone-at-a-time
convention).

## D17 — M15 frontend test stack: Jest + jest-expo + RNTL, not Vitest (revised mid-task-45)

**Decision**: The M15 kickoff's stated technical constraint was
Vitest + React Native Testing Library. During task-45 (frontend
scaffold), Vitest was attempted first, genuinely blocked, and the
stack was revised to Jest + `jest-expo` (Expo's own maintained preset)
+ RNTL — the standard combination every Expo/RN project uses.

**Root cause of the Vitest block**: React Native's own package source
is authored for Metro specifically — CommonJS (`require`/
`module.exports`, including dynamic lazy `require()` calls inside
getters, not just static top-level ones) written with Flow type syntax
(some of it, e.g. `expr as Type` casts, newer than what `@babel/parser`'s
bundled Flow support parses). Vite/Vitest's SSR module runner is
ESM-first: once a file is pulled into its own transform pipeline it no
longer gets a `require` global (that only exists for dependencies Vite
hands off untouched to Node's real loader) — but Node's real loader
can't parse Flow syntax either, so neither path works unmodified.

**What was actually tried, in order, each correctly solving the error
in front of it and surfacing a new one underneath** (full detail:
`tasks/completed/task-45-frontend-scaffold.md`'s `## ITERATE`):
1. `react-native` → `react-native-web` alias + jsdom — abandoned before
   implementation once it became clear `@testing-library/react-native`
   renders via a native test-renderer tree, not a DOM; that combination
   only applies to `@testing-library/react` (the web library).
2. `vite-plugin-babel` running the full `babel-preset-expo` — produced
   correct CommonJS (verified standalone) but Vite's SSR runner can't
   execute raw `require()` in an inlined module.
3. Flow-stripping only (`@babel/plugin-transform-flow-strip-types`,
   leaving module syntax untouched) — hit a real `@babel/parser` gap on
   `expr as Type` casts; fixed by adding `babel-plugin-syntax-hermes-parser`
   (Meta's own parser, kept in sync with Flow's actual syntax) — this
   fix worked (confirmed via a standalone repro) but landed back on the
   same `require is not defined` error from (2).
4. Vite's SSR dependency pre-bundling (`ssr.optimizeDeps` +
   `ssr.noExternal` + a custom esbuild plugin reusing the same
   hermes-parser + flow-strip transform) — the architecturally correct
   lever (esbuild's bundler inlines `require()` calls at bundle time),
   but did not engage under Vitest as configured; diagnosing why would
   require digging into Vitest's own (not raw Vite's) SSR
   dependency-resolution internals.

`jest-expo` solved this completely and immediately, with zero custom
transform configuration — it already ships the Flow-stripping/
native-module-mocking Metro-equivalent behavior this project spent
four attempts partially reconstructing for Vitest.

**A genuinely separate environment finding, kept regardless of the
Jest/Vitest question**: this machine has a Windows Application Control
policy that blocks `dlopen`-loaded native Node addons (`.node` files)
outright — it killed Rollup's native binary specifically
(`ERR_DLOPEN_FAILED: An Application Control policy has blocked this
file`), independent of React Native entirely (esbuild's own binary
loads fine because it's spawned as a subprocess, not `dlopen`'d).
Worth remembering if any future tool on this machine pulls in a
native-addon-based Rollup dependency — the fix (an npm `overrides` entry
pointing `rollup` at the officially-published `@rollup/wasm-node` WASM
build) was removed from `frontend/package.json` once Vite/Rollup were
removed entirely, since nothing in the project depends on Rollup
anymore, but the finding itself is recorded here for reuse.

**A real API discovery, not a config issue, worth flagging for every
subsequent M15 task**: `@testing-library/react-native@14.0.1` (paired
with React 19.2's concurrent rendering) has an **async** `render()` and
`fireEvent.*()`. Omitting `await` on either produces confusing
failures — `render` appears to succeed but `screen` queries report
"render function has not been called," or `fireEvent.press` fires but
assertions race the pending state update and see stale output. Every
M15 component test must `await render(...)` and `await
fireEvent.press(...)` (etc.) — restated in `.claude/CLAUDE.md`'s
Commands section so it isn't lost.

**Rationale**: the M15 kickoff's Vitest instruction was a stated
technical constraint the project should not silently override — task-45
was explicitly written with a "stop and report back" fallback rather
than a "silently substitute Jest" one, confirmed with the reviewer
*before* implementation began, precisely so a genuine blocker like this
one would surface as a decision point, not a silent deviation. Once
blocked, the reviewer made the actual call (Jest) in the same session.

**Status**: PROJECT DECISION (revises the M15 kickoff's stated
constraint), confirmed 2026-08-29, implemented in task-45. No other
M15 task needed rescoping beyond mechanical `vi.*` → `jest.*` API-name
references in task files that hadn't been implemented yet
(task-47/task-49's mock/fake-timer notes).

**Addendum (task-47) — two more gotchas from this same stack
combination (React 19 concurrent + Jest automocking), found writing
`useSession`'s tests**:
1. `jest.mock("some/module")` with no factory (bare automock)
   silently breaks a real `class X extends Error` export's prototype
   chain — `instanceof` checks against it come back `false` inside
   the code under test. Any test mocking a module that also exports a
   real class needs an explicit factory spreading
   `jest.requireActual(...)` and replacing only the plain functions,
   not a bare `jest.mock(path)`.
2. `jest.clearAllMocks()` does not clear queued
   `mockResolvedValueOnce`/`mockRejectedValueOnce` values, which can
   leak between tests in the same file; use `jest.resetAllMocks()` in
   `beforeEach` instead whenever more than one test drives the same
   mocked function.
Both restated in `.claude/CLAUDE.md`'s Commands section alongside the
async-render/fireEvent note, since every remaining M15 task's tests
depend on them.

**Addendum 2 (task-54) — a third gotcha, found wiring the top-level
`App.test.tsx` integration tests**: `jest.mock("module/path")` with
**no factory** still evaluates the real module once (to derive the
automock's shape). Mocking `./hooks/useSession` this way pulled in its
real `AsyncStorage` import and crashed with a native-module error,
even though the module was nominally mocked. Fixed with an explicit
empty factory: `jest.mock("./hooks/useSession", () => ({ useSession:
jest.fn() }))`. Restated in `.claude/CLAUDE.md` as gotcha #5.

## D18 — M15 app orchestration: hand-rolled screen-state machine, presentational screens, two small handoff decisions

**Decision**: `frontend/src/App.tsx` (task-54) is the single place that
knows about the backend API and decides which of five screens is
currently showing (`chat`, `transitionLoading`, `recommendations`,
`providerDetails`, `simulatedQA` — `SimulatedQAScreen`'s own internal
`loading`/`results` phase absorbed what would otherwise have been a
sixth `selectLoading` value, once task-52 shipped that phase union). A
separate `errorContext` value, not a `Screen` member, renders
`ErrorState` *instead of* whatever screen is current when set — this
keeps "which screen was I on" and "did the last action on it fail"
independent, so a successful retry lands back on the right screen with
no extra state to reconcile. Every one of the six screen/component
files (tasks 48-53) is purely presentational — props and callbacks
in, no network calls, no knowledge of navigation — confirmed by
building and testing all six in parallel with no coordination needed
beyond the already-frozen `frontend/src/domain/types.ts` (task-46).

**No navigation library** (React Navigation, expo-router) — confirmed
with the reviewer before any M15 task was written. The flow is a
short, mostly-linear sequence (chat → loading → comparison → details →
loading → answers, with one "back to comparison" branch and a
persistent "reopen chat" affordance) with no deep-linking or
back-stack complexity a routing library would actually earn its keep
solving.

**Two implementation-time decisions made explicit rather than left
ambiguous, both confirmed with the reviewer before/during task-54**:
1. The frozen UX spec's "auto-transition when ready" rule and its
   later-revised "reopening chat sends a message → refresh the
   comparison list" rule are the same event by construction — the very
   message that first reaches `ready_for_search` is *also* "a
   successful post-ready send from Chat." Implemented as one code path
   (react to the *resolved value* of the send call, not a separately-
   watched `state.phase` effect) specifically to avoid a double-fire
   race for that shared first case.
2. Resuming an app session (relaunch with a stored session id) that
   turns out to already be `ready_for_search` — with no message sent
   in this app instance to trigger anything — had no defined behavior
   in the frozen spec. Given no dead-end screen is acceptable, this
   case now runs the identical provider-search path once, automatically,
   after bootstrap. A small, reversible product decision within
   explicitly-open assignment territory (the "Ownership" evaluation
   criterion), recorded here rather than silently assumed.

**Rationale**: matches this project's existing precedent of keeping
each piece single-responsibility and swapping dependencies only when
they'd earn their complexity (D3's research-provider boundary, D6/D9's
"don't build speculatively ahead of demonstrated need") — a full
navigation library and a two-mechanism transition trigger were both
rejected for the same underlying reason: neither was needed to satisfy
what's actually being built.

**Status**: PROJECT DECISION, confirmed 2026-08-29 (navigation
approach confirmed with the reviewer before task-45; the two
transition-handling decisions made during task-54, both recorded in
its own `## ITERATE` section). M15 (frontend implementation) is now
fully complete — all ten tasks (45-54) are `DONE`.

## D19 — Desktop/wide-screen support: non-assignment scope extension, Split-Pane Workspace direction

**Decision**: `assignment-review` (run at the user's explicit request
before any design work) confirmed desktop/wide-screen support is not
an assignment requirement — not in Parts 1–6, not on the Bonus list,
and in tension with the assignment's own "we care more about... than
production-grade infrastructure or visual polish" framing (Context
section) and Part 6's "doesn't need to be beautiful." The user (direct,
first-person instruction, 2026-08-29) chose to pursue it anyway as a
deliberate personal/portfolio scope extension, reasoning that an
interviewer will most likely run and evaluate the app in a desktop
browser. Three concepts were produced via `ui-ux-design` (Responsive
Reflow, Split-Pane Workspace, Grid Comparison Board); **Split-Pane
Workspace was selected**, explicitly rejecting the plain-reflow option
("would look like a mobile UI centered inside a large browser window")
and the grid option (explicit instruction: keep the vertical
comparison list, do not turn it into a grid).

**Refined direction** (also direct instruction): a persistent left
"event/context" panel plus a right main-content area, active only once
provider recommendations exist in memory (initial requirement
gathering stays single-pane/full-width, same as mobile); the vertical
provider list is preserved with all 1–5 candidates simultaneously
visible; selecting a provider replaces right-pane content only, left
context stays visible; M10/M11 also render in the right pane;
returning to chat must not lose the already-held `providers`/
selected-candidate state. Full spec:
`design/m14-ux-spec.md`'s "Desktop / Wide-Screen Adaptation" addendum.

**Rationale**: Explicit first-person user instruction — per this
project's existing approval-gate convention, only the reviewer's own
direct words count as approval, which this is. No backend change, no
React Navigation, and critically **no new `Screen` state value**: the
desktop layout is derived entirely from client state the app already
holds (`providers !== null`) plus viewport width, so D18's five-screen
state machine and every existing screen component stay internally
unchanged — the split is a layout decision, not a new interaction
model.

**Status**: PROJECT DECISION. Explicitly **NOT** an assignment
requirement or Bonus item — must never be cited in
README.md/DESIGN.md's assignment-facing sections as satisfying any
Part 1–6 requirement. Confirmed 2026-08-29, before any frontend task
file was written or any code changed. Next step is a
`piv-task-management` task proposal for implementation.

**Addendum (task-64, 2026-08-29) — Chat's "initial requirement
gathering stays single-pane/full-width" clause above is corrected**:
tasks 55-58 implemented that clause literally, but at wide desktop
widths it produced a visibly stretched, unbounded Chat screen (full
window width, no max-width, message bubbles ballooning to ~1400px+) —
reported directly by the user as a UX bug. Fixed in task-64 with a
**second, independent desktop treatment scoped only to Chat**: while
`providers === null` (i.e. before the split-pane above ever applies),
Chat now renders inside a centered, ~800px-max-width bordered card on
a neutral gray backdrop, active only at `isDesktop` widths (≥1024px);
below that breakpoint, Chat is still genuinely full-bleed/unchanged.
This is deliberately **not** the ContextPanel/split-pane treatment
(no left rail during gathering — confirmed with the user as the right
call, since Chat's own "what I know so far" chip bar already serves
that role inline, and adding a sidebar during pure conversation would
edge toward redesigning the already-frozen M14 chat-first interaction
rather than fixing a layout bug). `ChatScreen.tsx` itself is
unmodified — the card lives entirely in `App.tsx`, mirroring the
existing `rightPaneInner` max-width pattern used by the split-pane
branch. Net effect: three desktop states exist for the app's content
area, not two — (1) `!isDesktop`: full-bleed everywhere, unchanged;
(2) `isDesktop && screen === "chat" && providers === null`: new
centered chat card; (3) `isDesktop && providers !== null`: original
ContextPanel split-pane, unchanged for every screen it already
covered.

## D20 — M16 error-handling audit findings, and rate-limit-specific error classification (tasks 65-68)

**Context**: `docs/Home Assignment.pdf`'s Technical Expectations list
"error handling" explicitly; the roadmap's M16 row states this is
embedded within M3/M4/M7/M8/M12 as each was built, not a separate
milestone to design fresh. A bounded, read-only audit was run against
the already-shipped implementation of those five milestones (no code
changed during the audit itself) to confirm that design held up in
practice, followed by a small, separately-approved implementation pass
addressing what the audit and a direct user bug report actually found.

**Audit verdict**: PASS WITH GAPS. Every audited Gemini/Firecrawl/
empty-result path already failed safely (no crash, no leaked internal
detail, no lost session state, correct per-provider batch resilience
in M8 vs. correct fail-loud in M10/M11 per D14/D15). All findings were
observability/messaging/UX polish, not correctness breaks, and none
were required by the assignment.

**Findings actually acted on (tasks 65-68)**:
1. **Rate-limit-specific error classification (task-65)** — new
   `GeminiRateLimitError` (`backend/src/llm/geminiClient.ts`) and
   `FirecrawlRateLimitError` (`backend/src/research/firecrawlProvider.ts`)
   classes. Gemini's SDK exports a real `ApiError` class with a numeric
   `status`, checked via `instanceof ApiError && status === 429`
   (verified live against `@google/genai`'s type declarations, same
   D2a precedent of confirming SDK shapes rather than assuming them).
   Firecrawl's equivalent (`SdkError`) is **not exported** from
   `@mendable/firecrawl-js`, so its 429 is duck-typed (`"status" in
   error && error.status === 429`) rather than `instanceof`-checked.
   All three action routes (`/message`, `/providers`,
   `/providers/select`) in `server.ts` now return `429` with a shared,
   clear message ("You've hit the rate limit — please wait a moment
   and try again.") when either class propagates, checked *before* the
   existing config/parse/validation → 502 branch. Deliberately scoped
   to 429 only — a general "wrap every possible SDK failure into its
   own class" mechanism was explicitly considered and rejected as
   low-value/not-worth-it (this is the one failure mode a user is
   actually likely to hit and immediately retry into, per the direct
   user report that motivated this task; every other raw SDK failure
   still correctly falls through to the pre-existing generic 500,
   which already fails safely).
2. **`ChatScreen.tsx` was discarding the real error entirely
   (task-66)** — the actual, user-reported bug (screenshot: a failed
   chat send always showed the hardcoded literal "Failed to send," with
   no indication of cause, even once (1) above existed on the backend).
   `attemptSend`'s catch block never referenced the caught error at
   all. Fixed by capturing `error instanceof Error ? error.message :
   "Failed to send."` (mirroring `App.tsx`'s pre-existing
   `errorMessage()` pattern) and rendering it in place of the literal
   string. This is the fix that actually makes (1)'s clear rate-limit
   message reach the user for a chat-send failure specifically —
   without it, the backend classification alone would have had no
   visible effect on the screen the user reported the bug from.
3. **M7 discovery per-candidate failures now logged (task-67)** —
   closes an already-recorded but previously-deliberately-deferred gap
   (see the "M7 real-API validation" Finding 1 above): task-25 (M8)
   added `console.error` logging to `enrichProviderCandidates.ts`'s
   per-candidate catch block but explicitly left
   `discoverProviderCandidates.ts`'s identical-shaped catch block
   unlogged. Mirrored the same one-line `console.error` call; added the
   previously-missing zero-search-results test case at the same time.
4. **`RecommendationsScreen.tsx` empty-state (task-68)** — a
   legitimate `200 { providers: [] }` response (already observed as a
   real, not hypothetical, outcome per the M7 real-API validation's
   Finding 3 on discovery-quality variance by category/location)
   previously rendered as a near-blank screen with only the decorative
   sort row. Added an explicit "no matching providers found" message.

**Rationale**: (1)+(2) directly answer a first-person user bug report
in this session, not a speculative hardening pass. (3)+(4) are the
audit's own lowest-risk, already-approved-in-spirit recommendations
(mirroring an identical pattern already shipped elsewhere in the
codebase), not new design. The audit's remaining, lower-priority
recommendation (wrapping every non-429 raw SDK failure into its own
distinguishable class) was explicitly left undone — both fallback
branches (429 and generic 500) already fail safely, and building a
general classification mechanism for failure modes with no reported
real-world impact would be exactly the kind of ahead-of-need work this
project's existing precedent (D6, D9, D13f) already argues against.

**Status**: PROJECT DECISION + bug fix, confirmed and implemented
2026-08-29 (tasks 65-68, all `DONE`). No assignment requirement was
unmet before this work and none is newly satisfied by it — this is
error-handling *quality*, not new *scope*.

## Open / Deferred

- Exact scoring weights for D8 will be finalized when ranking is
  implemented (M9 — corrected here; this bullet previously said "M8"
  from before the roadmap split Enrichment (M8) and Ranking (M9) into
  separate milestones), based on what data is realistically
  extractable from Firecrawl results.
- UX direction (D4's screens/flows) deferred to the `ui-ux-design`
  skill process — three concepts will be proposed before any
  frontend code is written.
- Per-session request serialization (D11) and its concurrency
  integration test are deferred to M5 task design.
- **Future, not-yet-scoped task — dedicated Google-reviews research
  mechanism** (raised during M8 design review, 2026-08-28; explicitly
  not started, not committed, not a roadmap milestone yet). M8's
  enrichment pipeline (tasks 21-25) uses a *generic* Firecrawl
  search+scrape per candidate (`"<provider> reviews <location>"`) that
  may or may not surface actual Google review content, and tags
  whatever it finds with a deterministic `sourceType` (including
  `"google"` when the result happens to be google-hosted) — this is
  NOT the same as a dedicated Google Reviews integration, and M8 must
  not be built as if it were. A future task, sequenced **after** M8
  ships and its generic pipeline is evaluated in practice (not
  concurrently with M8), would investigate what mechanism/API/tool for
  obtaining Google reviews specifically actually exists and is
  appropriate for this assignment (e.g. a real Google Places/Business
  Profile reviews API vs. scraping Google's own search/maps result
  pages via Firecrawl) before any implementation — explicitly not
  assuming Firecrawl's generic search is equivalent to a Google
  Reviews API, per this project's existing precedent (D2a, D2b) of
  verifying an external mechanism live rather than assuming its
  behavior. Boundary rationale: M8's generic pipeline already satisfies
  the explicit assignment requirement (enrichment + INFERRED with
  evidence pointers, Part 3) without depending on any one specific
  source; a dedicated Google mechanism would be a precision
  enhancement on top of already-satisfied scope, not a gap-filler, so
  it earns its own investigation-first task rather than being folded
  into M8 on an unverified assumption.
