import type { SubjectProgressSummary, WeakTopic } from "@samjho/contracts";
import type { Metadata } from "next";
import Link from "next/link";

import { BookmarkIcon, ChevronRight, ProgressIcon, RedoIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
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
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-7 px-4 py-6 sm:px-8 sm:py-8 xl:px-12 xl:py-10 2xl:px-16">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-6">
        <div>
          <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
            Learning evidence
          </p>
          <h1 className="text-text mt-2 text-[1.875rem] leading-[1.08] font-semibold tracking-[-0.035em] sm:text-[2.5rem]">
            Your progress
          </h1>
          <p className="text-text-soft mt-2 max-w-2xl text-sm leading-relaxed">
            See the work you have done, spot what needs another look, and turn it into a focused
            set.
          </p>
        </div>
        <ButtonLink href="/practice/new">Build a focused set</ButtonLink>
      </header>

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
        <section
          aria-labelledby="subjects-heading"
          className="rounded-panel border-line bg-card border p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
                By subject
              </p>
              <h2
                id="subjects-heading"
                className="text-text mt-1 text-xl font-semibold tracking-[-0.02em]"
              >
                Progress that is earned
              </h2>
            </div>
            <span className="text-text-faint text-xs font-medium">
              Recency-weighted performance
            </span>
          </div>

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
        </section>

        <aside className="flex flex-col gap-6">
          <section
            aria-labelledby="weak-topics-heading"
            className="rounded-panel bg-text text-card overflow-hidden p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-brand-300 text-xs font-bold tracking-[0.14em] uppercase">
                  Next to revise
                </p>
                <h2
                  id="weak-topics-heading"
                  className="mt-1 text-xl font-semibold tracking-[-0.02em]"
                >
                  Needs another look
                </h2>
              </div>
              <span className="bg-card/10 grid size-10 place-items-center rounded-xl text-brand-300">
                <ProgressIcon className="size-5" />
              </span>
            </div>

            {overview.weakTopics.length === 0 ? (
              <p className="mt-5 text-sm leading-relaxed text-white/72">
                Complete a few graded answers and this space will identify the topics that need your
                attention.
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-white/12">
                {overview.weakTopics.map((topic) => (
                  <li key={topic.id} className="py-3 first:pt-0 last:pb-0">
                    <WeakTopicCard topic={topic} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="revision-heading"
            className="rounded-panel border-line bg-card border p-5 sm:p-6"
          >
            <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
              Revision queue
            </p>
            <h2
              id="revision-heading"
              className="text-text mt-1 text-xl font-semibold tracking-[-0.02em]"
            >
              Your saved work
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link
                href="/practice"
                className="bg-raised hover:bg-brand-50 rounded-control group p-4 transition-colors"
              >
                <RedoIcon className="text-brand-700 size-5" />
                <p className="text-text mt-4 text-2xl font-semibold tracking-[-0.03em] tabular-nums">
                  {overview.openMistakes}
                </p>
                <p className="text-text-soft mt-1 text-xs font-medium">Open mistakes</p>
              </Link>
              <Link
                href="/practice"
                className="bg-raised hover:bg-brand-50 rounded-control group p-4 transition-colors"
              >
                <BookmarkIcon className="text-brand-700 size-5" />
                <p className="text-text mt-4 text-2xl font-semibold tracking-[-0.03em] tabular-nums">
                  {overview.savedQuestions}
                </p>
                <p className="text-text-soft mt-1 text-xs font-medium">Saved questions</p>
              </Link>
            </div>
            <Link
              href="/practice"
              className="text-brand-700 mt-5 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              Open revision tools <ChevronRight className="size-4" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
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
    <section className="rounded-panel border-line bg-card border p-5">
      <p className="text-text-soft text-sm font-medium">{label}</p>
      <p
        className={[
          "mt-3 text-3xl font-semibold tracking-[-0.04em] tabular-nums",
          warning ? "text-brand-700" : "text-text",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="text-text-faint mt-1 text-xs">{detail}</p>
    </section>
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
        <div
          className="bg-raised mt-2 h-2 overflow-hidden rounded-full"
          role="progressbar"
          aria-label={`Recent performance in ${progress.subject.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
        >
          <div
            className="bg-brand-500 h-full rounded-full"
            style={{ width: `${String(percentage)}%` }}
          />
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
        <div>
          <dd className="text-text font-semibold tabular-nums">
            {formatMarksValue(progress.marksEarned)}/{formatMarksValue(progress.marksPossible)}
          </dd>
          <dt className="text-text-faint mt-0.5 text-xs">Marks</dt>
        </div>
        <div>
          <dd className="text-text font-semibold tabular-nums">{progress.practiceSessions}</dd>
          <dt className="text-text-faint mt-0.5 text-xs">Sets finished</dt>
        </div>
        <div>
          <dd className="text-text font-semibold tabular-nums">{progress.unrepairedMistakes}</dd>
          <dt className="text-text-faint mt-0.5 text-xs">To revisit</dt>
        </div>
      </dl>
    </article>
  );
}

function WeakTopicCard({ topic }: { topic: WeakTopic }) {
  const percentage = Math.round(topic.masteryScore * 100);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{topic.name}</p>
          <p className="mt-0.5 truncate text-xs text-white/60">
            {topic.subject.name} · {topic.chapterName}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-brand-300 tabular-nums">
          {percentage}%
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-brand-400"
          style={{ width: `${String(percentage)}%` }}
        />
      </div>
      <Link
        href={practiceHref({ topicId: topic.id, unseenOnly: false })}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-300 hover:text-brand-200"
      >
        Practise this topic <ChevronRight className="size-3.5" />
      </Link>
    </div>
  );
}

function EmptyProgress() {
  return (
    <div className="bg-raised mt-5 rounded-control p-5">
      <p className="text-text font-semibold">Choose your subjects first</p>
      <p className="text-text-soft mt-1 text-sm">
        Once you add a subject, Samjho can show the evidence from your practice.
      </p>
      <Link
        href="/profile"
        className="text-brand-700 mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
      >
        Manage subjects <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}
