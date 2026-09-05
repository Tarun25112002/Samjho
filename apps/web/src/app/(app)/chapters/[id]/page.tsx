import { DataState, QUESTION_TYPE_LABELS, QuestionRenderer } from "@samjho/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, Chip } from "@/components/ui/surface";
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
 *
 * The primary action is to practise the chapter, not to read it (docs/01 §2), so
 * the button is in the header and the browsable list is below the fold.
 */
export default async function ChapterPage({ params }: PageProps) {
  const { id } = await params;
  await requireOnboarded();

  const chapter = await loadChapterOr404(id);
  const questions = await loadQuestions({ chapterId: chapter.id, limit: 20 });

  const typesPresent = chapter.counts.byType.filter((row) => row.count > 0);

  return (
    <PageShell>
      <PageHeader
        back={{ href: `/subjects/${chapter.subject.slug}`, label: chapter.subject.name }}
        eyebrow={chapter.domain ?? "Chapter guide"}
        title={chapter.name}
        lede={`${String(chapter.counts.total)} ${chapter.counts.total === 1 ? "question" : "questions"} ready to practise`}
        action={
          /*
            A plain link, because `/practice/new` is deep-linkable — the filters
            travel in the query string and the student can adjust them before
            starting.
          */
          chapter.counts.total > 0 ? (
            <ButtonLink href={practiceHref({ unseenOnly: false, chapterId: chapter.id })}>
              Practise this chapter
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <Card aria-labelledby="topics-heading">
          <SectionHeading
            id="topics-heading"
            eyebrow="Chapter content"
            title="Topics to work through"
          />

          {chapter.topics.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-2">
              {chapter.topics.map((topic) => (
                <li
                  key={topic.id}
                  className="border-line bg-raised/60 rounded-pill flex min-h-9 items-center gap-2 border px-3.5 py-1.5 text-sm"
                >
                  <span className="text-text">{topic.name}</span>
                  <span className="text-text-faint tabular-nums">{topic.questionCount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-soft mt-5 text-sm">
              Topic labels are not available for this chapter yet.
            </p>
          )}

          {/*
            Topic counts sum to more than the chapter total, because a question
            tagged with three topics counts in all three. Said out loud, because
            otherwise the numbers look like a bug.
          */}
          {chapter.topics.length > 0 ? (
            <p className="text-text-faint mt-4 text-xs leading-relaxed">
              A question can belong to more than one topic, so these counts may add up to more than
              the chapter total.
            </p>
          ) : null}
        </Card>

        <Card aria-labelledby="breakdown-heading">
          <SectionHeading id="breakdown-heading" eyebrow="Question mix" title="At a glance" />

          {typesPresent.length > 0 ? (
            <dl className="mt-5 grid grid-cols-2 gap-3">
              {typesPresent.map((row) => (
                <div key={row.type} className="bg-raised rounded-control p-3.5">
                  <dd className="text-text text-lg font-semibold tabular-nums">{row.count}</dd>
                  <dt className="text-text-soft mt-0.5 text-xs">
                    {QUESTION_TYPE_LABELS[row.type]}
                  </dt>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-text-soft mt-5 text-sm">
              Question types will appear as the chapter is populated.
            </p>
          )}

          {chapter.counts.byDifficulty.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {chapter.counts.byDifficulty.map((row) => (
                <li key={row.difficulty}>
                  <Chip>
                    {row.difficulty[0]}
                    {row.difficulty.slice(1).toLowerCase()}: {row.count}
                  </Chip>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>

      <section aria-labelledby="questions-heading" className="flex flex-col gap-4">
        <SectionHeading
          id="questions-heading"
          eyebrow="Question preview"
          title="Explore this chapter"
          lede="Preview the first few questions here, then start a set when you are ready to answer."
        />

        {/*
          The data is already resolved by the time this renders, so only the
          empty branch can fire here — a failure threw upstream and a Server
          Component has nothing to be "loading". Using the wrapper anyway is the
          point of it existing: the empty copy for a chapter reads the same
          wherever a chapter's questions are listed, including in the practice
          picker and the admin preview.
        */}
        <DataState
          data={questions.items}
          emptyTitle="No questions here yet"
          emptyBody="Samjho's question bank is being written from scratch, chapter by chapter. This one has not been filled in."
          emptyAction={
            <Link
              href={`/subjects/${chapter.subject.slug}`}
              className="text-brand-700 font-medium underline"
            >
              Browse other chapters
            </Link>
          }
        >
          {(items) => (
            <ol className="flex flex-col gap-4">
              {items.map((question, index) => (
                <Card as="li" key={question.id}>
                  {/*
                    No `onChange`, so every control renders disabled. Browsing is
                    reading; answering happens in the practice runner, which
                    passes the same component an `onChange` and gets inputs.
                  */}
                  <QuestionRenderer question={question} displayNumber={String(index + 1)} />
                </Card>
              ))}
            </ol>
          )}
        </DataState>

        {questions.pageInfo.hasMore ? (
          <p className="text-text-soft text-sm">
            Showing the first {questions.items.length}.{" "}
            <Link
              href={practiceHref({ unseenOnly: false, chapterId: chapter.id })}
              className="text-brand-700 font-medium underline"
            >
              Practise the chapter
            </Link>{" "}
            to work through the rest.
          </p>
        ) : null}
      </section>
    </PageShell>
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
