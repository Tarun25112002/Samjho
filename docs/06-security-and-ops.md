# Security, Compliance & Operations

> The user base is largely **minors** (14–18) in India. That single fact raises the bar on data handling above a typical B2C app and drives several decisions below.

---

## 1. Threat model

Realistic threats, in rough order of likelihood:

| #   | Threat                                                                   | Impact                            | Mitigation                                                                                                                                            |
| --- | ------------------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Student reads the answer key from the network tab during an exam         | Destroys the product's core value | Separate `QuestionAnswer` table; `toStudentQuestion` serializer; integration test asserting no answer fields in exam payloads                         |
| T2  | Student manipulates client clock or replays requests to extend exam time | Invalid results                   | Server-authoritative `deadlineAt`; every write checks expiry; three-way auto-submit                                                                   |
| T3  | IDOR — reading or writing another student's attempt/session/bookmark     | Data breach                       | Ownership predicate in the `WHERE` clause of every query, never fetch-then-compare                                                                    |
| T4  | Question bank scraped wholesale                                          | Loss of the main asset            | Rate limits on question endpoints; pagination caps; no bulk export endpoint; anomaly alerting on per-user request volume                              |
| T5  | AI endpoint abused as a free LLM proxy                                   | Direct financial loss             | Auth + rate limit + daily quota + strict server-assembled prompts + topical scope enforcement                                                         |
| T6  | Prompt injection via student free-text into the tutor                    | Jailbreak, off-scope use          | Student text is always a _user_ turn, never system; context assembled server-side; output is displayed, never executed or persisted to content tables |
| T7  | Non-admin reaching admin endpoints                                       | Content corruption                | Server-side role check on every admin route; role stored in our DB, not client-visible metadata; `/admin` returns 404 to non-admins                   |
| T8  | Stored XSS via question rich text or admin-uploaded content              | Session compromise                | Sanitise HTML server-side on write **and** on render; strict allowlist; CSP                                                                           |
| T9  | Credential stuffing                                                      | Account takeover                  | Delegated to Clerk (bot protection, breach detection, MFA available)                                                                                  |
| T10 | Leaked secrets in the repo or client bundle                              | Total compromise                  | Secrets only in the API process; `.env.example` with no values; secret scanning in CI; no `NEXT_PUBLIC_` secret ever                                  |

---

## 2. Application security baseline

**Input.** Zod validation at every boundary — body, query, params. Strict schemas (`.strict()`) so unknown keys are rejected rather than silently passed through. Explicit max lengths on every string; a 5MB answer body is not a legitimate long-answer submission.

**Output.** Never return raw errors. Never return Prisma errors. Never return stack traces. One error middleware, one envelope, a `requestId` for support correlation.

**Rate limiting**, tiered by cost and risk:

| Scope                    | Limit                    |
| ------------------------ | ------------------------ |
| Global per IP            | 300 req / min            |
| Authenticated per user   | 120 req / min            |
| AI messages              | 10 / 5 min + daily quota |
| Exam attempt creation    | 5 / hour                 |
| Auth-adjacent + webhooks | tight, separate bucket   |

Backed by Postgres initially (one fewer moving part); moved to Redis when traffic justifies it. `express-rate-limit` with a shared store, keyed on user id where authenticated and IP otherwise.

**HTTP hardening.** Helmet with a real CSP (no `unsafe-inline` scripts; hashes/nonces for what genuinely needs it). CORS allowlisted to the web origin only, credentials enabled. HSTS. `X-Content-Type-Options: nosniff`.

**Body limits.** 1MB default; larger only on the admin import route, and that route is role-gated and separately rate-limited.

**Webhooks.** Clerk webhooks verified via Svix signature with a timestamp tolerance to prevent replay. Unverified requests are dropped and logged.

**Dependencies.** `pnpm audit` in CI; Dependabot; lockfile committed; `--frozen-lockfile` in CI installs.

**Database.** Least-privilege application role (no `SUPERUSER`, no DDL at runtime — migrations run under a separate credential). TLS-enforced connections. Connection pooling with sane limits. No raw SQL string interpolation; `Prisma.sql` tagged templates where raw SQL is genuinely needed.

---

## 3. Data protection & minors

This is the part that is easy to get wrong and expensive to fix.

**Collect the minimum.** Class, board, subjects, target exam session, and an email (owned by Clerk). **Do not collect** date of birth, precise location, phone number, school address, or a photograph unless a feature genuinely requires it. Every additional field about a minor is a liability with no offsetting benefit at this stage.

**India's DPDP Act 2023 treats users under 18 as children**, requiring verifiable parental consent for processing their data and **prohibiting behavioural advertising and tracking directed at children**. Practical consequences for this build:

