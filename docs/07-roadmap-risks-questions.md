# Development Phases, Risks & Open Questions

---

## 1. Development phases

Sequenced so that **every phase ends with something demonstrable and the repo never sits broken.** Each phase gate: `turbo typecheck lint test build` green, feature manually verified, docs updated.

Estimates assume a learning developer working with AI assistance, not a full-time team.

### Phase 0 — Foundation (~2–3 days)

Monorepo skeleton (pnpm + Turborepo), `packages/config` (tsconfig/eslint/tailwind presets), `packages/contracts` with a first schema, Next.js and Express apps booting, Docker Compose Postgres, Prisma initialised, health endpoints, CI pipeline.
**Gate:** `pnpm dev` runs both apps; web fetches `/health` from api and renders it; CI green on a PR.
**Why first:** the shared-package wiring is fiddly and touches everything. Doing it before there is code to break is far cheaper than retrofitting it.

### Phase 1 — Data model & seed (~3–4 days)

Full `schema.prisma` per `03-data-model.md`. Migrations. Seed: Class 10 subjects, chapter/topic trees for Maths (no domains) and Science (domain-tagged Physics/Chemistry/Biology), the two MVP blueprints **plus the Class 12 Physics blueprint as a validator fixture**, ~40 questions covering **every** question type including case-based sub-parts at both `1+1+2` and `1/2/3` splits, an admin and two demo students.
**Gate:** `prisma studio` shows a coherent domain; seed is idempotent; blueprint validator passes in CI **against all three blueprints, including the 70-mark mixed-marks Class 12 one**.
**Why now:** everything downstream depends on these shapes. Getting the case-based tree and exam-slot model wrong here is the most expensive possible mistake, so it gets built and inspected before any UI exists.

### Phase 2 — Auth & profile (~3 days)

Clerk integration, JWT verification middleware, JWKS caching, Clerk webhook + lazy upsert, `User`/`StudentProfile`, role middleware, onboarding wizard, Next middleware route guards, profile page.
**Gate:** sign up → onboard → land on `/home`; API rejects unauthenticated and mis-roled requests; deleting a Clerk user syncs correctly.

### Phase 3 — Catalog & question rendering (~4 days)

Catalog endpoints and services; `packages/ui` primitives; **`QuestionRenderer` for all 10 question types**; KaTeX; `DataState` wrapper; subject/chapter browse pages; admin taxonomy CRUD.
**Gate:** every question type renders correctly from seed data on desktop and mobile; component tests per type.
**Why before practice:** the renderer is used by practice, exams, review, and admin preview. Building it once, properly, in isolation prevents four divergent copies.

### Phase 4 — Admin content management (~4 days) — _moved ahead of practice mode_

Question CRUD with type-driven forms, sub-part editing, provenance capture, publish/unpublish/archive, versioning + revision log, preview-as-student, bulk import with dry-run validation, admin dashboard.
**Gate:** a non-developer can create, preview and publish a case-based question with sub-parts; import rejects a malformed file with useful row-level errors; **median entry time for a fresh question under 90 seconds, measured, not estimated.**

> **Why this moved up.** The bank is being built from zero for a commercial launch, which makes content entry — not code — the critical path (R1). Every day admin tooling ships earlier is a day content entry starts earlier, and content entry is the multi-month activity. Practice mode can be built _while_ questions are being entered; questions cannot be entered while practice mode is being built. This swap buys roughly a week of parallelism for zero engineering cost.
>
> It is safe because Phase 3's `QuestionRenderer` already provides preview-as-student, so admins can see exactly what they are creating before the student runner exists.

### Phase 5 — Practice mode (~5–6 days)

Session creation with the full filter set, question selection service, runner UI, answer submission + auto-grading, subjective self-evaluation, feedback panel, mistake-reason capture, session results, `QuestionAttempt` writes, incremental `TopicMastery`/`MistakeRecord` updates, bookmarks.
**Gate:** end-to-end practice session works; attempts and mastery update correctly; ownership enforced (verified by test, not inspection).
**This is the product's core loop — the first phase that produces something genuinely usable, now running against real entered content rather than seed data.**

### Phase 6 — Exam engine (~7–9 days) — the big one

