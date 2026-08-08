# Samjho

CBSE Class 10 & 12 board-exam preparation platform.

Practise questions, understand your mistakes, and rehearse the full 3-hour board exam before you sit it.

> **Status: Phase 2 complete** — foundation, domain model and seeded database,
> plus authentication: Clerk sign-in, server-side JWT verification, onboarding,
> and a profile. A student can sign up, onboard and reach `/home`.
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
    src/features/  feature-first: onboarding/, profile/ — logic in hooks, not components
  api/        Express 5 · Prisma 7 · Postgres
    src/middleware/auth.ts   requireAuth → loadUser → requireRole
    src/lib/token-verifier.ts  RS256 + JWKS verification; the security boundary
packages/
  contracts/       Zod schemas shared by both apps — the single source of truth
                   for everything crossing the network boundary
  exam-blueprints/ CBSE paper structures as validated config, plus the validator
  config/          tsconfig / eslint / prettier presets
docs/              Product spec, architecture, data model, exam engine, roadmap
```

`apps/api` is layered **routes → services → repositories**. Business logic lives
in services and knows nothing about HTTP, which is what makes it testable
without spinning up a server. Only the API talks to the database — `apps/web`
has no Prisma dependency at all.

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
