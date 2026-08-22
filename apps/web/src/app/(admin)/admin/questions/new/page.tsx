import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

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
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-ink-900 dark:text-ink-50 text-2xl font-semibold tracking-tight">
          {subject.name} has no chapters yet
        </h1>
        <p className="text-ink-500 dark:text-ink-300 mt-2 text-sm">
          A question belongs to a chapter, so the syllabus has to exist first.
        </p>
        <Link href="/admin" className="text-ink-900 dark:text-ink-50 mt-4 inline-block underline">
          Back to the dashboard
        </Link>
      </main>
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
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-1">
        <Link href="/admin/questions" className="text-ink-500 hover:text-ink-900 text-sm">
          ← Questions
        </Link>
        <h1 className="text-ink-900 dark:text-ink-50 text-2xl font-semibold tracking-tight">
          New question
        </h1>
        <p className="text-ink-500 dark:text-ink-300 text-sm">
          {subject.name}. Saves as a draft — publishing is a separate step.
        </p>
      </header>

      <QuestionEditor chapters={chapters} defaults={defaults} initial={emptyDraft(defaults)} />
    </main>
  );
}
