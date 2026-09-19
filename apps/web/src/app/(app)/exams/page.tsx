import type { ExamAttemptSummary, ExamPaperStructure } from "@samjho/contracts";
import type { Metadata } from "next";
import Link from "next/link";

import { ChevronRight, PaperIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, Chip, IconTile, Meter, PanelOrbit } from "@/components/ui/surface";
import { loadExamAttempts, loadExamPapers } from "@/lib/exam";
import { requireStudent } from "@/lib/me";

export const metadata: Metadata = { title: "Board exams" };
export const dynamic = "force-dynamic";

/**
 * The exam space.
 *
 * This is the page the product's own tagline points at — rehearse the full
 * three-hour board exam before you sit it — so the unfinished attempt comes
 * first and everything else is below it. A student with a paper open has
 * exactly one thing they should be doing.
 *
 * Papers are shown with their real shape rather than as a list of titles: the
 * marks, the duration and the section breakdown are what tell a student whether
 * they have the afternoon for this, and hiding them behind a click would make
 * the decision harder rather than the page tidier.
 */
export default async function ExamsPage() {
  await requireStudent();

  const [papers, attempts] = await Promise.all([
    loadExamPapers({ limit: 20 }).catch(() => ({
      items: [],
      pageInfo: { hasMore: false, nextCursor: null },
    })),
    loadExamAttempts().catch(() => []),
  ]);

  const live = attempts.find((attempt) => attempt.status === "IN_PROGRESS");
  const finished = attempts.filter((attempt) => attempt.status !== "IN_PROGRESS");

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Board exams"
        title="Sit the whole paper, to time."
        lede="A full paper under exam conditions tells you something practice cannot: whether you can finish it."
      />

      {live ? <ResumeCard attempt={live} /> : null}

      <section aria-labelledby="papers-heading" className="flex flex-col gap-4">
        <SectionHeading
          id="papers-heading"
          eyebrow="Available papers"
          title="Papers you can sit"
          lede="Each one is built to the CBSE pattern for your class, with the same sections and mark weighting."
        />

        {papers.items.length === 0 ? (
          <Card pad="roomy" className="flex flex-col items-start gap-4">
            <PaperIcon className="text-brand-600 size-8" />
            <div>
              <p className="text-text font-semibold">No papers are published yet.</p>
              <p className="text-text-soft mt-2 max-w-xl text-sm leading-relaxed">
                Full papers are assembled from the question bank against a blueprint. Until one is
                published for your subjects, practice sets are the way to build up to it.
              </p>
            </div>
            <ButtonLink href="/practice">Go to practice</ButtonLink>
          </Card>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {papers.items.map((paper) => (
              <PaperCard key={paper.id} paper={paper} disabled={live !== undefined} />
            ))}
          </ul>
        )}
      </section>

      {finished.length > 0 ? (
        <section aria-labelledby="history-heading" className="flex flex-col gap-4">
          <SectionHeading id="history-heading" eyebrow="Your papers" title="Papers you have sat" />

          <Card pad="flush" className="overflow-hidden">
            <ul className="divide-line divide-y">
              {finished.map((attempt) => (
                <AttemptRow key={attempt.id} attempt={attempt} />
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </PageShell>
  );
}

function ResumeCard({ attempt }: { attempt: ExamAttemptSummary }) {
  return (
    <Card tone="brand" pad="roomy" className="relative overflow-hidden">
      <PanelOrbit />
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <Eyebrow className="flex items-center gap-2">
            <span className="bg-brand-500 size-2 animate-pulse rounded-full" /> Paper in progress
          </Eyebrow>
          <h2 className="text-text text-heading mt-3 truncate">{attempt.paper.title}</h2>
          <p className="text-text-soft mt-2 text-sm">
            Your clock is still running. It started at{" "}
            {new Date(attempt.startedAt).toLocaleTimeString("en-IN", {
              hour: "numeric",
              minute: "2-digit",
              timeZone: "Asia/Kolkata",
            })}{" "}
            and does not pause.
          </p>
        </div>

        <ButtonLink href={`/exams/attempts/${attempt.id}`} size="lg" className="shrink-0">
          Return to the paper
        </ButtonLink>
      </div>
    </Card>
  );
}

function PaperCard({ paper, disabled }: { paper: ExamPaperStructure; disabled: boolean }) {
  return (
    <Card as="li" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <IconTile tone="brand">
          <PaperIcon className="size-5" />
        </IconTile>

        <div className="min-w-0 flex-1">
          <h3 className="text-text truncate font-semibold">{paper.title}</h3>
          <p className="text-text-faint mt-0.5 truncate text-xs">
            {paper.subject.name} · Class {paper.subject.classLevel}
            {paper.year === null ? "" : ` · ${String(paper.year)}`}
          </p>
        </div>

        <Chip tone="outline">{paper.totalMarks} marks</Chip>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dd className="text-text font-semibold tabular-nums">{paper.durationMinutes} min</dd>
          <dt className="text-text-faint text-xs">Duration</dt>
        </div>
        <div>
          <dd className="text-text font-semibold tabular-nums">{paper.questionCount}</dd>
          <dt className="text-text-faint text-xs">Questions</dt>
        </div>
        <div>
          <dd className="text-text font-semibold tabular-nums">{paper.sections.length}</dd>
          <dt className="text-text-faint text-xs">Sections</dt>
        </div>
      </dl>

      {paper.blueprint ? (
        <p className="text-text-faint text-xs">
          Built to the {paper.blueprint.name} pattern, {paper.blueprint.academicYear}.
        </p>
      ) : null}

      <div className="mt-auto">
        {disabled ? (
          <p className="text-text-faint text-sm">
            Finish the paper you have open before starting this one.
          </p>
        ) : (
          <Link
            href={`/exams/${paper.id}`}
            className="text-brand-700 inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline"
          >
            Read the instructions <ChevronRight className="size-4" />
          </Link>
        )}
      </div>
    </Card>
  );
}

function AttemptRow({ attempt }: { attempt: ExamAttemptSummary }) {
  const percent =
    attempt.totalAwarded === null
      ? null
      : Math.round((attempt.totalAwarded / attempt.totalPossible) * 100);

  return (
    <li>
      <Link
        href={`/exams/attempts/${attempt.id}/result`}
        className="hover:bg-raised/60 flex min-h-16 items-center gap-4 px-5 py-4 transition-colors sm:px-6"
      >
        <div className="min-w-0 flex-1">
          <p className="text-text truncate text-sm font-medium">{attempt.paper.title}</p>
          <p className="text-text-faint mt-0.5 truncate text-xs">
            {attempt.submittedAt === null
              ? "Not submitted"
              : new Date(attempt.submittedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  timeZone: "Asia/Kolkata",
                })}
            {attempt.awaitingSelfEvaluation > 0
              ? ` · ${String(attempt.awaitingSelfEvaluation)} to score yourself`
              : ""}
          </p>
        </div>

        <div className="w-28 shrink-0">
          <p className="text-text text-right text-sm font-semibold tabular-nums">
            {attempt.totalAwarded === null
              ? "—"
              : `${String(attempt.totalAwarded)} / ${String(attempt.totalPossible)}`}
          </p>
          {percent === null ? null : <Meter percent={percent} size="slim" className="mt-1.5" />}
        </div>

        <ChevronRight className="text-text-faint size-5 shrink-0" />
      </Link>
    </li>
  );
}
