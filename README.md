# Samjho

CBSE Class 10 & 12 board-exam preparation platform.

Practise questions, understand your mistakes, and rehearse the full 3-hour board exam before you sit it.

> **Status: Phase 1 complete** — foundation scaffold plus the full domain model,
> exam blueprints and a seeded database. No UI beyond a status page yet.
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

pnpm db:up                                  # Postgres 18 in Docker
pnpm --filter @samjho/api db:generate       # generate the Prisma client
pnpm --filter @samjho/api db:migrate        # apply migrations
pnpm --filter @samjho/api db:seed           # curriculum, questions, demo students
pnpm --filter @samjho/api db:test:prepare   # migrate the separate test database

pnpm dev
```

- Web → <http://localhost:3000> (shows live system status)
- API → <http://localhost:4000/health> and `/ready`

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
  api/        Express 5 · Prisma 7 · Postgres
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
