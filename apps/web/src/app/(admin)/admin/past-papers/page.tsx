import type { PastPaperCoverage, PastPaperYearCoverage } from "@samjho/contracts";
import type { Metadata } from "next";
import Link from "next/link";

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
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-text text-2xl font-semibold tracking-tight">Previous-year papers</h1>
        <p className="text-text-soft mt-2 text-sm">No active subjects yet.</p>
      </main>
    );
  }

  const coverage = await loadPastPaperCoverage(selected.id);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-text text-2xl font-semibold tracking-tight">Previous-year papers</h1>
        <p className="text-text-soft text-sm">
          {coverage.papersWithQuestions} of {coverage.totalPapers} registered papers have questions
          against them — {coverage.importedQuestions} in total.
        </p>
      </header>

      {subjects.length > 1 ? (
        <nav aria-label="Subject" className="flex flex-wrap gap-2">
          {subjects.map((subject) => (
            <Link
              key={subject.id}
              href={`/admin/past-papers?subjectId=${subject.id}`}
              aria-current={subject.id === selected.id ? "page" : undefined}
              className={[
                "rounded-pill border px-3.5 py-2 text-sm font-medium transition-colors",
                subject.id === selected.id
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-line-strong text-text-soft hover:border-brand-300",
              ].join(" ")}
            >
              {subject.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {coverage.years.length === 0 ? (
        <p className="text-text-soft text-sm">
          No sittings registered for {coverage.subjectName} yet. Run the seed to register 2001–2026.
        </p>
      ) : (
        <section aria-labelledby="years-heading" className="space-y-3">
          <h2 id="years-heading" className="text-text text-sm font-semibold">
            By year
          </h2>

          <ul className="border-line divide-line divide-y rounded-xl border">
            {coverage.years.map((year) => (
              <YearRow key={year.year} year={year} subjectId={coverage.subjectId} />
            ))}
          </ul>
        </section>
      )}

      <Footnote coverage={coverage} />
    </main>
  );
}

function YearRow({ year, subjectId }: { year: PastPaperYearCoverage; subjectId: string }) {
  const cancelled = year.held === 0;
  const fraction =
    year.printedQuestions === null || year.printedQuestions === 0
      ? null
      : Math.min(1, year.importedQuestions / year.printedQuestions);

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <span className="text-text w-14 shrink-0 font-medium tabular-nums">{year.year}</span>

      <div className="min-w-0 flex-1">
        <div className="bg-raised h-1.5 w-full overflow-hidden rounded-full">
          {/*
            No bar at all when the denominator is unknown, rather than a bar at
            zero. "We hold 12 questions and don't know how many the paper had"
            is a different state from "we hold nothing", and a bar cannot show
            the difference.
          */}
          {fraction === null ? null : (
            <div
              className="bg-brand-500 h-full rounded-full"
              style={{ width: `${String(Math.round(fraction * 100))}%` }}
            />
          )}
        </div>

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
          className="text-text-soft hover:text-text shrink-0 text-sm"
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
    <p className="text-text-faint text-xs leading-relaxed">
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
