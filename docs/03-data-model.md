# Database & Domain Model

> Prisma/PostgreSQL. This document explains the *reasoning*; `schema.prisma` will follow it.
> The brief listed 16 entities. Five of them change shape once you look at real CBSE papers, and four more are needed. Those deltas are flagged **▲**.

---

## 1. Entity map

```
                    ┌──────────┐
                    │   User   │ (clerkId, role)
                    └────┬─────┘
                         │ 1:1
                  ┌──────▼────────┐        ┌──────────────┐
                  │ StudentProfile├───────▶│  TargetExam  │ ▲ (session + phase)
                  └──────┬────────┘        └──────────────┘
                         │ M:N (enrolment)
   ┌─────────────────────▼──────────────────────────────────────┐
   │  Subject ──▶ Chapter ──▶ Topic         (all syllabus-scoped)│
   └───────┬─────────────────────┬──────────────────────────────┘
           │                     │ M:N
           │              ┌──────▼──────┐
           │              │  Question   │◀─┐ parentId (case-based sub-parts) ▲
           │              └──┬───┬───┬──┘  │
           │                 │   │   └─────┘
           │      ┌──────────┘   └──────────┐
           │  ┌───▼──────────┐      ┌───────▼────────┐
           │  │QuestionOption│      │ QuestionSource │ (provenance + licence) ▲
           │  └──────────────┘      └────────────────┘
           │
   ┌───────▼────────┐                      ┌────────────────┐
   │  ExamBlueprint │ ▲ (config, versioned)│  ExamPaper     │
   └────────┬───────┘                      └───────┬────────┘
            └──────────────┬───────────────────────┘
                           ▼
                    ┌──────────────┐      ┌──────────────┐
                    │ ExamSection  │─────▶│  ExamSlot    │ ▲ (was ExamQuestion)
                    └──────────────┘      └──────┬───────┘
                                                 │ 1:N
                                          ┌──────▼───────┐
                                          │ ExamSlotItem │ ▲ (internal choice)
                                          └──────────────┘

   ┌──────────────────┐        ┌──────────────────┐
   │ PracticeSession  │        │   ExamAttempt    │
   └────────┬─────────┘        └────────┬─────────┘
            └───────────┬───────────────┘
                        ▼
                 ┌──────────────┐
                 │QuestionAttempt│  (polymorphic: practice OR exam)
                 └──────────────┘
                        │
                 ┌──────▼───────┐  ┌───────────┐  ┌──────────────┐  ┌───────────┐
                 │ TopicMastery │▲ │ Bookmark  │  │AIConversation│─▶│ AIMessage │
                 └──────────────┘  └───────────┘  └──────────────┘  └───────────┘
                                                          │
                                                   ┌──────▼──────┐
                                                   │  AIUsage    │ ▲ (quota ledger)
                                                   └─────────────┘
```

---

## 2. The five design decisions that matter

Everything else in this schema is routine. These are the ones that would be expensive to change later.

### 2.1 ▲ Questions are a shallow tree, not a flat table

A CBSE case-based question is *one* question worth 4 marks containing three sub-parts worth 1 + 1 + 2. Class 10 Maths Section E is three such questions. Flattening them into three independent questions loses the shared stimulus (the passage/diagram/data table) and breaks marks accounting. Storing sub-parts as a JSON blob makes them unfilterable, unattemptable individually, and invisible to progress tracking.

**Solution:** `Question.parentId` self-relation, depth capped at 1.
- A **parent** case-based question holds the stimulus, `totalMarks = 4`, and `isContainer = true`. It is never attempted directly.
- **Child** questions hold their own body, type, marks, answer, and solution. They *are* attempted, and they carry their own topic links — so a case study can legitimately span two topics, which real ones do.
- Practice filters query `WHERE parentId IS NULL OR includeSubParts`, and the renderer always loads the parent stimulus alongside a child.

The same mechanism serves multi-part questions like "(a) … (b) …" in Sections C and D.

### 2.2 ▲ An exam position is a *slot*, and a slot can hold alternatives

The brief's `ExamQuestion` join table assumes position → one question. Real papers say *"Attempt either Q29 or Q29(OR)"* — internal choice — throughout Sections B–E. It also assumes a paper is fixed, but we want to generate fresh mock papers from a blueprint later.

