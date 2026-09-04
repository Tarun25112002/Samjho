import { PRACTICE_MODE_LABELS } from "@samjho/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType } from "react";

import { BookmarkIcon, PaperIcon, RedoIcon, SlidersIcon, StackIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { StartPractice } from "@/features/practice/start-practice";
import { requireOnboarded } from "@/lib/me";
import { loadSessions } from "@/lib/practice";
import { describeScore, formatDuration } from "@/lib/practice-format";

export const metadata: Metadata = { title: "Practice" };
export const dynamic = "force-dynamic";

/**
 * The practice hub.
 *
 * Ordered by how much each thing helps the student *act*, which is the same rule
 * the dashboard follows (docs/01 §4). "Continue" is first and largest because a
 * half-finished set is the single most likely thing a returning student wants,
 * and the presets come before the filter builder because most students do not
 * want to build anything — they want to start.
 *
 * The custom builder is one row at the bottom rather than a panel. It is the
 * least-used path and the most visually expensive one, and putting it first is
 * how a two-tap product becomes a six-tap product.
 */
export default async function PracticeHubPage() {
  const me = await requireOnboarded();

  const [inProgress, recent] = await Promise.all([
    loadSessions({ status: "IN_PROGRESS", limit: 1 }),
    loadSessions({ limit: 8 }),
  ]);

  const resume = inProgress.items[0];
  const subjects = me.profile?.subjects ?? [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-9 px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <h1 className="text-text text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] sm:text-4xl">
          Practice
        </h1>
        <p className="text-text-soft mt-1.5 text-sm">
          Answer, find out why, and come back to what you got wrong.
        </p>
      </header>

      {resume ? (
        <section
          aria-labelledby="continue-heading"
          className="rounded-panel border-brand-200 bg-brand-50 flex flex-wrap items-center gap-x-6 gap-y-4 border p-6"
        >
          <div className="min-w-0">
            <p className="text-brand-700 text-sm font-semibold">Where you left off</p>
            <h2
              id="continue-heading"
              className="text-text mt-0.5 truncate text-xl font-semibold tracking-[-0.02em]"
            >
              {resume.focus ?? PRACTICE_MODE_LABELS[resume.mode]}
            </h2>
            <p className="text-text-soft mt-1 text-sm">
              {resume.totals.answered} of {resume.totals.totalQuestions} answered
            </p>
          </div>

          <ButtonLink href={`/practice/sessions/${resume.id}`} className="ml-auto">
            Resume
          </ButtonLink>
        </section>
      ) : null}

      <section aria-labelledby="start-heading" className="flex flex-col gap-4">
        <h2 id="start-heading" className="text-text text-lg font-semibold">
          Start something
        </h2>

        <ul className="grid gap-4 sm:grid-cols-2">
          <Preset
            icon={StackIcon}
            title="Quick practice"
            body="Ten questions you have not seen, drawn from everything you are studying."
          >
            <StartPractice mode="QUICK" filters={{ unseenOnly: true }} count={10} label="Start" />
          </Preset>

          <Preset
            icon={RedoIcon}
            title="Fix your mistakes"
            body="Questions you got wrong and have not got right since. The point of the whole app."
          >
            <StartPractice mode="MISTAKE_REVIEW" label="Practise these" variant="secondary" />
          </Preset>

          <Preset
            icon={BookmarkIcon}
            title="Saved questions"
            body="The ones you marked to come back to."
          >
            <StartPractice mode="BOOKMARKS" label="Practise saved" variant="secondary" />
          </Preset>

          <Preset
            icon={PaperIcon}
            title="Previous-year questions"
            body="Straight from CBSE board and sample papers, with the paper and year attached."
          >
            <StartPractice mode="PREVIOUS_YEAR" label="Practise PYQs" variant="secondary" />
          </Preset>
        </ul>

        <Link
          href="/practice/new"
          className="border-line bg-card hover:border-brand-300 rounded-panel flex items-center gap-4 border p-5 transition-colors"
        >
          <SlidersIcon className="text-text-soft size-5 shrink-0" />
          <span className="min-w-0">
            <span className="text-text block font-medium">Build a custom set</span>
            <span className="text-text-soft block text-sm">
              Pick the subject, chapter, question types and difficulty yourself.
            </span>
          </span>
        </Link>
      </section>

      {subjects.length > 0 ? (
        <section aria-labelledby="subjects-heading" className="flex flex-col gap-4">
          <h2 id="subjects-heading" className="text-text text-lg font-semibold">
            Practise a chapter
          </h2>

          <ul className="grid gap-4 sm:grid-cols-2">
            {subjects.map((subject) => (
              <li key={subject.id}>
                <Link
                  href={`/subjects/${subject.slug}`}
                  className="border-line bg-card hover:border-brand-300 rounded-panel block h-full border p-5 transition-colors"
                >
                  <p className="text-text font-semibold">{subject.name}</p>
                  <p className="text-text-soft mt-1 text-sm">Browse chapters and practise one</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="recent-heading" className="flex flex-col gap-4">
        <h2 id="recent-heading" className="text-text text-lg font-semibold">
          Recent sets
        </h2>

        {recent.items.length === 0 ? (
          <p className="border-line bg-card rounded-panel text-text-soft border p-6 text-sm">
            Nothing yet. Your first set will appear here.
          </p>
        ) : (
          <ul className="border-line bg-card rounded-panel divide-line divide-y overflow-hidden border">
            {recent.items.map((session) => (
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
 * One way into a set.
 *
 * The icon is doing real work here rather than decorating: four cards of
 * identical text at a glance are four cards nobody reads, and the shape is what
 * a returning student navigates by once they know which one they want.
 */
function Preset({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <li className="border-line bg-card rounded-panel flex flex-col gap-4 border p-5">
      <div>
        <span className="bg-raised text-text-soft mb-3 grid size-10 place-items-center rounded-full">
          <Icon className="size-5" />
        </span>
        <h3 className="text-text font-semibold">{title}</h3>
        <p className="text-text-soft mt-1 text-sm leading-relaxed">{body}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </li>
  );
}