- **No third-party advertising or behavioural-tracking SDKs. Ever.** This is not a nice-to-have; it is the rule that most constrains future monetisation, so it should be known now rather than discovered later.
- Analytics must be first-party and privacy-preserving (self-hosted or cookieless). No Google Analytics or Meta Pixel on authenticated pages.
- A parental-consent flow will be required at some point. This should be a deliberate legal decision before scaling, not something bolted on. **Flagged as open question Q7 and risk R6** — get advice from an Indian lawyer, not from this document.
- Age is not currently collected, which is deliberate; the fix is a consent flow, not an age gate that encourages lying.

**Retention & deletion.** `user.deleted` from Clerk → anonymise `User` (clear email/name, set `status: DELETED`) rather than hard-delete, preserving attempt rows for aggregate content analytics with no personal linkage. Provide a genuine data export (`/profile` → download JSON) and an in-product delete request. Document retention periods in the privacy policy and honour them.

**Encryption.** TLS everywhere. Managed Postgres with encryption at rest. Nothing sensitive in localStorage — IndexedDB holds only the student's own in-flight exam answers, cleared on submission.

---

## 4. Content licensing (the non-technical risk that could stop the project)

Restated here because it is a _compliance_ issue, not just a schema one. CBSE question papers are not free to reproduce commercially by default. The architecture supports whichever position you take (`QuestionSource.licenceStatus`, and a repository-level default filter that excludes `RESTRICTED` from student queries) — but **the position itself is a decision you need to make before bulk content entry**, because re-sourcing 5,000 questions later is ruinous.

The default this spec assumes, and the one most established Indian players operate on: **adapted questions** — same concept, same difficulty, same pattern, changed numbers and context, attributed as "based on CBSE 2023 Q17". Verbatim reproduction is limited to what is defensible, marked as such, and easy to purge if challenged.

`/legal/content-policy` should state the sourcing approach publicly. A published policy and a clear takedown path meaningfully reduce risk.

---

## 5. Observability

**Logging.** Pino, JSON, structured. Every request carries a `requestId` propagated via `AsyncLocalStorage`. Redact `authorization`, cookies, AI prompt/response content, and student answer bodies. Log level from env.

**Error tracking.** Sentry on both apps, with `requestId` and `userId` (never email) as tags, source maps uploaded, and PII scrubbing on.

**Metrics that matter here** — not vanity dashboards:

- `exam_attempts_lost` (attempts in `IN_PROGRESS` past deadline that the sweeper had to rescue) — **should be near zero; a rise means the client-side save path is broken**
- Answer-save failure rate and p99 latency
- Sweeper job run duration and rescued-attempt count
- AI cost/day, tokens/user, quota-exhaustion rate, provider error rate
- p95 latency on the practice question-selection query (the known scaling risk)

**Health & readiness.** `/health` (liveness) and `/ready` (DB reachable, migrations applied) for the platform's health checks.

**Alerting** on: sweeper job failure, error rate spike, AI spend threshold, DB connection saturation, and any non-zero `exam_attempts_lost` trend.

---

## 6. Environments & deployment

| Env        | Purpose                                                          |
| ---------- | ---------------------------------------------------------------- |
| Local      | Docker Compose Postgres, seeded, Clerk dev instance              |
| Preview    | Per-PR web deploy against a shared staging API + branch database |
| Staging    | Full mirror, production-like data volume for query profiling     |
| Production | —                                                                |

**Deployment shape:** `apps/web` → Vercel (Next.js's native home, ISR and edge caching for marketing/SEO pages). `apps/api` → a long-running container platform (Railway / Render / Fly). Postgres → managed with PITR (Neon, Supabase, or RDS). Long-running matters: the sweeper job and SSE streaming both fit poorly in a serverless model.

**Migrations.** `prisma migrate deploy` as a release step, never automatically on boot (two instances booting simultaneously would race). Expand-and-contract for breaking changes: add nullable → backfill → switch code → drop old, across separate releases. Never a destructive migration in a single deploy.

**Backups.** Managed daily backups plus PITR. **A restore must be rehearsed on staging at least once before launch** — an untested backup is not a backup.

**CI pipeline** (`turbo` powered, on every PR): typecheck → lint → unit → integration (ephemeral Postgres) → build → E2E on preview. Blueprint validation runs as part of unit tests. Merge blocked on green.

---

## 7. Accessibility

Not optional, and cheap if done from the start: this product is read for hours by teenagers, some with dyslexia, some with colour-vision deficiency, some on low-end devices.

- Semantic HTML; shadcn/ui (Radix) gives correct roles and focus management for free — the work is not undoing it.
- Full keyboard operability, including the exam runner: arrow keys between questions, number keys to jump, `M` to mark for review. Faster for everyone, essential for some.
- **Exam palette states carry a glyph and a text label, not only a colour.**
- WCAG AA contrast in both themes; visible focus rings never removed.
- All question diagrams require `altText` — enforced as a required field in the admin form, not a suggestion.
- Respect `prefers-reduced-motion`.
- Screen-reader-tested: question navigation, answer entry, timer announcements (polite live region at 15/5/1 minutes, not a continuous countdown).
- Font-size preference in settings; question text scales without breaking layout.
