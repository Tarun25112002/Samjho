import type { TeacherDashboard } from "@samjho/contracts";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/page";
import { Card } from "@/components/ui/surface";

/**
 * The teacher overview.
 *
 * ## Why the numbers are ordered the way they are
 *
 * Not by size and not by how impressive they look. The first tile is the one
 * with something to do behind it — students who have not finished overdue work
 * — and the rest descend from there. A dashboard whose top-left number is a
 * vanity total teaches its reader to stop looking at the top left.
 *
 * ## Why the empty state is a sentence, not a chart
 *
 * A teacher opening this on day one has no classes, no papers and no questions.
 * Four zeroes in four boxes is a page that says nothing and looks broken. The
 * empty state says what to do first instead, and it is one thing rather than
 * three, because the whole flow depends on a classroom existing.
 */
export function TeacherDashboardView({ data }: { data: TeacherDashboard }) {
  const isNew = data.classrooms.total === 0 && data.bank.total === 0 && data.uploads.total === 0;

  if (isNew) return <FirstRun />;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Waiting on students"
          value={data.assignments.overdueWithStragglers}
          hint={
            data.assignments.overdueWithStragglers === 0
              ? "Nothing overdue"
              : "assignments past due with work outstanding"
          }
          tone={data.assignments.overdueWithStragglers > 0 ? "attention" : "calm"}
          href="/teacher/classrooms"
        />
        <Tile
          label="Papers to review"
          value={data.uploads.awaitingReview}
          hint={
            data.uploads.extracting > 0
              ? `${String(data.uploads.extracting)} still being read`
              : "read and waiting for you"
          }
          tone={data.uploads.awaitingReview > 0 ? "attention" : "calm"}
          href="/teacher/uploads"
        />
        <Tile
          label="Your questions"
          value={data.bank.published}
          hint={
            data.bank.draft > 0
              ? `${String(data.bank.draft)} more not set for students yet`
              : "ready to set for a class"
          }
          tone="calm"
          href="/teacher/questions"
        />
        <Tile
          label="Students"
          value={data.classrooms.students}
          hint={`across ${String(data.classrooms.total)} ${
            data.classrooms.total === 1 ? "classroom" : "classrooms"
          }`}
          tone="calm"
          href="/teacher/classrooms"
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
        <Upcoming rows={data.upcoming} />
        <BankBreakdown bank={data.bank} />
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "attention" | "calm";
  href: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "rounded-panel hover:shadow-lift flex min-h-40 flex-col border p-5 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 sm:p-6",
        tone === "attention"
          ? "border-brand-200 bg-brand-50 hover:border-brand-400"
          : "border-line bg-card hover:border-line-strong",
      ].join(" ")}
    >
      <Eyebrow tone="muted">{label}</Eyebrow>
      <p className="text-text text-figure mt-3 tabular-nums">{value}</p>
      <p className="text-text-soft mt-auto pt-2 text-sm leading-snug">{hint}</p>
    </Link>
  );
}

function Upcoming({ rows }: { rows: TeacherDashboard["upcoming"] }) {
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-text text-subheading">Open work</h2>
        <span className="text-text-faint text-xs font-semibold tabular-nums">
          {rows.length} {rows.length === 1 ? "set" : "sets"}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-text-soft mt-3 text-sm leading-relaxed">
          Nothing is set at the moment. A short chapter set before the lesson you are about to teach
          is worth more than a long one at the end of term.
        </p>
      ) : (
        <ul className="divide-line mt-4 divide-y">
          {rows.map((row) => (
            <li key={row.assignmentId} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/teacher/assignments/${row.assignmentId}`}
                    className="text-text font-semibold hover:underline"
                  >
                    {row.title}
                  </Link>
                  <p className="text-text-faint mt-1 text-sm">
                    {row.classroomName} · {row.questionCount} questions
                    {row.dueAt ? ` · due ${dueLabel(row.dueAt)}` : " · no due date"}
                  </p>
                </div>
                <p className="text-text-soft shrink-0 text-sm tabular-nums">
                  {row.completedCount}/{row.studentCount} done
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BankBreakdown({ bank }: { bank: TeacherDashboard["bank"] }) {
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-text text-subheading">Your question bank</h2>
        {bank.total > 0 ? (
          <span className="text-text-faint text-xs font-semibold tabular-nums">
            {bank.total} total
          </span>
        ) : null}
      </div>

      {bank.total === 0 ? (
        <>
          <p className="text-text-soft mt-3 text-sm leading-relaxed">
            Upload a question paper and Samjho pulls the questions out of it — sorted by chapter and
            difficulty, ready for you to check.
          </p>
          <ButtonLink href="/teacher/uploads" className="mt-4" size="sm" variant="secondary">
            Upload a paper
          </ButtonLink>
        </>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {bank.bySubject.map((row) => (
            <li
              key={row.subjectId}
              className="bg-raised rounded-control flex items-center justify-between gap-4 px-3 py-2.5"
            >
              <span className="text-text-soft min-w-0 truncate text-sm">{row.subjectName}</span>
              <span className="text-text shrink-0 text-sm font-semibold tabular-nums">
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FirstRun() {
  return (
    <Card pad="roomy" className="relative min-h-72 overflow-hidden">
      <div
        aria-hidden="true"
        className="bg-brand-100 absolute -right-10 -bottom-16 size-56 rounded-full blur-2xl"
      />
      <div className="relative max-w-2xl">
        <p className="text-text text-heading">Start with one class.</p>
        <p className="text-text-soft mt-2 text-sm leading-relaxed">
          Make a classroom for a subject and share its code. Then set a short practice set — or
          upload one of your own papers and let Samjho pull the questions out of it, sorted by
          chapter and difficulty for you to check.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/teacher/classrooms">Create your first classroom</ButtonLink>
          <ButtonLink href="/teacher/uploads" variant="secondary">
            Upload a paper
          </ButtonLink>
        </div>
      </div>
    </Card>
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
