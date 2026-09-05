import type { SubjectProgressSummary, WeakTopic } from "@samjho/contracts";
import type { Metadata } from "next";
import Link from "next/link";

import { BookmarkIcon, ChevronRight, ProgressIcon, RedoIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, IconTile, Meter } from "@/components/ui/surface";
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
  const overview = await loadProgressOverview();
  const attempted = overview.subjects.reduce((sum, subject) => sum + subject.attempted, 0);
  const correct = overview.subjects.reduce((sum, subject) => sum + subject.correct, 0);
  const accuracy = attempted === 0 ? null : Math.round((correct / attempted) * 100);

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Learning evidence"
        title="Your progress"
        lede="See the work you have done, spot what needs another look, and turn it into a focused set."
        action={<ButtonLink href="/practice/new">Build a focused set</ButtonLink>}
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
        Once you add a subject, Samjho can show the evidence from your practice.
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
