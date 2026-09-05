import { DataState, MathText, QUESTION_TYPE_LABELS } from "@samjho/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { inputClass, selectClass } from "@/components/ui/form";
import { PageHeader, PageShell } from "@/components/ui/page";
import { Card, Chip } from "@/components/ui/surface";
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
    <PageShell as="main" width="wide">
      <PageHeader
        eyebrow="Content operations"
        title="Question bank"
        lede="Drafts included — this is the complete working bank, not the student view."
        action={
          <ButtonLink href={`/admin/questions/new${subjectId ? `?subjectId=${subjectId}` : ""}`}>
            New question
          </ButtonLink>
        }
      />

      <Card
        as="div"
        pad="flush"
        className="grid gap-4 p-4 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end sm:p-5"
      >
        <form className="contents" method="get">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text font-medium">Subject</span>
            <select name="subjectId" defaultValue={subjectId} className={selectClass}>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text font-medium">Status</span>
            <select name="status" defaultValue={first("status") ?? ""} className={selectClass}>
              <option value="">Any</option>
              <option value="DRAFT">Draft</option>
              <option value="IN_REVIEW">In review</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Withdrawn</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text font-medium">Search</span>
            <input
              name="search"
              defaultValue={first("search") ?? ""}
              placeholder="Search question text"
              className={inputClass}
            />
          </label>

          <button
            type="submit"
            className="border-line-strong text-text hover:border-brand-500 hover:bg-brand-50 rounded-pill min-h-11 border px-5 text-sm font-semibold transition-colors"
          >
            Filter
          </button>
        </form>
      </Card>

      <Card pad="flush" className="overflow-hidden">
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
                    className="hover:bg-raised/65 group block space-y-2 px-5 py-4 transition-colors sm:px-6"
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
      </Card>

      {questions.pageInfo.hasMore ? (
        <p className="text-text-soft text-sm">
          More questions match than are shown. Narrow the filters to find a specific one.
        </p>
      ) : null}
    </PageShell>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone =
    (
      {
        DRAFT: "neutral",
        IN_REVIEW: "partial",
        PUBLISHED: "correct",
        ARCHIVED: "wrong",
      } as const
    )[status] ?? "neutral";

  return <Chip tone={tone}>{status.replace(/_/g, " ").toLowerCase()}</Chip>;
}
