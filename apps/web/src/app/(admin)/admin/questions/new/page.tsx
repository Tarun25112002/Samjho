import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader, PageShell } from "@/components/ui/page";
import { QuestionEditor } from "@/features/admin/question-editor";
import { emptyDraft } from "@/features/admin/use-question-editor";
import { loadAdminChapters, loadAdminSubjects } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New question" };

interface PageProps {
  searchParams: Promise<{ subjectId?: string; chapterId?: string }>;
}

export default async function NewQuestionPage({ searchParams }: PageProps) {
  const { subjectId, chapterId } = await searchParams;

  const subjects = await loadAdminSubjects();
  const subject = subjects.find((row) => row.id === subjectId) ?? subjects[0];
  if (!subject) notFound();

  const chapters = await loadAdminChapters(subject.id);
  const chapter = chapters.find((row) => row.id === chapterId) ?? chapters[0];

  if (!chapter) {
    return (
      <PageShell as="main" width="wide">
        <PageHeader
          back={{ href: "/admin", label: "Dashboard" }}
          eyebrow="Question bank"
          title={`${subject.name} has no chapters yet`}
          lede="A question belongs to a chapter, so the syllabus has to exist first."
        />
      </PageShell>
    );
  }

  // The primary topic is pre-selected rather than left blank: at least one is
  // required, and a chapter's first topic is right often enough that defaulting
  // it saves a click on every question and costs a correction on some.
  const defaults = {
    chapterId: chapter.id,
    topicIds: chapter.topics[0] ? [chapter.topics[0].id] : [],
  };

  return (
    <PageShell as="main" width="wide">
      <PageHeader
        back={{ href: "/admin/questions", label: "Questions" }}
        eyebrow="Question bank"
        title="Create a question"
        lede={`${subject.name}. Saves as a draft — publishing is a separate step.`}
      />

      <QuestionEditor chapters={chapters} defaults={defaults} initial={emptyDraft(defaults)} />
    </PageShell>
  );
}
