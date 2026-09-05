import { DataState, MathText, QUESTION_TYPE_LABELS } from "@samjho/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { loadAdminQuestions, loadAdminSubjects } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Questions" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The editor's work queue.
 *
 * Filters live in the URL rather than in component state, which is what makes
 * the dashboard's links work: "licensing undecided in Science" is a link someone
 * can send to a colleague, bookmark, or come back to after lunch. State inside
 * the component would make every one of those a fresh set of clicks.
 *
 * Rows carry the full question body rather than a truncated excerpt, clamped
 * with CSS. Cutting Markdown-with-LaTeX at a character count splits `$\dfrac{n}`
 * in half and the row renders as garbage; CSS can only ever hide whole lines.
 */
export default async function AdminQuestionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const first = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const subjects = await loadAdminSubjects();
  const subjectId = first("subjectId") ?? subjects[0]?.id;

  const questions = await loadAdminQuestions({
    ...(subjectId ? { subjectId } : {}),
    ...(first("status") ? { status: first("status")?.split(",") as never } : {}),
    ...(first("licenceStatus")
      ? { licenceStatus: first("licenceStatus")?.split(",") as never }
      : {}),
    ...(first("search") ? { search: first("search") } : {}),
    limit: 25,
  });

  return (
    <main className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-5 py-7 sm:px-8 sm:py-10 xl:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
            Content operations
          </p>
          <h1 className="text-text mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Question bank
          </h1>
          <p className="text-text-soft mt-2 text-sm leading-relaxed">
            Drafts included — this is the complete working bank, not the student view.
          </p>
        </div>

        <Link
          href={`/admin/questions/new${subjectId ? `?subjectId=${subjectId}` : ""}`}
          className="bg-brand-500 text-on-brand shadow-brand inline-flex min-h-11 items-center rounded-pill px-5 text-sm font-semibold transition-colors hover:bg-brand-400"
        >
          New question
        </Link>
      </header>

      <form
        className="border-line bg-card rounded-panel flex flex-wrap items-end gap-4 border p-4 sm:p-5"
        method="get"
      >
        <label className="space-y-1.5 text-sm">
          <span className="text-text block font-medium">Subject</span>
          <select
            name="subjectId"
            defaultValue={subjectId}
            className="border-line-strong bg-card text-text min-h-11 rounded-control border px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="text-text block font-medium">Status</span>
          <select
            name="status"
            defaultValue={first("status") ?? ""}
            className="border-line-strong bg-card text-text min-h-11 rounded-control border px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">Any</option>
            <option value="DRAFT">Draft</option>
            <option value="IN_REVIEW">In review</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Withdrawn</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="text-text block font-medium">Search</span>
          <input
            name="search"
            defaultValue={first("search") ?? ""}
            placeholder="Search question text"
            className="border-line-strong bg-card text-text min-h-11 min-w-56 rounded-control border px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <button
          type="submit"
          className="border-line-strong text-text min-h-11 rounded-pill border px-5 text-sm font-semibold transition-colors hover:border-brand-500 hover:bg-brand-50"
        >
          Filter
        </button>
      </form>

      <section className="border-line bg-card rounded-panel overflow-hidden border">
        <DataState
          className="p-6"
          data={questions.items}
          emptyTitle="Nothing matches these filters"
          emptyBody="Try a broader search, or add the first question to this part of the bank."
          emptyAction={
            <Link
              href={`/admin/questions/new${subjectId ? `?subjectId=${subjectId}` : ""}`}
              className="text-brand-700 font-semibold underline"
            >
              Create a question
            </Link>
          }
        >
          {(items) => (
            <ul className="divide-line divide-y">
              {items.map((question) => (
                <li key={question.id}>
                  <Link
                    href={`/admin/questions/${question.id}`}
                    className="group block space-y-2 px-5 py-4 transition-colors hover:bg-raised/65 sm:px-6"
                  >
                    <div className="text-text-soft flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
                      <StatusChip status={question.status} />
                      <span>{QUESTION_TYPE_LABELS[question.type]}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {question.marks} mark{question.marks === 1 ? "" : "s"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{question.chapter.name}</span>
                      {question.isContainer ? <span>· {question.subPartCount} parts</span> : null}
                      {question.licenceStatus === "NEEDS_REVIEW" ? (
                        <span className="text-marker-700">· licensing undecided</span>
                      ) : null}
                    </div>

                    <div className="text-text line-clamp-2 max-w-4xl text-sm leading-relaxed group-hover:underline">
                      <MathText>{question.body}</MathText>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </section>

      {questions.pageInfo.hasMore ? (
        <p className="text-text-soft text-sm">
          More questions match than are shown. Narrow the filters to find a specific one.
        </p>
      ) : null}
    </main>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone =
    {
      DRAFT: "bg-raised text-text-soft",
      IN_REVIEW: "bg-half-50 text-half-700",
      PUBLISHED: "bg-tick-50 text-tick-700",
      ARCHIVED: "bg-marker-50 text-marker-700",
    }[status] ?? "bg-raised text-text-soft";

  return (
    <span className={`rounded-pill px-2.5 py-1 font-semibold ${tone}`}>
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
