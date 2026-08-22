# System Architecture

> Covers: system topology, monorepo layout, API design, authentication/authorization.
> Database in `03-data-model.md`, exam engine in `04-exam-engine.md`, AI in `05-ai-tutor.md`.

---

## 1. Topology

```
                    ┌───────────────────────────┐
   Browser  ───────▶│  Next.js  (apps/web)      │
   (student)        │  App Router · RSC · TS    │
                    │  - UI + routing            │
                    │  - Server Components fetch │
                    │    via server-side API cli │
                    │  - Client Components fetch │
                    │    via BFF route handlers  │
                    └─────────────┬─────────────┘
                                  │  HTTPS + Clerk JWT (Bearer)
                                  ▼
                    ┌───────────────────────────┐
                    │  Express  (apps/api)      │
                    │  ┌─────────────────────┐  │
                    │  │ routes (HTTP only)   │  │  thin: parse, delegate, respond
                    │  ├─────────────────────┤  │
                    │  │ middleware          │  │  auth · validate · rate-limit · log · errors
                    │  ├─────────────────────┤  │
                    │  │ services            │  │  ALL business logic lives here
                    │  ├─────────────────────┤  │
                    │  │ repositories        │  │  Prisma queries, kept out of services
                    │  └─────────────────────┘  │
                    └──────┬──────────────┬─────┘
                           │              │
                           ▼              ▼
                  ┌──────────────┐   ┌──────────────┐
                  │ PostgreSQL   │   │ AI provider  │
                  │ (Prisma)     │   │ (abstracted) │
                  └──────────────┘   └──────────────┘
                           ▲
                  ┌────────┴────────┐
                  │ Clerk (webhooks)│  user.created/updated → sync User row
                  └─────────────────┘
```

Shared, versioned in the monorepo: **Zod schemas and TypeScript types** (`packages/contracts`) imported by _both_ web and api. This is what makes the frontend/backend split cheap instead of painful — one definition of `CreateQuestionInput`, used for the API's runtime validation and the form's client-side validation and the response type.

### Why keep a separate Express API? (the brief allows changing this)

**Recommendation: keep it.** Next.js Route Handlers could host all of this, and for a solo developer that would mean one deployment instead of two. The honest case for two:

- **The exam engine needs to be provably server-authoritative.** A clean, separately deployed API where _every_ mutation is validated server-side makes it structurally impossible to accidentally trust the client. In a single Next app, the boundary between "server component that reads the DB" and "client component" is real but easy to blur under deadline pressure — which is exactly how exam-integrity bugs get shipped.
- **Background work is coming** — the auto-submit sweeper, AI usage rollups, and later spaced-repetition scheduling. These want a long-lived Node process, which Express gives you and Next's serverless model does not.
- **A future mobile app or teacher portal** consumes the same API without refactoring.
- **The learning goal is explicit.** Seeing routes → services → repositories as separate, testable layers is worth more pedagogically than the deployment convenience of merging them.

**The costs, stated plainly:** two deploys, CORS configuration, an extra network hop, and the risk of type drift between apps. The first three are one-time setup. The fourth is solved by `packages/contracts` — which is _why_ that package exists.

**The one concession:** Next.js Route Handlers are used as a thin BFF for browser-initiated calls, so the Clerk session token never has to be handled manually in client JS, and so we can stream AI responses through a same-origin endpoint. They forward to Express; they contain no business logic.

---

## 2. Monorepo structure

**Tooling: pnpm workspaces + Turborepo.** pnpm for strict, disk-efficient, phantom-dependency-free installs. Turborepo for task orchestration and caching — it is the lowest-ceremony option that does the two things that matter (`turbo run build` respecting the dependency graph, and not re-running unchanged work). Nx is more powerful and more to learn; plain pnpm workspaces would work but you re-run everything every time. Turborepo is the right point on that curve here.

