import { DataState } from "@samjho/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiClientError } from "@/lib/api-client";
import { groupChaptersByDomain, loadSubject } from "@/lib/catalog";
import { requireOnboarded } from "@/lib/me";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const subject = await loadSubject(slug);
    return { title: subject.name };
  } catch {
    // A missing subject is a 404, not a crashed metadata call.
    return { title: "Subject" };
  }
}

/**
 * Chapter browsing for one subject.
 *
 * The layout is driven entirely by `domains`. Science comes back with
 * Physics / Chemistry / Biology and renders as three sections; Maths comes back
 * with none and renders as one flat list of fourteen chapters. Neither branch is
 * special-cased by subject code — that is the whole point of `Chapter.domain`
 * being nullable rather than there being three Science subjects.
 */
export default async function SubjectPage({ params }: PageProps) {
  const { slug } = await params;
  await requireOnboarded();

  const subject = await loadSubjectOr404(slug);
  const groups = groupChaptersByDomain(subject.chapters, subject.domains);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="space-y-1">
        <p className="text-brand-600 text-sm font-medium tracking-wide uppercase">
          Class {subject.classLevel} · {subject.board}
        </p>
        <h1 className="text-ink-900 dark:text-ink-50 text-2xl font-semibold tracking-tight">
          {subject.name}
          {subject.variant ? (
            <span className="text-ink-500 font-normal"> ({subject.variant})</span>
          ) : null}
        </h1>
        <p className="text-ink-500 dark:text-ink-300 text-sm">
          {subject.theoryMarks}-mark theory paper · {subject.chapters.length} chapters ·{" "}
          {subject.counts.total} questions available
        </p>
      </header>

      <DataState
        data={groups}
        emptyTitle="This subject has no chapters yet"
        emptyBody="Its syllabus has not been entered. Nothing is wrong with your account."
        emptyAction={
          <Link href="/home" className="underline">
            Back to your subjects
          </Link>
        }
      >
        {(sections) => (
          <div className="flex flex-col gap-8">
            {sections.map((group) => (
              <section key={group.domain ?? "all"} className="space-y-3">
                {group.domain ? (
                  <h2 className="text-ink-700 dark:text-ink-100 text-sm font-semibold">
                    {group.domain}
                  </h2>
                ) : null}

                <ul className="divide-ink-100 dark:divide-ink-700 divide-y">
                  {group.chapters.map((chapter) => (
                    <li key={chapter.id}>
                      <Link
                        href={`/chapters/${chapter.id}`}
                        className="hover:bg-ink-50 dark:hover:bg-ink-900 -mx-3 flex items-baseline justify-between gap-4 rounded-lg px-3 py-3"
                      >
                        <span>
                          <span className="text-ink-900 dark:text-ink-50 font-medium">
                            {chapter.ncertChapterNo === null
                              ? chapter.name
                              : `${chapter.ncertChapterNo}. ${chapter.name}`}
                          </span>
                          <span className="text-ink-500 dark:text-ink-300 block text-sm">
                            {chapter.topicCount} topics
                          </span>
                        </span>

                        {/*
                    Zero is shown, not hidden. A platform building its bank from
                    zero (docs/07 R1) will have empty chapters for months, and
                    "0 questions" is information — an omitted count reads as a
                    bug.
                  */}
                        <span
                          className={
                            chapter.questionCount === 0
                              ? "text-ink-300 dark:text-ink-500 shrink-0 text-sm"
                              : "text-ink-500 dark:text-ink-300 shrink-0 text-sm"
                          }
                        >
                          {chapter.questionCount} questions
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </DataState>
    </main>
  );
}

async function loadSubjectOr404(slug: string) {
  try {
    return await loadSubject(slug);
  } catch (error) {
    // Only a genuine 404 becomes a 404 page. A 500 or a network failure must
    // keep bubbling — rendering "not found" for an outage sends students
    // hunting for a page that exists.
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }
}
