import type { Metadata } from "next";

import { PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, Chip } from "@/components/ui/surface";
import { loadAssignmentReport } from "@/lib/classrooms";
import { requireTeacher } from "@/lib/me";
import { formatDuration, formatMarksValue } from "@/lib/practice-format";

export const metadata: Metadata = { title: "Assignment progress" };
export const dynamic = "force-dynamic";

export default async function AssignmentReportPage(props: { params: Promise<{ id: string }> }) {
  await requireTeacher();
  const { id } = await props.params;
  const report = await loadAssignmentReport(id);
  const completed = report.students.filter(
    (student) => student.progress === "COMPLETED" || student.progress === "LATE",
  ).length;

  return (
    <PageShell as="main" width="wide">
      <PageHeader
        back={{ href: "/teacher/classrooms", label: "Classrooms" }}
        eyebrow={`Assignment report · ${report.assignment.subjectName}`}
        title={report.assignment.title}
        lede={`${report.assignment.classroomName} · ${
          report.assignment.chapterName ?? "Whole subject"
        } · ${String(report.assignment.questionCount)} questions${
          report.assignment.dueAt ? ` · due ${dueLabel(report.assignment.dueAt)}` : ""
        }`}
        action={
          <dl className="border-brand-200 bg-brand-50 rounded-control min-w-36 px-5 py-4 text-right">
            <dd className="text-text text-figure tabular-nums">
              {completed}/{report.students.length}
            </dd>
            <dt className="text-brand-700 text-eyebrow mt-1 uppercase">completed</dt>
          </dl>
        }
      >
        {report.assignment.instructions ? (
          <p className="text-text-soft mt-4 max-w-2xl text-sm leading-relaxed">
            {report.assignment.instructions}
          </p>
        ) : null}
      </PageHeader>

      <section aria-labelledby="students-heading" className="flex flex-col gap-4">
        <SectionHeading
          id="students-heading"
          eyebrow="Class progress"
          title="Who has finished"
          lede="Marks appear once a student finishes the set."
          action={
            <p className="text-text-faint text-sm font-medium tabular-nums">
              {report.students.length} {report.students.length === 1 ? "student" : "students"}
            </p>
          }
        />

        {report.students.length === 0 ? (
          <Card pad="roomy">
            <p className="text-text-soft text-sm">
              No students have joined this classroom yet. Share the classroom code from Teaching.
            </p>
          </Card>
        ) : (
          <Card pad="flush" className="overflow-hidden">
            <ul className="divide-line divide-y">
              {report.students.map((student) => (
                <li
                  key={student.studentId}
                  className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-6"
                >
                  <div className="min-w-40 flex-1">
                    <p className="text-text font-semibold">
                      {student.studentName ?? student.studentEmail}
                    </p>
                    {student.studentName ? (
                      <p className="text-text-faint mt-0.5 text-sm">{student.studentEmail}</p>
                    ) : null}
                  </div>
                  {student.totals ? (
                    <p className="text-text-soft text-sm">
                      {student.totals.answered}/{student.totals.totalQuestions} answered ·{" "}
                      {formatMarksValue(student.totals.marksEarned)}/
                      {formatMarksValue(student.totals.marksPossible)} marks
                      {student.progress !== "IN_PROGRESS"
                        ? ` · ${formatDuration(student.totals.timeSpentMs)}`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-text-faint text-sm">No session yet</p>
                  )}
                  <ProgressPill progress={student.progress} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </PageShell>
  );
}

/**
 * A student's state on this assignment.
 *
 * The same four states, the same four tones and the same four words as the
 * student's own classroom page — they were two separate maps that had already
 * drifted ("Complete" here, "Completed" there) and used `bg-brand-100` for a
 * finished set where the student's side used it for something else.
 */
function ProgressPill({
  progress,
}: {
  progress: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "LATE";
}) {
  const tones = {
    NOT_STARTED: "neutral",
    IN_PROGRESS: "brand",
    COMPLETED: "correct",
    LATE: "wrong",
  } as const;
  const labels = {
    NOT_STARTED: "Not started",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    LATE: "Completed late",
  } as const;

  return <Chip tone={tones[progress]}>{labels[progress]}</Chip>;
}

function dueLabel(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
