import {
  ADAPTIVE_COUNT_DEFAULT,
  ASSESSMENT_OBJECTIVE_BLURBS,
  SELECTION_REASON_LABELS,
  type DiagnosticStage,
} from "@samjho/contracts";
import type { Metadata } from "next";
import Link from "next/link";

import { Check, ChevronRight, GaugeIcon, LockIcon, TargetIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, Chip, IconTile, Meter, PanelOrbit } from "@/components/ui/surface";
import { StartAssessment } from "@/features/assessment/start-assessment";
import { loadAnalysis, loadDiagnostics } from "@/lib/assessment";
import { requireOnboarded } from "@/lib/me";

export const metadata: Metadata = { title: "Assessment" };
export const dynamic = "force-dynamic";

/**
 * The assessment space: three measurements, then a sitting built from them.
 *
 * ## Why the diagnostics are a ladder rather than three buttons
 *
 * They are not interchangeable. Fundamentals establishes what is already solid,
 * Application finds where a known idea stops being usable, and Challenge finds
 * where the reasoning runs out. Sitting Challenge first tells a student they are
 * bad at everything, which is both untrue and the fastest way to lose them — so
 * a stage that is not open yet says so, with a lock rather than a disabled
 * button nobody can explain.
 *
 * ## Why the personalised sitting sits below them and not above
 *
 * It cannot be built from nothing. Before the diagnostics there is no mastery to
 * aim at, and a "personalised" sitting drawn from an empty student model is a
 * random set with a flattering label. The card is present from the start so the
 * shape of the product is visible, and it says plainly what it is waiting for.
 */
export default async function AssessmentPage() {
  const me = await requireOnboarded();
  const [diagnostics, analysis] = await Promise.all([loadDiagnostics(), loadAnalysis()]);

  const subjects = me.profile?.subjects ?? [];
  const ready = diagnostics.analysisReady;
  const done = diagnostics.completedCount;

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Assessment"
        title="Find out where you actually are."
        lede="Three short sittings, then questions chosen from what your answers show — not from a list everyone gets."
        action={
          ready ? (
            <Link
              href="/analysis"
              className="text-brand-700 inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline"
            >
              Your report <ChevronRight className="size-4" />
            </Link>
          ) : undefined
        }
      />

      <section aria-labelledby="diagnostics-heading" className="flex flex-col gap-4">
        <SectionHeading
          id="diagnostics-heading"
          eyebrow="Step one"
          title="The three diagnostics"
          lede="Every student sits the same three, so the picture they build is comparable rather than flattering."
          action={
            <p className="text-text-soft text-sm tabular-nums">
              {done} of {diagnostics.stages.length} done
            </p>
          }
        />

        <Meter
          percent={(done / Math.max(diagnostics.stages.length, 1)) * 100}
          label="Diagnostics completed"
        />

        <ol className="grid gap-4 lg:grid-cols-3">
          {diagnostics.stages.map((stage, position) => (
            <StageCard
              key={stage.objective}
              stage={stage}
              position={position + 1}
              subjectId={subjects[0]?.id}
            />
          ))}
        </ol>
      </section>

      <section aria-labelledby="adaptive-heading">
        <Card
          tone={ready ? "brand" : "card"}
          pad="roomy"
          aria-labelledby="adaptive-heading"
          className="relative overflow-hidden"
        >
          {ready ? <PanelOrbit /> : null}

          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <Eyebrow className="flex items-center gap-2">
                <TargetIcon className="size-4" /> Step two
              </Eyebrow>

              <h2 id="adaptive-heading" className="text-text text-heading mt-3">
                {ready
                  ? "Your personalised assessment is ready."
                  : "Your personalised assessment unlocks next."}
              </h2>

              <p className="text-text-soft mt-2 max-w-2xl text-sm leading-relaxed">
                {ready
                  ? ASSESSMENT_OBJECTIVE_BLURBS.ADAPTIVE_PERSONALISED
                  : `Finish ${String(diagnostics.stages.length - done)} more ${
                      diagnostics.stages.length - done === 1 ? "diagnostic" : "diagnostics"
                    } and Samjho will have enough to build a sitting around your weak areas rather than around a guess.`}
              </p>

              {ready ? <Blend focusTopics={analysis.weak.slice(0, 3)} /> : null}
            </div>

            <div className="shrink-0">
              {ready ? (
                <StartAssessment
                  objective="ADAPTIVE_PERSONALISED"
                  {...(subjects[0] ? { subjectId: subjects[0].id } : {})}
                  count={ADAPTIVE_COUNT_DEFAULT}
                  label="Start personalised assessment"
                  busyLabel="Choosing your first question…"
                  size="lg"
                />
              ) : (
                <ButtonLink
                  href="#diagnostics-heading"
                  variant="secondary"
                  size="lg"
                  aria-disabled="true"
                >
                  Finish the diagnostics first
                </ButtonLink>
              )}
            </div>
          </div>
        </Card>
      </section>
    </PageShell>
  );
}

