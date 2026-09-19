import {
  MISTAKE_REASON_LABELS,
  type ClassroomDiagnostics,
  type ClassTopic,
  type ItemAnalysis,
} from "@medhavi/contracts";
import Link from "next/link";

import { SectionHeading } from "@/components/ui/page";
import { Card, Chip, Meter } from "@/components/ui/surface";

/**
 * What the class got wrong, and what to do about it.
 *
 * ## The page is a to-do list, not a report
 *
 * Ordered by what a teacher can act on before the next lesson: the topics to
 * reteach, the misconception behind the hardest questions, the students to pull
 * aside. A dashboard of totals would be easier to build and would answer a
 * question nobody has — a teacher knows roughly how their class is doing, and
 * needs to know precisely what to say on Monday.
 *
 * ## The distractor bars are the point
 *
 * "62% got Q4 wrong" is a fact about a class. "Fifteen of the nineteen who
 * missed Q4 chose the option with the sign flipped" is a fact about a
 * *misconception*, and it is one sentence of board work rather than a lesson
 * repeated. Every other element on this page is context for those bars.
 *
 * ## What is deliberately absent
 *
 * Student answers. The privacy line the classroom contract draws — a teacher
 * sees readiness, not a student's working — is not moved by this page. The only
 * free text that appears is a wrong answer *more than one student gave*, which
 * is a misconception rather than a person.
 */
