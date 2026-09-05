import {
  PRACTICE_MODE_LABELS,
  type PracticeSessionSummary,
  type ProgressOverview,
  type SubjectDetail,
  type SubjectProgressSummary,
  type SubjectSummary,
} from "@samjho/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ChevronRight, FlameIcon, PaperIcon, RedoIcon } from "@/components/icons";
import { StartPractice } from "@/features/practice/start-practice";
import { WeeklyTrend } from "@/features/dashboard/weekly-trend";
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
import { describeScore, formatDuration, formatMarksValue, practiceHref } from "@/lib/practice-format";
import { loadProgressOverview } from "@/lib/progress";

export const metadata: Metadata = { title: "Dashboard" };
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
 * ## Every weekly number here is checkable
 *
 * The Progress page reads the API's persisted rollups. This dashboard's weekly
 * figures instead come from the last fifty session summaries in
 * `lib/dashboard.ts`, because "62 answered, 48 right" is a fact a student can
 * check against their own history and it answers a different question from a
 * recency-weighted subject score.
 *
 * The page claims nothing it cannot show the working for, and says so where a
 * figure is missing rather than printing a zero.
 */
export default async function HomePage() {
  const me = await requireOnboarded();
  if (me.user.role === "TEACHER") redirect("/teacher");
  const profile = me.profile;

  const [inProgress, history, classrooms, overview] = await Promise.all([
    loadSessions({ status: "IN_PROGRESS", limit: 1 }),
    loadSessions({ limit: 50 }),
    // The same rule the subject cards below follow, for the same reason. The
    // teacher strip is one optional band on this page; practice history is the
    // page. A classroom endpoint that is failing — an unapplied migration is the
    // way this actually happens — should cost a student that band, not their
    // whole dashboard. `/classroom` is where a real failure gets reported,
    // because there it is the subject of the page rather than a garnish.
    loadStudentClassrooms().catch(() => []),
    // Progress is a helpful recommendation signal here, never a reason the
    // student's central workspace should fail to render.
    loadProgressOverview().catch(() => null),
  ]);

  const resume = inProgress.items[0];
  const week = weekTotals(history.items);
  const streak = streakDays(history.items);
  const days = activityStrip(history.items);
  const countdown = examCountdown(profile?.targetExam ?? null);
  const subjects = await loadEnrolledSubjects(profile?.subjects ?? []);
  const progressBySubjectId = new Map(
    overview?.subjects.map((subject) => [subject.subject.id, subject]) ?? [],
  );
  // The unfinished set already owns the hero. Repeating it in the activity log
  // makes the dashboard feel noisier without adding a decision.
  const recent = history.items.filter((session) => session.status !== "IN_PROGRESS").slice(0, 3);
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

  const today = days.at(-1);

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-4 py-6 sm:gap-7 sm:px-8 sm:py-8 xl:px-10 xl:py-10 2xl:px-14">
      <header className="flex flex-wrap items-end justify-between gap-5 pb-1">
        <div className="min-w-0">
          <p className="text-brand-700 mb-2 text-xs font-bold tracking-[0.16em] uppercase">
            {today?.label ?? "Your revision desk"}
          </p>
          <h1 className="text-text text-[2rem] leading-[1.04] font-semibold tracking-[-0.045em] sm:text-[2.85rem]">
            {firstName === undefined ? "Welcome back" : `${greeting()}, ${firstName}`}
          </h1>
          {profile ? (
            <p className="text-text-soft mt-3 text-sm sm:text-[0.9375rem]">
              Class {profile.classLevel} {profile.board}
              {countdown ? ` · ${countdown.when} board exams` : ""}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
          {week.accuracy !== null ? (
            <Link
              href="/progress"
              className="border-line-strong bg-card hover:border-brand-300 hover:bg-brand-50/60 inline-flex min-h-10 items-center gap-2 rounded-pill border px-3.5 text-sm font-semibold transition-colors"
            >
              <span className="text-text tabular-nums">{String(week.accuracy)}%</span>
              <span className="text-text-soft">this week</span>
              <ChevronRight className="text-brand-700 size-4" />
            </Link>
          ) : null}
          {/* Shown only once it exists. A streak counter reading "0 days" on the
              day someone comes back is a scolding, not a nudge. */}
          {streak > 0 ? (
            <p className="bg-brand-50 text-brand-700 rounded-pill inline-flex min-h-10 items-center gap-2 px-3.5 text-sm font-semibold">
              <FlameIcon className="size-4" />
              {streak === 1 ? "1 day streak" : `${String(streak)} day streak`}
            </p>
          ) : null}
        </div>
      </header>

      <section aria-label="Your next study step" className="grid min-w-0 gap-4 2xl:grid-cols-12 2xl:gap-5">
        <div className="min-w-0 2xl:col-span-8">
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

        <aside className="grid min-w-0 gap-4 sm:grid-cols-2 2xl:col-span-4 2xl:grid-cols-1">
          <CountdownCard countdown={countdown} />
          <TodayCard today={today} week={week} />
        </aside>
      </section>

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

      <section className="grid min-w-0 items-start gap-6 2xl:grid-cols-12 2xl:gap-5">
        <div className="flex min-w-0 flex-col gap-6 2xl:col-span-8">
          <ThisWeek week={week} days={days} hasHistory={history.items.length > 0} />
          <section aria-labelledby="subjects-heading" className="flex min-w-0 flex-col gap-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-brand-700 text-xs font-bold tracking-[0.16em] uppercase">
                  Your study plan
                </p>
                <h2
                  id="subjects-heading"
                  className="text-text mt-1 text-[1.35rem] font-semibold tracking-[-0.028em]"
                >
                  Your subjects
                </h2>
              </div>
              <Link
                href="/profile"
                className="text-brand-700 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
              >
                Manage <ChevronRight className="size-4" />
              </Link>
            </div>

            {subjects.length === 0 ? (
              <p className="border-line bg-card rounded-panel text-text-soft border p-6 text-sm">
                No subjects selected yet.{" "}
                <Link href="/profile" className="text-brand-700 font-semibold underline">
                  Choose your subjects
                </Link>{" "}
                and your chapters will appear here.
              </p>
            ) : (
              <ul className="grid min-w-0 gap-4 md:grid-cols-2">
                {subjects.map((subject, index) => (
                  <li key={subject.summary.id} className="min-w-0">
                    <SubjectCard
                      subject={subject}
                      index={index}
                      progress={progressBySubjectId.get(subject.summary.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-5 2xl:col-span-4">
          <QuickActions overview={overview} />
          <RecentPractice recent={recent} />
        </aside>
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
  const remaining = Math.max(total - answered, 0);

  return (
    <section
      aria-labelledby="resume-heading"
      className="relative h-full min-h-[16.5rem] overflow-hidden rounded-panel bg-sand-900 px-6 py-7 text-sand-50 sm:px-8 sm:py-8"
    >
      <div
        aria-hidden="true"
        className="border-brand-500/35 absolute -top-24 -right-24 size-80 rounded-full border-[1.9rem]"
      />
      <div
        aria-hidden="true"
        className="border-brand-500/20 absolute right-10 bottom-[-9rem] size-64 rounded-full border"
      />
      <div className="relative grid h-full gap-7 lg:grid-cols-[minmax(0,1fr)_12.5rem] lg:items-end">
        <div className="flex min-w-0 flex-col">
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-brand-300 uppercase">
            <span className="bg-brand-500 inline-block size-2 rounded-full" /> Continue your revision
          </p>
          <p className="mt-4 text-sm font-medium text-sand-300">You are already in the flow.</p>
          <h2
            id="resume-heading"
            className="mt-1 max-w-[19ch] text-[2rem] leading-[1.06] font-semibold tracking-[-0.042em] sm:max-w-[24ch] sm:text-[2.5rem]"
          >
            {focus}
          </h2>
          <p className="mt-3 max-w-[48ch] text-sm leading-relaxed text-sand-300">
            {remaining === 0
              ? "Your answers are ready for a final check."
              : `${String(remaining)} ${remaining === 1 ? "question remains" : "questions remain"} in this set.`}
          </p>

          <div className="mt-6 max-w-xl">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="font-medium text-sand-200">
                {answered} of {total} answered
              </span>
              <span className="font-semibold tabular-nums text-brand-300">{percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={answered}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-label="Questions answered in this set"
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/15"
            >
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${String(percent)}%` }}
              />
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href={`/practice/sessions/${id}`}>Resume set</ButtonLink>
            <Link
              href="/practice"
              className="inline-flex min-h-12 items-center justify-center rounded-pill border border-white/20 px-5 text-sm font-semibold text-sand-50 transition-colors hover:border-brand-300 hover:bg-white/8"
            >
              Browse practice
            </Link>
          </div>
        </div>

        <div className="border-brand-300/20 bg-sand-800/95 relative overflow-hidden rounded-control border p-5 lg:self-stretch">
          <p className="text-xs font-bold tracking-[0.14em] text-brand-300 uppercase">Set status</p>
          <p className="mt-6 text-6xl leading-none font-semibold tracking-[-0.07em] tabular-nums">
            {String(total)}
          </p>
          <p className="mt-2 text-sm text-sand-300">questions in this set</p>
          <div className="mt-6 flex items-center gap-2 border-t border-white/12 pt-4 text-sm">
            <span className="font-semibold text-sand-50 tabular-nums">{answered}</span>
            <span className="text-sand-300">complete</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The same slot when there is nothing to resume. */
function StartCard() {
  return (
    <section
      aria-labelledby="start-heading"
      className="relative h-full min-h-[16.5rem] overflow-hidden rounded-panel bg-sand-900 px-6 py-7 text-sand-50 sm:px-8 sm:py-8"
    >
      <div
        aria-hidden="true"
        className="border-brand-500/35 absolute -top-24 -right-24 size-80 rounded-full border-[1.9rem]"
      />
      <div
        aria-hidden="true"
        className="border-brand-500/20 absolute right-10 bottom-[-9rem] size-64 rounded-full border"
      />
      <div className="relative grid h-full gap-7 lg:grid-cols-[minmax(0,1fr)_12.5rem] lg:items-end">
        <div className="flex min-w-0 flex-col">
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-brand-300 uppercase">
            <span className="bg-brand-500 inline-block size-2 rounded-full" /> Today&apos;s practice plan
          </p>
          <p className="mt-4 text-sm font-medium text-sand-300">A short session can shift your week.</p>
          <h2
            id="start-heading"
            className="mt-1 max-w-[19ch] text-[2rem] leading-[1.06] font-semibold tracking-[-0.042em] sm:max-w-[24ch] sm:text-[2.5rem]"
          >
            Your 10-minute practice plan
          </h2>
          <p className="mt-3 max-w-[48ch] text-sm leading-relaxed text-sand-300">
            Ten fresh questions, instant marking, and every mistake saved for the next revision.
          </p>

          <div className="mt-7 flex flex-wrap items-start gap-3">
            {/* The preset, not the builder. Most students do not want to build
                anything — they want to start, and docs/00 §5 counts the taps. */}
            <StartPractice mode="QUICK" filters={{ unseenOnly: true }} count={10} label="Start now" />
            <Link
              href="/practice/new"
              className="inline-flex min-h-12 items-center justify-center rounded-pill border border-white/20 px-5 text-sm font-semibold text-sand-50 transition-colors hover:border-brand-300 hover:bg-white/8"
            >
              Build a focused set
            </Link>
          </div>
        </div>

        <div className="border-brand-300/20 bg-sand-800/95 relative overflow-hidden rounded-control border p-5 lg:self-stretch">
          <p className="text-xs font-bold tracking-[0.14em] text-brand-300 uppercase">Today&apos;s set</p>
          <p className="mt-6 text-6xl leading-none font-semibold tracking-[-0.07em] tabular-nums">10</p>
          <p className="mt-2 text-sm text-sand-300">fresh questions</p>
          <div className="mt-6 border-t border-white/12 pt-4 text-sm text-sand-300">About 10 minutes</div>
        </div>
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
    <section
      aria-labelledby="teacher-brief-heading"
      className="border-brand-200 bg-brand-50/70 rounded-control flex flex-col gap-4 border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="bg-brand-500 mt-1.5 size-2 shrink-0 rounded-full" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-brand-700 text-xs font-bold tracking-[0.12em] uppercase">
            From {classroomName}
          </p>
          <h2
            id="teacher-brief-heading"
            className="text-text mt-1 truncate text-base font-semibold tracking-[-0.016em] sm:text-lg"
          >
            {title}
          </h2>
          <p className="text-text-soft mt-1 text-sm">
            {subjectName} · {questionCount} questions
            {dueAt ? ` · due ${formatAssignmentDue(dueAt)}` : ""}
            {progress === "IN_PROGRESS" ? " · in progress" : ""}
          </p>
        </div>
      </div>
      <ButtonLink
        href="/classroom"
        variant={progress === "IN_PROGRESS" ? "secondary" : "primary"}
        className="shrink-0"
      >
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
      <section className="rounded-control border-line bg-card flex min-h-[10.5rem] flex-col justify-between border p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-text-soft text-sm font-medium">Board exam target</p>
            <h2 className="text-text mt-2 text-xl font-semibold tracking-[-0.028em]">
              Set your target
            </h2>
          </div>
          <span className="bg-brand-50 text-brand-700 grid size-9 place-items-center rounded-full text-sm font-semibold">
            +
          </span>
        </div>
        <Link href="/profile" className="text-brand-700 mt-4 inline-flex items-center gap-1 text-sm font-semibold hover:underline">
          Add exam details <ChevronRight className="size-4" />
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="countdown-heading"
      className="rounded-control border-line bg-card flex min-h-[10.5rem] flex-col justify-between border p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-text-soft text-sm font-medium">Board exam target</p>
          <h2 id="countdown-heading" className="text-text mt-2 text-xl font-semibold tracking-[-0.028em]">
            {countdown.when}
          </h2>
        </div>
        <Link
          href="/profile"
          className="text-brand-700 rounded-pill bg-brand-50 px-3 py-1.5 text-xs font-semibold hover:bg-brand-100"
        >
          Edit
        </Link>
      </div>

      {countdown.daysRemaining === null ? (
        <p className="text-text-faint mt-4 text-sm leading-relaxed">
          The final date will appear here when CBSE publishes the date sheet.
        </p>
      ) : (
        <div className="mt-4 flex items-baseline gap-2">
          <p className="text-text text-4xl font-semibold tracking-[-0.05em] tabular-nums">
            {countdown.daysRemaining}
          </p>
          <p className="text-text-soft text-sm font-medium">
            {countdown.daysRemaining === 1 ? "day to go" : "days to go"}
          </p>
        </div>
      )}
    </section>
  );
}

/** A compact, factual nudge for the part of the day that is still actionable. */
function TodayCard({
  today,
  week,
}: {
  today: ActivityDay | undefined;
  week: ReturnType<typeof weekTotals>;
}) {
  const answeredToday = today?.answered ?? 0;

  return (
    <section className="border-brand-200 bg-brand-50 rounded-control flex min-h-[10.5rem] flex-col justify-between border p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-brand-700 text-sm font-semibold">Today&apos;s momentum</p>
          <p className="text-text mt-3 text-4xl leading-none font-semibold tracking-[-0.05em] tabular-nums">
            {String(answeredToday)}
          </p>
          <p className="text-text-soft mt-1 text-sm">questions answered</p>
        </div>
        <span className="border-brand-300 text-brand-700 inline-flex min-h-9 shrink-0 items-center rounded-pill border bg-card px-2.5 text-xs font-bold tabular-nums">
          {week.sessions === 1 ? "1 set" : `${String(week.sessions)} sets`}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-brand-200 pt-3">
        <p className="text-text-soft text-xs font-medium">
          {week.sessions === 0
            ? "Start a 10-question sprint."
            : `${String(week.sessions)} ${week.sessions === 1 ? "set" : "sets"} this week`}
        </p>
        <Link
          href="/practice"
          className="text-brand-700 inline-flex shrink-0 items-center gap-1 text-sm font-semibold hover:underline"
        >
          Practice <ChevronRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

/**
 * A contextual revision queue, rather than a second copy of the practice hub.
 * The hero owns the one obvious "start" action; these are the useful follow-up
 * routes that earn their space only when there is evidence behind them.
 */
function QuickActions({ overview }: { overview: ProgressOverview | null }) {
  const weakTopic = overview?.weakTopics.find((topic) => topic.attempted >= 2);

  return (
    <section
      aria-labelledby="revision-queue-heading"
      className="rounded-panel border-line bg-card min-w-0 overflow-hidden border p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-brand-700 text-xs font-bold tracking-[0.16em] uppercase">Revision queue</p>
          <h2
            id="revision-queue-heading"
            className="text-text mt-1 text-[1.35rem] font-semibold tracking-[-0.028em]"
          >
            What to revisit next
          </h2>
        </div>
        <Link href="/progress" className="text-brand-700 shrink-0 text-sm font-semibold hover:underline">
          Progress
        </Link>
      </div>

      <ul className="mt-5 flex min-w-0 flex-col gap-2.5">
        {overview !== null && overview.openMistakes > 0 ? (
          <li className="w-full min-w-0">
            <QueueItem
              href="/practice"
              icon={<RedoIcon className="size-5" />}
              title={`Repair ${String(overview.openMistakes)} ${overview.openMistakes === 1 ? "mistake" : "mistakes"}`}
              detail="Turn a previous answer into a confident one."
              action="Review"
              tone="brand"
            />
          </li>
        ) : null}

        {weakTopic ? (
          <li className="w-full min-w-0">
            <QueueItem
              href={practiceHref({
                subjectId: weakTopic.subject.id,
                chapterId: weakTopic.chapterId,
                topicId: weakTopic.id,
                unseenOnly: false,
              })}
              icon={<RedoIcon className="size-5" />}
              title={weakTopic.name}
              detail={`${weakTopic.chapterName} · revisit while it is still fresh`}
              action="Practice"
            />
          </li>
        ) : null}

        <li className="w-full min-w-0">
          <QueueItem
            href="/practice/new"
            icon={<PaperIcon className="size-5" />}
            title="Build a focused set"
            detail="Choose a chapter, topic, or past paper."
            action="Create"
          />
        </li>

        {overview !== null && overview.savedQuestions > 0 ? (
          <li className="w-full min-w-0">
            <QueueItem
              href="/practice"
              icon={<PaperIcon className="size-5" />}
              title={`${String(overview.savedQuestions)} saved ${overview.savedQuestions === 1 ? "question" : "questions"}`}
              detail="Return to the questions you marked for later."
              action="Open"
            />
          </li>
        ) : null}
      </ul>

      {overview === null || (overview.openMistakes === 0 && weakTopic === undefined) ? (
        <p className="text-text-faint mt-4 text-xs leading-relaxed">
          Finish a few graded questions and this queue will become more personal.
        </p>
      ) : null}
    </section>
  );
}

function QueueItem({
  href,
  icon,
  title,
  detail,
  action,
  tone = "neutral",
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
  action: string;
  tone?: "brand" | "neutral";
}) {
  return (
    <Link
      href={href}
      className="rounded-control border-line hover:border-brand-300 hover:bg-brand-50/50 group grid w-full min-w-0 max-w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden border p-3 transition-colors"
    >
      <span
        className={[
          "grid size-10 shrink-0 place-items-center rounded-xl",
          tone === "brand" ? "bg-brand-50 text-brand-700" : "bg-raised text-text-soft",
        ].join(" ")}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-text block truncate text-sm font-semibold">{title}</span>
        <span className="text-text-soft mt-0.5 block truncate text-xs">{detail}</span>
      </span>
      <span className="text-brand-700 inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-xs font-bold">
        {action}
        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/**
 * The week, in three figures and seven days.
 *
 * The chart compares questions attempted with questions answered correctly.
 * They share a unit, which makes a two-line chart meaningful; plotting marks
 * or accuracy on the same axis would make the visual look more informative
 * than it is. The figures above retain the precise percentage and marks view.
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
  return (
    <section
      aria-labelledby="week-heading"
      className="rounded-panel border-line bg-card w-full overflow-hidden border"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
        <div>
          <p className="text-brand-700 text-xs font-bold tracking-[0.16em] uppercase">Weekly performance</p>
          <h2
            id="week-heading"
            className="text-text mt-1 text-[1.35rem] font-semibold tracking-[-0.028em]"
          >
            This week
          </h2>
          <p className="text-text-soft mt-1 text-sm">
            {week.sessions === 0
              ? "A clear view of your study rhythm will begin with your first set."
              : `${String(week.sessions)} ${week.sessions === 1 ? "practice set" : "practice sets"} in the last seven days`}
          </p>
        </div>
        <Link
          href="/progress"
          className="text-brand-700 inline-flex min-h-10 items-center gap-1 text-sm font-semibold hover:underline"
        >
          Full progress <ChevronRight className="size-4" />
        </Link>
      </div>

      {week.answered === 0 ? (
        <div className="mt-5 border-t border-line bg-raised/55 px-5 py-5 sm:px-6">
          <p className="text-text max-w-[48ch] text-sm leading-relaxed">
            {hasHistory
              ? "Nothing has been answered this week yet. A short set is enough to restart your rhythm."
              : "Your questions, accuracy, and marks will appear here as soon as you finish your first set."}
          </p>
          <Link
            href="/practice"
            className="text-brand-700 mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
          >
            Open practice <ChevronRight className="size-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-5 border-t border-line px-5 py-5 sm:px-6 sm:py-6">
          <dl className="grid grid-cols-3 divide-x divide-line">
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

          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-text text-sm font-semibold">Daily question flow</p>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="text-text-soft inline-flex items-center gap-1.5">
                <span className="bg-brand-500 block h-0.5 w-5 rounded-full" /> Attempted
              </span>
              <span className="text-text-soft inline-flex items-center gap-1.5">
                <span className="border-tick-600 block w-5 border-t-2 border-dashed" /> Correct
              </span>
            </div>
          </div>

          <div className="mt-3">
            <WeeklyTrend days={days} />
          </div>
        </div>
      )}
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0 sm:px-5">
      <dd className="text-text truncate text-xl font-semibold tracking-[-0.035em] tabular-nums sm:text-3xl">
        {value}
      </dd>
      <dt className="text-text-soft mt-1 text-xs font-medium sm:text-sm">{label}</dt>
    </div>
  );
}

function RecentPractice({ recent }: { recent: PracticeSessionSummary[] }) {
  return (
    <section
      aria-labelledby="recent-heading"
      className="rounded-panel border-line bg-card min-w-0 border p-5 sm:p-6"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-brand-700 text-xs font-bold tracking-[0.16em] uppercase">Recent activity</p>
          <h2
            id="recent-heading"
            className="text-text mt-1 text-[1.35rem] font-semibold tracking-[-0.028em]"
          >
            Your latest work
          </h2>
        </div>
        <Link href="/practice" className="text-brand-700 inline-flex items-center gap-1 text-sm font-semibold hover:underline">
          All <ChevronRight className="size-4" />
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="border-line bg-raised/55 mt-5 rounded-control border p-4">
          <p className="text-text text-sm font-semibold">Your first result will live here.</p>
          <p className="text-text-soft mt-1 text-sm leading-relaxed">
            Complete a set to start building a useful revision history.
          </p>
          <Link href="/practice" className="text-brand-700 mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline">
            Open practice <ChevronRight className="size-4" />
          </Link>
        </div>
      ) : (
        <ul className="mt-5 min-w-0 divide-y divide-line">
          {recent.map((session) => {
            const allCorrect =
              session.totals.answered > 0 && session.totals.correct === session.totals.answered;
            const noneCorrect = session.totals.answered > 0 && session.totals.correct === 0;
            const symbol = allCorrect ? "✓" : noneCorrect ? "×" : "•";
            const tone = allCorrect
              ? "border-tick-200 bg-tick-50 text-tick-700"
              : noneCorrect
              ? "border-marker-200 bg-marker-50 text-marker-700"
              : "border-brand-200 bg-brand-50 text-brand-700";

            return (
              <li key={session.id} className="min-w-0">
                <Link
                  href={`/practice/sessions/${session.id}/result`}
                  className="group flex min-w-0 items-center gap-3 overflow-hidden py-3 first:pt-0 last:pb-0"
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-9 shrink-0 place-items-center rounded-full border text-xs font-bold ${tone}`}
                  >
                    {symbol}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-text block truncate text-sm font-semibold">
                      {session.focus ?? PRACTICE_MODE_LABELS[session.mode]}
                    </span>
                    <span className="text-text-soft mt-0.5 block truncate text-xs">
                      {describeScore(session.totals)}
                    </span>
                  </span>
                  <span className="text-text-faint shrink-0 text-right text-xs font-medium">
                    <span className="block">{formatPracticeDate(session.startedAt)}</span>
                    <span className="mt-0.5 block">{formatDuration(session.totals.timeSpentMs)}</span>
                  </span>
                  <ChevronRight className="text-brand-700 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatPracticeDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
    new Date(value),
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
function SubjectCard({
  subject,
  index,
  progress,
}: {
  subject: EnrolledSubject;
  index: number;
  progress: SubjectProgressSummary | undefined;
}) {
  const { summary, detail } = subject;
  const accuracy =
    progress === undefined || progress.attempted === 0
      ? null
      : Math.round((progress.correct / progress.attempted) * 100);
  const mastery = progress === undefined ? null : Math.round(progress.masteryScore * 100);
  const hasPractice = (progress?.attempted ?? 0) > 0;
  const actionHref = hasPractice
    ? practiceHref({ subjectId: summary.id, unseenOnly: false })
    : `/subjects/${summary.slug}`;

  return (
    <article className="rounded-panel border-line bg-card hover:border-brand-300 hover:shadow-lift group relative flex min-h-[12.5rem] flex-col overflow-hidden border p-5 transition-all sm:p-6">
      <div aria-hidden="true" className="bg-brand-500 absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-text-faint text-xs font-bold tracking-[0.14em] uppercase">
            Subject {String(index + 1).padStart(2, "0")}
          </p>
        {/* The variant is only appended when the name has not already said it.
            The seed stores Mathematics as "Mathematics (Standard)" *and* sets
            `variant: "STANDARD"`, and printing both gives "Mathematics
            (Standard) (STANDARD)". */}
          <h3 className="text-text mt-1 truncate text-lg font-semibold tracking-[-0.024em]">
            {summary.name}
            {summary.variant !== null &&
            !summary.name.toLowerCase().includes(summary.variant.toLowerCase()) ? (
              <span className="text-text-faint font-normal"> ({summary.variant})</span>
            ) : null}
          </h3>
          <p className="text-text-soft mt-1.5 text-sm">
            {/* Never "out of 100": 80 for Class 10, 70 for Class 12 Physics. */}
            {summary.theoryMarks}-mark theory paper
            {detail ? ` · ${String(detail.chapters.length)} chapters` : ""}
          </p>
        </div>
        {mastery !== null && progress?.attempted !== 0 ? (
          <span className="border-brand-200 bg-brand-50 text-brand-700 shrink-0 rounded-pill border px-2.5 py-1 text-xs font-bold tabular-nums">
            {String(mastery)}% mastery
          </span>
        ) : null}
      </div>

      <div className="mt-5">
        {hasPractice && progress !== undefined ? (
          <>
            <div className="flex items-center justify-between gap-3 text-xs font-semibold">
              <span className="text-text-soft">Recent mastery</span>
              <span className="text-text tabular-nums">
                {accuracy === null ? "—" : `${String(accuracy)}% accurate`}
              </span>
            </div>
            <div
              className="bg-raised mt-2 h-1.5 overflow-hidden rounded-full"
              role="progressbar"
              aria-label={`Recent mastery in ${summary.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={mastery ?? 0}
            >
              <div className="bg-brand-500 h-full rounded-full" style={{ width: `${String(mastery ?? 0)}%` }} />
            </div>
          </>
        ) : (
          <p className="text-text-soft text-sm">Ready for your first focused set.</p>
        )}
      </div>

      <div className="mt-auto flex items-end justify-between gap-4 pt-5">
        <Link
          href={actionHref}
          className="text-brand-700 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
        >
          {hasPractice ? "Continue practice" : "Explore chapters"} <ChevronRight className="size-4" />
        </Link>

        {detail ? (
          <span className="marks-margin text-text-soft text-sm">
            {detail.counts.total} questions
          </span>
        ) : null}
      </div>
    </article>
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
