import type { SubjectProgressSummary, TopicMovement, WeakTopic } from "@medhavi/contracts";
import type { Metadata } from "next";
import Link from "next/link";

import { BookmarkIcon, ChevronRight, ProgressIcon, RedoIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, flushBandClass, IconTile, Meter } from "@/components/ui/surface";
import { MasteryTrend } from "@/features/progress/mastery-trend";
import { loadTrend } from "@/lib/assessment";
import { requireStudent } from "@/lib/me";
import { loadProgressOverview } from "@/lib/progress";
import { formatMarksValue, practiceHref } from "@/lib/practice-format";

export const metadata: Metadata = { title: "Progress" };
export const dynamic = "force-dynamic";

/**
 * The student progress space.
 *
 * This is intentionally a read model over `SubjectProgress` and
 * `TopicMastery`, not a second calculator in the browser. The numbers change
 * only when a graded answer changes them, and every revision action here leads
 * into the existing set builder with the exact subject, chapter, or topic kept
 * in the URL.
 */
export default async function ProgressPage() {
  await requireStudent();

  const [overview, trend] = await Promise.all([
    loadProgressOverview(),
    // A band on this page rather than the page itself. A trend endpoint that is
    // temporarily unavailable should cost a student one chart, not their whole
    // progress space - the same rule the dashboard applies to its own bands.
    loadTrend().catch(() => null),
  ]);

  // Only topics with something to compare against. A topic first met this week
  // has no fortnight-ago figure, and printing it as a movement from zero would
  // claim an improvement that did not happen.
  const movements = (trend?.topics ?? []).filter((topic) => topic.previous !== null);
  const attempted = overview.subjects.reduce((sum, subject) => sum + subject.attempted, 0);
  const correct = overview.subjects.reduce((sum, subject) => sum + subject.correct, 0);
  const accuracy = attempted === 0 ? null : Math.round((correct / attempted) * 100);

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Learning evidence"
        title="Your progress"
        lede="See the work you have done, spot what needs another look, and turn it into a focused set."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/analysis"
              className="text-brand-700 inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline"
            >
              Your report <ChevronRight className="size-4" />
            </Link>
            <ButtonLink href="/practice/new">Build a focused set</ButtonLink>
          </div>
        }
      />

      <section aria-label="Progress summary" className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Questions graded"
          value={String(attempted)}
          detail="Across your active subjects"
        />
        <SummaryCard
          label="Overall accuracy"
          value={accuracy === null ? "—" : `${String(accuracy)}%`}
          detail={
            accuracy === null
              ? "Complete a set to establish it"
              : `${String(correct)} answered correctly`
          }
        />
        <SummaryCard
          label="Open mistakes"
          value={String(overview.openMistakes)}
          detail={
            overview.openMistakes === 0 ? "Nothing waiting for a retry" : "Ready for revision"
          }
          warning={overview.openMistakes > 0}
        />
      </section>

      {trend !== null && trend.points.length > 1 ? (
        <Card aria-labelledby="trend-heading">
          <SectionHeading
            id="trend-heading"
            eyebrow="Over time"
            title="How your marks have moved"
            lede="Marks earned as a share of marks attempted, on each day you practised."
            action={
              trend.currentStreakDays > 0 ? (
                <span className="text-text-faint text-xs font-medium tabular-nums">
                  {trend.currentStreakDays} day streak
                </span>
              ) : undefined
            }
          />

          <div className="mt-5">
            <MasteryTrend points={trend.points} />
          </div>
        </Card>
      ) : null}

      {movements.length > 0 ? (
        <Card aria-labelledby="movement-heading" pad="flush" className="overflow-hidden">
          <div className={flushBandClass}>
            <SectionHeading
              id="movement-heading"
              eyebrow="Topic by topic"
              title="Current against a fortnight ago"
              lede="The earlier figure is rebuilt from what you answered before then, so it is a comparison rather than a restatement."
            />
          </div>

          <ul className="divide-line divide-y border-t border-line">
            {movements.map((topic) => (
              <TopicMovementRow key={topic.id} topic={topic} />
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.55fr)]">
        <Card aria-labelledby="subjects-heading">
          <SectionHeading
            id="subjects-heading"
            eyebrow="By subject"
            title="Progress that is earned"
            action={
              <span className="text-text-faint text-xs font-medium">
                Recency-weighted performance
              </span>
            }
          />

          {overview.subjects.length === 0 ? (
            <EmptyProgress />
          ) : (
            <ul className="mt-5 grid gap-3">
              {overview.subjects.map((subject) => (
                <li key={subject.subject.id}>
                  <SubjectProgressCard progress={subject} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <aside className="flex flex-col gap-6">
          <Card tone="desk" aria-labelledby="weak-topics-heading" className="overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <SectionHeading
                id="weak-topics-heading"
                tone="desk"
                eyebrow="Next to revise"
                title="Needs another look"
              />
              <IconTile tone="desk">
                <ProgressIcon className="size-5" />
              </IconTile>
            </div>

            {overview.weakTopics.length === 0 ? (
              <p className="text-on-desk-soft mt-5 text-sm leading-relaxed">
                Complete a few graded answers and this space will identify the topics that need your
                attention.
              </p>
            ) : (
              <ul className="divide-desk-line mt-5 divide-y">
                {overview.weakTopics.map((topic) => (
                  <li key={topic.id} className="py-3 first:pt-0 last:pb-0">
                    <WeakTopicCard topic={topic} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card aria-labelledby="revision-heading">
            <SectionHeading
              id="revision-heading"
              eyebrow="Revision queue"
              title="Your saved work"
            />
            <dl className="mt-5 grid grid-cols-2 gap-3">
              <RevisionTile
                icon={<RedoIcon className="text-brand-700 size-5" />}
                value={overview.openMistakes}
                label="Open mistakes"
              />
              <RevisionTile
                icon={<BookmarkIcon className="text-brand-700 size-5" />}
                value={overview.savedQuestions}
                label="Saved questions"
              />
            </dl>
            <Link
              href="/practice"
              className="text-brand-700 mt-5 inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline"
            >
              Open revision tools <ChevronRight className="size-4" />
            </Link>
          </Card>
        </aside>
      </div>
    </PageShell>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  warning = false,
}: {
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <Card>
      <p className="text-text-soft text-sm font-medium">{label}</p>
      <p
        className={["text-figure mt-3 tabular-nums", warning ? "text-brand-700" : "text-text"].join(
          " ",
        )}
      >
        {value}
      </p>
      <p className="text-text-faint mt-1 text-xs">{detail}</p>
    </Card>
  );
}

/**
 * One of the two counters in the revision queue.
 *
 * A `<dl>` rather than two links with a paragraph each: the pair is
 * value-and-label twice over, which is what a definition list is for, and it
 * gets the figure token and its tabular digits for free.
 */
function RevisionTile({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <Link
      href="/practice"
      className="bg-raised hover:bg-brand-50 rounded-control p-4 transition-colors"
    >
      {icon}
      <dd className="text-text text-figure mt-4 tabular-nums">{value}</dd>
      <dt className="text-text-soft mt-1 text-xs font-medium">{label}</dt>
    </Link>
  );
}

function SubjectProgressCard({ progress }: { progress: SubjectProgressSummary }) {
  const percentage = Math.round(progress.masteryScore * 100);
  const accuracy =
    progress.attempted === 0 ? null : Math.round((progress.correct / progress.attempted) * 100);

  return (
    <article className="rounded-control border-line hover:border-brand-300 hover:bg-brand-50/30 border p-4 transition-colors sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-text font-semibold">{progress.subject.name}</h3>
          <p className="text-text-soft mt-1 text-sm">
            {progress.attempted === 0
              ? "No graded answers yet"
              : `${String(progress.attempted)} graded · ${accuracy === null ? "—" : `${String(accuracy)}%`} correct`}
          </p>
        </div>
        <Link
          href={practiceHref({ subjectId: progress.subject.id, unseenOnly: false })}
          className="text-brand-700 inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline"
        >
          Practise <ChevronRight className="size-4" />
        </Link>
      </div>

      <div className="mt-5">
        <div className="text-text-soft flex items-center justify-between text-xs font-medium">
          <span>Recent performance</span>
          <span className="tabular-nums">
            {progress.attempted === 0 ? "Not enough data" : `${String(percentage)}%`}
          </span>
        </div>
        <Meter
          percent={percentage}
          className="mt-2"
          label={`Recent performance in ${progress.subject.name}`}
        />
      </div>

      <dl className="border-line mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
        <SmallStat
          label="Marks"
          value={`${formatMarksValue(progress.marksEarned)}/${formatMarksValue(progress.marksPossible)}`}
        />
        <SmallStat label="Sets finished" value={String(progress.practiceSessions)} />
        <SmallStat label="To revisit" value={String(progress.unrepairedMistakes)} />
      </dl>
    </article>
  );
}

/**
 * The inline stat under a subject.
 *
 * Deliberately not `<Figure>`: that one is a card's headline number, and three
 * of them at 30px inside an already-nested card would out-shout the subject
 * name they belong to. Same structure, body-copy size.
 */
function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dd className="text-text truncate font-semibold tabular-nums">{value}</dd>
      <dt className="text-text-faint mt-0.5 text-xs">{label}</dt>
    </div>
  );
}

function WeakTopicCard({ topic }: { topic: WeakTopic }) {
  const percentage = Math.round(topic.masteryScore * 100);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{topic.name}</p>
          <p className="text-on-desk-faint mt-0.5 truncate text-xs">
            {topic.subject.name} · {topic.chapterName}
          </p>
        </div>
        <span className="text-brand-300 shrink-0 text-sm font-semibold tabular-nums">
          {percentage}%
        </span>
      </div>
      <Meter percent={percentage} tone="desk" size="slim" className="mt-2" />
      <Link
        href={practiceHref({ topicId: topic.id, unseenOnly: false })}
        className="text-brand-300 hover:text-brand-200 mt-2 inline-flex items-center gap-1 text-xs font-semibold"
      >
        Practise this topic <ChevronRight className="size-3.5" />
      </Link>
    </div>
  );
}

function EmptyProgress() {
  return (
    <div className="bg-raised rounded-control mt-5 p-5">
      <p className="text-text font-semibold">Choose your subjects first</p>
      <p className="text-text-soft mt-1 text-sm">
        Once you add a subject, Medhavi can show the evidence from your practice.
      </p>
      <Link
        href="/profile"
        className="text-brand-700 mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline"
      >
        Manage subjects <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

/**
 * One topic's current mastery against where it was a fortnight ago.
 *
 * The arrow and the two figures rather than a percentage-point delta, because
 * "61% → 73%" is a sentence a student can check against their own memory and
 * "+12pp" is a statistic. The colour is carried by a word as well, since a
 * green number and a red number are the same number in greyscale.
 */
function TopicMovementRow({ topic }: { topic: TopicMovement }) {
  const previous = topic.previous ?? 0;
  const delta = topic.current - previous;
  const improved = delta > 0.005;
  const worsened = delta < -0.005;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <p className="text-text truncate text-sm font-medium">{topic.name}</p>
        <p className="text-text-faint mt-0.5 truncate text-xs">
          {topic.subjectName} · {topic.chapterName}
        </p>
      </div>

      <p className="shrink-0 text-sm tabular-nums">
        <span className="text-text-soft">{Math.round(previous * 100)}%</span>
        <span className="text-text-faint mx-2" aria-hidden="true">
          →
        </span>
        <span
          className={
            improved
              ? "text-tick-700 font-semibold"
              : worsened
                ? "text-marker-700 font-semibold"
                : "text-text font-semibold"
          }
        >
          {Math.round(topic.current * 100)}%
        </span>
        <span className="sr-only">
          {improved ? ", improved" : worsened ? ", fallen" : ", unchanged"}
        </span>
      </p>
    </li>
  );
}