**Solution: three levels.**

| Entity | Role |
| --- | --- |
| `ExamBlueprint` | The *rule*: "Class 12 Physics 2026 → 5 sections; Section C = 7 slots × 3 marks, 2 with internal choice, drawn from these chapters." Versioned JSON, validated by Zod. |
| `ExamPaper` | A *concrete instance*: either an actual past paper entered by an admin, or one generated from a blueprint. |
| `ExamSection` → `ExamSlot` → `ExamSlotItem` | The paper's contents. A slot is "question number 19, 3 marks, section C". A slot has one `ExamSlotItem` normally, or two when there is internal choice. |

`ExamAttempt` answers reference the **slot**, plus which item the student chose. That is the only way to represent "student attempted the OR variant" cleanly, and it makes scoring, review, and analytics all work without special cases.

Blueprints being data rather than code is the direct answer to "do not hard-code exam structures" — and the reason `packages/exam-blueprints` exists as a package with its own validator.

### 2.3 ▲ Published questions are immutable; edits create versions

If an admin fixes a typo in the correct answer of a question 4,000 students have already attempted, every one of those attempt records silently becomes wrong. Their scores, their mistake lists, and their mastery numbers are now lies.

**Solution:** `Question` has `version` and `contentHash`. `QuestionAttempt` stores `questionVersion` **and a snapshot of what was actually shown and what was accepted as correct** (`questionSnapshot` JSONB). Editing a published question in a way that changes meaning (body, options, correct answer, marks) increments `version` and writes a `QuestionRevision` row. Cosmetic edits (typo in explanation) do not.

This is heavier than it looks necessary. It is the difference between a question bank you can correct and one you are afraid to touch. It also means review screens can show the student exactly the paper they sat.

### 2.4 ▲ Provenance is a required field with a licence status

Previous-year CBSE papers are not public-domain content that can simply be copied. This is a legal exposure, and it is also a data-modelling problem, because "which 2023 paper, which set, which question number" is information students actively want.

**`QuestionSource`** carries: `sourceType` (`ORIGINAL` | `CBSE_BOARD_PAPER` | `CBSE_SAMPLE_PAPER` | `NCERT` | `ADAPTED` | `THIRD_PARTY`), `year`, `examSession`, `paperCode`, `setNumber`, `originalQuestionNumber`, `sourceUrl`, plus **`licenceStatus`** (`CLEARED` | `FAIR_USE_CLAIMED` | `NEEDS_REVIEW` | `RESTRICTED`) and `attributionText`.

Product consequences, which should be decided now rather than after a takedown notice:
- The safe default is **ADAPTED** — questions rewritten to test the same concept with changed numbers/context, attributed as "based on CBSE 2023 Q17". These carry no meaningful copyright risk and are what most established players actually do.
- `RESTRICTED` questions can exist in the DB for reference but are filtered out of every student-facing query by a **default repository-level predicate**, not by remembering to add a `WHERE` clause.
- NCERT questions are widely reproduced and lower-risk, but should still be marked.

See open question Q6 — this needs your decision before content entry begins at scale.

### 2.5 ▲ Progress is a rollup table, not a query over attempts

"Weak topics" computed live means aggregating a student's entire `QuestionAttempt` history on every dashboard load. At 50k attempts per active student per year and a few thousand students, that is a slow dashboard and an expensive database.

**Solution:** `TopicMastery` (one row per student × topic) maintained incrementally inside the same transaction that writes an attempt: `attempted`, `correct`, `marksEarned`, `marksPossible`, `lastAttemptedAt`, `masteryScore`, `unrepairedMistakes`. Dashboard reads become simple indexed lookups. `SubjectProgress` is the same idea one level up.

`masteryScore` uses a **recency-weighted accuracy** (recent attempts count more) rather than raw lifetime accuracy — a student who was 20% on Electrostatics in June and 80% in August is not a 50% student, and telling them so is both wrong and demoralising.

### 2.6 ▲ Chapters carry an optional `domain` — because Class 10 Science is three subjects wearing a trench coat

Class 10 Science is one 80-mark paper covering **Physics, Chemistry and Biology**. No student says "let me practise Science" — they say "I'm weak at Chemistry". The paper is also *set* along those lines, so marks-lost analysis is far more useful reported per domain than per chapter.

Three ways to model this, and the choice matters:

