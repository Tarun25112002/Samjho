import type { WeeklyFocus, WeeklyPlanDay } from "@samjho/contracts";
import type { Metadata } from "next";

import { PaperIcon, PenIcon, RedoIcon, SparkIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page";
import { Card, Chip } from "@/components/ui/surface";
import { requireOnboarded } from "@/lib/me";
import { loadWeeklyStudyPlan } from "@/lib/study-plan";

export const metadata: Metadata = { title: "Your week" };
export const dynamic = "force-dynamic";

/**
 * The week ahead.
 *
 * ## Why a whole page for seven lines
 *
 * Because the shape is the information. A student who can see that Thursday is
 * a mock and Sunday is off can plan around it; the same seven items delivered
 * one morning at a time are seven tasks with no shape at all. It is read once,
 * on a Sunday, and then referred back to — which is a different act from
 * opening the app to be told what to do now, and that is what `/home` is for.
 *
 * ## Every slot links somewhere real
 *
 * A plan that says "20 questions on Quadratic Equations" and cannot start them
 * is a to-do list. Each day's work carries the link that begins it, prefilled,
 * so the distance between reading the plan and doing it is one tap.
 *
 * ## What is generated and what is not
 *
 * The days, the topics and the counts are computed from the student's own
 * answers. Only the sentences are written by a model, and the footer says so.
 * A student who mistrusts the prose can still trust the plan.
 */
export default async function WeekPage() {
  await requireOnboarded();
  const plan = await loadWeeklyStudyPlan();

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Your week"
        title="The seven days ahead."
        lede="Built from what your answers show, what your revision queue owes, and how far away your exam is."
        action={<ButtonLink href="/home">Today&rsquo;s next step</ButtonLink>}
      />

      {plan.daysToExam !== null ? (
        <p className="rounded-control border-line bg-raised text-text-soft border px-4 py-3 text-sm">
          {plan.daysToExam > 0 ? (
            <>
              <span className="text-text font-semibold tabular-nums">{plan.daysToExam} days</span>{" "}
              until your exam.
            </>
          ) : (
            "Your exam has started."
          )}
        </p>
      ) : null}

      {plan.opening ? (
        <p className="text-text mt-4 text-base leading-relaxed">{plan.opening}</p>
      ) : null}

      <ol className="mt-6 flex flex-col gap-3">
        {plan.days.map((day) => (
          <DayRow key={day.date} day={day} />
        ))}
      </ol>

      <p className="text-text-faint mt-6 flex items-start gap-2 text-xs leading-relaxed">
        <SparkIcon className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {plan.generated
            ? "The days, the topics and the counts come from your own answers. Only the sentences are written by Samjho."
            : "Written from your own answers. Samjho could not add its notes this time, so the plan is here in plain form."}
        </span>
      </p>
    </PageShell>
  );
}

function DayRow({ day }: { day: WeeklyPlanDay }) {
  const resting = day.focus[0]?.kind === "REST";

  return (
    <li>
      <Card as="article" {...(resting ? { className: "opacity-70" } : {})}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-text text-sm font-semibold">{day.label}</h2>
          {day.minutes > 0 ? (
            <span className="text-text-faint text-xs tabular-nums">about {day.minutes} min</span>
          ) : (
            <Chip tone="partial">Rest</Chip>
          )}
        </div>

        {day.note ? (
          <p className="text-text-soft mt-2 text-sm leading-relaxed">{day.note}</p>
        ) : null}

        {resting ? null : (
          <div className="mt-3 flex flex-wrap gap-2">
            {day.focus.map((slot, index) => (
              <FocusLink key={index} slot={slot} />
            ))}
          </div>
        )}
      </Card>
    </li>
  );
}

/**
 * The one tap between reading a day and starting it.
 *
 * A topic slot goes to `/practice/new` rather than to the practice hub, because
 * that is the page which reads filters off the query (docs/01 §3): the student
 * lands on a form already filled in with the subject, the topic and the count.
 * The hub ignores a query string entirely, so linking there would quietly drop
 * the whole point of the slot.
 */
function FocusLink({ slot }: { slot: WeeklyFocus }) {
  switch (slot.kind) {
    case "REVISION":
      return (
        <ButtonLink variant="secondary" size="sm" href="/revision">
          <RedoIcon className="size-4" />
          {slot.questionCount} to revise
        </ButtonLink>
      );
    case "MOCK":
      return (
        <ButtonLink variant="secondary" size="sm" href="/exams">
          <PaperIcon className="size-4" />
          {slot.subjectName} paper
        </ButtonLink>
      );
    case "TOPIC":
      return (
        <ButtonLink
          variant="secondary"
          size="sm"
          href={`/practice/new?subjectId=${encodeURIComponent(slot.subjectId ?? "")}&topicId=${encodeURIComponent(slot.topicId ?? "")}&count=${String(slot.questionCount)}`}
        >
          <PenIcon className="size-4" />
          {slot.questionCount} on {slot.topicName}
        </ButtonLink>
      );
    case "REST":
      return null;
  }
}