```
samjho/
├── apps/
│   ├── web/                       # Next.js 15 · App Router
│   │   ├── src/app/
│   │   │   ├── (marketing)/       # public, SEO
│   │   │   ├── (onboarding)/
│   │   │   ├── (app)/             # student, app shell
│   │   │   ├── (exam)/            # exam shell — separate route group, own layout
│   │   │   ├── (admin)/
│   │   │   └── api/               # BFF route handlers only (proxy + AI stream)
│   │   ├── src/features/          # feature-first, NOT type-first
│   │   │   ├── practice/          #   components/ hooks/ api/ types
│   │   │   ├── exam/
│   │   │   ├── ai-tutor/
│   │   │   ├── progress/
│   │   │   └── admin/
│   │   ├── src/lib/               # api-client, auth helpers, formatting
│   │   └── src/components/        # app-level shared components
│   │
│   └── api/                       # Express 5 · TypeScript
│       ├── src/
│       │   ├── server.ts          # bootstrap only
│       │   ├── app.ts             # middleware wiring, testable without listening
│       │   ├── modules/           # ← the modular monolith seam
│       │   │   ├── auth/
│       │   │   ├── catalog/       # subjects, chapters, topics
│       │   │   ├── questions/
│       │   │   ├── practice/
│       │   │   ├── exams/
│       │   │   ├── progress/
│       │   │   ├── ai/
│       │   │   └── admin/
│       │   │       └── each: *.routes.ts · *.service.ts · *.repository.ts · *.schema.ts · *.test.ts
│       │   ├── middleware/        # requireAuth · requireRole · validate · rateLimit · errorHandler · requestContext
│       │   ├── lib/               # prisma client, logger, config, errors
│       │   └── jobs/              # exam sweeper, usage rollups
│       └── prisma/
│           ├── schema.prisma
│           ├── migrations/
│           └── seed/              # taxonomy, blueprints, sample questions
│
├── packages/
│   ├── contracts/                 # ★ Zod schemas + inferred types + API route constants
│   ├── ui/                        # shadcn/ui primitives + Samjho components (QuestionRenderer, MathText, …)
│   ├── config/                    # eslint, tsconfig, tailwind presets
│   └── exam-blueprints/           # versioned blueprint JSON + their Zod schema + validator
│
├── turbo.json
├── pnpm-workspace.yaml
└── docs/
```

Two structural choices worth explaining:

**`packages/contracts` is the keystone.** It exports Zod schemas; types are _derived_ (`z.infer`), never hand-written in parallel. Express validates requests with the schema; the web app validates forms with the same schema and types its fetch responses from it. A breaking API change becomes a TypeScript error in the web app at build time rather than a runtime 400 in production.

**`apps/api/src/modules/*` is the modular-monolith seam.** Each module owns its routes, service, repository, and schemas. The rule that keeps it modular: **modules call other modules through their service layer, never through another module's repository, and never by importing another module's Prisma queries.** Honour that and any module could later become a separate service without a rewrite. Ignore it and you have a big ball of mud with folders. There is no microservice plan — this is just about keeping the option open for free.

**`packages/ui` vs `apps/web/src/components`:** `packages/ui` holds genuinely reusable, app-agnostic pieces (design primitives, `QuestionRenderer`, `MathText`, `DataState`). Anything that knows about routing or app state stays in `apps/web`. Premature extraction into `packages/ui` is a common monorepo mistake; the default is `apps/web`, and things graduate.

---

## 3. API design

### Conventions

- Base: `/api/v1`. Versioned from day one — it costs nothing now and everything later.
- REST-ish, resource-oriented. Plural nouns. Verbs only for genuine state transitions (`POST /exam-attempts/:id/submit`).
- All request bodies, query params, and route params validated by Zod at the edge. **A handler never sees unvalidated input.**
- Response envelope: `{ data, meta? }` on success; `{ error: { code, message, details?, requestId } }` on failure. Consistent shape means one client-side error handler.
- Cursor pagination on every list endpoint that can grow (questions, attempts, sessions). Offset pagination on a 200k-row question table with filters is a performance trap.
- Idempotency keys on `POST /exam-attempts`, `/submit`, and answer saves.

### Endpoint map (MVP)

**Catalog** _(cacheable, mostly public)_

```
GET  /catalog/subjects?classLevel=12&board=CBSE
GET  /catalog/subjects/:id
GET  /catalog/subjects/:id/chapters
GET  /catalog/chapters/:id            → chapter + topics + question counts by type/difficulty
```

**Questions**

```
GET  /questions                       → filtered, paginated (student view: no answer key)
GET  /questions/:id                   → answer key omitted unless the student has attempted it
```

> Critical: the student-facing question serializer **strips `correctAnswer`, `solution`, and `markingScheme`** unless the attempt is graded. Two separate serializers (`toStudentQuestion`, `toAdminQuestion`), never one function with a boolean flag — flags get passed wrong.

**Practice**

```
POST /practice-sessions               { filters, count } → creates session + materialised question list
GET  /practice-sessions/:id           → session + current position + progress
POST /practice-sessions/:id/attempts  { questionId, answer, timeSpentMs } → graded result
POST /practice-sessions/:id/complete
GET  /practice-sessions/:id/result
GET  /practice-sessions               → history
```

**Exams**

