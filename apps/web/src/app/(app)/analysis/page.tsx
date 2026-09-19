import {
  MASTERY_BAND_LABELS,
  type AnalysisTopic,
  type LearningMetric,
  type MasteryBand,
} from "@medhavi/contracts";
import type { Metadata } from "next";

import { GaugeIcon, SparkIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, Chip, Meter, PanelOrbit } from "@/components/ui/surface";
import { loadAnalysis, loadDiagnostics } from "@/lib/assessment";
import { requireOnboarded } from "@/lib/me";

export const metadata: Metadata = { title: "Your report" };
export const dynamic = "force-dynamic";

/**
 * The preparation report.
 *
 * ## Every figure on this page came out of the student's own answers
 *
 * That is the whole claim the page makes, and it is why each metric carries the
 * basis it was computed from in plain words underneath. "67%" with no
 * explanation is a number a student either believes or does not; "67% — marks
 * earned as a share of marks attempted" is one they can check.
 *
 * ## Nothing here is invented to fill a gap
 *
 * A metric with too little behind it renders as a dash and says what it is
 * waiting for. The alternative — showing 0% for a topic nobody has been asked
 * about — is not a neutral placeholder: it tells a student they are failing
 * something they have never attempted.
 *
 * The AI paragraph is the last thing on the page and the only generated thing on
 * it, and it says so. If no provider answered, a summary written from the same
 * figures stands in its place, which is why there is no loading state here and
 * no way for this page to fail because a model was busy.
 */
export default async function AnalysisPage() {
  await requireOnboarded();
  const [analysis, diagnostics] = await Promise.all([loadAnalysis(), loadDiagnostics()]);

  if (analysis.overallMastery === null) {
    return <EmptyReport completed={diagnostics.completedCount} />;
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Your preparation"
        title="What your answers show."
        lede="Built from every question you have answered. Nothing on this page is an estimate of work you have not done."
        action={<ButtonLink href="/assessment">Take another assessment</ButtonLink>}
      />

      {analysis.diagnosticsComplete ? null : (
        <p className="rounded-control border-line bg-raised text-text-soft border px-4 py-3 text-sm">
          You have finished {analysis.diagnosticsCompleted} of 3 diagnostics. This report will get
          sharper — and your personalised assessment unlocks — once all three are done.
        </p>
      )}

      <Card tone="desk" pad="roomy" className="relative overflow-hidden">
        <PanelOrbit tone="desk" />
        <div className="relative grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
          <div>
            <Eyebrow tone="desk">Overall mastery</Eyebrow>
            <p className="text-on-desk text-figure-lg mt-2 tabular-nums">
              {percent(analysis.overallMastery)}
            </p>
            <p className="text-on-desk-soft mt-1 text-sm tabular-nums">
              across {analysis.questionsAttempted} scored questions
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
            {analysis.metrics
              .filter((metric) => metric.key !== "OVERALL_MASTERY")
              .map((metric) => (
                <MetricFigure key={metric.key} metric={metric} />
              ))}

            <div className="min-w-0">
              <dd className="text-on-desk text-figure truncate tabular-nums">
                {analysis.averageResponseSeconds === null
                  ? "—"
                  : `${String(analysis.averageResponseSeconds)}s`}
              </dd>
              <dt className="text-on-desk-soft mt-1 text-xs font-medium sm:text-sm">
                Average per question
              </dt>
            </div>
          </dl>
        </div>

        {analysis.paceRatio === null ? null : (
          <p className="text-on-desk-soft relative mt-6 text-sm">
            {analysis.paceRatio > 1.2
              ? `You take about ${String(analysis.paceRatio)}× as long as these questions are written for. Worth practising to time.`
              : analysis.paceRatio < 0.8
                ? `You answer in about ${String(analysis.paceRatio)}× the time these questions are written for. Quick — check that speed is not costing you marks.`
                : "You are answering at roughly the pace these questions are written for."}
          </p>
        )}
      </Card>

      <section aria-labelledby="subjects-heading" className="flex flex-col gap-4">
        <SectionHeading
          id="subjects-heading"
          eyebrow="By subject"
          title="Where the marks are"
          lede="Recency-weighted, so a fortnight of work moves it and a bad afternoon in June does not hold it down."
        />

        <ul className="grid gap-3 sm:grid-cols-2">
          {analysis.subjects.map((entry) => (
            <Card as="li" key={entry.subject.id}>
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-text truncate font-semibold">{entry.subject.name}</p>
                <p className="text-text text-figure shrink-0 tabular-nums">
                  {percent(entry.masteryScore)}
                </p>
              </div>
              <Meter percent={entry.masteryScore * 100} className="mt-3" />
              <p className="text-text-soft mt-2 text-sm tabular-nums">
                {entry.attempted === 0
                  ? "Nothing attempted yet"
                  : `${String(entry.attempted)} questions · ${
                      entry.accuracy === null ? "—" : percent(entry.accuracy)
                    } accuracy`}
              </p>
            </Card>
          ))}
        </ul>
      </section>

      <section aria-labelledby="topics-heading" className="flex flex-col gap-4">
        <SectionHeading
          id="topics-heading"
          eyebrow="By topic"
          title="What is solid and what is not"
          lede="A topic needs at least two attempts before it appears here. One unlucky question is not a verdict."
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <TopicBand band="WEAK" topics={analysis.weak} />
          <TopicBand band="NEEDS_PRACTICE" topics={analysis.needsPractice} />
          <TopicBand band="STRONG" topics={analysis.strong} />
        </div>
      </section>

      {analysis.insight === null ? null : (
        <Card aria-labelledby="insight-heading" pad="roomy">
          <div className="flex items-start gap-3">
            <SparkIcon className="text-brand-600 mt-0.5 size-5 shrink-0" />
            <div className="min-w-0">
              <h2 id="insight-heading" className="text-text font-semibold">
                What this adds up to
              </h2>
              <p className="text-text mt-3 leading-relaxed text-pretty">{analysis.insight.text}</p>
              <p className="text-text-faint mt-4 text-xs">
                {analysis.insight.generated
                  ? "Written by Medhavi's AI from the figures above, and from nothing else."
                  : "Summarised from the figures above."}
              </p>
            </div>
          </div>
        </Card>
      )}
    </PageShell>
  );
}

