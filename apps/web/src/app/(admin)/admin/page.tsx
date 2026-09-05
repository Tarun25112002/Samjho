import type { Metadata } from "next";
import Link from "next/link";

import { loadContentStats } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Content dashboard" };

/**
 * What to do next, in four numbers per subject.
 *
 * Not a chart. The bank is being written from zero for a commercial launch
 * (docs/07 R1), which means there are only three useful answers to "what now":
 * write more, decide the licensing on what exists, or fill the chapters holding
 * nothing. Each has a link straight into the filtered list, because a number you
 * cannot act on is decoration.
 */
export default async function AdminDashboardPage() {
  const stats = await loadContentStats();

  return (
    <main className="mx-auto flex w-full max-w-[90rem] flex-col gap-8 px-5 py-7 sm:px-8 sm:py-10 xl:px-10">
      <header className="border-line bg-card rounded-panel flex flex-wrap items-end justify-between gap-5 border p-6 sm:p-8">
        <div>
          <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
            Content operations
          </p>
          <h1 className="text-text mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Content dashboard
          </h1>
          <p className="text-text-soft mt-3 max-w-2xl text-sm leading-relaxed">
            See what is ready to serve, what needs review, and where the bank still has gaps.
          </p>
        </div>
        <div className="border-brand-200 bg-brand-50 rounded-control min-w-40 px-5 py-4 sm:text-right">
          <p className="text-text text-3xl font-semibold tracking-[-0.04em] tabular-nums">
            {stats.editedThisWeek}
          </p>
          <p className="text-brand-700 text-xs font-bold tracking-[0.08em] uppercase">
            updated this week
          </p>
        </div>
      </header>

      <section aria-labelledby="subjects-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
              Question coverage
            </p>
            <h2
              id="subjects-heading"
              className="text-text mt-1 text-xl font-semibold tracking-[-0.025em]"
            >
              By subject
            </h2>
          </div>
          <p className="text-text-faint text-sm">
            Open a subject to work from its complete question list.
          </p>
        </div>

        {stats.subjects.length === 0 ? (
          <div className="border-line bg-card rounded-panel border p-6 text-sm text-text-soft">
            No active subjects yet.
          </div>
        ) : (
          <ul className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {stats.subjects.map((subject) => (
              <li
                key={subject.subjectId}
                className="border-line bg-card rounded-panel flex min-h-72 flex-col border p-5 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-lift sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-text font-semibold tracking-[-0.02em]">{subject.name}</h3>
                    <p className="text-text-faint mt-1 text-sm">Class {subject.classLevel}</p>
                  </div>
                  <span className="bg-raised text-text-soft rounded-pill px-2.5 py-1 text-xs font-semibold tabular-nums">
                    {subject.total} total
                  </span>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-2">
                  <Stat
                    label="Published"
                    value={subject.byStatus.PUBLISHED ?? 0}
                    href={`/admin/questions?subjectId=${subject.subjectId}&status=PUBLISHED`}
                  />
                  <Stat
                    label="Drafts"
                    value={subject.byStatus.DRAFT ?? 0}
                    href={`/admin/questions?subjectId=${subject.subjectId}&status=DRAFT`}
                  />
                  <Stat
                    label="In review"
                    value={subject.byStatus.IN_REVIEW ?? 0}
                    href={`/admin/questions?subjectId=${subject.subjectId}&status=IN_REVIEW`}
                  />
                  <Stat
                    label="Licensing undecided"
                    value={subject.needsLicenceReview}
                    href={`/admin/questions?subjectId=${subject.subjectId}&licenceStatus=NEEDS_REVIEW`}
                  />
                </dl>

                {subject.chaptersWithNoQuestions > 0 ? (
                  <p className="text-text-soft mt-4 text-sm leading-relaxed">
                    {/*
                      The number that a total hides. 400 questions spread evenly is
                      a usable product; the same 400 in six chapters is not, because
                      the student practising next week's chapter finds it empty.
                    */}
                    {subject.chaptersWithNoQuestions} chapter
                    {subject.chaptersWithNoQuestions === 1 ? " has" : "s have"} no questions yet.
                  </p>
                ) : null}

                <Link
                  href={`/admin/questions?subjectId=${subject.subjectId}`}
                  className="text-brand-700 mt-auto inline-flex min-h-11 items-center pt-4 text-sm font-semibold hover:underline"
                >
                  Open question bank →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="licence-heading"
        className="border-line bg-card rounded-panel border p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
              Safety check
            </p>
            <h2 id="licence-heading" className="text-text mt-1 font-semibold tracking-[-0.02em]">
              Licensing across the bank
            </h2>
          </div>
          <p className="text-text-faint text-xs">
            Publication stays blocked until the source is reviewed.
          </p>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(stats.byLicenceStatus).map(([status, count]) => (
            <div key={status} className="bg-raised rounded-control px-4 py-3">
              <dt className="text-text-soft text-xs font-medium capitalize">
                {status.replace(/_/g, " ").toLowerCase()}
              </dt>
              <dd className="text-text mt-1 text-xl font-semibold tracking-[-0.025em] tabular-nums">
                {count}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <div className="bg-raised rounded-control px-3 py-2.5">
      <dt className="text-text-soft text-xs font-medium">{label}</dt>
      <dd className="text-text mt-1 text-lg font-semibold tracking-[-0.02em] tabular-nums">
        <Link href={href} className="hover:text-brand-700 hover:underline">
          {value}
        </Link>
      </dd>
    </div>
  );
}
