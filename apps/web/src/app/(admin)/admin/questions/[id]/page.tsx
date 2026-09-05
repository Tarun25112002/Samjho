import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card } from "@/components/ui/surface";
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
    <PageShell as="main" width="wide">
      <PageHeader
        back={{ href: "/admin/questions", label: "Questions" }}
        eyebrow="Question bank"
        title="Edit question"
        lede={`${question.chapter.name} · version ${String(question.version)}${
          question.authorName ? ` · written by ${question.authorName}` : ""
        }`}
      />

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

      <Card aria-labelledby="revisions-heading">
        <SectionHeading id="revisions-heading" eyebrow="Activity log" title="What changed" />

        {revisions.length === 0 ? (
          <p className="text-text-soft mt-5 text-sm">Nothing has changed since it was written.</p>
        ) : (
          <ol className="divide-line mt-5 divide-y text-sm">
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
      </Card>
    </PageShell>
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
