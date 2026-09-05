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
      <main className="mx-auto w-full max-w-[90rem] px-5 py-7 sm:px-8 sm:py-10 xl:px-10">
        <h1 className="text-text text-2xl font-semibold tracking-tight">
          {subject.name} has no chapters yet
        </h1>
        <p className="text-text-soft mt-2 text-sm">
          A question belongs to a chapter, so the syllabus has to exist first.
        </p>
        <Link href="/admin" className="text-text mt-4 inline-block underline">
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
    <main className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-5 py-7 sm:px-8 sm:py-10 xl:px-10">
      <header className="border-line bg-card rounded-panel space-y-2 border p-6 sm:p-8">
        <Link href="/admin/questions" className="text-text-soft hover:text-text text-sm">
          ← Questions
        </Link>
        <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
          Question bank
        </p>
        <h1 className="text-text text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
          Create a question
        </h1>
        <p className="text-text-soft text-sm leading-relaxed">
          {subject.name}. Saves as a draft — publishing is a separate step.
        </p>
      </header>

      <QuestionEditor chapters={chapters} defaults={defaults} initial={emptyDraft(defaults)} />
    </main>
  );
}
