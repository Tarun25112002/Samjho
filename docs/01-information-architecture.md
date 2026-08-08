# Information Architecture — Page Map & User Flows

> Companion to `00-overview.md`. Defines every route, what it is _for_, and the three detailed user journeys.

---

## 1. Navigation model

The brief listed ~28 pages. Shipping 28 top-level destinations produces a product students get lost in. The fix is to distinguish **destinations** (things in navigation) from **states** (things you arrive at from a destination).

**Five destinations, and nothing else in the primary nav:**

| Destination  | Purpose                            | The question it answers           |
| ------------ | ---------------------------------- | --------------------------------- |
| **Home**     | Launchpad                          | "What should I do right now?"     |
| **Practice** | Configure and run practice         | "Let me drill something specific" |
| **Exams**    | Full board simulations             | "Am I ready for the real thing?"  |
| **Progress** | Performance + mistakes + bookmarks | "Where am I losing marks?"        |
| **Profile**  | Account, subjects, settings        | —                                 |

Subjects, chapters, PYQ, mistakes, bookmarks and the AI tutor are **not** separate nav items:

- Subject/chapter browsing lives under Practice (it is a way to _choose what to practise_, which is what students actually want from it — a chapter page whose primary button is "Practise this chapter").
- PYQ is a _filter preset_, surfaced as a prominent card on Practice and Exams, not a parallel content universe. A previous-year question is a question with a `source`; giving it its own section duplicates the entire browse tree.
- Mistakes and Bookmarks are tabs inside Progress, and are also directly startable as practice sources.
- The AI tutor is contextual — a panel attached to a question, not a destination. A standalone "chat with AI" page is a `[V1.1]` addition once we see whether students want it.

On mobile: a 5-item bottom tab bar maps exactly to the five destinations. On desktop: a left sidebar. Same routes, same information architecture — no divergent mobile IA.

---

## 2. Route map

`(web)` = Next.js App Router route. Route groups in parentheses are organisational, not URL segments.

### Public — `(marketing)`

| Route                                                     | Page                | Notes                                                                                                                                                                                            |
| --------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                                       | Landing             | Static, SEO-indexed, ISR. Hero, the practice→mistake→improve loop, exam simulator preview, subject coverage, FAQ.                                                                                |
| `/sign-in/[[...rest]]`                                    | Login               | Clerk component, themed.                                                                                                                                                                         |
| `/sign-up/[[...rest]]`                                    | Signup              | Clerk component, themed.                                                                                                                                                                         |
| `/subjects/[classLevel]/[subjectSlug]`                    | Public subject page | SEO surface: chapter list + free sample questions. This is the organic-acquisition play — students search "class 12 physics electrostatics previous year questions". Server-rendered, indexable. |
| `/legal/terms`, `/legal/privacy`, `/legal/content-policy` | Legal               | Content policy matters here (see `06-security-and-ops.md` on provenance).                                                                                                                        |

### Onboarding — `(onboarding)`

| Route      | Page          | Notes                                                                                                                                            |
| ---------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/welcome` | 4-step wizard | Class → board → subjects → target exam session. Single page, stepped state, not four routes. Guarded: redirects to `/home` if already onboarded. |

### Student app — `(app)`, auth-required

| Route                                   | Page                       | Notes                                                                                                                     |
| --------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/home`                                 | Dashboard                  | Action-first. See §4.                                                                                                     |
| `/practice`                             | Practice hub               | Presets (Continue, My mistakes, Bookmarks, PYQ, Weak topics) + "Build a custom set" + subject grid.                       |
| `/practice/subjects/[subjectId]`        | Subject detail             | Chapters with mastery bars; primary CTA per chapter is "Practise".                                                        |
| `/practice/chapters/[chapterId]`        | Chapter detail             | Topics, question counts by type/difficulty, PYQ count, your history. CTA: "Practise this chapter".                        |
| `/practice/new`                         | Practice setup             | Filter builder. Deep-linkable via query params so every "Practise this" button in the app is just a pre-filled link here. |
| `/practice/sessions/[sessionId]`        | **Practice runner**        | Focus mode: no sidebar, minimal chrome. One question at a time.                                                           |
| `/practice/sessions/[sessionId]/result` | Session result             | Score, per-question review, "practise your N mistakes" CTA.                                                               |
| `/exams`                                | Exam hub                   | Available papers grouped by subject; past attempts; readiness indicator.                                                  |
| `/exams/[examPaperId]`                  | Exam detail + instructions | Structure summary, duration, rules, device check, explicit "Start" with a confirm.                                        |
| `/exams/attempts/[attemptId]`           | **Exam runner**            | Fully isolated layout. See `04-exam-engine.md`.                                                                           |
| `/exams/attempts/[attemptId]/evaluate`  | Subjective self-evaluation | Post-submit, pre-final-result. Marking scheme + self-score per subjective question.                                       |
| `/exams/attempts/[attemptId]/result`    | Exam result                | Section-wise, chapter-wise, time analysis, "fix these chapters".                                                          |
| `/progress`                             | Progress overview          | Accuracy trend, subject/chapter performance, weak topics.                                                                 |
| `/progress/mistakes`                    | Mistakes                   | Filterable; bulk "practise these".                                                                                        |
| `/progress/bookmarks`                   | Bookmarks                  | Same shape as mistakes.                                                                                                   |
| `/progress/sessions`                    | Activity history           | All practice sessions + exam attempts.                                                                                    |
| `/profile`                              | Profile & settings         | Class/subjects/target exam, display prefs, AI usage meter, data export, delete account.                                   |

