import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, Chip } from "@/components/ui/surface";
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
    <PageShell as="main" width="wide">
      <PageHeader
        eyebrow="Content operations"
        title="Content dashboard"
        lede="See what is ready to serve, what needs review, and where the bank still has gaps."
        action={
          <dl className="border-brand-200 bg-brand-50 rounded-control min-w-40 px-5 py-4 sm:text-right">
            <dd className="text-text text-figure tabular-nums">{stats.editedThisWeek}</dd>
            <dt className="text-brand-700 text-eyebrow mt-1 uppercase">updated this week</dt>
          </dl>
        }
      />

      <section aria-labelledby="subjects-heading" className="flex flex-col gap-4">
        <SectionHeading
          id="subjects-heading"
          eyebrow="Question coverage"
          title="By subject"
          action={
            <p className="text-text-faint text-sm">
              Open a subject to work from its complete question list.
            </p>
          }
        />

        {stats.subjects.length === 0 ? (
          <Card pad="roomy">
            <p className="text-text-soft text-sm">No active subjects yet.</p>
          </Card>
        ) : (
          <ul className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {stats.subjects.map((subject) => (
              <Card
                as="li"
                key={subject.subjectId}
                className="hover:border-line-strong hover:shadow-lift flex min-h-72 flex-col transition-[border-color,box-shadow]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-text text-subheading">{subject.name}</h3>
                    <p className="text-text-faint mt-1 text-sm">Class {subject.classLevel}</p>
                  </div>
                  <Chip className="tabular-nums">{subject.total} total</Chip>
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
              </Card>
            ))}
          </ul>
        )}
      </section>

      <Card aria-labelledby="licence-heading">
        <SectionHeading
          id="licence-heading"
          eyebrow="Safety check"
          title="Licensing across the bank"
          action={
            <p className="text-text-faint text-xs">
              Publication stays blocked until the source is reviewed.
            </p>
          }
        />
        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(stats.byLicenceStatus).map(([status, count]) => (
            <div key={status} className="bg-raised rounded-control px-4 py-3">
              <dt className="text-text-soft text-xs font-medium capitalize">
                {status.replace(/_/g, " ").toLowerCase()}
              </dt>
              <dd className="text-text mt-1 text-lg font-semibold tabular-nums">{count}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </PageShell>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <div className="bg-raised rounded-control px-3 py-2.5">
      <dt className="text-text-soft text-xs font-medium">{label}</dt>
      <dd className="text-text mt-1 text-lg font-semibold tabular-nums">
        <Link href={href} className="hover:text-brand-700 hover:underline">
          {value}
        </Link>
      </dd>
    </div>
  );
}
