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
import { Eyebrow, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, Chip, Figure, IconTile, Meter, PanelOrbit } from "@/components/ui/surface";
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
import {
  describeScore,
  formatDuration,
  formatMarksValue,
  practiceHref,
} from "@/lib/practice-format";
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
    <PageShell width="wide">
      {/*
        The one header in the product without a rule under it. What follows is a
        full-bleed dark panel that draws its own top edge, and a hairline a few
        pixels above it reads as a mistake rather than as structure — see the
        note on `PageHeader`, whose default this is the stated exception to.
      */}
      <header className="flex flex-wrap items-end justify-between gap-5 pb-1">
        <div className="min-w-0">
          <Eyebrow className="mb-2">{today?.label ?? "Your revision desk"}</Eyebrow>
          <h1 className="text-text text-display">
            {firstName === undefined ? "Welcome back" : `${greeting()}, ${firstName}`}
          </h1>
          {profile ? (
            <p className="text-text-soft text-ui mt-3">
              Class {profile.classLevel} {profile.board}
              {countdown ? ` · ${countdown.when} board exams` : ""}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
          {week.accuracy !== null ? (
            <Link
              href="/progress"
              className="border-line-strong bg-card hover:border-brand-300 hover:bg-brand-50/60 rounded-pill inline-flex min-h-11 items-center gap-2 border px-3.5 text-sm font-semibold transition-colors"
            >
              <span className="text-text tabular-nums">{String(week.accuracy)}%</span>
              <span className="text-text-soft">this week</span>
              <ChevronRight className="text-brand-700 size-4" />
            </Link>
          ) : null}
          {/* Shown only once it exists. A streak counter reading "0 days" on the
              day someone comes back is a scolding, not a nudge. */}
          {streak > 0 ? (
            <Chip tone="brand" className="min-h-11 px-3.5 text-sm">
              <FlameIcon className="size-4" />
              {streak === 1 ? "1 day streak" : `${String(streak)} day streak`}
            </Chip>
          ) : null}
        </div>
      </header>

      <section
        aria-label="Your next study step"
        className="grid min-w-0 gap-4 2xl:grid-cols-12 2xl:gap-5"
      >
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
            <SectionHeading
              id="subjects-heading"
              eyebrow="Your study plan"
              title="Your subjects"
              action={
                <Link
                  href="/profile"
                  className="text-brand-700 inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline"
                >
                  Manage <ChevronRight className="size-4" />
                </Link>
              }
            />

            {subjects.length === 0 ? (
              <Card pad="roomy">
                <p className="text-text-soft text-sm">
                  No subjects selected yet.{" "}
                  <Link href="/profile" className="text-brand-700 font-semibold underline">
                    Choose your subjects
                  </Link>{" "}
                  and your chapters will appear here.
                </p>
              </Card>
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
    </PageShell>
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
    <DeskHero
      headingId="resume-heading"
      eyebrow="Continue your revision"
      kicker="You are already in the flow."
      title={focus}
      body={
        remaining === 0
          ? "Your answers are ready for a final check."
          : `${String(remaining)} ${remaining === 1 ? "question remains" : "questions remain"} in this set.`
      }
      aside={
        <DeskAside label="Set status" value={String(total)} caption="questions in this set">
          <span className="text-on-desk font-semibold tabular-nums">{answered}</span>
          <span className="text-on-desk-soft">complete</span>
        </DeskAside>
      }
    >
      <div className="mt-6 max-w-xl">
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <span className="text-on-desk-soft font-medium">
            {answered} of {total} answered
          </span>
          <span className="text-brand-300 font-semibold tabular-nums">{percent}%</span>
        </div>
        <Meter
          percent={percent}
          tone="brand"
          className="mt-2 bg-on-desk/15"
          label="Questions answered in this set"
        />
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <ButtonLink href={`/practice/sessions/${id}`}>Resume set</ButtonLink>
        <DeskLink href="/practice">Browse practice</DeskLink>
      </div>
    </DeskHero>
  );
}

/** The same slot when there is nothing to resume. */
function StartCard() {
  return (
    <DeskHero
      headingId="start-heading"
      eyebrow="Today's practice plan"
      kicker="A short session can shift your week."
      title="Your 10-minute practice plan"
      body="Ten fresh questions, instant marking, and every mistake saved for the next revision."
      aside={
        <DeskAside label="Today's set" value="10" caption="fresh questions">
          <span className="text-on-desk-soft">About 10 minutes</span>
        </DeskAside>
      }
    >
      <div className="mt-7 flex flex-wrap items-start gap-3">
        {/* The preset, not the builder. Most students do not want to build
            anything — they want to start, and docs/00 §5 counts the taps. */}
        <StartPractice mode="QUICK" filters={{ unseenOnly: true }} count={10} label="Start now" />
        <DeskLink href="/practice/new">Build a focused set</DeskLink>
      </div>
    </DeskHero>
  );
}

/**
 * The dashboard's dark hero, in the one shape both of its states share.
 *
 * `ResumeCard` and `StartCard` were 60 lines of identical markup each, differing
 * only in their words and their two buttons — which meant the decorative rings,
 * the grid, the eyebrow and the aside panel all existed twice and had already
 * begun to disagree (`tracking-[0.16em]` on one eyebrow, `0.14em` on the aside's).
 * One component, two callers, and the states cannot drift apart again.
 */
function DeskHero({
  headingId,
  eyebrow,
  kicker,
  title,
  body,
  aside,
  children,
}: {
  headingId: string;
  eyebrow: string;
  kicker: string;
  title: string;
  body: string;
  aside: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card
      tone="desk"
      pad="roomy"
      aria-labelledby={headingId}
      className="relative h-full min-h-[16.5rem] overflow-hidden"
    >
      <PanelOrbit tone="desk" />
      <div className="relative grid h-full gap-7 lg:grid-cols-[minmax(0,1fr)_12.5rem] lg:items-end">
        <div className="flex min-w-0 flex-col">
          <Eyebrow tone="desk" className="flex items-center gap-2">
            <span className="bg-brand-500 inline-block size-2 rounded-full" /> {eyebrow}
          </Eyebrow>
          <p className="text-on-desk-soft mt-4 text-sm font-medium">{kicker}</p>
          <h2 id={headingId} className="text-display mt-1 max-w-[19ch] sm:max-w-[24ch]">
            {title}
          </h2>
          <p className="text-on-desk-soft mt-3 max-w-[48ch] text-sm leading-relaxed">{body}</p>
          {children}
        </div>

        {aside}
      </div>
    </Card>
  );
}

/** The figure panel beside the dashboard hero. */
function DeskAside({
  label,
  value,
  caption,
  children,
}: {
  label: string;
  value: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    /*
      `justify-between` rather than the default. The panel is `self-stretch`, so
      it takes the height of the tallest column — on a wide screen that left 155
      of its 274 pixels empty below the footer row, with everything bunched at
      the top. Pinning the footer to the bottom is what makes the stretch mean
      something instead of looking like a card that failed to load.
    */
    <div className="border-brand-300/20 bg-desk-raised/95 rounded-control relative flex flex-col justify-between overflow-hidden border p-5 lg:self-stretch">
      <div>
        <Eyebrow tone="desk">{label}</Eyebrow>
        <p className="text-figure-lg mt-6 tabular-nums">{value}</p>
        <p className="text-on-desk-soft mt-2 text-sm">{caption}</p>
      </div>
      <div className="border-desk-line mt-6 flex items-center gap-2 border-t pt-4 text-sm">
        {children}
      </div>
    </div>
  );
}

/**
 * The secondary action on the dark panel.
 *
 * Not `<Button variant="secondary">`: that one is a white card with a sand
 * border, which on a near-black panel is a bright rectangle competing with the
 * saffron button beside it. Same size and shape as the button it sits next to,
 * outlined in the panel's own hairline.
 */
function DeskLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="border-desk-line text-on-desk hover:border-brand-300 hover:bg-on-desk/8 rounded-pill inline-flex min-h-12 items-center justify-center border px-5 text-sm font-semibold transition-colors"
    >
      {children}
    </Link>
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
          <Eyebrow>From {classroomName}</Eyebrow>
          <h2 id="teacher-brief-heading" className="text-text text-subheading mt-1 truncate">
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
      <MiniCard>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-text-soft text-sm font-medium">Board exam target</p>
            <h2 className="text-text text-heading mt-2">Set your target</h2>
          </div>
          <span className="bg-brand-50 text-brand-700 grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold">
            +
          </span>
        </div>
        <Link
          href="/profile"
          className="text-brand-700 mt-4 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
        >
          Add exam details <ChevronRight className="size-4" />
        </Link>
      </MiniCard>
    );
  }

  return (
    <MiniCard aria-labelledby="countdown-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-text-soft text-sm font-medium">Board exam target</p>
          <h2 id="countdown-heading" className="text-text text-heading mt-2">
            {countdown.when}
          </h2>
        </div>
        <Link
          href="/profile"
          className="text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-pill shrink-0 px-3 py-1.5 text-xs font-semibold transition-colors"
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
          <p className="text-text text-figure tabular-nums">{countdown.daysRemaining}</p>
          <p className="text-text-soft text-sm font-medium">
            {countdown.daysRemaining === 1 ? "day to go" : "days to go"}
          </p>
        </div>
      )}
    </MiniCard>
  );
}