### Admin — `(admin)`, role-gated

| Route                     | Page                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `/admin`                  | Admin dashboard — content counts, publish queue, recent edits, question-health flags |
| `/admin/questions`        | Question list — dense table, faceted filters, bulk actions                           |
| `/admin/questions/new`    | Create question — keyboard-driven, "save and add another"                            |
| `/admin/questions/[id]`   | Edit question — with live student preview and version history                        |
| `/admin/questions/import` | Bulk import — upload, dry-run validation report, commit                              |
| `/admin/taxonomy`         | Subjects / chapters / topics — tree editor with drag reorder                         |
| `/admin/exams`            | Exam papers & blueprints list                                                        |
| `/admin/exams/[id]`       | Paper editor — sections, slots, internal choices, live blueprint validation          |
| `/admin/users`            | User management — roles, quota overrides `[V1.1]`                                    |

Admin login is not a separate page. Same Clerk session, role checked server-side; `/admin` 404s for non-admins (404 rather than 403 — do not confirm the existence of an admin area to a non-admin).

**Route count: 26 routes, 5 destinations.** The brief's page list is fully covered; the difference is hierarchy.

---

## 3. Layouts

Three distinct shells, because they have genuinely different purposes:

1. **App shell** — sidebar/bottom-nav, header, breadcrumbs. Everything under `(app)` except the two runners.
2. **Focus shell** — used by the practice runner. Header collapses to progress + exit. No nav. Removes the temptation to click away.
3. **Exam shell** — full-viewport, own header (timer + paper name), own footer (navigation), question palette drawer. No app nav at all, browser-back intercepted, `beforeunload` guard. This is what makes the exam "feel substantially different" — it is a different application shell, not a restyled page.

---

## 4. Dashboard composition (`/home`)

Ordered by "how much does this help the student _act_". The brief warned against an analytics-heavy page; this is the concrete answer.

1. **Continue** — resumes the last incomplete session/exam, or the next chapter in progress. Single largest element.
2. **Today's recommendation** — one deterministic suggested set (weak-topic-weighted). One card, one button, not a feed.
3. **Fix your mistakes** — count of unrepaired mistakes + "Practise N".
4. **Exam readiness** — days to target exam, papers attempted, "Take a full paper".
5. **This week** — three numbers only: questions attempted, accuracy, minutes practised. A single sparkline. Nothing more.
6. **Subjects** — compact grid with mastery bars, links into the chapter tree.

Deeper analytics live in `/progress`, where a student goes deliberately.

---

## 5. Journey A — Student daily loop (detailed)

```
/home
  └─ "Continue: Electrostatics — 8 questions left"
       │  POST /practice-sessions  (resume or create)
       ▼
/practice/sessions/{id}                      [Focus shell]
  ├─ Q3 of 10 · Electrostatics · 3 marks · 2023 PYQ · Medium
  ├─ Student answers
  │    ├─ Objective  → submit → server grades → correct/incorrect + explanation
  │    └─ Subjective → "Reveal marking scheme" → self-score (Full / Partial / None)
  ├─ Feedback panel:  correct answer · step-marking scheme · explanation · [Ask AI] · [Bookmark]
  ├─ If wrong: "What went wrong?" → Concept / Calculation / Misread / Guessed / Didn't know
  │            (one tap, skippable — this is what powers real mistake analysis)
  └─ Next →  ... → last question
       ▼
/practice/sessions/{id}/result
  ├─ 7/10 · 18/24 marks · 14 min
  ├─ Per-question review (expand any)
  ├─ Weak topic detected: "Gauss's Law — 1/3 correct"
  └─ CTAs: [Practise your 3 mistakes]  [Practise Gauss's Law]  [Back home]
```

**Why self-evaluation instead of auto-grading subjective answers:** a 3-mark derivation cannot be reliably auto-graded by string matching, and LLM grading is not accurate enough to be a student's _primary_ score signal without careful evaluation work. Self-evaluation against the official step-marking scheme is how CBSE students already practise, is honest about its limitations, and produces a `selfAwardedMarks` field that AI grading can later be validated against. We build the data path now and upgrade the grader later — see `04-exam-engine.md` §6.

---

## 6. Journey B — Full board exam (detailed)

