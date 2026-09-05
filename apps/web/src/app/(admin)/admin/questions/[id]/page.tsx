import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QuestionEditor } from "@/features/admin/question-editor";
import { StatusControls } from "@/features/admin/status-controls";
import { draftFromQuestion } from "@/features/admin/use-question-editor";
import { ApiClientError } from "@/lib/api-client";
import { loadAdminChapters, loadAdminQuestion, loadQuestionRevisions } from "@/lib/admin";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const question = await loadAdminQuestion(id);
    return { title: `${question.body.slice(0, 40)}…` };
  } catch {
    return { title: "Question" };
  }
}

/**
 * One question: edit it, move it through its lifecycle, read what was changed.
 *
 * The revision log is on the same page as the editor rather than behind a tab,
 * because the moment somebody needs it is the moment they are about to change
 * something — "a student says the answer is wrong, what did we do to this in
 * March" is one question, not two.
 */
export default async function AdminQuestionPage({ params }: PageProps) {
  const { id } = await params;

  const question = await loadQuestionOr404(id);
  const [chapters, revisions] = await Promise.all([
    loadAdminChapters(question.subjectId),
    loadQuestionRevisions(question.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-5 py-7 sm:px-8 sm:py-10 xl:px-10">
      <header className="border-line bg-card rounded-panel space-y-2 border p-6 sm:p-8">
        <Link href="/admin/questions" className="text-text-soft hover:text-text text-sm">
          ← Questions
        </Link>
        <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
          Question bank
        </p>
        <h1 className="text-text text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
          Edit question
        </h1>
        <p className="text-text-soft text-sm leading-relaxed">
          {question.chapter.name} · version {question.version}
          {question.authorName ? ` · written by ${question.authorName}` : ""}
        </p>
      </header>

      <StatusControls question={question} />

      <QuestionEditor
        chapters={chapters}
        defaults={{
          chapterId: question.chapter.id,
          topicIds: question.topics.map((topic) => topic.id),
        }}
        initial={draftFromQuestion(question)}
        question={question}
      />

      <section
        aria-labelledby="revisions-heading"
        className="border-line bg-card rounded-panel space-y-4 border p-5 sm:p-6"
      >
        <div>
          <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
            Activity log
          </p>
          <h2 id="revisions-heading" className="text-text mt-1 font-semibold tracking-[-0.02em]">
            What changed
          </h2>
        </div>

        {revisions.length === 0 ? (
          <p className="text-text-soft text-sm">Nothing has changed since it was written.</p>
        ) : (
          <ol className="divide-line divide-y text-sm">
            {revisions.map((revision) => (
              <li key={revision.id} className="space-y-1 py-3">
                <p className="text-text-soft text-xs">
                  {new Date(revision.createdAt).toLocaleString()}
                  {revision.editedByName ? ` · ${revision.editedByName}` : ""}
                  {revision.reason ? ` · ${revision.reason}` : ""}
                </p>
                <ul className="text-text space-y-0.5">
                  {revision.changes.map((change) => (
                    <li key={change.field}>
                      <span className="text-text-soft">{change.field}:</span>{" "}
                      <span className="line-clamp-1">
                        {change.from ?? "—"} → {change.to ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

async function loadQuestionOr404(id: string) {
  try {
    return await loadAdminQuestion(id);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }
}
