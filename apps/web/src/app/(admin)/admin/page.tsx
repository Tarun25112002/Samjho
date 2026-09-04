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
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-text text-2xl font-semibold tracking-tight">Content</h1>
        <p className="text-text-soft text-sm">
          {stats.editedThisWeek} question{stats.editedThisWeek === 1 ? "" : "s"} touched in the last
          seven days.
        </p>
      </header>

      <section aria-labelledby="subjects-heading" className="space-y-4">
        <h2 id="subjects-heading" className="text-text text-sm font-semibold">
          By subject
        </h2>

        {stats.subjects.length === 0 ? (
          <p className="text-text-soft text-sm">No active subjects yet.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {stats.subjects.map((subject) => (
              <li key={subject.subjectId} className="border-line space-y-3 rounded-xl border p-4">
                <div>
                  <h3 className="text-text font-medium">{subject.name}</h3>
                  <p className="text-text-soft text-xs">Class {subject.classLevel}</p>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
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
                  <p className="text-text-soft text-xs">
                    {/*
                      The number that a total hides. 400 questions spread evenly is
                      a usable product; the same 400 in six chapters is not, because
                      the student practising next week's chapter finds it empty.
                    */}
                    {subject.chaptersWithNoQuestions} chapter
                    {subject.chaptersWithNoQuestions === 1 ? " has" : "s have"} nothing in{" "}
                    {subject.chaptersWithNoQuestions === 1 ? "it" : "them"} yet.
                  </p>
                ) : null}

                <Link
                  href={`/admin/questions?subjectId=${subject.subjectId}`}
                  className="text-text-soft hover:text-text inline-block text-sm"
                >
                  Open {subject.total} question{subject.total === 1 ? "" : "s"} →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="licence-heading" className="space-y-3">
        <h2 id="licence-heading" className="text-text text-sm font-semibold">
          Licensing across the whole bank
        </h2>
        <dl className="flex flex-wrap gap-6 text-sm">
          {Object.entries(stats.byLicenceStatus).map(([status, count]) => (
            <div key={status}>
              <dt className="text-text-soft text-xs">{status.replace(/_/g, " ").toLowerCase()}</dt>
              <dd className="text-text font-medium">{count}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <>
      <dt className="text-text-soft">{label}</dt>
      <dd className="text-right font-medium">
        <Link href={href} className="text-text hover:underline">
          {value}
        </Link>
      </dd>
    </>
  );
}
