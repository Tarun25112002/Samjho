import { PRACTICE_MODE_LABELS, type SubjectDetail, type SubjectSummary } from "@samjho/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FlameIcon } from "@/components/icons";
import { StartPractice } from "@/features/practice/start-practice";
import { ButtonLink } from "@/components/ui/button";
import { loadSubject } from "@/lib/catalog";
import { loadStudentClassrooms } from "@/lib/classrooms";
import {
  activityStrip,
  examCountdown,
  streakDays,
  weekTotals,
  type ActivityDay,
} from "@/lib/dashboard";
import { requireOnboarded } from "@/lib/me";
import { loadSessions } from "@/lib/practice";
import { describeScore, formatDuration, formatMarksValue } from "@/lib/practice-format";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

/**
 * The dashboard.
 *
 * ## What it is ordered by
 *
 * How much each thing helps the student *act*, which is docs/01 §4's rule and
 * the same one the practice hub follows. So: the one thing to do next, then how
 * the week has gone, then the subjects, then history. A student opening the app
 * at eleven at night wants to answer a question, not to read about having
 * answered questions — and docs/00 §5's two-tap target is measured from this
 * page, so the button that starts a set is above the fold on a 360px screen.
 *
 * ## Every number here is checkable
 *
 * There is still no progress endpoint — the API maintains `TopicMastery` and
 * `SubjectProgress` but nothing reads them back — so the figures are derived
 * from the last fifty session summaries in `lib/dashboard.ts`. That is a real
 * constraint and a useful one: "62 answered, 48 right" is a fact a student can
 * check against their own history, whereas a mastery percentage invented in the
 * browser is a number they would believe and should not.
 *
 * The page therefore claims nothing it cannot show the working for, and says so
 * where a figure is missing rather than printing a zero.
 */