```
/exams
  └─ "CBSE Class 12 Physics — 2024 Board Paper · 70 marks · 3h"
       ▼
/exams/{paperId}                             [instructions]
  ├─ Structure: Section A 16m · B 10m · C 21m · D 9m · E 14m · 33 questions
  ├─ Rules, internal-choice explanation, how the palette works
  ├─ Device check: screen width, connectivity, clock skew vs server
  ├─ Warning: "Once started, the 3-hour timer runs on our server and does not pause."
  └─ [I'm ready — Start exam]  → confirm dialog
       │  POST /exam-attempts   → server stamps startedAt + deadlineAt
       ▼
/exams/attempts/{attemptId}                  [Exam shell, fullscreen requested]
  ┌──────────────────────────────────────────────────────────┐
  │ Physics 2024              ⏱ 02:47:13          [Submit]   │
  ├───────────────────────────────────────────┬──────────────┤
  │ Section C · Q19 · 3 marks                 │  PALETTE     │
  │ [internal choice: OR variant available]   │  ▣ answered  │
  │                                           │  ▤ review    │
  │ <question body, LaTeX, figure>            │  ▢ unseen    │
  │ <answer input by type>                    │  ◩ visited,  │
  │                                           │     unanswered│
  │ [◀ Prev] [Mark for review] [Clear] [Next ▶]│  Section jump│
  └───────────────────────────────────────────┴──────────────┘
  │
  ├─ Autosave every answer change (debounced) + heartbeat every 30s
  ├─ Offline → banner "Saving locally, will sync" → queue in IndexedDB → replay on reconnect
  ├─ Refresh/crash → reopen URL → server returns full attempt state → resume, timer intact
  ├─ T-15min / T-5min warnings
  └─ Time expires → client locks UI and submits → server enforces regardless
       ▼
   Submit (idempotent, server-authoritative)
       ▼
/exams/attempts/{attemptId}/evaluate
  └─ For each subjective answer: your answer | official marking scheme | award yourself 0..max
       (Objective section already scored automatically and shown.)
       ▼
/exams/attempts/{attemptId}/result
  ├─ 54 / 70   (Objective 15/16 auto · Subjective 39/54 self-assessed)
  ├─ Section-wise bars · chapter-wise marks lost · time spent per section
  ├─ "You lost 22 marks across 3 chapters: Ray Optics, EMI, Dual Nature"
  └─ [Practise those chapters]  [Review paper]  [Take another paper]
```

**Failure modes deliberately designed for:** browser refresh, tab close, laptop sleep, network loss, duplicate submit clicks, client clock manipulation, and the student simply walking away. All handled server-side; the client is treated as untrusted and disposable. Mechanisms in `04-exam-engine.md`.

---

## 7. Journey C — Admin content pipeline

```
/admin  →  /admin/questions/new
  ├─ Type (drives the whole form): MCQ · Assertion-Reason · VSA · SA · LA · Case-based · Numerical
  ├─ Taxonomy: Class → Subject → Chapter → Topic(s)   (cascading, keyboard-navigable)
  ├─ Body (rich text + LaTeX + image), options, correct answer(s)
  ├─ Case-based only: add sub-parts, each with its own marks (e.g. 1 + 1 + 2)
  ├─ Marks · Difficulty · Bloom level · expected time
  ├─ Solution + step-marking scheme + explanation
  ├─ Provenance (required):  Original | CBSE PYQ | CBSE Sample Paper | NCERT | Adapted
  │     └─ if not Original: year, paper code, set, and a licence status flag
  ├─ [Preview as student]  — renders in the real student component, no surprises
  └─ [Save draft] / [Save & add another] / [Publish]

/admin/questions/import
  ├─ Upload CSV/JSON → dry run
  ├─ Validation report: row-level Zod errors, duplicate detection, unknown chapters
  └─ Commit only if zero blocking errors → questions land as DRAFT for review
```

Two throughput decisions that matter more than they look:

- **"Save & add another" preserving taxonomy** turns a 4-minute task into a 90-second one when entering a chapter's worth of questions.
- **Bulk import lands as DRAFT, never PUBLISHED.** Import is for volume; publishing is a deliberate quality gate.

---

## 8. Cross-cutting UI states

Every list and data surface must define four states. This is enforced by building a shared `<DataState>` wrapper in `packages/ui` rather than by discipline.

| State       | Rule                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| **Loading** | Skeletons matching final layout. Never a centred spinner on a full page.                                             |
| **Empty**   | Always includes the action that fills it. "No mistakes yet — that's good! Practise a chapter to build your history." |
| **Error**   | Plain language + retry + a support reference id. Never a raw error string.                                           |
| **Offline** | Persistent banner; in the exam runner, an explicit save-status indicator.                                            |

---

## 9. Design direction (brief, for Phase 3)

- **Not a SaaS dashboard.** Warm, calm, high-contrast, generous type. Study material should feel like well-set print, not a CRM.
- **Type:** a readable serif or humanist sans for question bodies (students read these for hours); a clean sans for UI. Maths via KaTeX, styled to sit correctly on the text baseline.
- **Colour:** one confident brand hue, plus a strict semantic set — correct / incorrect / partial / review / unattempted. These five must be distinguishable by shape and label as well as colour (a meaningful fraction of teenage boys are colour-vision deficient, and the exam palette is _entirely_ colour-coded — so it also carries icons and text labels).
- **Density:** student surfaces are spacious; admin surfaces are dense. Two different jobs; do not use one design language for both.
- **Dark mode** from day one. The primary usage window is late at night.
- **Motion:** minimal and fast. Nothing animates during an exam except the timer.
