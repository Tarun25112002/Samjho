"use client";

import { PRACTICE_MODE_LABELS, type DailyStudyPlanItem } from "@medhavi/contracts";
import Link from "next/link";

import { StartAssignment } from "@/features/classrooms/start-assignment";
import { StartPractice } from "@/features/practice/start-practice";
import { StartRevision } from "@/features/revision/start-revision";

/**
 * Executes a plan item through the workflow that already owns it.
 *
 * The plan remains a read model. Its buttons do not accept question ids or
 * invent a new mutation: assignment membership, revision queue ordering, and
 * practice-set materialisation all stay enforced by their existing endpoints.
 */
export function StudyPlanAction({
  item,
  primary = false,
}: {
  item: DailyStudyPlanItem;
  primary?: boolean;
}) {
  const variant = primary ? "primary" : "secondary";
  const size = primary ? "md" : "sm";

  switch (item.kind) {
    case "RESUME":
      return (
        <Link
          href={`/practice/sessions/${encodeURIComponent(item.sessionId)}`}
          className={[
            "rounded-pill inline-flex min-h-12 items-center justify-center px-5 text-sm font-semibold transition-colors",
            primary
              ? "bg-brand-500 text-on-brand shadow-brand hover:bg-brand-400"
              : "border-line-strong bg-card text-text hover:border-brand-500 hover:bg-brand-50/60 border",
          ].join(" ")}
        >
          Resume {PRACTICE_MODE_LABELS[item.mode]}
        </Link>
      );
    case "ASSIGNMENT":
      return (
        <StartAssignment
          assignmentId={item.assignmentId}
          progress={item.progress}
          label={primary ? "Start assigned practice" : "Open assignment"}
          variant={variant}
          size={size}
        />
      );
    case "REVIEW":
      return (
        <StartRevision
          count={item.count}
          label={
            primary
              ? `Review ${String(item.count)} ${item.count === 1 ? "question" : "questions"}`
              : "Start review"
          }
          variant={variant}
        />
      );
    case "TOPIC_PRACTICE":
      return (
        <StartPractice
          mode="CUSTOM"
          filters={{
            subjectId: item.subject.id,
            ...(item.chapterId === null ? {} : { chapterId: item.chapterId }),
            ...(item.topicId === null ? {} : { topicId: item.topicId }),
            unseenOnly: item.unseenOnly,
          }}
          count={item.questionCount}
          label={primary ? `Practise ${item.title}` : "Start focused set"}
          variant={variant}
        />
      );
  }
}