/**
 * The blend, stated before the student commits to it.
 *
 * Ten questions is four weak areas, three reinforcement, two at the current
 * level and one stretch, and saying so is the difference between "the computer
 * picked these" and a sitting a student can see the shape of. The topic names
 * come from their own report, so the claim is checkable on the next page.
 */
function Blend({ focusTopics }: { focusTopics: { id: string; name: string }[] }) {
  const blend = [
    { reason: "WEAK_AREA", count: 4 },
    { reason: "REINFORCEMENT", count: 3 },
    { reason: "CURRENT_LEVEL", count: 2 },
    { reason: "CHALLENGE", count: 1 },
  ] as const;

  return (
    <div className="mt-5">
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {blend.map((entry) => (
          <div key={entry.reason} className="flex items-baseline gap-2 text-sm">
            <dd className="text-brand-700 w-6 shrink-0 font-semibold tabular-nums">
              {entry.count}
            </dd>
            <dt className="text-text-soft">{SELECTION_REASON_LABELS[entry.reason]}</dt>
          </div>
        ))}
      </dl>

      {focusTopics.length > 0 ? (
        <p className="text-text-soft mt-4 text-sm">
          Aimed at {focusTopics.map((topic) => topic.name).join(", ")}.
        </p>
      ) : null}

      <p className="text-text-faint mt-1 text-sm tabular-nums">
        {ADAPTIVE_COUNT_DEFAULT} questions · about 12 minutes
      </p>
    </div>
  );
}

const STAGE_TONE = {
  COMPLETED: "correct",
  IN_PROGRESS: "brand",
  AVAILABLE: "outline",
  LOCKED: "neutral",
} as const satisfies Record<DiagnosticStage["status"], "correct" | "brand" | "outline" | "neutral">;

const STAGE_STATUS_LABEL = {
  COMPLETED: "Done",
  IN_PROGRESS: "In progress",
  AVAILABLE: "Ready",
  LOCKED: "Locked",
} as const satisfies Record<DiagnosticStage["status"], string>;

function StageCard({
  stage,
  position,
  subjectId,
}: {
  stage: DiagnosticStage;
  position: number;
  subjectId: string | undefined;
}) {
  const locked = stage.status === "LOCKED";

  return (
    <Card as="li" className="flex flex-col gap-4" aria-label={stage.label}>
      <div className="flex items-start gap-3">
        <IconTile tone={locked ? "neutral" : "brand"}>
          {stage.status === "COMPLETED" ? (
            <Check className="size-5" />
          ) : locked ? (
            <LockIcon className="size-5" />
          ) : (
            <GaugeIcon className="size-5" />
          )}
        </IconTile>

        <div className="min-w-0 flex-1">
          <p className="text-text-faint text-xs font-semibold tabular-nums">
            {String(position).padStart(2, "0")}
          </p>
          <h3 className="text-text mt-0.5 font-semibold">{stage.label}</h3>
        </div>

        <Chip tone={STAGE_TONE[stage.status]}>{STAGE_STATUS_LABEL[stage.status]}</Chip>
      </div>

      <p className="text-text-soft flex-1 text-sm leading-relaxed">{stage.blurb}</p>

      {stage.status === "COMPLETED" ? (
        <p className="text-text-soft text-sm">
          {stage.scorePercent === null ? (
            "Finished."
          ) : (
            <>
              You scored{" "}
              <span className="text-text font-semibold tabular-nums">{stage.scorePercent}%</span>.
            </>
          )}
        </p>
      ) : locked ? (
        <p className="text-text-faint text-sm">Finish the one before this to open it.</p>
      ) : stage.status === "IN_PROGRESS" && stage.sessionId !== null ? (
        <ButtonLink href={`/practice/sessions/${stage.sessionId}`} size="sm">
          Continue
        </ButtonLink>
      ) : (
        <StartAssessment
          objective={stage.objective}
          {...(subjectId === undefined ? {} : { subjectId })}
          count={ADAPTIVE_COUNT_DEFAULT}
          label="Start"
          size="sm"
        />
      )}
    </Card>
  );
}
