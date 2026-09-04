import { PRACTICE_MODE_LABELS, type PracticeTopicResult } from "@samjho/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SessionReview } from "@/features/practice/session-review";
import { StartPractice } from "@/features/practice/start-practice";
import { ApiClientError } from "@/lib/api-client";
import { requireOnboarded } from "@/lib/me";
import { loadResult } from "@/lib/practice";
import { formatDuration, formatMarksValue, practiceHref } from "@/lib/practice-format";

export const metadata: Metadata = { title: "Practice result" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * What just happened, and what to do about it.
 *
 * The order is the argument: score, then the topics that cost marks, then what
 * to practise next, and only then the question-by-question review. A result page
 * that opens with twelve expanded questions is a page a student scrolls past;
 * one that opens with "you lost 6 marks in Gauss's Law" and a button is one they
 * act on. docs/00 §5 — when a feature could be more analytics or more practice,
 * choose practice.
 *
 * The per-topic figures are this session's, not lifetime mastery. Mixing the two
 * on one page is how a student ends up unable to tell whether a number is about
 * tonight or about August.
 */
export default async function PracticeResultPage({ params }: PageProps) {
  const { id } = await params;
  await requireOnboarded();

  const result = await loadResultOr404(id);
  const { session, topics, weakTopics, mistakeQuestionIds } = result;

  const accuracy =
    session.totals.answered > 0
      ? Math.round((session.totals.correct / session.totals.answered) * 100)
      : 0;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-10">
      <header className="space-y-2">
        <Link href="/practice" className="text-ink-500 hover:text-ink-900 text-sm">
          ← Practice
        </Link>

        <h1 className="text-ink-900 dark:text-ink-50 text-2xl font-semibold tracking-tight">
          {session.focus ?? PRACTICE_MODE_LABELS[session.mode]}
        </h1>

        <p className="text-ink-500 dark:text-ink-300 text-sm">
          {session.status === "IN_PROGRESS" ? "Still in progress · " : ""}
          {formatDuration(session.totals.timeSpentMs)}
        </p>
      </header>

      <section aria-labelledby="score-heading" className="space-y-3">
        <h2 id="score-heading" className="sr-only">
          Your score
        </h2>

        {/*
          Three tiles stay three tiles at 360px — a score a student wants to read
          as one line should not become a column — so the padding and type
          shrink instead of the grid reflowing.
        */}
        <dl className="grid grid-cols-3 gap-2 sm:gap-3">
          <Stat
            label="Marks"
            value={`${formatMarksValue(session.totals.marksEarned)} / ${formatMarksValue(session.totals.marksPossible)}`}
          />
          <Stat
            label="Right"
            value={`${String(session.totals.correct)} of ${String(session.totals.answered)}`}
          />
          <Stat label="Accuracy" value={`${String(accuracy)}%`} />
        </dl>

        {session.totals.awaitingSelfEvaluation > 0 ? (
          <p className="border-brand-600 text-ink-700 dark:text-ink-100 rounded-lg border p-3 text-sm">
            {session.totals.awaitingSelfEvaluation === 1
              ? "One written answer is still waiting for you to score it"
              : `${String(session.totals.awaitingSelfEvaluation)} written answers are still waiting for you to score them`}
            . Scroll down, compare each with the marking scheme, and award yourself the marks — your
            total above will move as you do.
          </p>
        ) : null}
      </section>

      {topics.length > 0 ? (
        <section aria-labelledby="topics-heading" className="space-y-3">
          <h2 id="topics-heading" className="text-ink-700 dark:text-ink-100 text-sm font-semibold">
            By topic
          </h2>

          <ul className="flex flex-col gap-2">
            {topics.map((topic) => (
              <TopicRow
                key={topic.topicId}
                topic={topic}
                weak={weakTopics.some((weakTopic) => weakTopic.topicId === topic.topicId)}
              />
            ))}
          </ul>

          {/*
            Said plainly rather than left for a student to infer from small
            numbers: two questions is not a verdict on a topic.
          */}
          <p className="text-ink-500 dark:text-ink-300 text-xs">
            Based only on this set. Your overall progress lives on your dashboard.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="next-heading" className="space-y-3">
        <h2 id="next-heading" className="text-ink-700 dark:text-ink-100 text-sm font-semibold">
          What next
        </h2>

        <div className="flex flex-wrap items-start gap-3">
          {mistakeQuestionIds.length > 0 ? (
            <StartPractice
              mode="MISTAKE_REVIEW"
              label={
                mistakeQuestionIds.length === 1
                  ? "Practise your 1 mistake"
                  : `Practise your ${String(mistakeQuestionIds.length)} mistakes`
              }
            />
          ) : null}

          {weakTopics[0] ? (
            <Link
              href={practiceHref({ unseenOnly: false, topicId: weakTopics[0].topicId })}
              className="border-ink-100 dark:border-ink-700 rounded-lg border px-4 py-2 font-medium"
            >
              Practise {weakTopics[0].name}
            </Link>
          ) : null}

          <Link
            href="/practice"
            className="border-ink-100 dark:border-ink-700 rounded-lg border px-4 py-2 font-medium"
          >
            Something else
          </Link>
        </div>
      </section>

      <section aria-labelledby="review-heading" className="space-y-4">
        <h2 id="review-heading" className="text-ink-700 dark:text-ink-100 text-sm font-semibold">
          Question by question
        </h2>

        <SessionReview initial={session} />
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-ink-100 dark:border-ink-700 rounded-xl border px-3 py-3 sm:px-4">
      <dt className="text-ink-500 dark:text-ink-300 text-xs">{label}</dt>
      <dd className="text-ink-900 dark:text-ink-50 text-base font-semibold tabular-nums sm:text-lg">
        {value}
      </dd>
    </div>
  );
}

function TopicRow({ topic, weak }: { topic: PracticeTopicResult; weak: boolean }) {
  const share = topic.marksPossible > 0 ? (topic.marksEarned / topic.marksPossible) * 100 : 0;

  return (
    <li className="border-ink-100 dark:border-ink-700 rounded-lg border px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
        <span className="text-ink-900 dark:text-ink-50 font-medium">{topic.name}</span>
        <span className="text-ink-500 dark:text-ink-300 text-xs">{topic.chapterName}</span>
        <span className="text-ink-500 dark:text-ink-300 ml-auto tabular-nums">
          {formatMarksValue(topic.marksEarned)} / {formatMarksValue(topic.marksPossible)}
        </span>
      </div>

      <div
        className="bg-ink-100 dark:bg-ink-700 mt-2 h-1.5 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`${String(Math.round(share))} per cent of the marks in ${topic.name}`}
      >
        <div
          className={weak ? "bg-danger h-1.5" : "bg-success h-1.5"}
          style={{ width: `${String(share)}%` }}
        />
      </div>
    </li>
  );
}

async function loadResultOr404(id: string) {
  try {
    return await loadResult(id);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }
}
