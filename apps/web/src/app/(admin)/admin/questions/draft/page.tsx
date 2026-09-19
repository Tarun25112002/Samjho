import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader, PageShell } from "@/components/ui/page";
import { DraftWithAI } from "@/features/admin/draft-with-ai";
import { loadAdminChapters, loadAdminSubjects } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Draft questions" };

interface PageProps {
  searchParams: Promise<{ subjectId?: string }>;
}

/**
 * A page rather than a panel on the editor.
 *
 * Commissioning six questions and reading them is a different job from writing
 * one, and folding it into the single-question form would mean a form that is
 * sometimes about one question and sometimes about six. It also keeps the
 * editor free of any AI at all, which is the right default for the surface
 * where a person is typing a question by hand.
 */
export default async function DraftQuestionsPage({ searchParams }: PageProps) {
  const { subjectId } = await searchParams;

  const subjects = await loadAdminSubjects();
  const subject = subjects.find((row) => row.id === subjectId) ?? subjects[0];
  if (!subject) notFound();

  const chapters = await loadAdminChapters(subject.id);

  return (
    <PageShell as="main" width="wide">
      <PageHeader
        back={{ href: "/admin/questions", label: "Questions" }}
        eyebrow="Question bank"
        title={`Draft questions for ${subject.name}`}
        lede="Commission a small batch against a topic, read them, and keep the ones that are right."
      />

      {chapters.length === 0 ? (
        <p className="text-text-faint text-sm">
          {subject.name} has no chapters yet. The syllabus has to exist before there is a topic to
          write against.
        </p>
      ) : (
        <DraftWithAI subjectId={subject.id} chapters={chapters} />
      )}
    </PageShell>
  );
}