| Option | Verdict |
| --- | --- |
| Three separate `Subject` rows (Phy/Chem/Bio) | ✗ Breaks the exam: there is one Science paper, not three. `ExamPaper.subjectId` would have nowhere to point. |
| A `Unit` table between Subject and Chapter | ✗ A whole entity, extra join, and two levels of nullability, to hold what is effectively a label for one subject. |
| **`Chapter.domain` — nullable string, indexed** | ✓ Zero cost for Maths (`null`), full grouping for Science, no new table, no new join. |

So: `Chapter.domain?` plus `@@index([subjectId, domain, orderIndex])`. The browse tree renders **Subject → Domain → Chapter → Topic** when any chapter in the subject has a domain, and **Subject → Chapter → Topic** when none do. One conditional in the catalog service, not a parallel code path.

This generalises usefully: Class 12 Physics has syllabus *units* ("Electrostatics", "Current Electricity") that group chapters and carry explicit marks weightage in the blueprint. Same field, same index, no further work. `TopicMastery` rolls up to domain for free via the chapter join, so "you're losing marks in Chemistry" is a cheap query rather than a new table.

---

## 3. Entity reference

Abbreviated. Every table gets `id` (cuid), `createdAt`, `updatedAt`.

### Identity
| Entity | Key fields | Notes |
| --- | --- | --- |
| `User` | `clerkId` @unique, `email`, `name`, `role`, `status` | Synced from Clerk via webhook + lazy upsert |
| `StudentProfile` | `userId` @unique, `classLevel`, `board`, `school?`, `preferredLanguage`, `onboardedAt` | 1:1 with User |
| `SubjectEnrolment` | `profileId`, `subjectId`, `isActive` | M:N; students change subjects |
| ▲ `TargetExam` | `profileId`, `session` ("2027"), `phase` (`PHASE_1`\|`PHASE_2`), `examDate?` | Models the new Class 10 two-attempt system and drives countdowns |

### Curriculum
| Entity | Key fields | Notes |
| --- | --- | --- |
| `Subject` | `board`, `classLevel`, `code`, `name`, `slug`, `variant?`, `syllabusYear`, `hasPractical`, `theoryMarks` | ▲ `variant` handles Maths Basic/Standard. `theoryMarks` is 70 or 80 — never a constant. |
| `Chapter` | `subjectId`, `name`, `slug`, `orderIndex`, `ncertChapterNo?`, ▲ `domain?` | `domain` groups chapters within a subject — "Physics"/"Chemistry"/"Biology" for Class 10 Science, syllabus unit names for Class 12. Null for Maths. See §2.6 |
| `Topic` | `chapterId`, `name`, `slug`, `orderIndex` | Finest granularity for mastery |
| ▲ `SyllabusVersion` | `subjectId`, `academicYear`, `isCurrent` | CBSE drops/rationalises chapters yearly. Without this, a 2019 PYQ on a deleted chapter shows up in a 2027 student's practice set. |

### Questions
| Entity | Key fields | Notes |
| --- | --- | --- |
| `Question` | `subjectId`, `chapterId`, `type`, `body` (rich), `marks`, `difficulty`, `bloomLevel`, `expectedTimeSeconds`, `status`, `version`, `parentId?`, `isContainer`, `hasInternalChoiceTwin?` | `status`: DRAFT \| IN_REVIEW \| PUBLISHED \| ARCHIVED |
| `QuestionTopic` | `questionId`, `topicId`, `isPrimary` | M:N — real questions span topics |
| `QuestionOption` | `questionId`, `label`, `body`, `isCorrect`, `orderIndex` | MCQ / assertion-reason |
| `QuestionAnswer` | `questionId`, `correctValue?`, `acceptedValues[]`, `tolerance?`, `unit?`, `solution`, `markingScheme` (JSON steps), `explanation` | ▲ Split from Question: keeps the answer key in a separate table so the student query *physically cannot* over-fetch it |
| `QuestionSource` | see §2.4 | Required |
| `QuestionRevision` | `questionId`, `version`, `diff`, `editedBy`, `reason` | Audit trail |
| `QuestionAsset` | `questionId`, `kind` (image/diagram), `url`, `altText` | ▲ Diagrams are unavoidable in Physics/Maths; `altText` is required for accessibility |

