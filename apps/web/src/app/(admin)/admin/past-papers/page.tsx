import type { PastPaperCoverage, PastPaperYearCoverage } from "@samjho/contracts";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, Meter } from "@/components/ui/surface";
import { loadAdminSubjects } from "@/lib/admin";
import { loadPastPaperCoverage } from "@/lib/past-papers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Previous-year papers" };

/**
 * How far through 2001–2026 we are, per subject, per year.
 *
 * ## Why the empty years are here
 *
 * Almost every row on this page is a sitting we hold nothing from, and that is
 * the page working. "Add every CBSE paper since 2001" is a content project of a
 * few thousand questions, and the first thing a project that size needs is an
 * honest list of what has not been done. A grid showing only the years already
 * loaded would report the work as nearly finished on the day it starts.
 *
 * ## Why some rows say "not counted" instead of a percentage
 *
 * Coverage is `questions we hold ÷ questions on the printed paper`, and the
 * denominator is null until somebody with the paper in front of them counts it.
 * A year with one uncounted paper in it therefore shows no percentage at all —
 * deliberately, because the alternative is a progress bar that reads 100%
 * because the denominator defaulted to whatever we happened to load.
 *
 * ## Why there is no "add a paper" button
 *
 * Papers arrive through the ingest pipeline, from files somebody prepared out of
 * a real paper — `content/past-papers/README.md` has the format and the command.
 * A form here would be a way to register a paper nobody holds, which is the one
 * thing this registry is designed to make visible rather than easy.
 */
export default async function PastPapersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const subjects = await loadAdminSubjects();

  const requested = typeof params["subjectId"] === "string" ? params["subjectId"] : undefined;
  const selected = subjects.find((subject) => subject.id === requested) ?? subjects[0];

  if (!selected) {
    return (
      <PageShell as="main" width="wide">
        <PageHeader
          eyebrow="Content coverage"
          title="Previous-year papers"
          lede="No active subjects yet."
        />
      </PageShell>
    );
  }

  const coverage = await loadPastPaperCoverage(selected.id);

  return (
    <PageShell as="main" width="wide">
      <PageHeader
        eyebrow="Content coverage"
        title="Previous-year papers"
        lede={`${String(coverage.papersWithQuestions)} of ${String(coverage.totalPapers)} registered papers have questions against them — ${String(coverage.importedQuestions)} in total.`}
      />

      {subjects.length > 1 ? (
        <Card as="div" pad="flush" className="flex flex-wrap gap-2 p-3">
          <nav aria-label="Subject" className="flex flex-wrap gap-2">
            {subjects.map((subject) => (
              <Link
                key={subject.id}
                href={`/admin/past-papers?subjectId=${subject.id}`}
                aria-current={subject.id === selected.id ? "page" : undefined}
                className={[
                  "rounded-pill min-h-11 border px-4 text-sm font-semibold transition-colors",
                  subject.id === selected.id
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-line-strong text-text-soft hover:border-brand-300",
                ].join(" ")}
              >
                {subject.name}
              </Link>
            ))}
          </nav>
        </Card>
      ) : null}

      {coverage.years.length === 0 ? (
        <p className="text-text-soft text-sm">
          No sittings registered for {coverage.subjectName} yet. Run the seed to register 2001–2026.
        </p>
      ) : (
        <section aria-labelledby="years-heading" className="flex flex-col gap-4">
          <SectionHeading
            id="years-heading"
            eyebrow="Coverage by year"
            title={coverage.subjectName}
          />

          <Card pad="flush" className="overflow-hidden">
            <ul className="divide-line divide-y">
              {coverage.years.map((year) => (
                <YearRow key={year.year} year={year} subjectId={coverage.subjectId} />
              ))}
            </ul>
          </Card>
        </section>
      )}

      <Footnote coverage={coverage} />
    </PageShell>
  );
}

function YearRow({ year, subjectId }: { year: PastPaperYearCoverage; subjectId: string }) {
  const cancelled = year.held === 0;
  const fraction =
    year.printedQuestions === null || year.printedQuestions === 0
      ? null
      : Math.min(1, year.importedQuestions / year.printedQuestions);

  return (
    <li className="hover:bg-raised/60 flex items-center gap-4 px-5 py-4 transition-colors sm:px-6">
      <span className="text-text w-14 shrink-0 font-semibold tabular-nums">{year.year}</span>

      <div className="min-w-0 flex-1">
        {/*
          No bar at all when the denominator is unknown, rather than a bar at
          zero. "We hold 12 questions and don't know how many the paper had" is
          a different state from "we hold nothing", and a bar cannot show the
          difference — so the track is drawn and left empty.
        */}
        <Meter percent={fraction === null ? 0 : fraction * 100} size="slim" />

        <p className="text-text-soft mt-1 text-xs">
          {cancelled
            ? "Not held — no paper to source"
            : year.printedQuestions === null
              ? `${year.importedQuestions} question${year.importedQuestions === 1 ? "" : "s"} held · paper not counted yet`
              : `${year.importedQuestions} of ${year.printedQuestions} questions`}
          {year.papers > 1 ? ` · ${year.papers} papers` : null}
        </p>
      </div>

      {year.importedQuestions > 0 ? (
        <Link
          href={`/admin/questions?subjectId=${subjectId}`}
          className="text-brand-700 hover:text-brand-800 shrink-0 text-sm font-semibold hover:underline"
        >
          Open →
        </Link>
      ) : null}
    </li>
  );
}

function Footnote({ coverage }: { coverage: PastPaperCoverage }) {
  const uncounted = coverage.years.filter((year) => year.printedQuestions === null).length;

  return (
    <p className="border-line bg-raised text-text-faint rounded-panel border p-4 text-xs leading-relaxed sm:p-5">
      Papers are loaded from files with{" "}
      <code className="text-text-soft">pnpm --filter @samjho/api ingest:paper &lt;file&gt;</code> —
      see <code className="text-text-soft">content/past-papers/README.md</code>. Nothing on this
      page is generated: a question here came off a paper somebody had in front of them.
      {uncounted > 0
        ? ` ${String(uncounted)} year${uncounted === 1 ? " has" : "s have"} at least one paper nobody has counted yet, so ${uncounted === 1 ? "it shows" : "they show"} no percentage.`
        : null}
    </p>
  );
}
