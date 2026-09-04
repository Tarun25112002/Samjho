import { PRACTICE_MODE_LABELS } from "@samjho/contracts";
import type { Metadata } from "next";
import Link from "next/link";

import { StartPractice } from "@/features/practice/start-practice";
import { loadSessions } from "@/lib/practice";
import { describeScore, formatDuration } from "@/lib/practice-format";
import { requireOnboarded } from "@/lib/me";

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
 * The custom builder is one line of text at the bottom rather than a panel. It
 * is the least-used path and the most visually expensive one, and putting it
 * first is how a two-tap product becomes a six-tap product.
 */
export default async function PracticeHubPage() {
  const me = await requireOnboarded();

  const [inProgress, recent] = await Promise.all([
    loadSessions({ status: "IN_PROGRESS", limit: 1 }),
    loadSessions({ limit: 6 }),
  ]);

  const resume = inProgress.items[0];
  const subjects = me.profile?.subjects ?? [];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-ink-900 dark:text-ink-50 text-2xl font-semibold tracking-tight">
          Practice
        </h1>
        <p className="text-ink-500 dark:text-ink-300 text-sm">
          Answer, find out why, and come back to what you got wrong.
        </p>
      </header>

      {resume ? (
        <section
          aria-labelledby="continue-heading"
          className="border-brand-600 rounded-xl border p-5"
        >
          <h2 id="continue-heading" className="text-ink-900 dark:text-ink-50 font-medium">
            Continue where you left off
          </h2>
          <p className="text-ink-500 dark:text-ink-300 mt-1 text-sm">
            {resume.focus ?? PRACTICE_MODE_LABELS[resume.mode]} · {resume.totals.answered} of{" "}
            {resume.totals.totalQuestions} answered
          </p>
          <Link
            href={`/practice/sessions/${resume.id}`}
            className="bg-brand-600 mt-3 inline-block rounded-lg px-4 py-2 font-medium text-white"
          >
            Resume
          </Link>
        </section>
      ) : null}

      <section aria-labelledby="start-heading" className="space-y-3">
        <h2 id="start-heading" className="text-ink-700 dark:text-ink-100 text-sm font-semibold">
          Start something
        </h2>

        <ul className="grid gap-3 sm:grid-cols-2">
          <Preset
            title="Quick practice"
            body="Ten questions you haven't seen, drawn from everything you're studying."
          >
            <StartPractice mode="QUICK" filters={{ unseenOnly: true }} label="Start" count={10} />
          </Preset>

          <Preset
            title="Fix your mistakes"
            body="Questions you got wrong and haven't got right since. The point of the whole app."
          >
            <StartPractice mode="MISTAKE_REVIEW" label="Practise these" variant="secondary" />
          </Preset>

          <Preset title="Saved questions" body="The ones you marked to come back to.">
            <StartPractice mode="BOOKMARKS" label="Practise saved" variant="secondary" />
          </Preset>

          <Preset
            title="Previous-year questions"
            body="Straight from CBSE board and sample papers, with the paper and year attached."
          >
            <StartPractice mode="PREVIOUS_YEAR" label="Practise PYQs" variant="secondary" />
          </Preset>
        </ul>

        <p className="text-ink-500 dark:text-ink-300 text-sm">
          Want something specific?{" "}
          <Link href="/practice/new" className="underline">
            Build a custom set
          </Link>
          .
        </p>
      </section>

      {subjects.length > 0 ? (
        <section aria-labelledby="subjects-heading" className="space-y-3">
          <h2
            id="subjects-heading"
            className="text-ink-700 dark:text-ink-100 text-sm font-semibold"
          >
            Practise a chapter
          </h2>

          <ul className="grid gap-3 sm:grid-cols-2">
            {subjects.map((subject) => (
              <li key={subject.id}>
                <Link
                  href={`/subjects/${subject.slug}`}
                  className="border-ink-100 dark:border-ink-700 hover:border-brand-600 block rounded-xl border p-4 transition-colors"
                >
                  <p className="text-ink-900 dark:text-ink-50 font-medium">{subject.name}</p>
                  <p className="text-ink-500 dark:text-ink-300 mt-1 text-sm">
                    Browse chapters and practise one
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="recent-heading" className="space-y-3">
        <h2 id="recent-heading" className="text-ink-700 dark:text-ink-100 text-sm font-semibold">
          Recent sets
        </h2>

        {recent.items.length === 0 ? (
          <p className="text-ink-500 dark:text-ink-300 text-sm">
            Nothing yet. Your first set will appear here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.items.map((session) => (
              <li key={session.id}>
                <Link
                  href={
                    session.status === "IN_PROGRESS"
                      ? `/practice/sessions/${session.id}`
                      : `/practice/sessions/${session.id}/result`
                  }
                  className="border-ink-100 dark:border-ink-700 hover:border-brand-600 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-sm transition-colors"
                >
                  <span className="text-ink-900 dark:text-ink-50 font-medium">
                    {session.focus ?? PRACTICE_MODE_LABELS[session.mode]}
                  </span>
                  <span className="text-ink-500 dark:text-ink-300">
                    {describeScore(session.totals)}
                  </span>
                  <span className="text-ink-500 dark:text-ink-300 ml-auto">
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
    </main>
  );
}

function Preset({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <li className="border-ink-100 dark:border-ink-700 flex flex-col gap-3 rounded-xl border p-4">
      <div>
        <h3 className="text-ink-900 dark:text-ink-50 font-medium">{title}</h3>
        <p className="text-ink-500 dark:text-ink-300 mt-1 text-sm text-pretty">{body}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </li>
  );
}