function MetricFigure({ metric }: { metric: LearningMetric }) {
  return (
    <div className="min-w-0">
      <dd className="text-on-desk text-figure truncate tabular-nums">
        {metric.value === null ? "—" : percent(metric.value)}
      </dd>
      <dt className="text-on-desk-soft mt-1 text-xs font-medium sm:text-sm">{metric.label}</dt>
      <p className="text-on-desk-soft/70 mt-1 text-xs leading-snug">
        {metric.value === null ? "Not enough answered yet" : metric.basis}
      </p>
    </div>
  );
}

const BAND_TONE = {
  WEAK: "wrong",
  NEEDS_PRACTICE: "partial",
  STRONG: "correct",
} as const satisfies Record<MasteryBand, "wrong" | "partial" | "correct">;

const BAND_METER = {
  WEAK: "wrong",
  NEEDS_PRACTICE: "brand",
  STRONG: "correct",
} as const satisfies Record<MasteryBand, "wrong" | "brand" | "correct">;

function TopicBand({ band, topics }: { band: MasteryBand; topics: AnalysisTopic[] }) {
  return (
    <Card as="section" aria-label={MASTERY_BAND_LABELS[band]} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-text font-semibold">{MASTERY_BAND_LABELS[band]}</h3>
        <Chip tone={BAND_TONE[band]}>{topics.length}</Chip>
      </div>

      {topics.length === 0 ? (
        <p className="text-text-faint text-sm">
          {band === "STRONG"
            ? "Nothing here yet. It fills up as topics pass 75%."
            : "Nothing in this band — which is good news."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {topics.map((topic) => (
            <li key={topic.id}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-text truncate text-sm font-medium">{topic.name}</p>
                <p className="text-text shrink-0 text-sm tabular-nums">
                  {percent(topic.masteryScore)}
                </p>
              </div>
              <Meter
                percent={topic.masteryScore * 100}
                tone={BAND_METER[band]}
                size="slim"
                className="mt-1.5"
              />
              <p className="text-text-faint mt-1 text-xs tabular-nums">
                {topic.subjectName} · {topic.attempted} attempted
                {topic.unrepairedMistakes > 0
                  ? ` · ${String(topic.unrepairedMistakes)} still to fix`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * The first-run state.
 *
 * Deliberately not a dashboard with zeroes in it. A student who has answered
 * nothing has no weak areas, and a page of 0% bars tells them they are failing
 * subjects nobody has asked them about.
 */
function EmptyReport({ completed }: { completed: number }) {
  return (
    <PageShell width="default">
      <PageHeader
        eyebrow="Your preparation"
        title="Nothing to report yet."
        lede="This page fills itself from your answers. It stays empty until there are some, rather than showing you figures nobody earned."
      />

      <Card pad="roomy" className="flex flex-col items-start gap-5">
        <GaugeIcon className="text-brand-600 size-8" />
        <div>
          <h2 className="text-text text-heading">Start with the first diagnostic.</h2>
          <p className="text-text-soft mt-2 max-w-xl text-sm leading-relaxed">
            Three short sittings are enough for Medhavi to tell what is solid, what is shaky and
            what has not been learned yet. You have finished {completed} of them.
          </p>
        </div>
        <ButtonLink href="/assessment" size="lg">
          Go to assessments
        </ButtonLink>
      </Card>
    </PageShell>
  );
}

function percent(value: number): string {
  return `${String(Math.round(value * 100))}%`;
}
