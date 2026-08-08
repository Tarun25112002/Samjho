# Exam Engine Architecture

> The highest-risk subsystem. A bug in the practice module annoys a student; a bug here destroys three hours of their work and they never return.
>
> **Governing principle: the client is untrusted, disposable, and may vanish at any moment.** Every guarantee is enforced on the server. The browser is a rendering surface with a local cache.

---

## 1. Three layers: blueprint → paper → attempt

```
ExamBlueprint          "how a Class 12 Physics paper is shaped"        CONFIG (versioned JSON)
      │  generate / author
      ▼
ExamPaper              "the 2024 Physics paper, Set 55/4/2"            CONTENT
      │  student starts
      ▼
ExamAttempt            "Aarav's attempt, started 19:04, ends 22:04"    RUNTIME STATE
```

Separating these is what makes the engine configuration-driven. A blueprint change ships as data, not a deploy. A new subject means new blueprint JSON, not new code.

### The blueprint format

Lives in `packages/exam-blueprints`, validated by a Zod schema, unit-tested. Class 12 Physics, matching the verified 2026 structure:

```jsonc
{
  "id": "cbse-12-physics-2026",
  "version": 1,
  "subject": { "board": "CBSE", "classLevel": 12, "code": "PHY" },
  "totalMarks": 70,
  "durationMinutes": 180,
  "generalInstructions": ["All questions are compulsory.", "..."],
  "sections": [
    {
      "name": "Section A", "orderIndex": 0, "marksPerQuestion": 1,
      "instructions": "Questions 1 to 16 are multiple choice / assertion-reason.",
      "groups": [
        { "count": 12, "types": ["MCQ"],              "internalChoice": false },
        { "count": 4,  "types": ["ASSERTION_REASON"], "internalChoice": false }
      ]
    },
    { "name": "Section B", "orderIndex": 1, "marksPerQuestion": 2,
      "groups": [{ "count": 5, "types": ["SHORT_ANSWER"], "internalChoice": true, "choiceCount": 1 }] },
    { "name": "Section C", "orderIndex": 2, "marksPerQuestion": 3,
      "groups": [{ "count": 7, "types": ["SHORT_ANSWER","NUMERICAL"], "internalChoice": true, "choiceCount": 2 }] },
    { "name": "Section D", "orderIndex": 3, "marksPerQuestion": 5,
      "groups": [{ "count": 3, "types": ["LONG_ANSWER"], "internalChoice": true, "choiceCount": 1 }] },
    { "name": "Section E", "orderIndex": 4,
      "groups": [
        { "count": 2, "marks": 4, "types": ["CASE_BASED"],   "subPartMarks": [1,1,2] },
        { "count": 1, "marks": 6, "types": ["LONG_ANSWER"], "internalChoice": true }
      ]
    }
  ],
  "chapterWeightage": [ { "unit": "Electrostatics", "marks": 16 }, "..." ]
}
```

Note that Section E carries two groups with **different marks per question** (4 and 6) — which is why `marksPerQuestion` is per-section *or* per-group, and why assuming "a section has one mark value" would have broken on the first real paper. Class 10 Maths needs 38 questions / 80 marks / sub-parts of 1+1+2 in Section E, and it is expressed in the same schema without a code change. That is the test the format has to pass.

**Blueprint validator** (`validateBlueprint`) asserts that section marks sum to `totalMarks` and question counts are internally consistent. Run in CI over every blueprint file, and in the admin paper editor live. A paper whose parts don't add up to 70 must be impossible to publish.

### Paper generation `[V1.1]`

`generatePaper(blueprint, questionPool, seed)` selects questions satisfying each group's type, marks and chapter-weightage constraints, with a deterministic seed so a paper is reproducible. MVP ships hand-authored papers via the admin UI; the blueprint format is designed so this can be added without schema change.

---

## 2. The timer — server-authoritative, always

Client clocks are wrong, sometimes innocently (drift, timezone, sleep) and sometimes deliberately (a student setting their system clock back). A `setInterval` countdown started on page load is wrong the moment the tab is backgrounded, because browsers throttle background timers.

**Model:**
- On `POST /exam-attempts`, the server computes and persists `startedAt` and `deadlineAt = startedAt + durationMinutes`. **`deadlineAt` is written once and never recalculated from client input.**
- Every API response for an attempt includes `serverTime`. The client computes `offset = serverTime - clientTime` once and renders `deadlineAt - (clientNow + offset)`.
- The client re-syncs `offset` on every heartbeat (30s), on tab visibility change, and on network reconnect. A laptop that slept for 20 minutes corrects itself the instant it wakes.
- The displayed countdown is cosmetic. **Nothing depends on it.** Every write endpoint independently checks `now() > deadlineAt` and rejects with `410 EXAM_EXPIRED`.

