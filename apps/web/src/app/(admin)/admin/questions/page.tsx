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
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-text text-2xl font-semibold tracking-tight">Questions</h1>
          <p className="text-text-soft text-sm">
            Drafts included — this is the whole bank, not the student&rsquo;s view.
          </p>
        </div>

        <Link
          href={`/admin/questions/new${subjectId ? `?subjectId=${subjectId}` : ""}`}
          className="bg-brand-500 flex min-h-11 items-center rounded-lg px-5 text-sm font-medium text-white"
        >
          New question
        </Link>
      </header>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="space-y-1.5 text-sm">
          <span className="text-text block font-medium">Subject</span>
          <select
            name="subjectId"
            defaultValue={subjectId}
            className="border-line-strong rounded-lg border bg-transparent px-3 py-2 text-sm"
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
            className="border-line-strong rounded-lg border bg-transparent px-3 py-2 text-sm"
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
            placeholder="Text in the question"
            className="border-line-strong rounded-lg border bg-transparent px-3 py-2 text-sm"
          />
        </label>

        <button
          type="submit"
          className="border-line-strong min-h-11 rounded-lg border px-4 text-sm"
        >
          Filter
        </button>
      </form>

      <DataState
        data={questions.items}
        emptyTitle="Nothing matches that yet"
        emptyBody="Either the filters are too narrow, or this part of the bank has not been written."
        emptyAction={
          <Link
            href={`/admin/questions/new${subjectId ? `?subjectId=${subjectId}` : ""}`}
            className="text-text underline"
          >
            Write the first one
          </Link>
        }
      >
        {(items) => (
          <ul className="divide-line divide-y">
            {items.map((question) => (
              <li key={question.id} className="py-4">
                <Link href={`/admin/questions/${question.id}`} className="group block space-y-1.5">
                  <div className="text-text-soft flex flex-wrap items-center gap-2 text-xs">
                    <StatusChip status={question.status} />
                    <span>{QUESTION_TYPE_LABELS[question.type]}</span>
                    <span>·</span>
                    <span>
                      {question.marks} mark{question.marks === 1 ? "" : "s"}
                    </span>
                    <span>·</span>
                    <span>{question.chapter.name}</span>
                    {question.isContainer ? <span>· {question.subPartCount} parts</span> : null}
                    {question.licenceStatus === "NEEDS_REVIEW" ? (
                      <span className="text-marker-700">· licensing undecided</span>
                    ) : null}
                  </div>

                  <div className="text-text line-clamp-2 text-sm group-hover:underline">
                    <MathText>{question.body}</MathText>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DataState>

      {questions.pageInfo.hasMore ? (
        <p className="text-text-soft text-sm">
          More questions match than are shown. Narrow the filters to find a specific one.
        </p>
      ) : null}
    </main>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className="border-line rounded-full border px-2 py-0.5">
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
