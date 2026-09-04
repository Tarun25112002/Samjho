import { DataState } from "@samjho/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChevronRight } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-client";
import { groupChaptersByDomain, loadSubject } from "@/lib/catalog";
import { requireOnboarded } from "@/lib/me";
import { practiceHref } from "@/lib/practice-format";

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
 *
 * ## Why the counts are so prominent
 *
 * Samjho's bank is being written from zero (docs/07 R1), so most chapters are
 * empty most of the time and will be for months. A chapter row that shows "0
 * questions" is telling the truth; one that shows nothing lets a student tap in,
 * find an empty page, and conclude the app is broken. The empty rows are also
 * visibly quieter, so the eye lands on the chapters that have something in them.
 */
export default async function SubjectPage({ params }: PageProps) {
  const { slug } = await params;
  await requireOnboarded();

  const subject = await loadSubjectOr404(slug);
  const groups = groupChaptersByDomain(subject.chapters, subject.domains);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <p className="text-text-soft text-sm font-medium">
          Class {subject.classLevel} {subject.board}
        </p>
        <h1 className="text-text mt-1 text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] sm:text-4xl">
          {subject.name}
        </h1>

        <p className="text-text-soft mt-2 text-sm">
          {/* Never "out of 100": 80 for Class 10, 70 for Class 12 Physics. */}
          {subject.theoryMarks}-mark theory paper · {subject.chapters.length} chapters ·{" "}
          {subject.counts.total} questions available
        </p>

        {subject.counts.total > 0 ? (
          <ButtonLink
            href={practiceHref({ unseenOnly: false, subjectId: subject.id })}
            className="mt-5"
          >
            Practise {subject.name}
          </ButtonLink>
        ) : null}
      </header>

      <DataState
        data={groups}
        emptyTitle="This subject has no chapters yet"
        emptyBody="Its syllabus has not been entered. Nothing is wrong with your account."
        emptyAction={
          <Link href="/home" className="text-brand-700 font-medium underline">
            Back to your subjects
          </Link>
        }
      >
        {(sections) => (
          <div className="flex flex-col gap-8">
            {sections.map((group) => (
              <section key={group.domain ?? "all"} className="flex flex-col gap-3">
                {group.domain ? (
                  <h2 className="text-text text-lg font-semibold">{group.domain}</h2>
                ) : null}

                <ul className="border-line bg-card rounded-panel divide-line divide-y overflow-hidden border">
                  {group.chapters.map((chapter) => {
                    const empty = chapter.questionCount === 0;

                    return (
                      <li key={chapter.id}>
                        <Link
                          href={`/chapters/${chapter.id}`}
                          className="hover:bg-raised flex items-center gap-4 px-5 py-4 transition-colors"
                        >
                          {/* NCERT numbers chapters, and students refer to them
                              by number constantly — "chapter 6, Life Processes".
                              It is real sequence data, not a decorative
                              counter. */}
                          <span
                            className={[
                              "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums",
                              empty ? "bg-raised text-text-faint" : "bg-brand-50 text-brand-700",
                            ].join(" ")}
                          >
                            {chapter.ncertChapterNo ?? "–"}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span
                              className={[
                                "block font-medium",
                                empty ? "text-text-soft" : "text-text",
                              ].join(" ")}
                            >
                              {chapter.name}
                            </span>
                            <span className="text-text-faint block text-sm">
                              {chapter.topicCount} topics
                            </span>
                          </span>

                          <span
                            className={[
                              "marks-margin shrink-0 text-sm",
                              empty ? "text-text-faint" : "text-text-soft",
                            ].join(" ")}
                          >
                            {chapter.questionCount}{" "}
                            {chapter.questionCount === 1 ? "question" : "questions"}
                          </span>

                          <ChevronRight className="text-text-faint size-4 shrink-0" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </DataState>
    </div>
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