**Auto-submit has three independent triggers**, because relying on any one of them is how attempts get lost:
1. **Client:** at zero, the UI locks and fires submit. Fast and good UX. Not trusted.
2. **Server-lazy:** any request touching an expired `IN_PROGRESS` attempt finalises it first, then serves the response. Covers the student who closed the laptop and returns two days later.
3. **Sweeper job:** every 60 seconds, `WHERE status='IN_PROGRESS' AND deadlineAt < now()` → submit with `submissionReason: 'AUTO_TIMEOUT'`. Covers the student who never comes back, so results and analytics are never stuck in limbo.

All three converge on the same idempotent `submitAttempt` service function, so whichever fires first wins and the others are no-ops.

**Deliberate non-feature: no pause.** Real board exams do not pause. Adding it would create an obvious abuse path and undermine the entire point of the simulation. This is stated explicitly on the instructions page before the student starts.

---

## 3. Answer persistence — surviving refresh, crash, and network loss

Three layers, in order of authority:

```
  React state  ──debounce 800ms──▶  IndexedDB queue  ──when online──▶  PUT /answers/:slotId
   (instant)                         (survives crash)                   (authoritative)
```

**Save protocol.** `PUT /exam-attempts/:id/answers/:slotId` with `{ answer, status, chosenSlotItemId, revision, timeSpentMs }`.
- `revision` is a client-incremented counter per slot. The server accepts the write only if `revision >= stored.revision`, then stores the new one. This resolves the two-tabs / retried-request race deterministically without pessimistic locking.
- Upsert on `@@unique([attemptId, slotId])` — concurrent saves for the same slot cannot create duplicates at the database level.
- Response returns `{ savedAt, revision, serverTime }`; the UI shows an explicit **"Saved" / "Saving…" / "Saved offline"** indicator. During a high-stakes three-hour exam, uncertainty about whether work is saved is itself a failure — this indicator is a feature, not chrome.

**Offline.** A `navigator.onLine` + failed-request detector flips the runner into offline mode: a persistent banner, writes queued in IndexedDB keyed by `slotId` (newest wins), and a replay-in-order flush on reconnect. The exam remains fully usable offline; only sync pauses. The timer keeps running (server deadline is absolute) and the student is told so plainly.

**Refresh / crash / new device.** `GET /exam-attempts/:id` returns the entire resumable state: paper structure, every saved answer, per-slot status, `deadlineAt`, `serverTime`. The runner rehydrates from it and merges any unsynced IndexedDB entries whose `revision` exceeds the server's. **The server is always the base truth; local storage is only ever a recovery buffer.**

**Leaving the page.** `beforeunload` guard while `IN_PROGRESS`. On `visibilitychange` → hidden, flush pending saves immediately via `navigator.sendBeacon` — the last, best chance to persist when a tab is being closed.

---

## 4. Submission — exactly once

The attempt is a state machine, and the transition is guarded by the database:

```
CREATED ──▶ IN_PROGRESS ──┬──▶ SUBMITTED ──▶ EVALUATING ──▶ COMPLETED
                          └──▶ ABANDONED   (never started properly)
```

```ts
// conceptual — inside a transaction, at SERIALIZABLE or with a conditional update
const updated = await tx.examAttempt.updateMany({
  where:  { id, userId, status: 'IN_PROGRESS' },   // ← the guard
  data:   { status: 'SUBMITTED', submittedAt: now, submissionReason },
});
if (updated.count === 0) {
  return existingResult(id);   // already submitted — return the same result, do not error
}
await gradeObjectiveAnswers(tx, id);
```

The conditional `updateMany` is the whole trick: the *database* decides who wins the race between a double-click, a client auto-submit, and the sweeper. A `findFirst`-then-`update` has a window between read and write; this has none. Duplicate submits return the existing result rather than a 409, because from the student's perspective their exam did submit successfully.

`POST /exam-attempts` takes an idempotency key for the same reason at the other end — a double-tapped "Start exam" must not create two attempts and two timers.

---

## 5. Scoring