```
GET  /exam-papers?subjectId=&classLevel=
GET  /exam-papers/:id                 → structure/instructions, NOT the questions
POST /exam-attempts                   { examPaperId }  [idempotent] → attempt + startedAt + deadlineAt
GET  /exam-attempts/:id               → full resumable state (questions + saved answers + server time)
PUT  /exam-attempts/:id/answers/:slotId  { answer, status, revision } → autosave
POST /exam-attempts/:id/heartbeat     → server time sync + liveness
POST /exam-attempts/:id/submit        [idempotent] → locks attempt, auto-grades objective
POST /exam-attempts/:id/evaluations   { slotId, selfMarks } → subjective self-grading
GET  /exam-attempts/:id/result
```

**Progress**

```
GET  /progress/summary
GET  /progress/subjects/:id
GET  /progress/weak-topics
GET  /progress/mistakes               → paginated, filterable
GET  /progress/bookmarks
POST /bookmarks  ·  DELETE /bookmarks/:questionId
```

**AI**

```
POST /ai/conversations                { questionId, attemptId? }
POST /ai/conversations/:id/messages   { action, content? } → SSE stream
GET  /ai/conversations/:id
GET  /ai/usage                        → quota remaining
```

**Admin** — `/admin/*`, role-gated

```
GET|POST         /admin/questions
GET|PATCH|DELETE /admin/questions/:id
POST             /admin/questions/:id/publish  ·  /unpublish
POST             /admin/questions/import       → dry-run + commit
CRUD             /admin/subjects · /chapters · /topics
CRUD             /admin/exam-papers · /admin/blueprints
GET              /admin/users  ·  PATCH /admin/users/:id/role
```

**Identity & profile** _(Phase 2, shipped)_

```
GET   /me                             → user + student profile + onboarding state
POST  /me/onboarding                  → idempotent; creates profile, target exam, enrolments
PATCH /me/profile                     → partial edit; class level and board deliberately absent
GET   /catalog/subjects?board=&classLevel=
```

**Catalog & question browsing** _(Phase 3, shipped)_

```
GET  /catalog/subjects/:idOrSlug          → subject + chapters + domains + counts
GET  /catalog/subjects/:idOrSlug/chapters → chapters grouped by domain
GET  /catalog/chapters/:idOrSlug          → chapter + topics + counts by type/difficulty
GET  /questions?subjectId=&chapterId=&topicId=&type=&difficulty=&marks=&search=&cursor=
GET  /questions/:id                       → the student view; no answer key exists on this shape
```

> `:idOrSlug` because students arrive from readable URLs while code holds ids.
> Visibility (published, licence-cleared, active chapter and subject) lives in a
> single `STUDENT_VISIBLE_QUESTION` clause every query spreads in — a predicate
> you have to remember to add is not a control.

**Admin taxonomy** _(Phase 3, shipped — `ADMIN` or `CONTENT_EDITOR`)_

```
GET   /admin/catalog/subjects?board=&classLevel=&includeInactive=
POST  /admin/catalog/subjects                     · PATCH /admin/catalog/subjects/:id
GET   /admin/catalog/subjects/:id/chapters        · POST  /admin/catalog/subjects/:id/chapters
PUT   /admin/catalog/subjects/:id/chapters/order  → the whole order, in one transaction
GET   /admin/catalog/chapters/:id                 · PATCH /admin/catalog/chapters/:id
POST  /admin/catalog/chapters/:id/topics          · PUT   /admin/catalog/chapters/:id/topics/order
PATCH /admin/catalog/topics/:id
```

> **No `DELETE`.** Taxonomy foreign keys are `onDelete: Restrict`, so nothing
> anyone has used can be removed; `PATCH { isActive: false }` withdraws a subject
> or chapter _and_ its questions, and can be undone.
>
> **Reordering takes the whole list.** Per-row `orderIndex` PATCHes leave the list
> with duplicate indexes between requests, and a failure halfway leaves an order
> that is neither the old one nor the new one, with nothing recording it.
>
> Mounted under its own prefix rather than as extra verbs on `/catalog`, so
> opening the catalog to anonymous traffic for the Phase 9 SEO pages cannot
> open the writes with it.

**Question authoring** _(Phase 4, shipped — `ADMIN` or `CONTENT_EDITOR`)_

```
GET  /admin/questions?subjectId=&chapterId=&topicId=&type=&difficulty=&status=&licenceStatus=&search=&cursor=
POST /admin/questions                 → the whole question tree, one document, one transaction
GET  /admin/questions/:id             · PUT /admin/questions/:id
PUT  /admin/questions/:id/status      → DRAFT · IN_REVIEW · PUBLISHED · ARCHIVED
GET  /admin/questions/:id/revisions   → the audit trail, field by field
POST /admin/questions/import          → bulk, dry-run by default, all-or-nothing
GET  /admin/dashboard/content         → counts by status and licence, plus the empty chapters
```