> **`QuestionAnswer` as a separate table is deliberate.** With the answer key on `Question`, the student list endpoint must remember to `select` around it every time. As a relation, the default query returns no answer data at all, and exposing it requires an explicit `include` — the safe path becomes the lazy path.

**`QuestionType` enum:** `MCQ`, `ASSERTION_REASON`, `VERY_SHORT_ANSWER`, `SHORT_ANSWER`, `LONG_ANSWER`, `CASE_BASED`, `NUMERICAL`, `TRUE_FALSE`, `FILL_BLANK`, `MATCH_FOLLOWING`.
**`Difficulty`:** `EASY`, `MEDIUM`, `HARD` (admin-set initially; recalibrated from real accuracy data later — store both `statedDifficulty` and a computed `observedDifficulty`).

### Exams
| Entity | Key fields |
| --- | --- |
| `ExamBlueprint` | `subjectId`, `name`, `academicYear`, `version`, `totalMarks`, `durationMinutes`, `structure` (validated JSON), `isActive` |
| `ExamPaper` | `blueprintId?`, `subjectId`, `title`, `paperType` (`PAST_PAPER`\|`SAMPLE_PAPER`\|`GENERATED_MOCK`), `year?`, `setCode?`, `totalMarks`, `durationMinutes`, `generalInstructions`, `status` |
| `ExamSection` | `paperId`, `name` ("Section A"), `orderIndex`, `instructions`, `marksPerQuestion?` |
| ▲ `ExamSlot` | `sectionId`, `questionNumber`, `marks`, `orderIndex`, `isOptional`, `choiceGroupId?` |
| ▲ `ExamSlotItem` | `slotId`, `questionId`, `variantLabel` (`MAIN`\|`OR`), `orderIndex` |

### Attempts
| Entity | Key fields | Notes |
| --- | --- | --- |
| `PracticeSession` | `userId`, `mode`, `filtersJson`, `questionIds[]`, `currentIndex`, `status`, `startedAt`, `completedAt`, totals | `questionIds` is **materialised at creation** so the set is stable even if content changes mid-session |
| `ExamAttempt` | `userId`, `examPaperId`, `status`, `startedAt`, `deadlineAt`, `submittedAt?`, `submissionReason`, `lastHeartbeatAt`, `objectiveScore?`, `selfAssessedScore?`, `totalScore?`, `idempotencyKey` @unique | See `04-exam-engine.md` |
| `ExamAnswer` | `attemptId`, `slotId`, `chosenSlotItemId?`, `answerJson`, `status`, `revision`, `timeSpentMs`, `visitCount` | @@unique([attemptId, slotId]) |
| `QuestionAttempt` | `userId`, `questionId`, `questionVersion`, `questionSnapshot`, `practiceSessionId?`, `examAttemptId?`, `answerJson`, `isCorrect?`, `marksAwarded`, `marksPossible`, `evaluationMode` (`AUTO`\|`SELF`\|`AI`), `mistakeReason?`, `timeSpentMs`, `usedAiHelp`, `attemptedAt` | The single source of truth for all analytics. Exactly one of the two session FKs is set (DB check constraint). |
| `Bookmark` | `userId`, `questionId`, `note?` | @@unique([userId, questionId]) |
| ▲ `MistakeRecord` | `userId`, `questionId`, `firstMissedAt`, `repairedAt?`, `repairAttempts`, `nextReviewAt?` | Derivable from attempts, but materialised: it makes "unrepaired mistakes" a fast indexed query and gives spaced repetition a home later |

### Progress & AI
| Entity | Key fields |
| --- | --- |
| ▲ `TopicMastery` | `userId`, `topicId`, `attempted`, `correct`, `marksEarned`, `marksPossible`, `masteryScore`, `unrepairedMistakes`, `lastAttemptedAt` — @@unique([userId, topicId]) |
| ▲ `SubjectProgress` | same shape, subject level |
| `AIConversation` | `userId`, `questionId?`, `questionAttemptId?`, `context` (`PRACTICE`\|`REVIEW`), `title`, `messageCount`, `status` |
| `AIMessage` | `conversationId`, `role`, `action?`, `content`, `promptTokens`, `completionTokens`, `model`, `providerRequestId`, `latencyMs` |
| ▲ `AIUsageLedger` | `userId`, `date`, `messageCount`, `totalTokens`, `estimatedCostPaise` — @@unique([userId, date]) |

