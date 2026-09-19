import { bookmarkWithQuestionSchema, paginatedSchema } from "@samjho/contracts";
import type { BookmarkWithQuestion } from "@samjho/contracts";
import { QuestionRenderer } from "@samjho/ui";
import type { Metadata } from "next";

import { BookmarkIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page";
import { Card, Chip } from "@/components/ui/surface";
import { StartPractice } from "@/features/practice/start-practice";
import { apiFetchAuthed } from "@/lib/api-client";
import { requireStudent } from "@/lib/me";

export const metadata: Metadata = { title: "Saved questions" };
export const dynamic = "force-dynamic";

/**
 * The questions a student chose to keep.
 *
 * ## Why the questions are rendered rather than listed by title
 *
 * A question has no title. A list of first-lines would make a student open each
 * one to find out which it was, which is the opposite of what saving something
 * is for — and the renderer already exists and handles all ten types, so
 * showing the real thing costs nothing.
 *
 * The controls are read-only: this is a place to find a question, not to answer
 * one. Answering happens in a set, which is what the button at the top builds.
 *
 * ## Why saving is not the same as the mistake queue
 *
 * The revision queue is what the *system* says a student should revisit,
 * scheduled by spaced repetition. This is what the *student* said they wanted
 * to keep, in their own order, with their own note attached. Merging the two
 * would mean the product overruling a deliberate act, and the note is the tell:
 * nobody annotates a queue.
 */
export default async function SavedQuestionsPage() {
  await requireStudent();

  const saved = await apiFetchAuthed(
    "/api/v1/bookmarks?limit=50",
    paginatedSchema(bookmarkWithQuestionSchema),
    { cache: "no-store" },
  );

  return (
    <PageShell width="default">
      <PageHeader
        eyebrow="Saved questions"
        title="The ones you kept."
        lede="Questions you marked to come back to, newest first."
        action={
          saved.items.length > 0 ? (
            <StartPractice
              mode="BOOKMARKS"
              count={Math.min(saved.items.length, 20)}
              label="Practise these"
            />
          ) : undefined
        }
      />

      {saved.items.length === 0 ? (
        <Card pad="roomy" className="flex flex-col items-start gap-5">
          <BookmarkIcon className="text-brand-600 size-8" />
          <div>
            <h2 className="text-text text-heading">Nothing saved yet.</h2>
            <p className="text-text-soft mt-2 max-w-xl text-sm leading-relaxed">
              While you are practising, the bookmark button at the top of the runner keeps a
              question here. It is worth using on the ones you got right but are not sure you could
              repeat — those are the ones that quietly disappear otherwise.
            </p>
          </div>
          <ButtonLink href="/practice">Start practising</ButtonLink>
        </Card>
      ) : (
        <ol className="flex flex-col gap-4">
          {saved.items.map((bookmark) => (
            <SavedQuestion key={bookmark.id} bookmark={bookmark} />
          ))}
        </ol>
      )}

      {saved.pageInfo.hasMore ? (
        <p className="text-text-faint text-sm">
          Showing your fifty most recent. Practise some of them to work through the rest.
        </p>
      ) : null}
    </PageShell>
  );
}

function SavedQuestion({ bookmark }: { bookmark: BookmarkWithQuestion }) {
  return (
    <Card as="li">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <Chip tone="outline">{bookmark.question.chapter.name}</Chip>
        {bookmark.question.topics
          .filter((topic) => topic.isPrimary)
          .map((topic) => (
            <Chip key={topic.id} tone="neutral">
              {topic.name}
            </Chip>
          ))}
        <span className="text-text-faint ml-auto text-xs tabular-nums">
          {new Date(bookmark.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            timeZone: "Asia/Kolkata",
          })}
        </span>
      </header>

      {/* No `onChange`, which is the renderer's own definition of read-only. */}
      <QuestionRenderer question={bookmark.question} hideMeta />

      {bookmark.note === null ? null : (
        <p className="border-line text-text-soft mt-4 border-t pt-4 text-sm italic">
          {bookmark.note}
        </p>
      )}

      <div className="mt-4">
        <StartPractice
          mode="CHAPTER"
          filters={{ chapterId: bookmark.question.chapter.id }}
          count={10}
          label={`Practise ${bookmark.question.chapter.name}`}
          variant="secondary"
        />
      </div>
    </Card>
  );
}