> **A question is written as one document, not six endpoints.** It is a tree —
> stem, options, answer key, provenance, topic links, sub-parts with their own
> children — and an MCQ with no options is not a valid intermediate state. Six
> sequential saves also cannot reach the phase gate's 90-second median.
>
> **The per-type rules live in `packages/contracts`.** "An MCQ has exactly one
> correct option", "a numerical question needs a tolerance", "a case study's
> sub-parts must add up to its marks" are enforced from one table
> (`QUESTION_TYPE_RULES`) that the admin form reads to decide what to render, the
> API runs on every write, and bulk import gets for free. Three doors, one
> validator.
>
> **Status is a separate endpoint from content.** "Save my edits" and "let
> students see this" are different decisions; folding them together makes every
> save a publish for anyone who leaves a dropdown alone.
>
> **Publication is gated on the licensing decision.** A source row defaults to
> `NEEDS_REVIEW` and a question carrying it cannot be published — docs/07 R2's
> mitigation made into a refusal, so the audit happens one question at a time by
> the person holding the source paper.
>
> **The version bumps only when the content hash moves.** Retagging a question as
> HARD or fixing an attribution leaves the version alone, because from Phase 5
> every attempt records the version it saw. The revision log is numbered
> separately and records everything, including status moves.
>
> **Import is dry-run by default and all-or-nothing.** It reports every bad row
> at once with its file index and the author's own reference, rejects rows
> duplicated within the file or already in the bank, and writes nothing unless
> every row is valid.

**Webhooks**

```
POST /webhooks/clerk                  → Svix-signature-verified user sync
```

> Mounted **before** `express.json()`. Svix signs the bytes Clerk sent; once the JSON parser has consumed the stream those bytes are gone, and re-serialising the object does not reproduce them. The handler is awaited before responding, so a failed write returns 500 and Svix retries — safe precisely because every handler is an upsert.

### Data fetching split in Next.js

| Case                                                             | Mechanism                                                       | Why                                                                 |
| ---------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Initial page data (dashboard, chapter list, exam list)           | Server Component → server-side API client with the Clerk token  | Fast first paint, no client waterfall, no loading flash             |
| Interactive/mutating (practice runner, exam runner, admin forms) | Client Component → TanStack Query → BFF route handler → Express | Needs caching, optimistic updates, retries, offline queueing        |
| AI responses                                                     | BFF route handler proxying an SSE stream                        | Streaming needs a same-origin endpoint; keeps tokens off the client |

TanStack Query is worth adding to the stack: the exam runner needs request retry, mutation queueing, and background refetch, and hand-rolling those is exactly the kind of thing that produces lost-answer bugs.

---

## 4. Authentication & authorization

### Authentication (Clerk)

```
1. User signs in via Clerk in the browser. Clerk owns credentials, sessions, MFA.
2. Next.js gets a short-lived JWT via Clerk's SDK (server-side where possible).
3. Every API call carries  Authorization: Bearer <jwt>.
4. Express `requireAuth` verifies the JWT signature against Clerk's JWKS
   (cached, with rotation handling) — a network call per request would be unacceptable.
5. Verified claims → req.auth = { clerkUserId, sessionId }.
6. `loadUser` resolves our own User row (cached briefly) → req.user = { id, role, classLevel, ... }.
```

**The non-obvious part: we still need our own `User` table.** Clerk owns identity; we own the domain. `StudentProfile`, attempts, bookmarks and progress all need a stable local foreign key, and joining every query to an external service is not viable. So:

- `User.clerkId` is unique and indexed.
- A **Clerk webhook** (`user.created`, `user.updated`, `user.deleted`) keeps the local row in sync, with Svix signature verification.
- Webhooks can be late or lost, so `loadUser` also **lazily upserts** on first authenticated request. Belt and braces — relying on webhook delivery alone produces a class of "user signed up and immediately got a 500" bugs.
- `user.deleted` → soft-delete/anonymise locally rather than cascade-delete attempt history (see `06-security-and-ops.md` on data retention).

### Authorization

Roles: `STUDENT`, `ADMIN`, `CONTENT_EDITOR` (can draft/edit but not publish or manage users).

**Role is stored in our database, not in Clerk metadata.** Clerk public metadata is convenient but is client-visible and mutable through paths we do not fully own; authorization decisions must be made from data we control. `requireRole('ADMIN')` reads `req.user.role`.

Three layers, all required:

