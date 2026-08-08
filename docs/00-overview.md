# Samjho — Product Overview & Scope

> **Status:** Phase 1 specification. Awaiting approval before implementation.
> **Last updated:** 2026-08-08

---

## 1. Refined product vision

**One-line:** Samjho is a CBSE board-exam preparation platform that turns every wrong answer into a targeted next step, and lets a student rehearse the real 3-hour exam before they sit it.

The brief described "a question bank plus an exam simulator plus AI." That combination is available from a dozen vendors. The thing that is genuinely scarce, and therefore what this product should be organised around, is this loop:

```
Practice  →  Get it wrong  →  Understand WHY (not just "what")  →  Re-practice that
   ↑                                                                      │
   └──────────────────  measurably fewer errors next time  ───────────────┘
```

Most Indian ed-tech products break this loop at step three. They show a correct answer and a paragraph of explanation, the student nods, and nothing changes. Samjho's differentiator is that **the mistake is a first-class object in the system**, not a row in an attempts log:

- Every wrong attempt is tagged with a _reason_ (conceptual gap / calculation slip / misread question / ran out of time / didn't attempt), partly by the student, partly inferred.
- The AI tutor's job is to identify which of those it was and address that specific failure, rather than re-teaching the chapter.
- The dashboard's job is to answer one question — **"what should I do in the next 30 minutes?"** — not to display seventeen charts.
- Weak topics automatically become the source of the next recommended practice set.

**Positioning statement for design decisions:** when a feature could be either (a) more analytics or (b) more practice, choose practice. When it could be either (a) give the answer or (b) get the student to the answer, choose the latter.

### Why the name matters to the product

"Samjho" (समझो) = "understand." It is a useful internal test: if a feature does not increase understanding, it is decoration. This is the tiebreaker for scope arguments.

---

## 2. Target users

### Primary — the Class 10 CBSE student (design for this person first)

- Age 14–16. **Every primary user is a minor, without exception.** This is not a caveat; it is a constraint that shapes signup, data collection, and monetisation. See `06-security-and-ops.md` §3.
- Lower study autonomy than a Class 12 student, more parent involvement, shorter attention blocks (25–45 min).
- Often phone-first. A meaningful share have _no_ personal laptop, which affects the exam simulator's mobile posture.
- Network is intermittent.
- **Core need:** "The boards are coming, I don't know if I'm ready, and I don't know what to study next."

**The two-attempt system is this product's commercial hook.** From 2026 CBSE runs Class 10 boards twice — mandatory February, optional May, best-of-two scoring. That creates a **March–May demand window** of students who have just seen a real score, know exactly which subjects let them down, and have ten weeks to improve them. That is an unusually well-qualified, high-intent, time-boxed audience — and "here is precisely what to fix, and here is a full paper to prove you fixed it" is exactly what this platform does. Modelled explicitly as `TargetExam { session, phase }`.

### Secondary — the Class 12 student

- Age 16–18, preparing for boards _and usually_ JEE/NEET simultaneously. Higher willingness to pay.
- Not in MVP content scope, but the schema and exam engine are built to accept them without change (see §5).

### Tertiary — the admin / content operator

- Not a developer. Possibly a teacher or an operations hire.
- Will enter and QA thousands of questions. **Their throughput is the real bottleneck on this product**, so the admin UI is a core product surface, not an afterthought. If entering one question takes 4 minutes instead of 90 seconds, the question bank never reaches critical mass.

### Explicitly not targeted in v1

Teachers assigning homework, schools/institutions (B2B), parents' dashboards, non-CBSE boards, Classes 6–9. Each is a plausible later market; none should influence v1 architecture beyond keeping `board` a first-class column rather than an assumption.

---

## 3. Core user journeys

Journeys are written as _goals_, with the page-level flow in `01-information-architecture.md`.

### J1 — First run ("I just signed up, make me feel this is for me")

Landing → Sign up → Onboarding (class → board → subjects → target exam date) → Dashboard **already seeded with a recommended 10-question diagnostic set per subject**, not an empty state.

> Design note: an empty dashboard on day one is the single biggest driver of churn in study apps. The onboarding must end _inside_ a practice session, not on a dashboard.

### J2 — The daily loop (the journey that must be frictionless)

Dashboard → "Continue: Electrostatics, 8 left" → Practice session → answer → immediate feedback → (optional) Ask AI → next → session result → "Practice your 3 mistakes" → done. Target: **two taps from opening the app to answering a question.**

### J3 — Targeted repair

Dashboard → Weak topics → pick topic → auto-configured practice set drawn from that topic, weighted toward previously-missed questions → practice → mastery indicator moves.

### J4 — Previous-year drilling

PYQ hub → filter (subject / year / chapter) → either browse or start a PYQ session → attempt → compare against official marking scheme.

### J5 — Full exam rehearsal (see `04-exam-engine.md` for the detailed journey)

Exam hub → choose paper → instructions + readiness check → 3-hour proctor-free simulation → submit → objective auto-score immediately → subjective self-evaluation against marking scheme → full result with section-wise and chapter-wise breakdown → "these 6 chapters cost you 22 marks" → practice those.

### J6 — Admin content pipeline

Admin login → Question management → create/import → assign taxonomy + provenance → preview as student → publish → (later) build into an exam paper via a blueprint.

---

## 4. Feature list

Grouped by domain. `[MVP]` = in the first shippable release. `[V1.1]`, `[V2]` = later.

### Identity & profile

- `[MVP]` Sign up / log in (Clerk: email + Google; phone OTP is common in India — see open questions)
- `[MVP]` Onboarding: class, board, subject selection, target exam session
- `[MVP]` Profile & settings; subject list editable later
- `[V1.1]` Streaks and study goals
- `[V2]` Parent-visible progress link

### Content & discovery

- `[MVP]` Subject → chapter → topic browsing with per-chapter progress
- `[MVP]` Question rendering: MCQ, assertion–reason, very-short, short, long, case-based (with sub-parts), numerical
- `[MVP]` LaTeX/maths rendering and diagram images
- `[V1.1]` Chapter-level concept notes / formula sheets
- `[V2]` Full-text search across questions

### Practice mode

- `[MVP]` Practice setup with filters: subject, chapter, topic, difficulty, question type, marks, year, PYQ-only, count
- `[MVP]` Sequential question player with immediate feedback
- `[MVP]` Special sources: **My mistakes**, **Bookmarks**
- `[MVP]` Self-evaluation flow for subjective answers against the marking scheme
- `[MVP]` Session results with per-question review
- `[V1.1]` Timed practice mode; spaced-repetition scheduling of past mistakes
- `[V2]` Adaptive difficulty within a session

### Full exam simulation

- `[MVP]` Configurable exam blueprints (per subject, per year, per variant)
- `[MVP]` Exam runner: server-authoritative timer, palette navigation, mark-for-review, autosave, resume-after-refresh, auto-submit
- `[MVP]` Objective auto-grading + subjective self-grading against marking scheme
- `[MVP]` Result with section-wise / chapter-wise breakdown
- `[V1.1]` Admin blueprint builder UI + auto-generated papers from a blueprint
- `[V1.1]` Tab-switch / focus-loss logging (honesty nudge, not proctoring)
- `[V2]` AI-assisted rubric grading of subjective answers

### AI tutor

- `[MVP]` Context-aware "Ask AI" on any question: hint → concept → my mistake → step-by-step → simpler language
- `[MVP]` Grounded in the stored solution and marking scheme; provider-abstracted; server-side only
- `[MVP]` Per-user quotas and rate limits
- `[V1.1]` "Give me a similar question" (generates from the bank first, LLM only as fallback)
- `[V1.1]` Conversation history in an AI Tutor hub
- `[V2]` Free-form doubt asking outside a question context

### Progress

- `[MVP]` Dashboard: continue, recommended practice, accuracy, weak topics, recent activity
- `[MVP]` Subject and chapter performance; mistakes list; bookmarks list
- `[V1.1]` Predicted board score band; time-per-mark analysis
- `[V2]` Peer percentile comparison

### Admin

- `[MVP]` Question CRUD, publish/unpublish, archive; taxonomy assignment; provenance capture; preview-as-student
- `[MVP]` Subject / chapter / topic management
- `[MVP]` Bulk import (CSV or JSON) with validation report — non-negotiable for content throughput
- `[V1.1]` Exam paper builder; question QA workflow (draft → review → published); user management
- `[V2]` Content analytics (which questions are too easy / discriminate poorly)

---

## 5. MVP scope — what we actually build first

The MVP is deliberately **narrow in content and complete in mechanics**. It is better to have one subject that works end-to-end than eight that half-work.

**Content scope for MVP:** **Class 10 Mathematics and Class 10 Science.** _(Decided 2026-08-08.)_

Two consequences of this choice, both handled:

**(a) Science is not one subject.** Class 10 Science is a single 80-mark paper spanning **Physics, Chemistry and Biology** as distinct domains. Students do not think "I'll practise Science" — they think "I need to do Chemistry". So `Chapter` carries a `domain` field, and the browse tree for Science is **Subject → Domain → Chapter → Topic** while Maths is **Subject → Chapter → Topic**. One extra optional level, not a special case. See `03-data-model.md` §2.6.

**(b) Maths 10 and Science 10 are structurally similar** — both 80 marks, both Sections A–E, both 3 hours. That similarity removes the natural pressure that keeps the exam engine configuration-driven, which was the strongest argument for a mixed-class MVP. **Mitigation: a Class 12 Physics blueprint (70 marks, Section E mixing 4-mark and 6-mark groups) ships in `packages/exam-blueprints` as a validator test fixture from Phase 1** — no questions, no content, no UI, just the JSON and a test asserting the engine handles a structurally different paper. Cost: about an hour. It buys back the insurance that the subject choice gave up, and makes Class 12 a content problem later rather than an architecture problem.

**Content reality:** the bank is being built from zero. That makes admin throughput the critical path, and it reorders the phase plan (see `07-roadmap-risks-questions.md` §1) — admin content tooling now ships _before_ practice mode so content entry can begin roughly a week earlier and run in parallel with the rest of the build.

**In MVP:**

1. Auth + onboarding + profile
2. Taxonomy browsing (subject/chapter/topic)
3. Practice mode with the full filter set, including mistakes and bookmarks
4. Self-evaluation for subjective questions
5. Full exam simulation for the two chosen subjects, driven by blueprints
6. AI tutor with the five actions, quota-limited
7. Dashboard, progress, mistakes, bookmarks, PYQ hub
8. Admin: taxonomy CRUD, question CRUD, bulk import, publishing

**Deliberately out of MVP:** payments, notifications, streaks, spaced repetition, AI grading of subjective answers, blueprint builder UI (blueprints are seeded as versioned JSON initially), search, mobile app, offline mode beyond exam resilience.

**Definition of done for MVP:** a real Class 10 student can sign up, practise 200+ questions across Maths and Science chapters, sit a full 3-hour Science paper, recover from a browser crash mid-exam without losing answers, get a scored result, and be told which three chapters to fix.

---

## 6. Future features (post-MVP, ordered by expected value)

1. **Remaining subjects** — Chemistry, Maths (12), Biology, English, Economics, Business Studies, Accountancy; Science, Social Science, English (10).
2. **AI-assisted subjective grading** — grade a 5-mark answer against the official step-marking scheme. Highest-value AI feature and hardest to get right; needs the marking-scheme data model that MVP already establishes.
3. **Spaced repetition** — resurface a mistake at expanding intervals. Cheap to build on top of `QuestionAttempt`, large retention effect.
4. **Class 10 second-attempt mode** — given the new two-exam system, a focused "improve these subjects by May" plan.
5. **Predicted score** — calibrated projection from attempt history, framed carefully to avoid demoralising students.
6. **Admin blueprint builder + auto paper generation** — generate a fresh mock paper on demand from a blueprint plus the question bank.
7. **Teacher/school mode** — assign sets, view class performance. The real B2B monetisation path.
8. **Monetisation** — free practice, paid full exams + AI quota, most likely.

---

## 7. Success metrics (so we can tell if this is working)

| Metric                                                                           | Why it matters                        | Target signal        |
| -------------------------------------------------------------------------------- | ------------------------------------- | -------------------- |
| Questions attempted per active student per week                                  | The core loop is running              | > 60                 |
| Mistake-repair rate: % of missed questions re-attempted correctly within 14 days | The _differentiating_ loop is running | > 45%                |
| Full exams started → completed                                                   | Exam UX is trustworthy                | > 70%                |
| Exam attempts lost to technical failure                                          | Timer/persistence reliability         | ~0                   |
| Median admin time to enter one question                                          | Content throughput                    | < 90s                |
| AI cost per active student per month                                             | Unit economics                        | see `05-ai-tutor.md` |

---

## 8. Verified CBSE facts underpinning the design

These were checked against current sources during Phase 1 rather than assumed. They are the evidence for "make the exam structure configurable."

- **Class 10 now has two board attempts** (Feb, mandatory; May, optional), best-of-two scoring, same syllabus and pattern for both.
- **Competency-based questions rose to ~50% weightage** for 2026-27, up from 40%. So case-based / source-based / assertion–reason are not edge cases — they are half the paper, and must be first-class question types from day one.
- **Papers differ structurally by subject**, including in ways that a naive schema would miss:

|              | Class 10 Maths              | Class 10 Science                  | Class 12 Physics                  |
| ------------ | --------------------------- | --------------------------------- | --------------------------------- |
| Questions    | 38                          | 39                                | 33                                |
| Theory marks | 80                          | 80 (+20 internal)                 | 70 (+30 practical)                |
| Sections     | A–E                         | A–E                               | A–E                               |
| Section A    | 20 × 1m                     | 16 MCQ + 4 A-R × 1m               | 12 MCQ + 4 A-R × 1m               |
| Section E    | 3 × 4m, sub-parts **1+1+2** | 3 × 4m, sub-parts **1/2/3**       | 2 × 4m case-based **+ 1 × 6m LA** |
| Notes        | Basic / Standard variants   | spans Physics, Chemistry, Biology | —                                 |

- **Internal choice** ("attempt either / or") exists in most sections of all three.
- **Sub-part marks vary between subjects** (1+1+2 vs 1/2/3) — so sub-part structure is per-question data, never a constant.
- **A section can contain groups with different marks per question** — Class 12 Physics Section E holds both 4-mark and 6-mark questions. Any schema assuming "one mark value per section" breaks on the first real paper.
- **Subject variants exist** — Maths Basic vs Standard at Class 10.
- **Class 10 Science is internally divided into Physics / Chemistry / Biology**, which students navigate by.

Three schema consequences follow directly, and they are the reason the naive `ExamQuestion` join table in the brief is insufficient:

1. A question can have **sub-parts with their own marks** → questions form a shallow tree.
2. An exam position can offer **alternative questions** → the paper is a list of _slots_, each holding one or more question options.
3. Total marks, section count, and question count are **per-subject-per-year data**, never constants.

Sources:

- [CBSE two-exam system 2026, Class 10](https://supertutor.in/resources/blog/cbse-two-exam-system-2026/)
- [CBSE Class 10 board exams 2026 date sheet, both phases](https://news.careers360.com/cbse-class-10-board-exams-2026-tentative-date-sheet-pdf-out-phase-1-from-february-17-second-exam-starts-may-15/amp)
- [CBSE Class 12 exam pattern 2026-27, competency-based weightage](https://allen.in/cbse/class-12-exam-pattern)
- [CBSE Class 12 Physics sample paper 2026 structure](https://syllabus4u.com/cbse-class-12-physics-sample-paper-2026/)
- [CBSE Class 10 Maths sample paper 2025-26 structure](https://www.vedantu.com/sample-papers/cbse-sample-papers-for-class-10-maths)
- [CBSE Class 10 Science sample paper 2025-26 structure](https://www.vedantu.com/sample-papers/cbse-sample-papers-for-class-10-science)
- [CBSE Class 10 Science exam pattern 2026 (revised)](https://www.msn.com/en-in/news/India/cbse-class-10-science-exam-pattern-2026-revised-check-new-question-paper-format-marking-scheme-topic-wise-weightage/ar-AA1PDiFK)

> These are secondary sources. **Before Phase 6, every blueprint must be checked against the official sample paper PDF on `cbseacademic.nic.in`** and the source URL recorded on the blueprint record. Coaching-site summaries are good enough for architecture; they are not good enough to score a student's exam against.