---

## 4. Indexes

Chosen against the queries that will actually run, not speculatively.

**The hot path — practice question selection.** This filters on 6+ columns over what will become the largest table:
```prisma
@@index([subjectId, status, difficulty])
@@index([chapterId, status, type])
@@index([subjectId, chapterId, status, marks])
@@index([parentId])
```
Plus on `QuestionTopic`: `@@index([topicId, questionId])` and `@@index([questionId])` — the topic-filtered path goes through the join table, and without the first index it becomes a sequential scan.

For year/PYQ filtering, the predicate lives on `QuestionSource`, so: `@@index([sourceType, year])` and `@@index([questionId])`.

> **Known scaling concern:** "give me 10 random published Medium questions from chapter X excluding ones I've answered correctly" is not a naturally indexable query. `ORDER BY RANDOM()` degrades badly. Plan: fetch a candidate id set with a covering index, shuffle in application code, then fetch the chosen rows. Revisit only if profiling demands it — see `07-roadmap-risks-questions.md` R4.

**Attempts and progress:**
```prisma
QuestionAttempt  @@index([userId, attemptedAt(sort: Desc)])       // history feed
                 @@index([userId, questionId, attemptedAt])        // "have I seen this?"
                 @@index([userId, isCorrect, attemptedAt])         // mistakes
                 @@index([examAttemptId])
                 @@index([practiceSessionId])
TopicMastery     @@unique([userId, topicId])
                 @@index([userId, masteryScore])                   // weak topics, sorted
MistakeRecord    @@index([userId, repairedAt])                     // unrepaired = repairedAt IS NULL
ExamAttempt      @@index([userId, status])
                 @@index([status, deadlineAt])                     // ← the sweeper job's query
ExamAnswer       @@unique([attemptId, slotId])
Bookmark         @@unique([userId, questionId])
User             @@unique([clerkId])
```

`@@index([status, deadlineAt])` on `ExamAttempt` is small but load-bearing: the auto-submit sweeper runs `WHERE status='IN_PROGRESS' AND deadlineAt < now()` every minute forever.

**Deferred until measured:** full-text search (needs `pg_trgm` / `tsvector` — a `[V2]` feature), partial indexes on `status='PUBLISHED'` (likely worthwhile once the table is large).

---

## 5. Integrity constraints worth enforcing in the database

Application code forgets. The database does not.

- `QuestionAttempt`: `CHECK ((practiceSessionId IS NULL) <> (examAttemptId IS NULL))` — an attempt belongs to exactly one context.
- `ExamAttempt.idempotencyKey` unique — makes duplicate attempt creation impossible, not merely unlikely.
- `@@unique([attemptId, slotId])` on `ExamAnswer` — one answer per slot, so concurrent autosaves upsert instead of duplicating.
- `Question`: `CHECK (parentId IS NULL OR isContainer = false)` — enforces max depth 1.
- Cascade rules: deleting a `Subject` must **not** cascade to questions and attempts. Subjects are archived (`isActive=false`), never deleted. `onDelete: Restrict` is the default posture here; `Cascade` only where the child is genuinely meaningless alone (`QuestionOption`, `ExamSlotItem`, `AIMessage`).

---

## 6. Seed data plan

`prisma/seed/` runs idempotently and is the fastest way to get a working system for development:
1. Subjects for Class 10 (CBSE), with correct `theoryMarks` and Maths Basic/Standard variants.
2. Full chapter and topic trees for **Class 10 Mathematics** (no domains) and **Class 10 Science** (chapters tagged `domain` = Physics / Chemistry / Biology) — so both branches of the browse tree have real data.
3. Two exam blueprints matching the verified structures in `00-overview.md` §8, **plus a Class 12 Physics blueprint as a validator test fixture only** (70 marks, mixed-marks Section E) — no questions, no UI, purely to prove the engine is not shaped around one paper.
4. ~40 seed questions per subject, marked `sourceType: ORIGINAL` or `ADAPTED`, spanning every question type including case-based with sub-parts at **both** `1+1+2` (Maths) and `1/2/3` (Science) splits — so every renderer path has real data from day one.
5. One admin user and two demo students at different progress levels, so the dashboard is never developed against an empty state.
