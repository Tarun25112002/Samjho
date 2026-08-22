import { DataState, QUESTION_TYPE_LABELS, QuestionRenderer } from "@samjho/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiClientError } from "@/lib/api-client";
import { loadChapter, loadQuestions } from "@/lib/catalog";
import { requireOnboarded } from "@/lib/me";
import { practiceHref } from "@/lib/practice-format";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const chapter = await loadChapter(id);
    return { title: chapter.name };
  } catch {
    return { title: "Chapter" };
  }
}

/**
 * One chapter: its topics, what it contains, and the questions themselves.
 *
 * The question list is rendered with the same `QuestionRenderer` the practice
 * runner and the exam will use — read-only here, because no `onChange` is
 * passed. That is the payoff for building the renderer before any of its
 * consumers: this page needed no question markup of its own, and it is
 * physically incapable of drifting from how a question looks in an exam.
 */
export default async function ChapterPage({ params }: PageProps) {
  const { id } = await params;
  await requireOnboarded();

  const chapter = await loadChapterOr404(id);
  const questions = await loadQuestions({ chapterId: chapter.id, limit: 20 });

  const typesPresent = chapter.counts.byType.filter((row) => row.count > 0);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <Link
          href={`/subjects/${chapter.subject.slug}`}
          className="text-ink-500 hover:text-ink-900 dark:hover:text-ink-50 text-sm"
        >
          ← {chapter.subject.name}
        </Link>

        <h1 className="text-ink-900 dark:text-ink-50 text-2xl font-semibold tracking-tight">
          {chapter.name}
        </h1>

        <p className="text-ink-500 dark:text-ink-300 text-sm">
          {chapter.domain ? `${chapter.domain} · ` : ""}
          {chapter.counts.total} questions
        </p>

        {/*
          The primary action on a chapter page is to practise it, not to read it
          (docs/01 §2). A plain link, because `/practice/new` is deep-linkable —
          the filters travel in the query string and the student can adjust them
          before starting.
        */}
        {chapter.counts.total > 0 ? (
          <p className="pt-2">
            <Link
              href={practiceHref({ unseenOnly: false, chapterId: chapter.id })}
              className="bg-brand-600 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white"
            >
              Practise this chapter
            </Link>
          </p>
        ) : null}
      </header>

      <section aria-labelledby="topics-heading" className="space-y-3">
        <h2 id="topics-heading" className="text-ink-700 dark:text-ink-100 text-sm font-semibold">
          Topics
        </h2>
        <ul className="flex flex-wrap gap-2">
          {chapter.topics.map((topic) => (
            <li
              key={topic.id}
              className="border-ink-100 dark:border-ink-700 rounded-full border px-3 py-1 text-sm"
            >
              <span className="text-ink-900 dark:text-ink-50">{topic.name}</span>{" "}
              <span className="text-ink-500 dark:text-ink-300">{topic.questionCount}</span>
            </li>
          ))}
        </ul>
        {/*
          Topic counts sum to more than the chapter total, because a question
          tagged with three topics counts in all three. Said out loud, because
          otherwise the numbers look like a bug.
        */}
        <p className="text-ink-500 dark:text-ink-300 text-xs">
          A question can belong to more than one topic, so these add up to more than the chapter
          total.
        </p>
      </section>

      <section aria-labelledby="breakdown-heading" className="space-y-3">
        <h2 id="breakdown-heading" className="text-ink-700 dark:text-ink-100 text-sm font-semibold">
          What&rsquo;s in this chapter
        </h2>

        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {typesPresent.map((row) => (
            <div
              key={row.type}
              className="border-ink-100 dark:border-ink-700 rounded-lg border px-3 py-2"
            >
              <dt className="text-ink-500 dark:text-ink-300 text-xs">
                {QUESTION_TYPE_LABELS[row.type]}
              </dt>
              <dd className="text-ink-900 dark:text-ink-50 font-medium">{row.count}</dd>
            </div>
          ))}
        </dl>

        <div className="text-ink-500 dark:text-ink-300 flex gap-4 text-sm">
          {chapter.counts.byDifficulty.map((row) => (
            <span key={row.difficulty}>
              {row.difficulty[0]}
              {row.difficulty.slice(1).toLowerCase()}: {row.count}
            </span>
          ))}
        </div>
      </section>

      <section aria-labelledby="questions-heading" className="space-y-6">
        <h2 id="questions-heading" className="text-ink-700 dark:text-ink-100 text-sm font-semibold">
          Questions
        </h2>

        {/*
          The data is already resolved by the time this renders, so only the
          empty branch can fire here — a failure threw upstream and a Server
          Component has nothing to be "loading". Using the wrapper anyway is the
          point of it existing: the empty copy for a chapter reads the same
          wherever a chapter's questions are listed, including in the practice
          picker and the admin preview later.
        */}
        <DataState
          data={questions.items}
          emptyTitle="No questions here yet"
          emptyBody="Samjho's question bank is being written from scratch, chapter by chapter. This one has not been filled in."
          emptyAction={
            <Link href={`/subjects/${chapter.subject.slug}`} className="underline">
              Browse other chapters
            </Link>
          }
        >
          {(items) => (
            <ol className="flex flex-col gap-8">
              {items.map((question, index) => (
                <li
                  key={question.id}
                  className="border-ink-100 dark:border-ink-700 rounded-xl border p-5"
                >
                  {/*
                    No `onChange`, so every control renders disabled. Browsing is
                    reading; answering happens in the practice runner, which
                    passes the same component an `onChange` and gets inputs.
                  */}
                  <QuestionRenderer question={question} displayNumber={String(index + 1)} />
                </li>
              ))}
            </ol>
          )}
        </DataState>

        {questions.pageInfo.hasMore ? (
          <p className="text-ink-500 dark:text-ink-300 text-sm">
            Showing the first {questions.items.length}.{" "}
            <Link href={practiceHref({ unseenOnly: false, chapterId: chapter.id })}>
              Practise the chapter
            </Link>{" "}
            to work through the rest.
          </p>
        ) : null}
      </section>
    </main>
  );
}

async function loadChapterOr404(id: string) {
  try {
    return await loadChapter(id);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }
}