/**
 * The two small cards in the dashboard's right column.
 *
 * `rounded-control` rather than `rounded-panel`, and that is deliberate: they
 * sit *inside* the hero row as a pair, and a panel radius at this size makes
 * two 168px boxes read as two more panels rather than as the hero's companions.
 * The height is fixed so the pair aligns whatever their content.
 */
function MiniCard({
  children,
  tone = "card",
  "aria-labelledby": ariaLabelledBy,
}: {
  children: ReactNode;
  tone?: "card" | "brand";
  "aria-labelledby"?: string;
}) {
  return (
    <section
      aria-labelledby={ariaLabelledBy}
      className={[
        "rounded-control flex min-h-[10.5rem] flex-col justify-between border p-5",
        tone === "brand" ? "border-brand-200 bg-brand-50" : "border-line bg-card",
      ].join(" ")}
    >
      {children}
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
    <MiniCard tone="brand">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-brand-700 text-sm font-semibold">Today&apos;s momentum</p>
          <p className="text-text text-figure mt-3 tabular-nums">{String(answeredToday)}</p>
          <p className="text-text-soft mt-1 text-sm">questions answered</p>
        </div>
        <span className="border-brand-300 text-brand-700 bg-card rounded-pill inline-flex min-h-9 shrink-0 items-center border px-2.5 text-xs font-bold tabular-nums">
          {week.sessions === 1 ? "1 set" : `${String(week.sessions)} sets`}
        </span>
      </div>

      <div className="border-brand-200 mt-4 flex items-center justify-between gap-3 border-t pt-3">
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
    </MiniCard>
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
    <Card aria-labelledby="revision-queue-heading" className="min-w-0 overflow-hidden">
      <SectionHeading
        id="revision-queue-heading"
        eyebrow="Revision queue"
        title="What to revisit next"
        action={
          <Link
            href="/progress"
            className="text-brand-700 inline-flex min-h-11 items-center text-sm font-semibold hover:underline"
          >
            Progress
          </Link>
        }
      />

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
    </Card>
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
      className="rounded-control border-line hover:border-brand-300 hover:bg-brand-50/50 group grid w-full max-w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden border p-3 transition-colors"
    >
      <IconTile tone={tone === "brand" ? "brand" : "neutral"}>{icon}</IconTile>
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
    <Card aria-labelledby="week-heading" pad="flush" className="w-full overflow-hidden">
      <div className="px-5 pt-5 sm:px-6 sm:pt-6">
        <SectionHeading
          id="week-heading"
          eyebrow="Weekly performance"
          title="This week"
          lede={
            week.sessions === 0
              ? "A clear view of your study rhythm will begin with your first set."
              : `${String(week.sessions)} ${week.sessions === 1 ? "practice set" : "practice sets"} in the last seven days`
          }
          action={
            <Link
              href="/progress"
              className="text-brand-700 inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline"
            >
              Full progress <ChevronRight className="size-4" />
            </Link>
          }
        />
      </div>

      {week.answered === 0 ? (
        <div className="border-line bg-raised/55 mt-5 border-t px-5 py-5 sm:px-6">
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
        <div className="border-line mt-5 border-t px-5 py-5 sm:px-6 sm:py-6">
          <dl className="divide-line grid grid-cols-3 divide-x">
            <Figure
              label="Questions"
              value={String(week.answered)}
              className="px-3 first:pl-0 last:pr-0 sm:px-5"
            />
            {/* Null, not zero — see `weekTotals`. */}
            <Figure
              label="Accuracy"
              value={week.accuracy === null ? "—" : `${String(week.accuracy)}%`}
              className="px-3 first:pl-0 last:pr-0 sm:px-5"
            />
            <Figure
              label="Marks"
              value={`${formatMarksValue(week.marksEarned)}/${formatMarksValue(week.marksPossible)}`}
              className="px-3 first:pl-0 last:pr-0 sm:px-5"
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
    </Card>
  );
}

function RecentPractice({ recent }: { recent: PracticeSessionSummary[] }) {
  return (
    <Card aria-labelledby="recent-heading" className="min-w-0">
      <SectionHeading
        id="recent-heading"
        eyebrow="Recent activity"
        title="Your latest work"
        action={
          <Link
            href="/practice"
            className="text-brand-700 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
          >
            All <ChevronRight className="size-4" />
          </Link>
        }
      />

      {recent.length === 0 ? (
        <div className="border-line bg-raised/55 rounded-control mt-5 border p-4">
          <p className="text-text text-sm font-semibold">Your first result will live here.</p>
          <p className="text-text-soft mt-1 text-sm leading-relaxed">
            Complete a set to start building a useful revision history.
          </p>
          <Link
            href="/practice"
            className="text-brand-700 mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
          >
            Open practice <ChevronRight className="size-4" />
          </Link>
        </div>
      ) : (
        <ul className="divide-line mt-5 min-w-0 divide-y">
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
                    <span className="mt-0.5 block">
                      {formatDuration(session.totals.timeSpentMs)}
                    </span>
                  </span>
                  <ChevronRight className="text-brand-700 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
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
    <Card
      as="article"
      interactive
      className="group relative flex min-h-[12.5rem] flex-col overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="bg-brand-500 absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
      />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow tone="muted">Subject {String(index + 1).padStart(2, "0")}</Eyebrow>
          {/* The variant is only appended when the name has not already said it.
              The seed stores Mathematics as "Mathematics (Standard)" *and* sets
              `variant: "STANDARD"`, and printing both gives "Mathematics
              (Standard) (STANDARD)". */}
          <h3 className="text-text text-subheading mt-1 truncate">
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
          <Chip tone="brand" className="border-brand-200 shrink-0 border tabular-nums">
            {String(mastery)}% mastery
          </Chip>
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
            <Meter
              percent={mastery ?? 0}
              size="slim"
              className="mt-2"
              label={`Recent mastery in ${summary.name}`}
            />
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
          {hasPractice ? "Continue practice" : "Explore chapters"}{" "}
          <ChevronRight className="size-4" />
        </Link>

        {detail ? (
          <span className="marks-margin text-text-soft text-sm">
            {detail.counts.total} questions
          </span>
        ) : null}
      </div>
    </Card>
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
