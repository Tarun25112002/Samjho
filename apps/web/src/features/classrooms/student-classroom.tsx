"use client";

import {
  joinClassroomResponseSchema,
  joinClassroomSchema,
  startAssignmentResponseSchema,
  type StudentAssignment,
  type StudentClassroom,
} from "@samjho/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { sendJson } from "@/lib/client-api";
import { formatDuration, formatMarksValue } from "@/lib/practice-format";

export function StudentClassroom({ classrooms }: { classrooms: StudentClassroom[] }) {
  const [joinOpen, setJoinOpen] = useState(classrooms.length === 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-brand-700 text-sm font-semibold">Your classroom</p>
          <h1 className="text-text mt-1 text-[1.9rem] leading-tight font-semibold tracking-[-0.035em] sm:text-4xl">
            Work that has a purpose.
          </h1>
          <p className="text-text-soft mt-2 max-w-xl text-sm leading-relaxed">
            Your teacher can set a focused practice brief. Your answers and feedback stay yours.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setJoinOpen((open) => !open)}>
          {joinOpen ? "Close" : "Join a class"}
        </Button>
      </header>

      {joinOpen ? <JoinClassroom onJoined={() => setJoinOpen(false)} /> : null}

      {classrooms.length === 0 ? <EmptyClassroom onJoin={() => setJoinOpen(true)} /> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {classrooms.map((classroom) => (
          <ClassroomCard key={classroom.id} classroom={classroom} />
        ))}
      </div>
    </div>
  );
}

function JoinClassroom({ onJoined }: { onJoined: () => void }) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function join(): Promise<void> {
    const parsed = joinClassroomSchema.safeParse({ joinCode });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Enter your class code.");
      return;
    }

    setBusy(true);
    setMessage(null);
    const result = await sendJson(
      "POST",
      "/api/v1/classrooms/join",
      parsed.data,
      joinClassroomResponseSchema,
    );
    setBusy(false);

    if (!result.ok) {
      setMessage(result.failure.message);
      return;
    }

    onJoined();
    router.refresh();
  }

  return (
    <section className="border-brand-200 bg-brand-50 rounded-panel border p-5 sm:p-6">
      <form
        className="flex flex-col gap-4 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void join();
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="class-code" className="text-text block text-sm font-semibold">
            Class code
          </label>
          <p className="text-text-soft mt-1 text-sm">
            Ask your teacher for the six-character code.
          </p>
          <input
            id="class-code"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="e.g. B7K2MQ"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="border-brand-200 bg-card text-text mt-3 h-11 w-full rounded-xl border px-3 font-mono text-base tracking-[0.16em] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Joining…" : "Join class"}
        </Button>
      </form>
      {message ? (
        <p role="alert" className="text-marker-700 mt-3 text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function EmptyClassroom({ onJoin }: { onJoin: () => void }) {
  return (
    <section className="border-line bg-card rounded-panel relative overflow-hidden border p-7 sm:p-9">
      <div className="bg-brand-100 absolute -top-16 -right-12 size-44 rounded-full blur-2xl" />
      <div className="relative max-w-xl">
        <p className="text-text text-lg font-semibold">No classes yet</p>
        <p className="text-text-soft mt-2 text-sm leading-relaxed">
          Join with a code and any practice your teacher assigns will appear here. Personal practice
          stays completely separate in your own account.
        </p>
        <Button className="mt-5" onClick={onJoin}>
          Enter a class code
        </Button>
      </div>
    </section>
  );
}

function ClassroomCard({ classroom }: { classroom: StudentClassroom }) {
  return (
    <section className="border-line bg-card rounded-panel overflow-hidden border">
      <div className="border-line bg-raised/60 border-b px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-brand-700 text-xs font-bold tracking-[0.12em] uppercase">
              {classroom.subject.code}
            </p>
            <h2 className="text-text mt-1 text-lg font-semibold">{classroom.name}</h2>
          </div>
          <span className="text-text-faint rounded-pill border-line border bg-card px-2.5 py-1 text-xs font-medium">
            {classroom.subject.name}
          </span>
        </div>
        <p className="text-text-soft mt-2 text-sm">
          {classroom.teacherName ? `with ${classroom.teacherName}` : "Teacher classroom"}
        </p>
      </div>

      <div className="p-5 sm:p-6">
        {classroom.assignments.length === 0 ? (
          <p className="text-text-soft text-sm leading-relaxed">
            Nothing assigned right now. When your teacher sends a practice brief, it will show up
            here.
          </p>
        ) : (
          <ul className="divide-line divide-y">
            {classroom.assignments.map((assignment) => (
              <li key={assignment.id} className="py-4 first:pt-0 last:pb-0">
                <AssignmentCard assignment={assignment} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AssignmentCard({ assignment }: { assignment: StudentAssignment }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-text font-semibold">{assignment.title}</h3>
            <ProgressPill progress={assignment.progress} />
          </div>
          <p className="text-text-faint mt-1 text-sm">
            {assignment.chapterName ?? "Whole subject"} · {assignment.questionCount} questions
            {assignment.dueAt ? ` · due ${dueLabel(assignment.dueAt)}` : ""}
          </p>
        </div>
      </div>

      {assignment.instructions ? (
        <p className="text-text-soft text-sm leading-relaxed">{assignment.instructions}</p>
      ) : null}

      {assignment.totals ? (
        <p className="text-text-soft text-sm">
          {assignment.totals.answered} answered · {assignment.totals.correct} correct ·{" "}
          {formatMarksValue(assignment.totals.marksEarned)}/
          {formatMarksValue(assignment.totals.marksPossible)} marks
          {assignment.progress !== "IN_PROGRESS"
            ? ` · ${formatDuration(assignment.totals.timeSpentMs)}`
            : ""}
        </p>
      ) : null}

      <StartAssignment assignment={assignment} />
    </div>
  );
}

function StartAssignment({ assignment }: { assignment: StudentAssignment }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function start(): Promise<void> {
    setBusy(true);
    setMessage(null);
    const result = await sendJson(
      "POST",
      `/api/v1/classrooms/assignments/${encodeURIComponent(assignment.id)}/start`,
      {},
      startAssignmentResponseSchema,
    );

    if (!result.ok) {
      setBusy(false);
      setMessage(result.failure.message);
      return;
    }

    router.push(
      result.data.status === "COMPLETED"
        ? `/practice/sessions/${result.data.id}/result`
        : `/practice/sessions/${result.data.id}`,
    );
  }

  const label =
    assignment.progress === "NOT_STARTED"
      ? "Start assigned practice"
      : assignment.progress === "IN_PROGRESS"
        ? "Resume practice"
        : "Review your work";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant={assignment.progress === "NOT_STARTED" ? "primary" : "secondary"}
        disabled={busy}
        onClick={() => void start()}
      >
        {busy ? "Opening…" : label}
      </Button>
      {message ? (
        <p role="alert" className="text-marker-700 text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function ProgressPill({ progress }: { progress: StudentAssignment["progress"] }) {
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
    <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${styles[progress]}`}>
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
