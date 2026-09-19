import type { ExamResultItem, ExamScore, ExamSectionResult } from "@samjho/contracts";
import { MathText, QuestionRenderer } from "@samjho/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, Chip, Meter, PanelOrbit } from "@/components/ui/surface";
import { ApiClientError } from "@/lib/api-client";
import { loadExamResult } from "@/lib/exam";
import { requireStudent } from "@/lib/me";

export const metadata: Metadata = { title: "Exam result" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * What the paper came to.
 *
 * ## The two scores are never added into one headline
 *
 * Objective marks were computed by the server against a stored key. Subjective
 * marks were awarded by the student against the official marking scheme. Those
 * are different kinds of claim, and docs/04 §5 is explicit that presenting a
 * single blended number as if it were an official score would be the one
 * dishonest thing in this product. So the hero shows both, labelled, and the
 * total says which parts it is made of.
 *
 * ## Unscored answers are counted, not hidden
 *
 * A student who has not yet self-evaluated six answers has a partial total, and
 * the page says so at the top rather than quietly reporting a low score. The
 * alternative teaches them that the product's numbers cannot be trusted.
 */
export default async function ExamResultPage({ params }: PageProps) {
  const { id } = await params;
  await requireStudent();

  const result = await loadOr404(id);
  const { attempt, score, sections, items } = result;

  return (
    <PageShell width="wide">
      <PageHeader
        back={{ href: "/exams", label: "Board exams" }}
        eyebrow="Exam result"
        title={attempt.paper.title}
        lede={`${formatDuration(result.timeTakenMs)} taken${result.expired ? " · the clock ran out" : ""}`}
        action={<ButtonLink href="/exams">Sit another paper</ButtonLink>}
      />

      {score.awaitingSelfEvaluation > 0 ? (
        <p className="rounded-control border-half-200 bg-half-50 text-sand-800 border px-4 py-3 text-sm leading-relaxed">
          <strong className="font-semibold">
            {score.awaitingSelfEvaluation === 1
              ? "One written answer is still waiting for you to score it"
              : `${String(score.awaitingSelfEvaluation)} written answers are still waiting for you to score them`}
            .
          </strong>{" "}
          Your total below is partial until you do. Scroll down, compare each with the marking
          scheme, and award yourself the marks step by step.
        </p>
      ) : null}

      <Card tone="desk" pad="roomy" className="relative overflow-hidden">
        <PanelOrbit tone="desk" />

        <div className="relative grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
          <div>
            <Eyebrow tone="desk">Total so far</Eyebrow>
            <p className="text-on-desk text-figure-lg mt-2 flex items-baseline gap-2 tabular-nums">
              {score.totalAwarded}
              <span className="text-on-desk-soft text-2xl font-medium tracking-normal">
                / {score.totalPossible}
              </span>
            </p>
            <p className="text-on-desk-soft mt-1 text-sm tabular-nums">
              {Math.round((score.totalAwarded / score.totalPossible) * 100)}%
            </p>
          </div>

          <ScoreSplit score={score} />
        </div>

        <p className="text-on-desk-soft relative mt-6 max-w-2xl text-sm leading-relaxed">
          These two are counted separately on purpose. The objective marks were scored against the
          answer key; the written marks are the ones you awarded yourself against the marking
          scheme. Only the first is a fact about your answers — the second is a fact about your
          judgement of them, which is a different and still useful thing.
        </p>
      </Card>

      <section aria-labelledby="sections-heading" className="flex flex-col gap-4">
        <SectionHeading
          id="sections-heading"
          eyebrow="Section by section"
          title="Where the marks went"
        />

        <Card pad="flush" className="overflow-hidden">
          <ul className="divide-line divide-y">
            {sections.map((section) => (
              <SectionRow key={section.sectionId} section={section} />
            ))}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="review-heading" className="flex flex-col gap-4">
        <SectionHeading
          id="review-heading"
          eyebrow="Review"
          title="Question by question"
          lede="Every question with your answer, the official solution and, where there is one, the marking scheme."
        />

        <ol className="flex flex-col gap-4">
          {items.map((item) => (
            <ResultItem key={item.slotId} item={item} />
          ))}
        </ol>
      </section>
    </PageShell>
  );
}

function ScoreSplit({ score }: { score: ExamScore }) {
  return (
    <dl className="grid gap-5 sm:grid-cols-2">
      <div>
        <dd className="text-on-desk text-figure tabular-nums">
          {score.objectiveAwarded}
          <span className="text-on-desk-soft text-lg font-medium">
            {" "}
            / {score.objectivePossible}
          </span>
        </dd>
        <dt className="text-on-desk-soft mt-1 text-sm font-medium">Objective</dt>
        <p className="text-on-desk-soft/70 mt-1 text-xs">Scored automatically against the key</p>
      </div>

      <div>
        <dd className="text-on-desk text-figure tabular-nums">
          {score.selfAssessedAwarded}
          <span className="text-on-desk-soft text-lg font-medium">
            {" "}
            / {score.selfAssessedPossible}
          </span>
        </dd>
        <dt className="text-on-desk-soft mt-1 text-sm font-medium">Written</dt>
        <p className="text-on-desk-soft/70 mt-1 text-xs">
          {score.awaitingSelfEvaluation > 0
            ? `${String(score.awaitingSelfEvaluation)} still to score yourself`
            : "Scored by you against the marking scheme"}
        </p>
      </div>
    </dl>
  );
}

function SectionRow({ section }: { section: ExamSectionResult }) {
  const percent =
    section.marksPossible === 0 ? 0 : (section.marksAwarded / section.marksPossible) * 100;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <p className="text-text text-sm font-medium">{section.name}</p>
        <p className="text-text-faint mt-0.5 text-xs tabular-nums">
          {section.attempted} of {section.total} attempted
        </p>
      </div>

      <div className="w-40 shrink-0">
        <p className="text-text text-right text-sm font-semibold tabular-nums">
          {section.marksAwarded} / {section.marksPossible}
        </p>
        <Meter percent={percent} size="slim" className="mt-1.5" />
      </div>
    </li>
  );
}

