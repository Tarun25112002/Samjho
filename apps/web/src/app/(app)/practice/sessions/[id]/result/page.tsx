import { PRACTICE_MODE_LABELS, type PracticeTopicResult } from "@medhavi/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, Meter, PanelOrbit } from "@/components/ui/surface";
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
  const { session, topics, weakTopics, mistakeQuestionIds, previous, deltaPercent, movements } =
    result;

  // Only topics that actually moved, and only where there is a "before" to move
  // from. A topic the student has never met before is news rather than progress,
  // and listing it as "0% → 60%" claims an improvement that did not happen.
  const improvements = movements.filter(
    (movement) => movement.before !== null && movement.after > movement.before,
  );

  const accuracy =
    session.totals.answered > 0
      ? Math.round((session.totals.correct / session.totals.answered) * 100)
      : 0;

  return (
    <PageShell>
      <PageHeader
        back={{ href: "/practice", label: "Practice" }}
        eyebrow="Practice result"
        title={session.focus ?? PRACTICE_MODE_LABELS[session.mode]}
        lede={`${session.status === "IN_PROGRESS" ? "Still in progress · " : ""}${formatDuration(
          session.totals.timeSpentMs,
        )}`}
      />

      <section aria-labelledby="score-heading" className="flex flex-col gap-4">
        <h2 id="score-heading" className="sr-only">
          Your score
        </h2>

        <Card tone="brand" pad="roomy" className="relative overflow-hidden">
          <PanelOrbit />
          <div className="relative">
            <Eyebrow>Your result</Eyebrow>
            <p className="text-text-soft mt-3 text-sm font-medium">Marks earned</p>
            <p className="text-text text-figure-lg mt-1 flex items-baseline gap-2 tabular-nums">
              {formatMarksValue(session.totals.marksEarned)}
              <span className="text-text-soft text-2xl font-medium tracking-normal">
                / {formatMarksValue(session.totals.marksPossible)}
              </span>
            </p>

            <ScoreChange
              scorePercent={result.scorePercent}
              deltaPercent={deltaPercent}
              previous={previous}
            />

            {/*
              Three figures stay three figures at 360px — a score a student reads
              as one line should not become a column — so the type shrinks rather
              than the grid reflowing.
            */}
            <dl className="border-brand-200 mt-7 grid grid-cols-3 gap-4 border-t pt-5 sm:max-w-xl sm:gap-8">
              <Stat
                label="Correct"
                value={`${String(session.totals.correct)} of ${String(session.totals.answered)}`}
              />
              <Stat label="Accuracy" value={`${String(accuracy)}%`} />
              <Stat label="Time taken" value={formatDuration(session.totals.timeSpentMs)} />
            </dl>
          </div>
        </Card>

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

      {improvements.length > 0 ? (
        <section aria-labelledby="improvements-heading" className="flex flex-col gap-4">
          <SectionHeading
            id="improvements-heading"
            eyebrow="What moved"
            title="You improved on these"
            lede="This set against everything you had answered on the same topics before it."
          />

          <Card pad="flush" className="overflow-hidden">
            <ul className="divide-line divide-y">
              {improvements.map((movement) => (
                <li
                  key={movement.topicId}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="text-text truncate text-sm font-medium">{movement.name}</p>
                    <p className="text-text-faint truncate text-xs">{movement.chapterName}</p>
                  </div>

                  <p className="text-text shrink-0 text-sm tabular-nums">
                    <span className="text-text-soft">{toPercent(movement.before)}</span>
                    <span className="text-text-faint mx-2">→</span>
                    <span className="text-tick-700 font-semibold">{toPercent(movement.after)}</span>
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {topics.length > 0 ? (
        <section aria-labelledby="topics-heading" className="flex flex-col gap-4">
          <SectionHeading
            id="topics-heading"
            eyebrow="Session detail"
            title="Performance by topic"
          />

          <Card pad="flush" className="overflow-hidden">
            <ul className="divide-line divide-y">
              {topics.map((topic) => (
                <TopicRow
                  key={topic.topicId}
                  topic={topic}
                  weak={weakTopics.some((weakTopic) => weakTopic.topicId === topic.topicId)}
                />
              ))}
            </ul>
          </Card>

          {/*
            Said plainly rather than left for a student to infer from small
            numbers: two questions is not a verdict on a topic.
          */}
          <p className="text-text-faint text-xs">
            Based only on this set. Your overall progress lives on your dashboard.
          </p>
        </section>
      ) : null}

      <Card aria-labelledby="next-heading">
        <SectionHeading
          id="next-heading"
          eyebrow="Keep moving"
          title="Turn this result into your next set"
          lede="A quick retry while the work is still fresh is the fastest way to turn a mistake into a strength."
        />

        <div className="mt-5 flex flex-wrap items-start gap-3">
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
            Choose another set
          </ButtonLink>
        </div>
      </Card>

      <section aria-labelledby="review-heading" className="flex flex-col gap-4">
        <SectionHeading id="review-heading" eyebrow="Review" title="Question by question" />

        <SessionReview initial={session} />
      </section>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dd className="text-text truncate text-lg font-semibold tabular-nums sm:text-xl">{value}</dd>
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
    <li className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="text-text font-medium">{topic.name}</span>
        <span className="text-text-faint text-xs">{topic.chapterName}</span>
        <span className="marks-margin text-text-soft ml-auto text-sm">
          {formatMarksValue(topic.marksEarned)} / {formatMarksValue(topic.marksPossible)}
        </span>
      </div>

      <Meter
        percent={share}
        tone={weak ? "wrong" : "correct"}
        className="mt-2.5"
        label={`${String(Math.round(share))} per cent of the marks in ${topic.name}`}
      />
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

/**
 * The score, and how it compares to last time.
 *
 * Only ever against a *comparable* sitting — the API matches on objective where
 * there is one and on mode otherwise — because "down 9%" against a different
 * kind of exercise is a number that means nothing and lands like a verdict.
 *
 * A first sitting says so rather than showing a flat zero change. There is
 * nothing discouraging about "this is your first", and a lot discouraging about
 * an arrow pointing nowhere.
 */
function ScoreChange({
  scorePercent,
  deltaPercent,
  previous,
}: {
  scorePercent: number;
  deltaPercent: number | null;
  previous: { scorePercent: number } | null;
}) {
  const rounded = Math.round(scorePercent);

  if (previous === null || deltaPercent === null) {
    return (
      <p className="text-text-soft mt-3 text-sm">
        <span className="text-text font-semibold tabular-nums">{rounded}%</span> · your first set of
        this kind, so there is nothing to compare it with yet.
      </p>
    );
  }

  const moved = Math.round(deltaPercent);
  const tone = moved > 0 ? "text-tick-700" : moved < 0 ? "text-marker-700" : "text-text-soft";

  return (
    <p className="text-text-soft mt-3 flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="text-text font-semibold tabular-nums">{rounded}%</span>
      <span className={`${tone} font-semibold tabular-nums`}>
        {moved > 0 ? "↑" : moved < 0 ? "↓" : "="} {Math.abs(moved)}%
      </span>
      <span>
        {moved === 0 ? "level with" : "from"} your previous{" "}
        <span className="tabular-nums">{Math.round(previous.scorePercent)}%</span>
      </span>
    </p>
  );
}

function toPercent(value: number | null): string {
  return value === null ? "—" : `${String(Math.round(value * 100))}%`;
}