`exam-blueprints` package + validator; paper/section/slot/slot-item model; admin paper editor; attempt creation with idempotency; **server-authoritative timer**; autosave with revision ordering; IndexedDB offline queue; resume; heartbeat; three-way auto-submit + sweeper job; idempotent submission; objective auto-grading; self-evaluation flow; exam runner UI (palette, internal choice, focus mode); results with section/chapter breakdown.
**Gate:** every row of the failure matrix in `04-exam-engine.md` §7 has a passing test. Manual verification includes: reload mid-exam, kill the network for two minutes, change the system clock, double-click submit, sit an exam past its deadline.
**Sub-sequence:** blueprint/paper model → attempt lifecycle + timer (API only, tested via Supertest) → runner UI → resilience → grading → results. **The timer and submission logic are proven server-side before any UI exists.**

### Phase 7 — AI tutor (~4 days)

Provider abstraction, Anthropic implementation, grounded context assembly, six action templates, SSE streaming through the BFF, conversation persistence, rate limits + quotas + usage ledger, exam guard, fallback to stored explanation, quota UI.
**Gate:** all six actions behave per spec on the fixture set; key absent from every client bundle (verified by grepping the build output); quota enforcement tested; AI provably unreachable during a live exam attempt.

### Phase 8 — Dashboard & progress (~3–4 days)

Progress summary endpoints reading rollups, weak-topic detection, recommendation logic, dashboard composition, progress pages, mistakes and bookmarks lists, activity history.
**Gate:** dashboard loads in <500ms against a seeded 20k-attempt dataset; recommendations are sensible for the demo students.
**Why last:** it consumes data that phases 4–7 produce. Building it earlier means building it twice.

### Phase 9 — Polish & launch readiness (~4–5 days)

Landing page + SEO subject pages, accessibility audit, mobile pass, empty/loading/error states everywhere, performance profiling of the question-selection query at volume, Sentry, alerting, **backup restore rehearsal**, legal pages, staging soak test.
**Gate:** Lighthouse ≥ 90 on public pages; axe clean; a full exam completed on staging on a real mid-range Android phone.

**Total: roughly 8–11 weeks** at a sustainable pace, plus content entry running in parallel from Phase 5.

---

## 2. Technical risks