1. **Route-level** — `requireAuth`, `requireRole`.
2. **Resource-level (ownership)** — the service verifies that the requested `practiceSession` / `examAttempt` / `bookmark` belongs to `req.user.id`. This is the single most commonly missed check in apps like this: it is trivially easy to write `GET /exam-attempts/:id` that returns _anyone's_ attempt. Enforced by always querying with the ownership predicate in the `WHERE` clause (`findFirst({ where: { id, userId } })`), never by fetching then comparing — the former cannot be forgotten silently.
3. **Field-level** — the student serializer strips answer keys, as above.

Next.js middleware additionally gates route groups (redirect unauthenticated → `/sign-in`, non-onboarded → `/welcome`, non-admin → 404 on `/admin`). This is **UX only**. The API never trusts it.

> **Corrections, Phase 2.** Four things landed differently from the sketch above. Recorded here rather than edited silently, because the reasons are the interesting part.
>
> 1. **`loadUser` does not cache.** The plan said "cached briefly". It is one hit on a unique index — under a millisecond — and a cache would open a window in which a suspended account keeps working and a revoked admin role keeps applying. Trading correctness of authorization data for a sub-millisecond saving is a bad trade. If it ever shows up in a profile, the fix is a short TTL with explicit invalidation on role and status writes, added deliberately.
> 2. **Verification uses `jose`, not `@clerk/backend`.** `createTokenVerifier` takes a key-resolution function, so tests generate an RSA key pair and sign real tokens against the real code path — no mock of the thing under test. It also keeps the identity provider a configuration detail. The cost is that Clerk-specific claim handling is ours to get right, which is why each check in `lib/token-verifier.ts` says what it is for.
> 3. **The onboarding gate is not in middleware.** "Has a `StudentProfile`" lives in our database, not the session, so checking it in middleware would mean an API call in front of every request. It moved into the `(app)` layout, which already fetches `/me` to render the shell. This is also Clerk's current advice: protect close to the resource. Middleware now decides only signed-in versus signed-out, which it can answer from the cookie alone.
> 4. **`middleware.ts` is `proxy.ts`.** Next 16 renamed it. Same file, same position in the lifecycle.
>
> Two things the sketch got right and are worth restating because the tests now prove them: **role never comes from a token claim or Clerk metadata** — `upsertFromClerk` deliberately omits `role` and `status` from its update, so even a perfectly signed webhook cannot promote an account — and **`user.deleted` anonymises rather than cascades**, keeping the pseudonymous learning record coherent while erasing the personal data.
>
> One route-shape note: there is no `GET /users/:id`. Every `/me` route takes its subject from `req.user.id`, so the commonest authorization bug in an app like this — an id parameter a caller can tamper with — is not merely guarded against but unexpressible.

---

## 5. Error handling, logging, configuration

- **Typed error classes** (`AppError` → `NotFoundError`, `ValidationError`, `ForbiddenError`, `ConflictError`, `RateLimitError`, `QuotaExceededError`) each carrying an HTTP status and a stable machine-readable `code`. One Express error middleware maps them to the response envelope. Unknown errors → 500 with a generated `requestId`, full detail logged, nothing internal leaked to the client.
- **Structured logging** with Pino. Every request gets a `requestId` (via `AsyncLocalStorage`) that appears in logs and in error responses, so a student can quote a code and it can be found. Redact `authorization`, cookies, and AI prompt content by default.
- **Config validated at boot** with Zod in `lib/config.ts`. The process refuses to start with a missing or malformed env var. Failing at boot beats failing at 2am on one code path.
- **Environments:** `.env.example` committed with every key documented and no values. Secrets never in the repo. `DIRECT_URL` alongside `DATABASE_URL` for migrations when using a pooled connection.

---

## 6. Testing strategy

Proportionate, not dogmatic — weighted to where the risk actually is.

| Layer       | Tool                                                        | What is tested                                                                                                                                                           |
| ----------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit        | Vitest                                                      | **Grading logic, exam blueprint validation, timer/deadline math, score aggregation.** Pure functions, exhaustively tested. This is where correctness bugs cost the most. |
| Integration | Vitest + Supertest + Postgres (Testcontainers or a test DB) | Every API route: auth, validation, ownership enforcement, idempotency.                                                                                                   |
| Component   | Vitest + Testing Library                                    | `QuestionRenderer` per question type; exam palette; answer inputs.                                                                                                       |
| E2E         | Playwright                                                  | Three flows only: sign-up→onboard→practice; full exam with a forced mid-exam reload; admin create→publish→appears in practice.                                           |

Non-negotiable tests before the exam engine is considered done: submit-twice, submit-after-deadline, resume-after-refresh, clock-skewed client, concurrent answer saves.
