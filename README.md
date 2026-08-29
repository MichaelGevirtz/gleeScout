# GleeScout

An AI event-planning booking agent. The user describes an event in
natural language; GleeScout works out what it still needs to know,
asks for it conversationally, researches real providers on the web,
ranks them, and — for the one provider the user selects — simulates
the questions and answers that would follow if a human actually
reached out.

Rationale for the design (assumptions, architecture decisions,
optimizations, production evolution) lives in [DESIGN.md](DESIGN.md).
This file covers how to run it.

---

## Prerequisites

- **Node.js 20+** and npm
- A **Google Gemini** API key
- A **Firecrawl** API key

## Setup

```bash
git clone <repo-url>
cd gleeScout

# backend
cd backend && npm install

# frontend (in a second terminal)
cd frontend && npm install
```

Then create the backend environment file:

```bash
cp .env.example backend/.env
# edit backend/.env and fill in GEMINI_API_KEY and FIRECRAWL_API_KEY
```

`.env.example` documents every variable the project reads. Nothing is
hard-coded and no key is committed.

## Running

**Backend** (http://localhost:3000):

```bash
cd backend
npm run dev
```

Check it: `curl http://localhost:3000/health` → `{"status":"ok"}`

**Frontend** (Expo):

```bash
cd frontend
npx expo start
# press "w" for web, "a"/"i" for Android/iOS, or scan the QR with Expo Go
```

The app talks to `http://localhost:3000` by default. If you run it on
a physical phone (which cannot reach the dev machine's `localhost`),
set `EXPO_PUBLIC_API_URL` in `frontend/.env` to your machine's LAN
address — see `.env.example`.

## Tests and checks

```bash
cd backend  && npm test && npm run typecheck && npm run build
cd frontend && npm test && npm run typecheck
```

There is also an on-demand extraction evaluation against a golden set
that makes **real** Gemini calls (~2 min, needs a real key). It is
never run by `npm test` or `npm run build`:

```bash
cd backend && npm run eval:extraction
```

---

## Architecture

```
frontend/  Expo + React Native (iOS / Android / web)
             App.tsx owns cross-screen flow; screens are presentational
                     |  HTTP
backend/   Fastify + TypeScript
             domain/         Zod schemas for conversation, provider, evidence
             conversation/   deterministic orchestration, merging, question policy
             llm/            Gemini calls, each Zod-validated on receipt
             research/       Firecrawl web research behind a provider boundary
             ranking/        deterministic scoring and explanation
             recommendation/ provider-list assembly and provider selection
             providerQuestions/  M10 gap analysis + M11 simulated answers
             store/          in-memory session store (no database)
```

**The central rule: the LLM interprets, deterministic code decides.**
The LLM understands intent, proposes which attributes matter, extracts
information, analyzes provider content, phrases questions, and
simulates provider replies. Deterministic application logic owns
structured state, validation, merging, workflow transitions, readiness,
question selection, deduplication, provenance, and ranking. Every LLM
response is validated with a Zod schema before it is allowed to enter
application state — the LLM contributes to state but is never the
authoritative source of it.

State is in-memory only. There is no database, no auth, and no user
accounts, per the assignment's constraints. Restarting the backend
loses sessions; the app detects this and starts a fresh one.

### API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | liveness |
| `POST` | `/conversation` | start a session |
| `GET` | `/conversation/:id` | fetch session state |
| `POST` | `/conversation/:id/message` | send a user message, get updated state |
| `POST` | `/conversation/:id/providers` | research + rank providers (only once `phase` is `ready_for_search`) |
| `POST` | `/conversation/:id/providers/select` | select one provider → simulated Q&A |

A conversation is in phase `gathering` until date/time, location, and
the category-specific attributes the LLM proposed are all present; it
then becomes `ready_for_search`.

---

## Design

The UX was designed before any frontend code was written: three
substantially different concepts were produced, one direction was
selected, and a desktop variant followed. That exploration is in
[`design/`](design/) and is **viewable without installing anything** —
open any of these files directly in a browser:

| File | What it shows |
| --- | --- |
| `design/m14-final/gleescout-ux-final.html` | **The selected direction** — start here |
| `design/m14-desktop/gleescout-desktop-split-pane.html` | Desktop split-pane variant |
| `design/m14-concept-{1,2,3}/gleescout-ux-concept-*.html` | The three original concepts |

Each is a self-contained canvas showing every screen side by side; pan
and zoom to move around it. The per-screen sources sit next to it as
`*.dc.html`, and the written spec is
[`design/m14-ux-spec.md`](design/m14-ux-spec.md).

---

## FACT / INFERRED / SIMULATED

Every piece of provider information carries its provenance, and the
three kinds are kept **structurally separate** all the way from the
backend schemas through to distinct sections of the UI. Simulated data
can never overwrite factual data.

| Kind | Where it comes from | How it is shown |
| --- | --- | --- |
| **FACT** | Scraped directly from a provider's own page. Carries the source URL. | "Sourced facts", with its source shown |
| **INFERRED** | Derived by the LLM from review/third-party text. Carries the source URL, an excerpt, and the source type. | "Inferred from reviews", captioned *"Inferred from review patterns — not confirmed by the provider."* |
| **SIMULATED** | Generated by the LLM to imitate a plausible provider reply. Not evidence of anything. | Only on the simulated Q&A screen, behind an explicit banner and a per-answer `SIMULATED · NOT CONFIRMED` badge |

### No provider is ever actually contacted

This is worth stating plainly. After the user selects a provider, the
backend runs two steps:

- **M10** — analyzes what the gathered requirements still leave
  unanswered about *that* provider, and phrases the questions a person
  would ask them.
- **M11** — generates a **simulated** answer to each of those
  questions.

No email is sent, no form is submitted, no call is made. **GleeScout
never contacts a real provider.** The simulated Q&A screen says so
directly ("We have not actually contacted …") and badges every answer,
so simulated content is never presented as a confirmed provider
response. Simulation runs only for the provider the user actually
selects — never for the whole list.
