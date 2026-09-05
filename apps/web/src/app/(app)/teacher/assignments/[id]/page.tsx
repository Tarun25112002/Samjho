import type { Metadata } from "next";
import Link from "next/link";

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
    <main className="mx-auto flex w-full max-w-[90rem] flex-col gap-7 px-5 py-7 sm:px-8 sm:py-10 xl:px-10">
      <Link
        href="/teacher/classrooms"
        className="text-brand-700 w-fit text-sm font-semibold hover:underline"
      >
        ← Back to classrooms
      </Link>

      <header className="border-line bg-card rounded-panel border p-6 sm:p-8">
        <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
          Assignment report · {report.assignment.subjectName}
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-3xl">
            <h1 className="text-text text-3xl leading-tight font-semibold tracking-[-0.04em] sm:text-4xl">
              {report.assignment.title}
            </h1>
            <p className="text-text-soft mt-3 text-sm leading-relaxed">
              {report.assignment.classroomName} · {report.assignment.chapterName ?? "Whole subject"}{" "}
              · {report.assignment.questionCount} questions
              {report.assignment.dueAt ? ` · due ${dueLabel(report.assignment.dueAt)}` : ""}
            </p>
            {report.assignment.instructions ? (
              <p className="text-text-soft mt-4 max-w-2xl text-sm leading-relaxed">
                {report.assignment.instructions}
              </p>
            ) : null}
          </div>
          <div className="border-brand-200 bg-brand-50 rounded-control min-w-35 px-5 py-4 text-right">
            <p className="text-text text-3xl font-semibold tabular-nums">
              {completed}/{report.students.length}
            </p>
            <p className="text-brand-700 text-xs font-bold tracking-[0.08em] uppercase">
              completed
            </p>
          </div>
        </div>
      </header>

      <section aria-labelledby="students-heading">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2
              id="students-heading"
              className="text-text text-lg font-semibold tracking-[-0.02em]"
            >
              Class progress
            </h2>
            <p className="text-text-faint mt-1 text-sm">
              Marks appear once a student finishes the set.
            </p>
          </div>
          <p className="text-text-faint text-sm font-medium tabular-nums">
            {report.students.length} {report.students.length === 1 ? "student" : "students"}
          </p>
        </div>

        {report.students.length === 0 ? (
          <div className="border-line bg-card rounded-panel border p-6 text-sm text-text-soft">
            No students have joined this classroom yet. Share the classroom code from Teaching.
          </div>
        ) : (
          <ul className="border-line bg-card rounded-panel divide-line divide-y overflow-hidden border">
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
        )}
      </section>
    </main>
  );
}

function ProgressPill({
  progress,
}: {
  progress: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "LATE";
}) {
  const styles = {
    NOT_STARTED: "bg-raised text-text-soft",
    IN_PROGRESS: "bg-brand-50 text-brand-700",
    COMPLETED: "bg-brand-100 text-brand-800",
    LATE: "bg-marker-50 text-marker-700",
  } as const;
  const labels = {
    NOT_STARTED: "Not started",
    IN_PROGRESS: "In progress",
    COMPLETED: "Complete",
    LATE: "Completed late",
  } as const;

  return (
    <span className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${styles[progress]}`}>
      {labels[progress]}
    </span>
  );
}

function dueLabel(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