| #       | Risk                                                                                                                                                                                                                                                                                                                                 | Likelihood  | Impact                | Mitigation                                                                                                                                                                                                                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **R1**  | **Content acquisition is the critical path, and it starts from zero.** A perfect platform with 300 questions is worthless. ~2,000 quality questions per subject with solutions and step-marking schemes is _months_ of work, and it is the only task here that cannot be accelerated by better engineering.                          | **Certain** | **Critical**          | Admin tooling **moved to Phase 4**, ahead of practice mode; sub-90s entry time as a measured phase gate; bulk import with dry-run; budget for paid content entry from Phase 4 onward; sourcing model settled before entry begins (Q6)                                                                                                                                                |
| **R2**  | **Copyright exposure — sharpened by commercial intent.** Reproducing CBSE/publisher questions in a paid product is a materially different risk from doing so in a portfolio project.                                                                                                                                                 | Medium      | **Critical**          | `QuestionSource.licenceStatus`; **default to adapted-and-attributed**; repository-level filtering of `RESTRICTED`; public content policy + takedown path; **Indian legal review before bulk entry, not before launch** — re-sourcing 2,000 questions after the fact is ruinous                                                                                                       |
| **R3**  | Subjective answers can't be auto-graded, so exam scores are partly self-reported                                                                                                                                                                                                                                                     | **Certain** | High                  | Designed around it: step-level self-evaluation against the official marking scheme; scores labelled honestly; AI grading as a later, validated upgrade — never silently trusted                                                                                                                                                                                                      |
| **R4**  | Question-selection query degrades at 100k+ questions (multi-column filters + random sampling + exclusion of already-answered)                                                                                                                                                                                                        | Medium      | High                  | Composite indexes designed up front; candidate-id-then-hydrate strategy instead of `ORDER BY RANDOM()`; profile against seeded volume in Phase 9; p95 latency alert                                                                                                                                                                                                                  |
| **R5**  | Exam data loss from an unforeseen client failure                                                                                                                                                                                                                                                                                     | Low         | **Critical**          | Failure matrix as tests; three save layers; three auto-submit triggers; `exam_attempts_lost` metric alerting from day one                                                                                                                                                                                                                                                            |
| **R6**  | **DPDP Act compliance — now unavoidable, not deferrable.** Commercial product + Class 10 audience means **100% of paying users are 14–16 year-old minors.** DPDP 2023 requires verifiable parental consent for processing children's data and bans behavioural tracking directed at them. There is no "mostly adults" fallback here. | **High**    | **High**              | Data minimisation from Phase 1; **zero ad/tracking SDKs, permanently — this forecloses ad-based monetisation entirely**; parental-consent flow designed into Phase 2 signup rather than retrofitted; Indian legal review before public launch; billing must anticipate a paying parent and a using child as different people (Q9)                                                    |
| **R7**  | AI cost exceeds revenue per student                                                                                                                                                                                                                                                                                                  | Medium      | Medium                | Quotas, rate limits, prompt caching, model routing per action, response caching, hard monthly ceiling with graceful degradation to stored explanations                                                                                                                                                                                                                               |
| **R8**  | CBSE changes the exam pattern mid-build (it demonstrably does — CBQ weightage moved 40%→50%, and Class 10 gained a second attempt)                                                                                                                                                                                                   | **High**    | Low _if_ configurable | The entire blueprint design exists for this. A pattern change is a JSON file and a seed, not a refactor. `SyllabusVersion` handles chapter rationalisation.                                                                                                                                                                                                                          |
| **R9**  | Scope creep — the brief describes ~3 products' worth of features                                                                                                                                                                                                                                                                     | High        | High                  | Explicit MVP boundary in `00-overview.md` §5; phase gates; features earn entry by moving a metric in §7                                                                                                                                                                                                                                                                              |
| **R10** | Solo-developer velocity vs. an 11-week plan while learning                                                                                                                                                                                                                                                                           | Medium      | Medium                | Phases are independently shippable; Phases 7–8 can slip without blocking a usable product; Phase 4 alone is a launchable practice tool                                                                                                                                                                                                                                               |
| **R11** | Prisma + Postgres connection exhaustion under a serverless web tier                                                                                                                                                                                                                                                                  | Low         | Medium                | Web never touches the DB — only the long-running API does, with a bounded pool. This is a side benefit of the two-app architecture.                                                                                                                                                                                                                                                  |
| **R12** | **Class 10 monetisation.** 14–16 year-olds have no payment instrument and low willingness to pay; the buyer is a parent who never uses the product. Ad-based revenue is closed off by R6.                                                                                                                                            | **High**    | High                  | Lean into the **March–May second-attempt window** — highest-intent, most motivated cohort, clearest value proposition ("you scored 62 in Feb, here is exactly what to fix by May"). Design the parent as an explicit persona in the purchase flow: a parent-visible progress summary is a _conversion_ feature, not a nice-to-have. Validate price with real parents before Phase 9. |
| **R13** | **Both MVP subjects have near-identical paper structure** (80 marks, Sections A–E), removing the natural pressure that keeps the exam engine configuration-driven. Assumptions could bake in unnoticed.                                                                                                                              | Medium      | Medium                | ✅ **Done in Phase 1.** Class 12 Physics ships as a CI validator fixture — 70 marks, 33 questions, and **case-based in Section D rather than E**, so anything keying off "the last section" fails. A second, synthetic fixture covers mixed marks within a section. See the R13 note below.                                                                                          |

> **R13 note, Phase 1.** The mitigation as originally written rested on a false premise: it described Class 12 Physics as having a "mixed 4m/6m Section E". Checking the real pattern showed Section E is a uniform 3 × 5m and the case-based questions live in Section D. The blueprint that shipped is the corrected one, and it still does R13's job — a different total (70 vs 80), a different question count (33 vs 38/39), and case-based in a different section than either Class 10 paper.
>
> What it no longer provides is pressure on the mixed-marks-within-a-section path, because **no paper this platform models actually mixes them.** That capability is kept — one nullable field, and R8 says patterns change — but it is now covered by an explicit synthetic fixture (`fixtures/mixed-marks-section.ts`) that is honest about being synthetic, rather than by a real paper that does not have the property. An untested capability is not a capability.

**The three risks that decide whether this succeeds are R1, R2 and R6, and none of them is a coding problem.** Worth internalising now: the engineering here is tractable and well-understood; the content operation, the licensing position, and the minors-compliance position are the hard parts, and all three want work starting before Phase 4.

---

## 3. Open questions

### ✅ Resolved 2026-08-08

**Q1 — MVP subject scope → Class 10 Mathematics + Class 10 Science.**
Consequences applied: `Chapter.domain` added for Science's Physics/Chemistry/Biology split (`03-data-model.md` §2.6); Class 12 Physics blueprint retained as a CI validator fixture to compensate for the two MVP papers being structurally alike (R13).

**Q2 — Existing content → none; building from zero.**
Consequences applied: admin tooling moved from Phase 5 to **Phase 4**, ahead of practice mode, so entry starts ~1 week earlier and runs in parallel; sub-90-second median entry time is now a measured phase gate, not an aspiration; R1 upgraded to _Certain_.

