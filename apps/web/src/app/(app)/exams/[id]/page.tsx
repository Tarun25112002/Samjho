import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, Chip } from "@/components/ui/surface";
import { StartExam } from "@/features/exam/start-exam";
import { ApiClientError } from "@/lib/api-client";
import { loadExamPaper } from "@/lib/exam";
import { requireStudent } from "@/lib/me";

export const metadata: Metadata = { title: "Before you start" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * The instructions page — the last screen before three hours start.
 *
 * ## Why this exists rather than a Start button on the list
 *
 * Because the clock begins the moment the attempt is created, and a student who
 * did not know that has already lost time. Everything on this page is something
 * they need before that instant: how long they have, that it does not pause,
 * what happens to their written answers, and that the tutor is not available.
 *
 * The small-screen recommendation is a recommendation, not a block. Many
 * students in this audience have only a phone, and refusing them the feature
 * the product is named for would be the wrong call — so they are told the
 * palette is easier on a laptop and then allowed to decide.
 */
export default async function ExamInstructionsPage({ params }: PageProps) {
  const { id } = await params;
  await requireStudent();

  const paper = await loadOr404(id);

  return (
    <PageShell width="default">
      <PageHeader
        back={{ href: "/exams", label: "Board exams" }}
        eyebrow="Before you start"
        title={paper.title}
        lede={`${paper.subject.name} · ${String(paper.totalMarks)} marks · ${String(paper.durationMinutes)} minutes`}
      />

      <Card tone="brand" pad="roomy">
        <h2 className="text-text font-semibold">The clock starts when you press start.</h2>
        <p className="text-text-soft mt-2 text-sm leading-relaxed">
          There is no pause, because a board exam has none. If you close the tab the clock keeps
          running, and your answers will be submitted automatically when the time is up — you will
          still get a result for everything you had written by then.
        </p>
      </Card>

      <section aria-labelledby="structure-heading" className="flex flex-col gap-4">
        <SectionHeading
          id="structure-heading"
          eyebrow="The paper"
          title="How it is laid out"
          lede={
            paper.blueprint
              ? `Built to the ${paper.blueprint.name} pattern, ${paper.blueprint.academicYear}.`
              : undefined
          }
        />

        <Card pad="flush" className="overflow-hidden">
          <ul className="divide-line divide-y">
            {paper.sections.map((section) => (
              <li
                key={section.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4 sm:px-6"
              >
                <div className="min-w-0">
                  <p className="text-text text-sm font-medium">{section.name}</p>
                  {section.instructions === null ? null : (
                    <p className="text-text-faint mt-0.5 text-xs">{section.instructions}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Chip tone="neutral">
                    {section.slots.length} {section.slots.length === 1 ? "question" : "questions"}
                  </Chip>
                  <Chip tone="outline">{section.marks} marks</Chip>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {paper.generalInstructions.length > 0 ? (
        <section aria-labelledby="general-heading">
          <SectionHeading
            id="general-heading"
            eyebrow="General instructions"
            title="Read these first"
          />

          <Card className="mt-4">
            <ol className="text-text-soft list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              {paper.generalInstructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ol>
          </Card>
        </section>
      ) : null}

      <Card>
        <h2 className="text-text font-semibold">What happens to your written answers</h2>
        <p className="text-text-soft mt-2 text-sm leading-relaxed">
          Multiple-choice, numerical and fill-in-the-blank answers are marked automatically. Long
          and short written answers cannot be — so after you submit, you will score them yourself
          against the official step-marking scheme, one step at a time. Your result shows the two
          separately rather than blending them into a number that would not mean anything.
        </p>
        <p className="text-text-faint mt-3 text-sm">
          The AI tutor is unavailable for the whole of an exam.
        </p>
      </Card>

      <div className="flex flex-col gap-3">
        <StartExam paperId={paper.id} />
        <p className="text-text-faint text-sm lg:hidden">
          This works on a phone, but the question palette is much easier to use on a laptop or
          tablet if you have one.
        </p>
      </div>
    </PageShell>
  );
}

async function loadOr404(id: string) {
  try {
    return await loadExamPaper(id);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }
}