export default async function HomePage() {
  const me = await requireOnboarded();
  if (me.user.role === "TEACHER") redirect("/teacher");
  const profile = me.profile;

  const [inProgress, history, classrooms] = await Promise.all([
    loadSessions({ status: "IN_PROGRESS", limit: 1 }),
    loadSessions({ limit: 50 }),
    // The same rule the subject cards below follow, for the same reason. The
    // teacher strip is one optional band on this page; practice history is the
    // page. A classroom endpoint that is failing — an unapplied migration is the
    // way this actually happens — should cost a student that band, not their
    // whole dashboard. `/classroom` is where a real failure gets reported,
    // because there it is the subject of the page rather than a garnish.
    loadStudentClassrooms().catch(() => []),
  ]);

  const resume = inProgress.items[0];
  const week = weekTotals(history.items);
  const streak = streakDays(history.items);
  const days = activityStrip(history.items);
  const countdown = examCountdown(profile?.targetExam ?? null);
  const subjects = await loadEnrolledSubjects(profile?.subjects ?? []);
  const recent = history.items.slice(0, 5);
  const assignedNext = classrooms
    .flatMap((classroom) =>
      classroom.assignments.map((assignment) => ({
        assignment,
        classroomName: classroom.name,
        subjectName: classroom.subject.name,
      })),
    )
    .sort((left, right) => {
      const priority = { IN_PROGRESS: 0, NOT_STARTED: 1, LATE: 2, COMPLETED: 3 } as const;
      return priority[left.assignment.progress] - priority[right.assignment.progress];
    })
    .find(
      ({ assignment }) => assignment.progress !== "COMPLETED" && assignment.progress !== "LATE",
    );

  const firstName = me.user.name?.split(" ")[0];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-text text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] sm:text-4xl">
            {firstName === undefined ? "Welcome back" : `${greeting()}, ${firstName}`}
          </h1>
          {profile ? (
            <p className="text-text-soft mt-1.5 text-sm">
              Class {profile.classLevel} {profile.board}
              {countdown ? ` · board exams in ${countdown.when}` : ""}
            </p>
          ) : null}
        </div>

        {/* Shown only once it exists. A streak counter reading "0 days" on the
            day someone comes back is a scolding, not a nudge. */}
        {streak > 0 ? (
          <p className="bg-brand-50 text-brand-700 rounded-pill inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold">
            <FlameIcon className="size-4" />
            {streak === 1 ? "1 day streak" : `${String(streak)} day streak`}
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {resume ? (
            <ResumeCard
              id={resume.id}
              focus={resume.focus ?? PRACTICE_MODE_LABELS[resume.mode]}
              answered={resume.totals.answered}
              total={resume.totals.totalQuestions}
            />
          ) : (
            <StartCard />
          )}
        </div>

        <CountdownCard countdown={countdown} />
      </div>

      {assignedNext ? (
        <TeacherBrief
          classroomName={assignedNext.classroomName}
          subjectName={assignedNext.subjectName}
          title={assignedNext.assignment.title}
          questionCount={assignedNext.assignment.questionCount}
          progress={assignedNext.assignment.progress}
          dueAt={assignedNext.assignment.dueAt}
        />
      ) : null}

      <ThisWeek week={week} days={days} hasHistory={history.items.length > 0} />

      <section aria-labelledby="subjects-heading" className="flex flex-col gap-4">
        <h2 id="subjects-heading" className="text-text text-lg font-semibold">
          Your subjects
        </h2>

        {subjects.length === 0 ? (
          <p className="border-line bg-card rounded-panel text-text-soft border p-6 text-sm">
            No subjects selected yet.{" "}
            <Link href="/profile" className="text-brand-700 font-medium underline">
              Choose some
            </Link>{" "}
            and your chapters will appear here.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {subjects.map((subject) => (
              <li key={subject.summary.id}>
                <SubjectCard subject={subject} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent-heading" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="recent-heading" className="text-text text-lg font-semibold">
            Recent sets
          </h2>
          {recent.length > 0 ? (
            <Link href="/practice" className="text-brand-700 text-sm font-medium hover:underline">
              All practice
            </Link>
          ) : null}
        </div>

        {recent.length === 0 ? (
          <p className="border-line bg-card rounded-panel text-text-soft border p-6 text-sm">
            Nothing yet. Your first set will appear here the moment you finish one.
          </p>
        ) : (
          <ul className="border-line bg-card rounded-panel divide-line divide-y overflow-hidden border">
            {recent.map((session) => (
              <li key={session.id}>
                <Link
                  href={
                    session.status === "IN_PROGRESS"
                      ? `/practice/sessions/${session.id}`
                      : `/practice/sessions/${session.id}/result`
                  }
                  className="hover:bg-raised flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-4 transition-colors"
                >
                  <span className="text-text font-medium">
                    {session.focus ?? PRACTICE_MODE_LABELS[session.mode]}
                  </span>
                  <span className="text-text-soft text-sm">{describeScore(session.totals)}</span>
                  <span className="text-text-faint ml-auto text-sm">
                    {session.status === "IN_PROGRESS"
                      ? "In progress"
                      : formatDuration(session.totals.timeSpentMs)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * "Good evening" at eleven at night, in the student's own time zone.
 *
 * docs/01 §9 says the primary usage window is late at night, so this greeting is
 * wrong more often than it is right if it uses the server's clock — which for a
 * UTC host means greeting a student with "Good afternoon" at half past nine in
 * the evening.
 */
function greeting(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * The one thing to do next, when there is a half-finished set.
 *
 * First and largest, because a set in progress is the single most likely thing a
 * returning student wants — and an abandoned set is the one that never gets
 * finished.
 */
function ResumeCard({
  id,
  focus,
  answered,
  total,
}: {
  id: string;
  focus: string;
  answered: number;
  total: number;
}) {
  const percent = total === 0 ? 0 : Math.round((answered / total) * 100);

  return (
    <section
      aria-labelledby="resume-heading"
      className="rounded-panel border-brand-200 bg-brand-50 flex h-full flex-col gap-5 border p-6 sm:p-7"
    >
      <div>
        <p className="text-brand-700 text-sm font-semibold">Where you left off</p>
        <h2
          id="resume-heading"
          className="text-text mt-1 text-2xl font-semibold tracking-[-0.02em]"
        >
          {focus}
        </h2>
      </div>

      <div>
        <div className="text-text-soft flex items-baseline justify-between text-sm">
          <span>
            {answered} of {total} answered
          </span>
          <span className="tabular-nums">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={answered}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Questions answered in this set"
          className="bg-brand-200 mt-2 h-2 w-full overflow-hidden rounded-full"
        >
          <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${String(percent)}%` }} />
        </div>
      </div>

      <div className="mt-auto flex flex-wrap gap-3">
        <ButtonLink href={`/practice/sessions/${id}`}>Resume</ButtonLink>
        <ButtonLink href="/practice" variant="secondary">
          Something else
        </ButtonLink>
      </div>
    </section>
  );
}

/** The same slot when there is nothing to resume. */
function StartCard() {
  return (
    <section
      aria-labelledby="start-heading"
      className="rounded-panel border-brand-200 bg-brand-50 flex h-full flex-col gap-5 border p-6 sm:p-7"
    >
      <div>
        <p className="text-brand-700 text-sm font-semibold">Ready when you are</p>
        <h2 id="start-heading" className="text-text mt-1 text-2xl font-semibold tracking-[-0.02em]">
          Ten questions, right now
        </h2>
        <p className="text-text-soft mt-2 max-w-[42ch] text-sm leading-relaxed">
          Drawn from everything you are studying, marked as you go, and your mistakes kept for next
          time.
        </p>
      </div>

      <div className="mt-auto flex flex-wrap items-start gap-3">
        {/* The preset, not the builder. Most students do not want to build
            anything — they want to start, and docs/00 §5 counts the taps. */}
        <StartPractice mode="QUICK" filters={{ unseenOnly: true }} count={10} label="Start" />
        <ButtonLink href="/practice" variant="secondary">
          Choose what to practise
        </ButtonLink>
      </div>
    </section>
  );
}

/** A task should show up where students already decide what to do next. */
function TeacherBrief({
  classroomName,
  subjectName,
  title,
  questionCount,
  progress,
  dueAt,
}: {
  classroomName: string;
  subjectName: string;
  title: string;
  questionCount: number;
  progress: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "LATE";
  dueAt: string | null;
}) {
  return (
    <section className="rounded-panel border-brand-200 bg-card flex flex-col gap-4 border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <p className="text-brand-700 text-sm font-semibold">From your teacher · {classroomName}</p>
        <h2 className="text-text mt-1 text-xl font-semibold tracking-[-0.02em]">{title}</h2>
        <p className="text-text-soft mt-1 text-sm">
          {subjectName} · {questionCount} questions
          {dueAt ? ` · due ${formatAssignmentDue(dueAt)}` : ""}
          {progress === "IN_PROGRESS" ? " · you have started this" : ""}
        </p>
      </div>
      <ButtonLink href="/classroom" variant={progress === "IN_PROGRESS" ? "secondary" : "primary"}>
        {progress === "IN_PROGRESS" ? "Resume" : "Open assignment"}
      </ButtonLink>
    </section>
  );
}

function formatAssignmentDue(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * Days until the paper.
 *
 * The most emotionally live fact in the product, so it is stated and then left
 * alone: a number, a date, and no ring, gauge or colour change as it shrinks. A
 * countdown that turns red in January is a countdown that makes January worse.
 */
function CountdownCard({ countdown }: { countdown: ReturnType<typeof examCountdown> }) {
  if (countdown === null) {
    return (
      <section className="rounded-panel border-line bg-card flex flex-col justify-center gap-2 border p-6">
        <h2 className="text-text font-semibold">No sitting chosen</h2>
        <p className="text-text-soft text-sm leading-relaxed">
          Pick the board sitting you are working towards and this becomes a countdown.
        </p>
        <Link href="/profile" className="text-brand-700 text-sm font-medium hover:underline">
          Set your target
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="countdown-heading"
      className="rounded-panel border-line bg-card flex flex-col justify-center border p-6"
    >
      <h2 id="countdown-heading" className="text-text-soft text-sm font-medium">
        Your board exams
      </h2>

      {countdown.daysRemaining === null ? (
        <>
          <p className="text-text mt-2 text-3xl font-semibold tracking-[-0.03em]">
            {countdown.when}
          </p>
          <p className="text-text-faint mt-2 text-sm leading-relaxed">
            CBSE publishes the date sheet a few months before. The exact day appears here when it
            does.
          </p>
        </>
      ) : (
        <>
          <p className="text-text mt-2 flex items-baseline gap-2 text-5xl font-semibold tracking-[-0.04em] tabular-nums">
            {countdown.daysRemaining}
            <span className="text-text-soft text-base font-medium tracking-normal">
              {countdown.daysRemaining === 1 ? "day" : "days"}
            </span>
          </p>
          <p className="text-text-faint mt-2 text-sm">{countdown.when}</p>
        </>
      )}
    </section>
  );
}

/**
 * The week, in three figures and seven days.
 *
 * The strip is bars rather than a heat map: seven squares in four shades is a
 * legend nobody reads, and a bar whose height is the number of questions is
 * legible without one. Every bar also carries its own text label for a screen
 * reader, because a row of coloured squares says nothing out loud.
 */
function ThisWeek({
  week,
  days,
  hasHistory,
}: {
  week: ReturnType<typeof weekTotals>;
  days: ActivityDay[];
  hasHistory: boolean;
}) {
  const busiest = Math.max(...days.map((day) => day.answered), 1);

  return (
    <section
      aria-labelledby="week-heading"
      className="rounded-panel border-line bg-card grid gap-6 border p-6 lg:grid-cols-[1fr_auto] lg:gap-10 lg:p-7"
    >
      <div>
        <h2 id="week-heading" className="text-text text-lg font-semibold">
          Your last seven days
        </h2>

        {week.answered === 0 ? (
          <p className="text-text-soft mt-3 max-w-[46ch] text-sm leading-relaxed">
            {hasHistory
              ? "Nothing this week yet. One set of ten takes about twelve minutes."
              : "Once you finish a set, your questions, accuracy and marks for the week show up here."}
          </p>
        ) : (
          <dl className="mt-4 grid grid-cols-3 gap-4 sm:gap-6">
            <Figure label="Questions" value={String(week.answered)} />
            {/* Null, not zero — see `weekTotals`. */}
            <Figure
              label="Accuracy"
              value={week.accuracy === null ? "—" : `${String(week.accuracy)}%`}
            />
            <Figure
              label="Marks"
              value={`${formatMarksValue(week.marksEarned)}/${formatMarksValue(week.marksPossible)}`}
            />
          </dl>
        )}
      </div>

      <ol className="flex items-end gap-2 lg:gap-2.5" aria-label="Questions answered each day">
        {days.map((day) => (
          <li key={day.key} className="flex flex-col items-center gap-2">
            <span className="sr-only">
              {day.label}:{" "}
              {day.answered === 0 ? "nothing answered" : `${String(day.answered)} answered`}
            </span>

            {/* A full-height track with the bar drawn inside it, rather than a
                bare bar on the page. An empty day is then a visible empty slot
                instead of a hairline the eye reads as missing data — and the
                busiest day has something to be measured against. */}
            <span
              aria-hidden="true"
              className="bg-raised flex h-16 w-6 items-end overflow-hidden rounded-lg lg:w-7"
            >
              <span
                className="bg-brand-500 w-full rounded-lg"
                style={{
                  // A floor of 15%, so one question on a busy week is still a
                  // mark on the page rather than a sliver.
                  height:
                    day.answered === 0
                      ? "0%"
                      : `${String(Math.max(15, Math.round((day.answered / busiest) * 100)))}%`,
                }}
              />
            </span>

            <span
              aria-hidden="true"
              className={[
                "text-xs font-medium",
                day.isToday ? "text-brand-700" : "text-text-faint",
              ].join(" ")}
            >
              {day.initial}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="text-text text-2xl font-semibold tracking-[-0.02em] tabular-nums sm:text-3xl">
        {value}
      </dd>
      <dt className="text-text-soft mt-0.5 text-sm">{label}</dt>
    </div>
  );
}

/**
 * A subject, with what is actually in it.
 *
 * The question count is the honest part. Samjho's bank is being written from
 * zero (docs/07 R1), so a subject with 40 questions in 14 chapters should say
 * so — a card that only shows a name lets a student tap into an empty chapter
 * and conclude the app is broken.
 */
function SubjectCard({ subject }: { subject: EnrolledSubject }) {
  const { summary, detail } = subject;

  return (
    <div className="rounded-panel border-line bg-card hover:border-brand-300 flex h-full flex-col gap-4 border p-5 transition-colors">
      <div>
        {/* The variant is only appended when the name has not already said it.
            The seed stores Mathematics as "Mathematics (Standard)" *and* sets
            `variant: "STANDARD"`, and printing both gives "Mathematics
            (Standard) (STANDARD)". */}
        <h3 className="text-text text-lg font-semibold tracking-[-0.015em]">
          {summary.name}
          {summary.variant !== null &&
          !summary.name.toLowerCase().includes(summary.variant.toLowerCase()) ? (
            <span className="text-text-faint font-normal"> ({summary.variant})</span>
          ) : null}
        </h3>
        <p className="text-text-soft mt-1 text-sm">
          {/* Never "out of 100": 80 for Class 10, 70 for Class 12 Physics. */}
          {summary.theoryMarks}-mark theory paper
          {detail ? ` · ${String(detail.chapters.length)} chapters` : ""}
        </p>
      </div>

      <div className="mt-auto flex items-end justify-between gap-4">
        <Link
          href={`/subjects/${summary.slug}`}
          className="text-brand-700 text-sm font-semibold hover:underline"
        >
          Browse chapters
        </Link>

        {detail ? (
          <span className="marks-margin text-text-soft text-sm">
            {detail.counts.total} questions
          </span>
        ) : null}
      </div>
    </div>
  );
}

interface EnrolledSubject {
  summary: SubjectSummary;
  /** Null when the subject failed to load — the card degrades, the page does not. */
  detail: SubjectDetail | null;
}

/**
 * Load each enrolled subject in full, tolerating failures.
 *
 * The same rule `/practice/new` follows: a subject that 404s because it was
 * deactivated between onboarding and now loses its counts, not the whole
 * dashboard. A student's home page failing because one subject was retired is
 * the kind of outage that reads as "the app is broken".
 */
async function loadEnrolledSubjects(summaries: SubjectSummary[]): Promise<EnrolledSubject[]> {
  return Promise.all(
    summaries.map(async (summary) => {
      try {
        return { summary, detail: await loadSubject(summary.slug) };
      } catch {
        return { summary, detail: null };
      }
    }),
  );
}
