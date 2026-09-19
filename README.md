# AI Interview Prep Kit

An assessment project that will eventually turn a job description, a company
website URL, and a number of days-until-interview into a structured interview
preparation kit: a company brief, role breakdown, requirements, interview
questions, flashcards, a study schedule, and a coverage report.

The project is being built in explicit stages. **The AI generation pipeline
is not fully implemented yet.** As of this step, only requirement extraction
(job description → structured requirements) is wired to a real language
model. Question generation, company research/scraping, scheduling, coverage
checking, persistence, and authentication do not exist yet.

## Current tech stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, ESLint
- **Backend:** Node.js, Express, TypeScript, Zod, dotenv, CORS
- **Shared:** a single canonical `@interview-prep-ai/shared` workspace holding
  the InterviewKit TypeScript types and Zod schemas
- **LLM:** Google Gemini (`gemini-1.5-flash` by default), called directly via
  `fetch` — no provider SDK — behind a small `LLMProvider` interface so other
  providers can be added later without touching extraction logic
- **Tooling:** npm workspaces, Node's built-in test runner (`node:test`) via
  `tsx`

No database, authentication, scraping, or deployment tooling exists yet by
design.

## Project structure

```
interview-prep-ai/
├── frontend/                        Next.js app (minimal starter page)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── eslint.config.mjs
│   └── .env.example
│
├── backend/                         Express + TypeScript API
│   ├── src/
│   │   ├── app.ts                   Express app wiring (routes, middleware)
│   │   ├── server.ts                process entry point
│   │   ├── routes/
│   │   │   ├── health-routes.ts     GET /api/health
│   │   │   └── requirement-routes.ts  POST /api/requirements/extract
│   │   ├── controllers/
│   │   │   └── requirement-controller.ts
│   │   ├── services/
│   │   │   ├── requirement-extractor.ts   Step 3 pipeline stage
│   │   │   ├── prompts/
│   │   │   │   └── requirement-extraction-prompt.ts
│   │   │   └── llm/
│   │   │       ├── llm-provider.ts        provider interface
│   │   │       ├── gemini-provider.ts     real Gemini implementation
│   │   │       └── provider-factory.ts    env-driven provider selection
│   │   ├── schemas/
│   │   │   ├── requirement-request.ts     HTTP request validation
│   │   │   └── llm-requirement-output.ts  raw LLM payload validation
│   │   ├── types/
│   │   │   └── errors.ts                  AppError / ProviderError
│   │   ├── utils/
│   │   │   ├── json-extract.ts            tolerant JSON extraction
│   │   │   ├── requirement-normalizer.ts  dedupe + deterministic IDs
│   │   │   ├── retry.ts                   small retry helper
│   │   │   └── logger.ts
│   │   └── testing/
│   │       └── fake-llm-provider.ts       test double, excluded from build
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── shared/                          Canonical InterviewKit contract
│   ├── types/interview-kit.ts
│   ├── schemas/
│   │   ├── interview-kit.ts
│   │   └── interview-kit.test.ts
│   ├── fixtures/valid-interview-kit.ts
│   ├── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
├── .gitignore
├── .env.example
├── README.md
└── package.json                     workspace root
```

## Local setup

Requires Node.js 20+ and npm 10+.

```bash
git clone <this-repo>
cd interview-prep-ai
npm install
```

`npm install` installs dependencies for all three workspaces (`shared`,
`backend`, `frontend`) in one pass.

Copy the environment templates:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

`backend/.env` needs a real `LLM_API_KEY` only if you want to exercise
`POST /api/requirements/extract` against the live model. Without one, the
server still starts and `GET /api/health` still works; the extraction
endpoint returns a structured `LLM_NOT_CONFIGURED` error instead of
fabricating data.

## Running the project