**Q3 — Intent → commercial, serving real students.**
Consequences applied: R2 (copyright) and R6 (DPDP/minors) both upgraded to must-resolve-before-content-entry rather than pre-launch; ad-based monetisation permanently foreclosed; R12 added for the Class 10 willingness-to-pay problem; Phase 9 launch-readiness work is non-negotiable.

**Q4 — Auth methods → Clerk with email + Google. Phone/OTP deferred.**
Consequences applied: `User.email` stays required and unique, which the whole lazy-upsert path depends on — a phone-only Clerk user has no address to write. `lib/clerk-user.ts` therefore throws rather than inventing a placeholder, with a comment naming phone auth as the change that would trigger revisiting it. Adding phone/OTP later is a Clerk dashboard toggle **plus** a migration making `email` nullable and an audit of every place that assumes it, so the deferral is real work saved now and real work owed later, not a free option.

**Q7 — Parental consent → closed pilot, capturing the guardian's address at onboarding.**
Consequences applied: onboarding requires a parent/guardian email and two explicitly ticked declarations (`z.literal(true)`, so an omitted consent block is a validation error rather than a stored `false`). Two columns were added in Phase 2 — `guardianDeclaredAt` and `termsAcceptedAt`/`termsAcceptedVersion` — specifically so the student's declaration is **not** written into `parentConsentAt`. That field means "a guardian verifiably acted" and stays NULL throughout the pilot; conflating the two would make the pilot indistinguishable from verified consent in the one table a regulator would read. `parentConsentToken` is minted at onboarding so switching the verification email on later is a mailer and a route, not a migration plus a backfill. The profile page states the position in plain words rather than showing a green tick nobody earned. **Still required: Indian legal advice before the pilot opens up**, and the build toward the parent-owns-the-account model (Q9/R12) is unchanged.

### Near-term

**Q5 — Hindi / bilingual support.** CBSE papers are published bilingually. Supporting it later means retrofitting translations onto every question — expensive. Supporting it now roughly doubles content entry. My recommendation: **English only for MVP, but add a nullable `bodyHindi` column now** so the door stays open for free. Agree?

**Q6 — Content sourcing position (drives R2).** Which do you want?
(a) Adapted-and-attributed only — safest, most work, _recommended_;
(b) Verbatim PYQs with attribution — fastest, real legal exposure;
(c) Licensed from a publisher — cleanest, costs money.
The schema supports all three; the operational decision is yours and should be made before bulk entry.

### Later

**Q8 — Self-evaluation vs AI grading.** Confirm you accept that MVP exam scores for subjective sections are student-self-assessed against official marking schemes. This is the single largest honesty compromise in the product, and I'd rather you agree to it explicitly now than discover it in Phase 6. _(Note: Class 10 Science and Maths are somewhat more auto-gradable than Class 12 Physics — more numerical answers, more short factual responses — so the self-assessed share is smaller than it would have been under the original scope. A genuine upside of your subject choice.)_

**Q9 — Monetisation (sharpened by Q3 + R12).** Ad-based is off the table (R6). That leaves freemium (free practice, paid full exams + AI quota) or fully paid. Given the payer is a parent, the pricing page and the product are aimed at _different people_ — worth designing for deliberately. Also affects whether Phase 0 needs payment scaffolding; my assumption is no, and that payments land after MVP validation.

**Q10 — Mobile app.** Web-only assumed. Worth noting your audience skews phone-first more than Class 12 would have, so **the mobile web experience carries more weight than originally scoped** — the exam runner's mobile posture in particular deserves real Phase 9 attention rather than a graceful-degradation note.

**Q11 — Hosting budget.** Vercel + Railway/Render + managed Postgres runs roughly ₹2,000–5,000/month at low volume before AI costs. Is there a budget constraint that should push toward a single VPS instead?

**Q12 — Timeline.** Is there a date this needs to be usable by? **This one has a natural answer now:** the Class 10 boards run February and May. An 8–11 week build starting August lands comfortably before a February 2027 session, and the March–May second-attempt window (R12) is the single best launch moment this product will get. If you are aiming at that, say so — it changes what gets cut and when content entry must begin.

---

## 4. What happens on approval

On your go-ahead, Phase 0 starts: monorepo scaffold, both apps booting, shared packages wired, Docker Postgres, CI green. That is a small, verifiable deliverable you can inspect before we commit to anything larger — and it is the phase where I'll explain the monorepo and shared-contract mechanics in detail, since that wiring is the part most tutorials skip and most projects get wrong.

I will not generate the whole application in one step. Each phase ends with working, type-checked, tested code and a short written explanation of the decisions inside it.