Executed **entirely server-side**, reading the answer key from the database. The client never receives correct answers during an attempt — not hidden in the payload, not in a `__NEXT_DATA__` blob, not anywhere. This is enforced by the `toStudentQuestion` serializer (`02-architecture.md` §3), and it is worth an explicit integration test that asserts the exam-runner payload contains no answer-key fields.

**Auto-graded now:** MCQ, assertion–reason, true/false, fill-in-blank (normalised comparison against `acceptedValues`), and numerical (tolerance-aware, unit-aware — `9.8 m/s²` and `9.80` should both pass, `9.8 cm/s²` should not).

**Not auto-graded:** short answer, long answer, derivations, case-based descriptive sub-parts. These are ~70% of a Physics paper's marks. Any claim to auto-grade them accurately would be false.

**MVP approach — structured self-evaluation.** After submit, the student is walked through each subjective answer alongside the **official step-marking scheme** (stored as an ordered list of steps with marks) and awards themselves marks per step, not per question. Awarding "did I get 3/5?" is guesswork; ticking "wrote the correct expression for electric field (1) ✓ / applied Gauss's law correctly (1) ✗ / …" is a genuine learning act, and it is exactly how a teacher marks. It also produces per-step data that a future AI grader can be validated against.

The result screen labels the two components honestly: *Objective 15/16 (auto-scored) · Subjective 39/54 (self-assessed)*. Never a single blended number presented as if it were an official score.

**`[V2]` AI-assisted grading** slots in as a third `evaluationMode` on `QuestionAttempt` (`AUTO` | `SELF` | `AI`). The plan is AI-suggested step marks that the student confirms or overrides — assistive, not authoritative — with agreement against self-scores measured before it is trusted.

---

## 6. The exam runner UI

A separate route group with its own layout, deliberately unlike the rest of the app.

**Structure:** fixed header (paper title, section, server-synced timer, save status, Submit) · scrollable question pane · right-hand question palette on desktop, bottom drawer on mobile · fixed footer (Prev · Mark for review · Clear · Next).

**Palette states**, each with a colour *and* a distinct glyph *and* an accessible label — the palette is otherwise pure colour-coding, which fails for colour-vision-deficient students:

| State | Meaning |
| --- | --- |
| Not visited | never opened |
| Visited, unanswered | opened, left blank |
| Answered | has an answer |
| Marked for review | flagged, may or may not be answered |
| Answered & marked | both |

**Internal choice** renders as a tab pair ("Q29" / "Q29 OR") within the slot. Switching tabs warns if the other variant has an answer, and only the chosen variant's answer is scored.

**Focus features:** fullscreen requested on start; browser-back intercepted; no app navigation; nothing animates except the timer's final minute; T-15 and T-5 warnings as non-blocking toasts. **AI tutor is completely disabled during an exam** — the button is absent, and the API rejects AI calls referencing an `IN_PROGRESS` exam attempt server-side.

**Screen size:** the brief accepts desktop-first here. Below ~768px the instructions page shows a clear recommendation to use a larger screen, but the exam remains *usable* on mobile — many Indian students only have a phone, and blocking them entirely would be the wrong call. The palette becomes a drawer and the footer compacts.

**`[V1.1]` honesty telemetry:** log tab-blur events and durations, shown to the student on their own result page ("you switched tabs 7 times"). Self-awareness, not proctoring. No webcam, no lockdown, no accusations — this is a practice tool and treating students as suspects would poison the product.

---

## 7. Failure matrix

Every row here becomes an integration or E2E test before this feature is called done.

| Failure | Mitigation | Outcome |
| --- | --- | --- |
| Browser refresh | Server state + IndexedDB merge | Resumes, timer intact |
| Tab closed / crash | Debounced save + `sendBeacon` on hide | ≤ ~1s of input at risk |
| Network drops 20 min | Offline queue, replay on reconnect | No data loss |
| Laptop sleeps 30 min | Absolute server `deadlineAt` | Time correctly consumed; no exploit |
| Client clock changed | Offset re-sync + server-side rejection | Cheat has no effect |
| Double-click Submit | Conditional `updateMany` guard | One submission, same result returned |
| Two tabs open | Per-slot `revision` ordering | Deterministic last-write-wins |
| Student never returns | Sweeper job | Auto-submitted, result available |
| Answer POSTed after deadline | `410 EXAM_EXPIRED` on every write | Rejected |
| Answer key sniffed from network | Separate `QuestionAnswer` table + student serializer + explicit test | Not in any payload |
| Server restarts mid-exam | All state in Postgres, none in memory | Unaffected |