export function ClassDiagnostics({ diagnostics }: { diagnostics: ClassroomDiagnostics }) {
  const nothingYet =
    diagnostics.weakestTopics.length === 0 && diagnostics.hardestQuestions.length === 0;

  if (nothingYet) {
    return (
      <Card pad="roomy">
        <p className="text-text text-base font-semibold">
          Nothing to diagnose from {diagnostics.classroomName} yet.
        </p>
        <p className="text-text-soft mt-2 max-w-xl text-sm leading-relaxed">
          {diagnostics.studentCount === 0
            ? "No students have joined this class yet. Share the join code and they will appear here."
            : "This page fills up once the class has answered some questions. Set an assignment and come back after they have sat it."}
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <ClassSummary diagnostics={diagnostics} />

      <NextTeachingMove diagnostics={diagnostics} />

      {diagnostics.weakestTopics.length > 0 ? (
        <section aria-labelledby="reteach">
          <SectionHeading
            id="reteach"
            eyebrow="Reteach"
            title="Where the marks are going"
            lede="Weakest first, across everything this class has answered. The second number tells you whether it is the whole room or a handful of students."
          />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {diagnostics.weakestTopics.map((topic) => (
              <TopicRow key={topic.topicId} topic={topic} studentCount={diagnostics.studentCount} />
            ))}
          </div>
        </section>
      ) : null}

      {diagnostics.mistakeReasons.length > 0 ? (
        <section aria-labelledby="reasons">
          <SectionHeading
            id="reasons"
            eyebrow="Diagnosis"
            title="What kind of wrong"
            lede="Students tag their own mistakes. A class losing marks to calculation slips needs drill; a class losing them to concepts needs the lesson again — and the two look identical in a mark total."
          />
          <Card className="mt-4">
            <ul className="flex flex-col gap-3">
              {diagnostics.mistakeReasons.map((row) => (
                <li key={row.reason}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-text text-sm font-medium">
                      {MISTAKE_REASON_LABELS[row.reason]}
                    </span>
                    <span className="text-text-soft shrink-0 text-sm tabular-nums">
                      {row.count}
                    </span>
                  </div>
                  <Meter
                    // Scaled against the commonest reason, not against the
                    // total: the question is "which of these dominates", and
                    // sharing a denominator with every other reason leaves the
                    // whole list as short stubs that all look the same.
                    percent={
                      (row.count / (diagnostics.mistakeReasons[0]?.count ?? row.count)) * 100
                    }
                    size="slim"
                    className="mt-1.5"
                  />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {diagnostics.hardestQuestions.length > 0 ? (
        <section aria-labelledby="hardest">
          <SectionHeading
            id="hardest"
            eyebrow="Item analysis"
            title="The questions that beat them"
            lede="For an objective question, the bars show which option the class actually chose. A distractor most of them picked is one misconception, not thirty separate errors."
          />
          <div className="mt-4 flex flex-col gap-4">
            {diagnostics.hardestQuestions.map((item) => (
              <ItemCard key={item.questionId} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {diagnostics.strugglingStudents.length > 0 ? (
        <section aria-labelledby="students">
          <SectionHeading
            id="students"
            eyebrow="Who"
            title="Students to check on"
            lede="Ranked by mastery among those with enough work to judge. Students who have barely started are listed after, because they are a different conversation."
          />
          <Card className="mt-4" pad="flush">
            <ul className="divide-line divide-y">
              {diagnostics.strugglingStudents.map((student) => (
                <li
                  key={student.studentId}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-4 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="text-text truncate text-sm font-semibold">
                      {student.studentName ?? student.studentEmail}
                    </p>
                    <p className="text-text-soft mt-0.5 text-xs">
                      {student.attempted === 0
                        ? "Has not answered anything yet"
                        : student.weakestTopics.length > 0
                          ? `Weakest: ${student.weakestTopics.join(", ")}`
                          : `${String(student.attempted)} answered`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-text text-sm font-semibold tabular-nums">
                      {student.attempted === 0
                        ? "—"
                        : `${String(Math.round(student.masteryScore * 100))}%`}
                    </p>
                    {student.unrepairedMistakes > 0 ? (
                      <p className="text-text-faint text-xs">{student.unrepairedMistakes} open</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

/**
 * The handoff that turns a diagnosis into a teaching move.
 *
 * It deliberately pre-fills, rather than auto-sends, an assignment. The
 * diagnostic can identify the weak topic; the teacher still decides the size,
 * source, wording, and due time that make sense for tomorrow's lesson.
 */
function NextTeachingMove({ diagnostics }: { diagnostics: ClassroomDiagnostics }) {
  const topic = diagnostics.weakestTopics[0];
  if (!topic) return null;

  const reason = diagnostics.mistakeReasons[0];
  const href = `/teacher/classrooms?classroom=${encodeURIComponent(
    diagnostics.classroomId,
  )}&chapter=${encodeURIComponent(topic.chapterId)}`;

  return (
    <Card tone="brand" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="bg-brand-100 absolute -right-14 -bottom-16 size-48 rounded-full blur-2xl"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <p className="text-brand-700 text-sm font-semibold">Next teaching move</p>
          <h2 className="text-text text-heading mt-1">Give {topic.topicName} a second look.</h2>
          <p className="text-text-soft mt-2 text-sm leading-relaxed">
            The class is at {String(Math.round(topic.scoreRatio * 100))}% on this topic.
            {reason
              ? ` Their most common self-reported barrier is ${MISTAKE_REASON_LABELS[reason.reason].toLowerCase()}.`
              : " A short, focused follow-up will show whether the idea has landed."}
          </p>
        </div>
        <Link
          href={href}
          className="bg-brand-500 text-on-brand shadow-brand hover:bg-brand-400 rounded-pill inline-flex min-h-12 shrink-0 items-center justify-center px-5 text-sm font-semibold transition-colors"
        >
          Set focused practice
        </Link>
      </div>
    </Card>
  );
}

function ClassSummary({ diagnostics }: { diagnostics: ClassroomDiagnostics }) {
  return (
    <Card>
      <div className="grid gap-5 sm:grid-cols-3">
        <Stat
          label="Class score"
          value={
            diagnostics.classScoreRatio === null
              ? "—"
              : `${String(Math.round(diagnostics.classScoreRatio * 100))}%`
          }
          detail="Marks won of marks available"
        />
        <Stat
          label="Active this week"
          value={`${String(diagnostics.activeThisWeek)} of ${String(diagnostics.studentCount)}`}
          detail={`${String(diagnostics.attemptsThisWeek)} answers in seven days`}
        />
        <Stat
          label="Strong ground"
          value={diagnostics.strongestTopics[0]?.topicName ?? "Not enough work to say"}
          detail={
            diagnostics.strongestTopics.length > 0
              ? "Best topic across the class"
              : "A topic needs a few attempts before it means anything"
          }
        />
      </div>
    </Card>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0">
      <p className="text-text-faint text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-text mt-1 truncate text-xl font-semibold">{value}</p>
      <p className="text-text-soft mt-0.5 text-xs">{detail}</p>
    </div>
  );
}

/**
 * One topic, with the number that decides which lesson to teach.
 *
 * `studentsStruggling` beside the class average, because the average hides the
 * distinction a teacher needs: 55% might be everyone at 55%, which is a reteach,
 * or most of the room at 80% and six students at 15%, which is not.
 */
function TopicRow({ topic, studentCount }: { topic: ClassTopic; studentCount: number }) {
  const percent = Math.round(topic.scoreRatio * 100);
  const wholeRoom = studentCount > 0 && topic.studentsStruggling >= studentCount / 2;

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <p className="text-text truncate text-sm font-semibold">{topic.topicName}</p>
          <p className="text-text-faint mt-0.5 truncate text-xs">{topic.chapterName}</p>
        </div>
        <p className="text-text shrink-0 text-lg font-semibold tabular-nums">{percent}%</p>
      </div>

      <Meter
        percent={percent}
        // Red below half marks, which is the same threshold the weak-topic rule
        // uses everywhere else. A teacher scanning eight of these should be able
        // to find the problems by colour rather than by reading eight numbers.
        tone={percent < 50 ? "wrong" : "brand"}
        className="mt-3"
      />

      <p className="text-text-soft mt-2.5 text-xs">
        {topic.studentsStruggling === 0
          ? `${String(topic.studentsAttempted)} students have worked on this`
          : wholeRoom
            ? `${String(topic.studentsStruggling)} of ${String(topic.studentsAttempted)} are below half marks — worth the whole room`
            : `${String(topic.studentsStruggling)} of ${String(topic.studentsAttempted)} are below half marks — a small group`}
      </p>
    </Card>
  );
}

/**
 * One question, with the distractor tally.
 *
 * The bar for a wrong option most of the class chose is drawn in `marker` — the
 * red a teacher's pen makes, and already the colour of "this went wrong"
 * everywhere else in the product — so the misconception is findable by scanning
 * rather than by reading every number.
 */
export function ItemCard({ item }: { item: ItemAnalysis }) {
  const percent = Math.round(item.scoreRatio * 100);
  const mostChosenWrong = item.options
    .filter((option) => !option.isCorrect)
    .reduce<number>((most, option) => Math.max(most, option.chosenBy), 0);

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1">
          {/*
            The stem is plain text and clamped. It may contain LaTeX, which the
            renderer would typeset properly — and this is a scanning list, where
            twelve typeset stems is a wall. A teacher who needs the real question
            has it in front of them, or opens the bank.
          */}
          <p className="text-text line-clamp-3 text-sm leading-relaxed">{item.body}</p>
          <p className="text-text-faint mt-1.5 text-xs">
            {[item.chapterName, item.topicName].filter(Boolean).join(" · ")}
            {item.chapterName || item.topicName ? " · " : ""}
            {item.marks} mark{item.marks === 1 ? "" : "s"}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-text text-lg font-semibold tabular-nums">{percent}%</p>
          <p className="text-text-faint text-xs">
            {item.correct} of {item.attempted} right
          </p>
        </div>
      </div>

      {item.options.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {item.options.map((option) => {
            const share = item.attempted > 0 ? option.chosenBy / item.attempted : 0;
            const isMisconception =
              !option.isCorrect && option.chosenBy > 0 && option.chosenBy === mostChosenWrong;

            return (
              <li key={option.optionId}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-text-soft min-w-0 truncate text-xs">
                    <span className="text-text font-semibold">{option.label}.</span> {option.body}
                    {option.isCorrect ? (
                      <span className="text-tick-700 ml-1.5 font-semibold">correct</span>
                    ) : null}
                  </span>
                  <span className="text-text-soft shrink-0 text-xs tabular-nums">
                    {option.chosenBy}
                  </span>
                </div>

                <div className="bg-raised mt-1 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className={[
                      "h-full rounded-full",
                      option.isCorrect
                        ? "bg-tick-500"
                        : isMisconception
                          ? "bg-marker-500"
                          : "bg-sand-300",
                    ].join(" ")}
                    style={{ width: `${String(Math.round(share * 100))}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {item.commonWrongAnswers.length > 0 ? (
        <div className="mt-4">
          <p className="text-text-faint text-xs font-medium">
            Wrong answers more than one student gave
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {item.commonWrongAnswers.map((row) => (
              <Chip key={row.answer}>
                {row.answer} <span className="tabular-nums">×{row.count}</span>
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {item.mistakeReasons.length > 0 ? (
        <p className="text-text-soft mt-3 text-xs">
          They said:{" "}
          {item.mistakeReasons
            .slice(0, 3)
            .map((row) => `${MISTAKE_REASON_LABELS[row.reason]} (${String(row.count)})`)
            .join(", ")}
        </p>
      ) : null}
    </Card>
  );
}