function ResultItem({ item }: { item: ExamResultItem }) {
  const verdict =
    item.evaluationMode === "PENDING"
      ? { tone: "partial" as const, label: "Score this yourself" }
      : item.isCorrect === true
        ? { tone: "correct" as const, label: "Correct" }
        : item.marksAwarded > 0
          ? { tone: "partial" as const, label: "Partly right" }
          : { tone: "wrong" as const, label: "Not right" };

  return (
    <Card as="li">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-text-faint text-xs font-semibold tabular-nums">
          {item.sectionName} · Q{item.questionNumber}
        </span>
        <Chip tone={verdict.tone}>{verdict.label}</Chip>
        <span className="text-text-soft ml-auto text-sm tabular-nums">
          {item.marksAwarded} / {item.marks}
        </span>
      </header>

      <QuestionRenderer question={item.question} hideMeta />

      {item.answer.text.trim().length > 0 ? (
        <div className="border-line mt-4 border-t pt-4">
          <p className="text-text-faint text-xs font-semibold tracking-wide uppercase">
            Your answer
          </p>
          <p className="text-text mt-2 text-sm whitespace-pre-wrap">{item.answer.text}</p>
        </div>
      ) : null}

      {item.key ? (
        <div className="border-line mt-4 border-t pt-4">
          <p className="text-text-faint text-xs font-semibold tracking-wide uppercase">Solution</p>
          <MathText className="text-text mt-2 text-sm leading-relaxed">
            {item.key.solution}
          </MathText>

          {item.key.markingScheme && item.key.markingScheme.length > 0 ? (
            <div className="mt-4">
              <p className="text-text-faint text-xs font-semibold tracking-wide uppercase">
                Marking scheme
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {item.key.markingScheme.map((step) => (
                  <li key={step.step} className="flex items-baseline gap-3 text-sm">
                    <span className="text-text-soft w-8 shrink-0 tabular-nums">{step.marks}</span>
                    <MathText className="text-text-soft">{step.step}</MathText>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${String(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${String(hours)} hr` : `${String(hours)} hr ${String(rest)} min`;
}

async function loadOr404(id: string) {
  try {
    return await loadExamResult(id);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }
}
