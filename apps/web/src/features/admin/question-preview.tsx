"use client";

import type { AdminChapter, WriteQuestionInput } from "@samjho/contracts";
import { QuestionRenderer, toPreviewQuestion } from "@samjho/ui";

/**
 * Preview-as-student.
 *
 * Note what is *not* here: no preview mode, no "hide the answer" flag, no second
 * rendering path. The draft is projected into `StudentQuestion` — the exact type
 * the student endpoint returns — and handed to the exact component the browse
 * pages and, from Phase 5, the practice runner use.
 *
 * That is the whole reason `QuestionRenderer` was built in Phase 3 before
 * anything consumed it. If this preview looks right, the question is right,
 * because the same code produced both. And the answer key cannot appear in it
 * even by accident: `StudentQuestion` has nowhere to put one.
 *
 * `onChange` is omitted, so every control renders disabled — an editor can see
 * the options without accidentally answering their own question.
 */
export function QuestionPreview({
  draft,
  chapter,
  topicNames,
}: {
  draft: WriteQuestionInput;
  chapter: AdminChapter | null;
  topicNames: string[];
}) {
  if (draft.body.trim().length === 0) {
    return (
      <div className="border-ink-100 dark:border-ink-700 text-ink-500 rounded-xl border p-4 text-sm">
        The preview appears here as you type the question.
      </div>
    );
  }

  const question = toPreviewQuestion(draft, {
    ...(chapter
      ? {
          chapter: {
            id: chapter.id,
            name: chapter.name,
            slug: chapter.slug,
            domain: chapter.domain,
          },
        }
      : {}),
    topicNames,
  });

  return (
    <div className="border-ink-100 dark:border-ink-700 rounded-xl border p-4">
      <QuestionRenderer question={question} displayNumber="1" />
    </div>
  );
}
