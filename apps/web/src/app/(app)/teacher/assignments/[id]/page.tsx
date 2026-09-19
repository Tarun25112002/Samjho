import type { AssignmentItemAnalysis } from "@medhavi/contracts";
import type { Metadata } from "next";

import { PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, Chip } from "@/components/ui/surface";
import { ItemCard } from "@/features/teacher/class-diagnostics";
import { loadAssignmentItemAnalysis, loadAssignmentReport } from "@/lib/classrooms";
import { INDIA_TIME_ZONE } from "@/lib/india-time";
import { requireTeacher } from "@/lib/me";
import { formatDuration, formatMarksValue } from "@/lib/practice-format";

export const metadata: Metadata = { title: "Assignment progress" };
export const dynamic = "force-dynamic";

export default async function AssignmentReportPage(props: { params: Promise<{ id: string }> }) {
  await requireTeacher();
  const { id } = await props.params;

  const [report, analysis] = await Promise.all([
    loadAssignmentReport(id),
    // The register is the page; the analysis is a section of it. A diagnostics
    // query that fails — most plausibly on an assignment nobody has sat, where
    // there is nothing to fold — should cost the teacher that section rather
    // than the page they came for.
    loadAssignmentItemAnalysis(id).catch(() => null),
  ]);
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

      {/*
        Below the register rather than above it, because a teacher opening this
        page during a lesson usually wants "has 10B finished" — but the reason
        they come back to it afterwards is this section, which is the one that
        changes what they teach.
      */}
      <ItemAnalysisSection analysis={analysis} />
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
    timeZone: INDIA_TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * Per-question analysis of this assignment, hardest first.
 *
 * ## The caveat is on the page, not left to be inferred
 *
 * Item analysis compares directly only when every student sat the same
 * questions — which is true of a hand-built test and false of a drawn one, where
 * the selector gives each student their own set. On a drawn assignment the
 * denominators come out as 3, 1, 2, and a teacher reading "1 of 1 got it wrong"
 * as a class-wide signal would be badly misled.
 *
 * Rather than hide the section or silently weaken it, it says so. The fix is
 * also stated, because it is one choice on the form next time.
 */
function ItemAnalysisSection({ analysis }: { analysis: AssignmentItemAnalysis | null }) {
  if (analysis === null || analysis.items.length === 0) return null;

  return (
    <section aria-labelledby="item-analysis" className="flex flex-col gap-4">
      <SectionHeading
        id="item-analysis"
        eyebrow="Item analysis"
        title="What they got wrong"
        lede="Hardest first. For objective questions the bars show which option the class actually chose — a distractor most of them picked is one misconception to correct, not thirty separate errors."
        action={
          <p className="text-text-faint text-sm font-medium tabular-nums">
            {analysis.studentsAttempted} of {analysis.studentsInClass} attempted
          </p>
        }
      />

      {!analysis.sameQuestionsForEveryone ? (
        <Card>
          <p className="text-text-soft text-sm leading-relaxed">
            Students were given different questions in this assignment, so the per-question numbers
            below cover whoever happened to be shown each one. To compare the class question by
            question, set a test by picking the questions yourself — every student then sits the
            same paper.
          </p>
        </Card>
      ) : null}

      <div className="flex flex-col gap-4">
        {analysis.items.map((item) => (
          <ItemCard key={item.questionId} item={item} />
        ))}
      </div>
    </section>
  );
}
