# Samjho

CBSE Class 10 & 12 board-exam preparation platform.

Practise questions, understand your mistakes, and rehearse the full 3-hour board exam before you sit it.

> **Status: Phase 5 complete** — foundation, domain model and seeded database;
> authentication (Clerk sign-in, server-side JWT verification, onboarding,
> profile); the catalog, with a `QuestionRenderer` that handles all ten question
> types with KaTeX maths; content management (type-driven authoring with
> sub-parts and provenance, publish/withdraw with a revision log,
> preview-as-student, bulk import with a dry run); and **practice mode** —
> filtered sets, auto-grading, self-evaluation against the marking scheme,
> mistake capture, bookmarks, and progress rollups. A student can sign up,
> onboard, practise, find out why they were wrong, and come back to it;
> an editor can write the bank they are practising.
>
> Plus the **teacher workspace**: sign up as a teacher, run classrooms, and
> upload a question paper that a model reads into structured questions — filed
> by chapter, tagged by difficulty, and reviewed by the teacher before any of it
> is saved. See [Teachers](#teachers) below.
> Specification and architecture live in [`docs/`](./docs/README.md).

---

## Prerequisites

| Tool   | Version                |
| ------ | ---------------------- |
| Node   | ≥ 22 (developed on 24) |
| pnpm   | 10.x — `npm i -g pnpm` |
| Docker | for local Postgres     |

## Setup

```bash
pnpm install

# Environment: each app has its own .env (Next.js only reads its own directory,
# and the API follows the same rule — one convention instead of two).
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# ...then fill in the Clerk values — see "Clerk setup" below. Both apps refuse
# to start without them, which is the config validation working as intended.

pnpm db:up                                  # Postgres 18 in Docker
pnpm --filter @samjho/api db:generate       # generate the Prisma client
pnpm --filter @samjho/api db:migrate        # apply migrations
pnpm --filter @samjho/api db:seed           # curriculum, questions, demo students
pnpm --filter @samjho/api db:test:prepare   # migrate the separate test database

pnpm dev
```

- Web → <http://localhost:3000> · system status at `/status`
- API → <http://localhost:4000/health> and `/ready`

## Clerk setup

One Clerk application serves both apps. From the [Clerk dashboard](https://dashboard.clerk.com):

1. **Create an application.** Enable **Email** and **Google**; leave phone off (see `docs/07` Q4).
2. **API keys** → copy into your `.env` files:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` → `apps/web/.env`
   - `CLERK_SECRET_KEY` → `apps/api/.env`
   - **Show JWT public key → Issuer** → `CLERK_ISSUER_URL` in `apps/api/.env`
3. **Webhooks** → add an endpoint for `user.created`, `user.updated`, `user.deleted`, and copy its
   signing secret to `CLERK_WEBHOOK_SIGNING_SECRET` in `apps/api/.env`.

The webhook needs a publicly reachable URL, so in local development it usually
goes unconfigured — and that is fine. `loadUser` lazily creates the local row on
a user's first authenticated request, so signup works with no webhook at all.
The webhook exists for the things that happen while the user is _not_ making
requests: an email changed in the dashboard, an account deleted.

No test needs a Clerk account. Token verification is exercised against a locally
generated RSA key pair, which is why CI runs green with placeholder keys.

## Commands

Run from the repo root; Turborepo fans them out in dependency order.

| Command                                      | Does                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`                                   | Both apps in watch mode                                                  |
| `pnpm check`                                 | typecheck → lint → test → build. **The gate — run before every commit.** |
| `pnpm typecheck` / `lint` / `test` / `build` | Individually                                                             |
| `pnpm format` / `format:check`               | Prettier                                                                 |
| `pnpm db:up` / `db:down` / `db:logs`         | Local Postgres                                                           |
| `pnpm --filter @samjho/api db:generate`      | Regenerate the Prisma client                                             |
| `pnpm --filter @samjho/api db:migrate`       | Create/apply a migration                                                 |
| `pnpm --filter @samjho/api db:seed`          | Seed dev data — idempotent, safe to re-run                               |
| `pnpm --filter @samjho/api db:reset`         | Drop, re-migrate and re-seed                                             |
| `pnpm --filter @samjho/api db:test:prepare`  | Migrate `samjho_test`, needed by the constraint tests                    |
| `pnpm --filter @samjho/api db:studio`        | Browse the database                                                      |

## Layout

```
apps/
  web/        Next.js 16 · App Router · React 19 · Tailwind 4
    src/proxy.ts   Next 16's middleware — signed-in/out redirects only, UX not security
    src/app/api/   BFF route handlers: attach the Clerk token server-side and forward
    src/features/  feature-first: onboarding/, profile/, admin/, practice/,
                   classrooms/, teacher/ — logic in hooks, not components
    src/app/(focus)/  the practice runner's shell: no nav, nothing to click away to
  api/        Express 5 · Prisma 7 · Postgres
    src/middleware/auth.ts   requireAuth → loadUser → requireRole
    src/lib/token-verifier.ts  RS256 + JWKS verification; the security boundary
    src/modules/practice/grading.ts  pure; no Prisma, no clock, no Express
    src/modules/questions/question.visibility.ts  the one definition of "a
                   question a student may see" — including the owner clause that
                   keeps a teacher's uploads out of everyone else's practice
    src/modules/ai/provider/  the OpenRouter → Gemini → Grok fallback chain
    src/modules/teacher/  uploads, AI extraction, review, and the teacher's bank
packages/
  contracts/       Zod schemas shared by both apps — the single source of truth
                   for everything crossing the network boundary
  ui/              app-agnostic components: QuestionRenderer, MathText, DataState,
                   and toPreviewQuestion — the projection that makes the admin
                   preview literally the student's view
  exam-blueprints/ CBSE paper structures as validated config, plus the validator
  config/          tsconfig / eslint / prettier presets
docs/              Product spec, architecture, data model, exam engine, roadmap
```

`apps/api` is layered **routes → services → repositories**. Business logic lives
in services and knows nothing about HTTP, which is what makes it testable
without spinning up a server. Only the API talks to the database — `apps/web`
has no Prisma dependency at all.

## Teachers

A teacher account is chosen at signup — the first screen of `/welcome` asks
whether you are studying or teaching — and it is a different account, not a mode.
A teacher has no practice history and no progress of their own; a student cannot
set homework. The choice is one-directional and cannot be undone from the
product, which is why the screen says so before you make it.

`User.role` is still never read from a request body. The teacher form posts a
school and a sentence about what you teach; the role is the server's conclusion
from the fact that a fresh account submitted it (see
`packages/contracts/src/auth/teacher.schema.ts`).

**What a teacher gets**

| Surface               | What it does                                                                         |
| --------------------- | ------------------------------------------------------------------------------------ |
| `/teacher`            | Overview: what is overdue, what needs reviewing, what is in the bank                 |
| `/teacher/classrooms` | Create a classroom, share its code, set practice, watch completion                   |
| `/teacher/uploads`    | Upload a paper (PDF, photo, or pasted text) and review what the model read out of it |
| `/teacher/questions`  | The teacher's own bank, filtered by chapter, difficulty, marks and type              |

**The upload pipeline** is `upload → review → import`, and the middle step is the
point. A model transcribes a paper well and _guesses_ the two fields the product
runs on — which chapter a question belongs to, and how hard it is. So it
proposes, the teacher disposes, and only accepted rows are written. A teacher who
uploads a paper and never opens the review screen has imported nothing, which is
correct rather than a missing feature. Import validates every row against
`writeQuestionInputSchema` — the same schema an editor's hand-typed question
faces — and writes all of them or none.

**Where those questions live.** Imported questions carry
`Question.ownerTeacherId`, and `STUDENT_VISIBLE_QUESTION` filters on that being
null. They are drawn for that teacher's own assignments (set the assignment's
source to "my own questions") and are invisible to open practice and to every
other classroom. One teacher's unreviewed OCR reaching every student on the
platform is the failure that would be found last and cost most, so it is a clause
in the shared predicate rather than a check each query remembers.

**Without an AI key** the workspace still works — classrooms, assignments,
reports, the bank. Only the upload screen changes, and it says plainly that
reading papers is not switched on rather than offering a button that fails. See
the AI section of `apps/api/.env.example`.

Demo data: `pnpm --filter @samjho/api db:seed` creates the teacher
`meera.demo@samjho.test` with a Class 10 Science classroom (join code `SAMJHO`)
that both demo students are already in.

## Stack notes

Decisions that were made deliberately and are easy to get wrong later:

- **TypeScript is pinned to 5.9**, not 7. TypeScript 7 (the native compiler) is
  stable, but `typescript-eslint` refuses to load under it — linting is a hard
  failure, not a warning. Revisit when typescript-eslint ships TS 7 support.
- **The API dev script uses `node --import tsx --watch`, not `tsx watch`.**
  `tsx watch` spawns a supervising child process that does not survive
  Turborepo's process management on Windows — the server silently never binds.
- **Prisma 7 needs a driver adapter.** Connection URLs are gone from
  `schema.prisma`: the CLI reads one from `prisma.config.ts`, and the runtime
  connects through `@prisma/adapter-pg`.
- **Postgres 18 mounts its volume at `/var/lib/postgresql`**, not `/data`. The
  older path refuses to start.
- **Exam structures are data, not code.** `packages/exam-blueprints` holds the
  CBSE paper shapes and a validator that reconciles declared totals against the
  section arithmetic. A pattern change is a data edit; a mis-transcribed paper
  fails the build. It caught a 76-mark "70-mark" Physics paper in the spec.
- **Two CHECK constraints are hand-written into the initial migration**, because
  Prisma's schema language cannot express them. If a migration is ever
  regenerated they must be re-added — `src/test/db-constraints.test.ts` fails if
  they go missing.
- **A unique index over a nullable column does not constrain the NULL rows.**
  Postgres treats NULL as distinct from NULL, so the four-column subject
  uniqueness key allowed any number of identical subjects with no `variant` —
  which is nearly all of them. A hand-written partial index covers exactly those
  rows. Worth remembering before adding another nullable column to a key.
- **A student never sees an answer key, structurally.** `StudentQuestion` has no
  `answer` property and `QuestionOption` has no `isCorrect`, so a leak is a
  compile error rather than a forgotten strip; the repository's select never
  requests those columns either. `question.test.ts` searches the raw response
  body for the solution text, because the failure mode is a field nobody thought
  to assert on.
- **Question validity is a table, not a switch statement.** `QUESTION_TYPE_RULES`
  in contracts says what each of the ten types requires — how many options,
  whether a correct value is forbidden because the tick on the option _is_ the
  key, whether the body must contain a blank or a table. The admin form reads it
  to decide what to render, the API runs it on every write, and bulk import gets
  it free. A rule enforced only in the form is a rule with two holes.
- **A question's version is not its revision number.** `Question.version`
  identifies the content a student saw and moves only when the content hash does;
  the revision log has its own counter and records everything, publishes and
  withdrawals included. Merging them means either a unique-constraint collision on
  the second withdrawal or a version bump for an edit that changed nothing.
- **A nested read inside a Prisma interactive transaction issues its relation
  queries concurrently on that transaction's one connection.** `pg` tolerates it
  and deprecates it; the version that removes it would turn the write into a
  runtime error. So the admin editor re-reads and diffs _after_ the commit —
  which it needed to do anyway for the response.
- **Withdrawing is the delete.** Taxonomy foreign keys are `onDelete: Restrict`,
  so nothing anyone has used can be removed; `isActive: false` hides a subject
  or chapter _and_ its questions, via the single `STUDENT_VISIBLE_QUESTION`
  clause, and can be undone.
- **An answer key hangs off an attempt, never off a question.** `StudentQuestion`
  has no `answer` property to fill in, so the key travels inside
  `PracticeAttempt` — an object that cannot exist unless the student has already
  answered. Two selects (`studentQuestionSelect`, `gradingSelect`) rather than
  one with a flag, for the same reason Phase 3 chose two serializers.
- **A practice session's totals are recomputed, not incremented.** Every write
  recalculates from the attempt rows inside the same transaction. Incrementing is
  faster and produces four bugs at once: a retried submit double-counts, a case
  study is called correct before its last part is scored, a late self-score never
  lands, and a partial score is claimed either way. Fifty items is a bounded
  read; drift is not bounded.
- **`isCorrect` is nullable, and that is load-bearing.** A subjective answer is
  submitted long before it is scored. `PENDING` is that gap, and collapsing it to
  `false` would file every unscored answer as a mistake and record a zero the
  student was never given. Nothing rolls up until a score exists.
- **Question selection counts, windows, then shuffles.** `ORDER BY RANDOM()` asks
  Postgres to sort every matching row to return ten of them, which is the
  degradation docs/07 R4 predicts on the endpoint a student hits first. Two
  index-only queries and an in-memory shuffle instead.
- **`lib/practice.ts` is server-only; `lib/practice-format.ts` is not.** Importing
  a single formatter from the loader module pulls Clerk's `auth()` into the
  browser bundle and the build fails. It did. The split is the fix, and the same
  trap is waiting in every future `lib/<feature>.ts`.
- **The question renderer promotes single-line `$…$` to display maths.**
  remark-math only treats `$` as display when the fences sit on their own lines,
  and content authors write it inline constantly. Fixing it in `MathText` rather
  than in the content means the rule cannot be broken by whoever types the next
  two thousand questions.
- **No secret ever gets a `NEXT_PUBLIC_` prefix** — those values are inlined
  into the browser bundle. The AI provider key (Phase 7) lives only in
  `apps/api`.
- **Turborepo runs tasks in strict env mode**, so a variable not declared in
  `turbo.json` is removed from the task's environment. `globalEnv` holds values
  that change build output (everything `NEXT_PUBLIC_`, which gets inlined);
  `globalPassThroughEnv` holds values read at runtime and deliberately excluded
  from the cache key — a cache key derived from a secret is a hash of that
  secret sitting in a shared cache.
- **The Clerk webhook is mounted before `express.json()`.** Svix signs the raw
  bytes; once the JSON parser consumes the stream, no re-serialisation
  reproduces them and every signature check fails.
- **`role` is a column in our database, never a token claim.** `upsertFromClerk`
  omits `role` and `status` from its update, so even a correctly signed webhook
  cannot promote an account. There is a test for exactly that.
- **Next 16 renamed `middleware.ts` to `proxy.ts`**, and Clerk v7 replaced
  `<SignedIn>` / `<SignedOut>` with `<Show when="signed-in">`.