The `shared` package must be built once before the backend can resolve it
(it's a compiled workspace dependency, not a source import):

```bash
npm run build:shared
```

Then, from the repo root:

```bash
npm run dev              # shared build + backend + frontend, concurrently
npm run dev:backend      # backend only  → http://localhost:5000
npm run dev:frontend     # frontend only → http://localhost:3000
```

Other useful scripts from the root:

```bash
npm run build            # build shared, backend, frontend
npm run typecheck        # typecheck shared + backend
npm run test             # run shared + backend test suites
npm run lint:frontend    # ESLint on the frontend
```

## Health endpoint

```
GET /api/health
```

```json
{ "status": "ok" }
```

## Step 3 — Requirement Extraction

The first stage of the AI generation pipeline: turning raw job-description
text into structured, schema-validated requirements. This is the only
pipeline stage implemented so far. It does not generate questions,
flashcards, schedules, or company research, and it does not persist
anything.

> **Verification status:** the extraction service and Gemini provider are
> implemented and fully covered by automated tests against a fake provider,
> and the HTTP endpoint has been manually verified end-to-end for the
> no-credentials path (`INVALID_JD`, `LLM_NOT_CONFIGURED`, and
> `GET /api/health`). **A real call to the live Gemini API has NOT been
> performed**, because no `LLM_API_KEY` credentials were available in this
> environment. The Gemini integration is therefore unverified against the
> real provider until someone runs it with a real key.

**Endpoint:** `POST /api/requirements/extract`

**Request:**

```json
{ "jd": "Frontend Developer with React, TypeScript..." }
```

**Success response (200):**

```json
{
  "requirements": [
    {
      "id": "req-001",
      "text": "Experience with React",
      "kind": "technical",
      "priority": "must"
    }
  ]
}
```

**Error responses:**

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_JD` | 400 | JD missing, not a string, empty, or over the length limit |
| `LLM_NOT_CONFIGURED` | 500 | No `LLM_API_KEY` configured on the server |
| `LLM_PROVIDER_ERROR` | 502 | The provider call failed (timeout, rate limit, bad credentials, etc.) |
| `INVALID_LLM_OUTPUT` | 502 | The model's output could not be parsed into valid requirements, even after one repair attempt |

Error bodies never include API keys, stack traces, or raw provider
responses — only a stable `code` and a client-safe `message`.

### Pipeline

```
raw JD text
  → validateJobDescription()        reject empty / non-string / oversized
  → LLM call (Gemini)                system instruction + delimited JD as data
  → extractJsonObject()              strip markdown fences / surrounding prose
  → Zod validation (raw LLM shape)   malformed output → repair retry (max 1)
  → normalizeRequirements()          trim whitespace, drop empties, dedupe
  → deterministic ID assignment      req-001, req-002, ... by surviving order
  → RequirementSchema (canonical)    final guard before returning
```

The canonical `Requirement` type and `RequirementSchema` live in
`shared/` and are imported, not redefined, by the backend.

### LLM provider abstraction

`backend/src/services/llm/llm-provider.ts` defines a two-method
`LLMProvider` interface. `gemini-provider.ts` is the only implementation
today, selected via environment variables through
`provider-factory.ts`. Adding OpenAI, Anthropic, or another provider means
writing one new file that implements the interface — no changes to
`requirement-extractor.ts`.

### Deterministic IDs

Requirement IDs are assigned by position after normalization and
deduplication (`req-001`, `req-002`, ...) — never from model-provided IDs,
`Math.random()`, `Date.now()`, or UUIDs. The same ordered, normalized input
always produces the same IDs, which matters because later stages
(questions, flashcards, coverage, schedule) will reference these IDs.

### Normalization

Whitespace is collapsed and trimmed; empty entries are dropped; exact
duplicates (case- and trailing-punctuation-insensitive) are merged, with a
`must` duplicate upgrading an earlier `nice` entry. Normalization does not
do semantic merging — "Experience with React" and "Experience with React
Native" are kept as distinct requirements.

### Retry / error handling

Two independent, capped mechanisms:

- **Transient provider failures** (timeout, rate limit, 5xx): up to 2 total
  attempts with short exponential backoff. Non-retryable failures (e.g. HTTP
  401/403) fail immediately.
- **Invalid structured output**: if the model's response can't be parsed
  into valid requirements, exactly one repair attempt is made with a
  stricter instruction. If that also fails, the request fails with
  `INVALID_LLM_OUTPUT` — no loop, no silent fallback to fake data.

### Security

The job description is treated as untrusted data, not instructions. It is
wrapped in explicit delimiters in the prompt, and the system instruction
tells the model to ignore any embedded attempt to override its behavior
(e.g. "ignore previous instructions...").

### Testing

All extraction tests run against a `FakeLLMProvider` test double
implementing the real `LLMProvider` interface — no test depends on network
access or real credentials. Coverage includes: valid output, deterministic
IDs, duplicate removal, whitespace normalization, invalid `kind`/`priority`,
malformed/fenced JSON, one repair retry then success, persistent invalid
output, empty JD rejection, thin-JD handling, provider failure, and
transient-failure retry within the attempt limit.

**Real Gemini API testing has NOT been performed.** No `LLM_API_KEY`
credentials were available in the environment this project was built in, so
the live-provider path (`gemini-provider.ts` actually reaching
`generativelanguage.googleapis.com`) has not been exercised. Everything
above it — request validation, JSON extraction, Zod validation,
normalization, deterministic IDs, retry/error handling, and the HTTP
endpoint — has been verified against the fake provider and with manual
`curl` requests to a running server. To verify the real integration, set
`LLM_API_KEY` in `backend/.env` and send a request to
`POST /api/requirements/extract`.

### Environment variables

Set in `backend/.env` (see `backend/.env.example`):

```
PORT=5000
LLM_PROVIDER=gemini
LLM_API_KEY=your-api-key-here
LLM_MODEL=gemini-1.5-flash
LLM_TIMEOUT_MS=30000
```

`LLM_API_KEY` has no working default. Without it, the extraction endpoint
returns `LLM_NOT_CONFIGURED` rather than fabricating requirements.

### Not implemented in this step

Company scraping/research, question generation, flashcard generation,
schedule generation, coverage checking, MongoDB persistence, authentication,
and any frontend UI beyond the Step 1 starter page.

## Step 4 — Requirements → Interview Questions

The second stage of the AI generation pipeline: transforming an array of validated
requirements (`Requirement[]`) into grounded, schema-validated interview questions
(`InterviewQuestion[]`).

Each question is strictly grounded in one or more supplied requirement IDs, and
evaluated across standard categories (`technical`, `behavioural`, `system-design`,
`company-fit`) and difficulty ratings (`1`, `2`, `3`).

> **Verification status:** the question-generation service and LLM pipeline are
> implemented and fully covered by automated unit/integration tests against a fake
> provider (`FakeLLMProvider`), and the HTTP endpoint has been verified for both
> successful responses and failure modes (`INVALID_REQUIREMENTS`, `INVALID_REQUEST`,
> `LLM_NOT_CONFIGURED`, `LLM_PROVIDER_ERROR`, `INVALID_LLM_OUTPUT`). **A real call to the
> live Gemini API has NOT been performed**, because no `LLM_API_KEY` credentials were
> present in this environment. The integration operates through the same provider
> abstraction established in Step 3.

**Endpoint:** `POST /api/questions/generate`

**Request:**

```json
{
  "requirements": [
    {
      "id": "req-001",
      "text": "Strong experience with React and state management",
      "kind": "technical",
      "priority": "must"
    },
    {
      "id": "req-002",
      "text": "Experience leading technical discussions and mentoring junior engineers",
      "kind": "behavioural",
      "priority": "must"
    }
  ]
}
```

**Success response (200):**

```json
{
  "questions": [
    {
      "id": "q-001",
      "prompt": "How do you evaluate state management solutions in a React application?",
      "category": "technical",
      "difficulty": 2,
      "requirement_ids": ["req-001"],
      "answer_outline": "Discuss criteria such as bundle size, rendering performance, boilerplate, and team familiarity."
    },
    {
      "id": "q-002",
      "prompt": "Describe a scenario where you mentored an engineer through an architectural decision.",
      "category": "behavioural",
      "difficulty": 2,
      "requirement_ids": ["req-002"],
      "answer_outline": "Highlight coaching techniques, active listening, trade-off analysis, and outcome evaluation."
    }
  ]
}
```

**Error responses:**

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_REQUEST` | 400 | Request body missing or invalid structure (e.g. requirements not an array) |
| `INVALID_REQUIREMENTS` | 400 | Empty requirements list or invalid requirement items |
| `LLM_NOT_CONFIGURED` | 500 | No `LLM_API_KEY` configured on the server |
| `LLM_PROVIDER_ERROR` | 502 | Provider failure (transport, rate limits, 5xx, or authentication) |
| `INVALID_LLM_OUTPUT` | 502 | Model output could not be parsed, lacked required fields, or persistently referenced unknown requirement IDs |

### Pipeline

```
Requirement[]
  → validateRequirements()          reject non-arrays, empty lists, or invalid items
  → buildUserContent()               format requirements within <<<REQUIREMENTS_START/END>>>
  → LLM call (Gemini)                system instruction with grounding rules + delimited user data
  → extractJsonObject()              strip markdown fences / surrounding prose
  → Zod validation (wire shape)      LlmQuestionOutputSchema (rejects empty prompts/outlines & unknown IDs)
  → repair retry (max 1)             stricter correction instruction if output is invalid
  → normalizeQuestions()             trim whitespace, dedupe by prompt, merge requirement IDs
  → deterministic ID assignment      q-001, q-002, ... by surviving order
  → InterviewQuestionSchema guard    referential integrity check (question.requirement_ids ⊆ input IDs)
```

### Grounding and security

Requirements originate from user-provided job descriptions and are treated strictly as untrusted data.
They are encapsulated within explicit security delimiters:
`<<<REQUIREMENTS_START>>>` and `<<<REQUIREMENTS_END>>>`.
The system prompt instructs the model that content between delimiters is data to analyze, not instructions to execute, neutralizing prompt-injection attempts.

Every question generated must map directly to one or more supplied requirement IDs (`requirement_ids ⊆ supplied requirement IDs`). Model-invented requirement IDs and questions referencing nonexistent requirements are rejected.

### Deterministic IDs

Application code assigns stable, sequential IDs (`q-001`, `q-002`, ...) based on the surviving order after normalization and deduplication. Model-generated IDs, random identifiers, and timestamps are discarded.

### Normalization and deduplication

- Prompts and answer outlines are trimmed and internal whitespace collapsed. Empty prompts or outlines are strictly rejected by Zod wire validation before normalization occurs and are never silently converted or dropped.
- Exact and near-duplicate questions (case- and punctuation-insensitive) are collapsed, preserving the earlier question and merging referenced requirement IDs.

### Error and retry strategy

- **Transient provider failures**: up to 2 attempts with exponential backoff.
- **Malformed JSON or invalid schema**: exactly one targeted repair pass with `QUESTION_GENERATION_REPAIR_INSTRUCTION`.
- If the repair fails or the model persistently returns invalid questions, `INVALID_LLM_OUTPUT` (502) is raised.

### Deferral notice (Step 5)

Step 4 only produces the initial grounded question draft. The following are intentionally deferred to Step 5:
- Uncovered requirement detection
- Requirement coverage scoring
- Missing-question detection and second-pass generation
- Coverage repair and "all must requirements covered" enforcement

### Testing

Tests run using `FakeLLMProvider` and test suites:
- `backend/src/utils/question-normalizer.test.ts`
- `backend/src/services/question-generator.test.ts`
- `backend/src/app.test.ts` (API integration tests for `POST /api/questions/generate`)

Coverage includes: valid questions generation, empty requirements rejection, non-array rejection, unknown requirement ID rejection and repair, invalid categories/difficulties, empty prompt/outline handling, markdown fences, single repair success, persistent repair failure, duplicate deduplication, deterministic IDs, and prompt injection safety.

## Roadmap

```
Step 1  Project foundation                         ✅ done
Step 2  InterviewKit contract (types + schemas)     ✅ done
Step 3  Job description → Requirements              ✅ done
Step 4  Requirements → Questions                    ✅ done (this step)
Step 5  Coverage + missing-question second pass      not started
Step 6  Deterministic study schedule                not started
Step 7  Company research                            not started
Step 8+ Persistence, auth, kit builder UI, practice
        mode, batch evaluation, deployment           not started
```
