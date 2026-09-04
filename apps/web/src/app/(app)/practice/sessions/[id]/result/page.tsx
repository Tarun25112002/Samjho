import { PRACTICE_MODE_LABELS, type PracticeTopicResult } from "@samjho/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChevronLeft } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
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
    <div className="mx-auto flex max-w-3xl flex-col gap-9 px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <Link
          href="/practice"
          className="text-text-soft hover:text-text inline-flex min-h-11 items-center gap-1 text-sm font-medium"
        >
          <ChevronLeft className="size-4" />
          Practice
        </Link>

        <h1 className="text-text mt-1 text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] sm:text-4xl">
          {session.focus ?? PRACTICE_MODE_LABELS[session.mode]}
        </h1>
        <p className="text-text-soft mt-1.5 text-sm">
          {session.status === "IN_PROGRESS" ? "Still in progress · " : ""}
          {formatDuration(session.totals.timeSpentMs)}
        </p>
      </header>

      <section aria-labelledby="score-heading" className="flex flex-col gap-4">
        <h2 id="score-heading" className="sr-only">
          Your score
        </h2>

        <div className="rounded-panel border-brand-200 bg-brand-50 border p-6 sm:p-7">
          <p className="text-brand-700 text-sm font-semibold">Marks</p>
          <p className="text-text mt-1 flex items-baseline gap-2 text-5xl font-semibold tracking-[-0.04em] tabular-nums sm:text-6xl">
            {formatMarksValue(session.totals.marksEarned)}
            <span className="text-text-soft text-2xl font-medium tracking-normal">
              / {formatMarksValue(session.totals.marksPossible)}
            </span>
          </p>

          {/*
            Three figures stay three figures at 360px — a score a student reads
            as one line should not become a column — so the type shrinks rather
            than the grid reflowing.
          */}
          <dl className="border-brand-200 mt-6 grid grid-cols-3 gap-4 border-t pt-5">
            <Stat
              label="Right"
              value={`${String(session.totals.correct)} of ${String(session.totals.answered)}`}
            />
            <Stat label="Accuracy" value={`${String(accuracy)}%`} />
            <Stat label="Time" value={formatDuration(session.totals.timeSpentMs)} />
          </dl>
        </div>

        {session.totals.awaitingSelfEvaluation > 0 ? (
          <p className="rounded-panel border-half-200 bg-half-50 text-sand-800 border p-5 text-sm leading-relaxed">
            <strong className="font-semibold">
              {session.totals.awaitingSelfEvaluation === 1
                ? "One written answer is still waiting for you to score it"
                : `${String(session.totals.awaitingSelfEvaluation)} written answers are still waiting for you to score them`}
              .
            </strong>{" "}
            Scroll down, compare each with the marking scheme, and award yourself the marks — your
            total above will move as you do.
          </p>
        ) : null}
      </section>

      {topics.length > 0 ? (
        <section aria-labelledby="topics-heading" className="flex flex-col gap-4">
          <h2 id="topics-heading" className="text-text text-lg font-semibold">
            By topic
          </h2>

          <ul className="border-line bg-card rounded-panel divide-line divide-y overflow-hidden border">
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
          <p className="text-text-faint text-xs">
            Based only on this set. Your overall progress lives on your dashboard.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="next-heading" className="flex flex-col gap-4">
        <h2 id="next-heading" className="text-text text-lg font-semibold">
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
            <ButtonLink
              href={practiceHref({ unseenOnly: false, topicId: weakTopics[0].topicId })}
              variant="secondary"
            >
              Practise {weakTopics[0].name}
            </ButtonLink>
          ) : null}

          <ButtonLink href="/practice" variant="secondary">
            Something else
          </ButtonLink>
        </div>
      </section>

      <section aria-labelledby="review-heading" className="flex flex-col gap-4">
        <h2 id="review-heading" className="text-text text-lg font-semibold">
          Question by question
        </h2>

        <SessionReview initial={session} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="text-text text-lg font-semibold tabular-nums sm:text-xl">{value}</dd>
      <dt className="text-text-soft mt-0.5 text-xs sm:text-sm">{label}</dt>
    </div>
  );
}

/**
 * One topic's share of the marks.
 *
 * The bar is green or crimson depending on whether the topic came out weak, and
 * the marks are stated beside it in figures — the colour is the summary, the
 * numbers are the fact. A bar alone would be a chart nobody can read a value
 * off.
 */
function TopicRow({ topic, weak }: { topic: PracticeTopicResult; weak: boolean }) {
  const share = topic.marksPossible > 0 ? (topic.marksEarned / topic.marksPossible) * 100 : 0;

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="text-text font-medium">{topic.name}</span>
        <span className="text-text-faint text-xs">{topic.chapterName}</span>
        <span className="marks-margin text-text-soft ml-auto text-sm">
          {formatMarksValue(topic.marksEarned)} / {formatMarksValue(topic.marksPossible)}
        </span>
      </div>

      <div
        className="bg-raised mt-2.5 h-2 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`${String(Math.round(share))} per cent of the marks in ${topic.name}`}
      >
        <div
          className={weak ? "bg-marker-500 h-2 rounded-full" : "bg-tick-500 h-2 rounded-full"}
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
