"use client";

import { EMPTY_ANSWER, type PracticeSession } from "@samjho/contracts";
import { QuestionRenderer } from "@samjho/ui";

import { TutorPanel } from "@/features/ai/tutor-panel";
import { markingFrom } from "@/lib/practice-format";

import { FeedbackPanel } from "./feedback-panel";
import { usePracticeRunner } from "./use-practice-runner";

/**
 * Every question in a finished set, with what happened to it.
 *
 * Built on the same hook as the runner rather than on a read-only copy of it,
 * for one reason that matters: **a student who hit Finish with answers unscored
 * must be able to score them here.** The API allows self-evaluation on a
 * completed session precisely so those answers are not lost, and a review screen
 * that could only display would throw that away.
 *
 * Everything else the hook offers — navigation, submission, the timer — is
 * simply not called. That is cheaper than a second hook that would drift from
 * this one the first time the attempt shape changes.
 */
export function SessionReview({ initial }: { initial: PracticeSession }) {
  const runner = usePracticeRunner(initial);

  if (runner.session.items.length === 0) {
    return (
      <p className="border-line bg-card rounded-panel text-text-soft border p-6 text-sm">
        The questions in this set are no longer available.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-8">
      {runner.session.items.map((item, position) => {
        const answers = Object.fromEntries(
          item.attempts.map((attempt) => [attempt.targetId, attempt.answer]),
        );
        const marking = markingFrom(item.attempts);

        return (
          <li
            key={item.question.id}
            className="rounded-panel border-line bg-card flex flex-col gap-4 border p-5 sm:p-6"
          >
            {/* No `onChange`: every control renders disabled. The review shows
                what the student answered, and the answer is now history. */}
            <QuestionRenderer
              question={item.question}
              displayNumber={String(position + 1)}
              value={answers[item.question.id] ?? EMPTY_ANSWER}
              subPartValues={answers}
              {...(marking ? { marking } : {})}
            />

            {item.attempts.length === 0 ? (
              <p className="text-text-faint text-sm">You didn&rsquo;t reach this one.</p>
            ) : (
              <>
                <FeedbackPanel
                  item={item}
                  busy={runner.busy}
                  onSelfEvaluate={(attemptId, marks) => void runner.selfEvaluate(attemptId, marks)}
                  onSetMistakeReason={(attemptId, reason) =>
                    void runner.setMistakeReason(attemptId, reason)
                  }
                />

                {/* The review is where "explain my mistake" earns its place: the
                    student is looking at a wrong answer they have had time to
                    think about, rather than one they submitted ten seconds ago.
                    Each panel is closed and inert until tapped, so a set of ten
                    costs nothing to render. */}
                <TutorPanel
                  questionId={item.question.id}
                  answered
                  answeredWrong={item.attempts.some((attempt) => attempt.isCorrect === false)}
                  attemptId={item.attempts[0]?.id}
                />
              </>
            )}
          </li>
        );
      })}

      {runner.failure ? (
        <li
          role="alert"
          className="rounded-control border-marker-200 bg-marker-50 text-marker-700 border px-4 py-3 text-sm"
        >
          {runner.failure.message}
        </li>
      ) : null}
    </ol>
  );
}
