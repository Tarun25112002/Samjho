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
import { codeInputClass } from "@/components/ui/form";
import { Eyebrow, PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, Chip, flushBandClass } from "@/components/ui/surface";
import { sendJson } from "@/lib/client-api";
import { formatDuration, formatMarksValue } from "@/lib/practice-format";

export function StudentClassroom({ classrooms }: { classrooms: StudentClassroom[] }) {
  const [joinOpen, setJoinOpen] = useState(classrooms.length === 0);

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Teacher workspace"
        title="Your classroom"
        lede="See assigned practice, due dates, and your feedback in one place. Your personal practice stays separate."
        action={
          <Button variant="secondary" onClick={() => setJoinOpen((open) => !open)}>
            {joinOpen ? "Close" : "Join a class"}
          </Button>
        }
      />

      {joinOpen ? <JoinClassroom onJoined={() => setJoinOpen(false)} /> : null}

      {classrooms.length === 0 ? <EmptyClassroom onJoin={() => setJoinOpen(true)} /> : null}

      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {classrooms.map((classroom) => (
          <ClassroomCard key={classroom.id} classroom={classroom} />
        ))}
      </div>
    </PageShell>
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
    <Card tone="brand">
      <SectionHeading eyebrow="Join a class" title="Enter your class code" className="mb-5" />
      <form
        className="flex flex-col gap-4 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void join();
        }}
      >
        {/* Not `flex-1`. The field is a fixed 16rem now, so stretching this
            wrapper only pushed "Join class" to the far side of a 1200px row,
            leaving eight hundred pixels between a code and the button that
            submits it. */}
        <div className="min-w-0">
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
            placeholder="B7K2MQ"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className={`${codeInputClass} mt-3`}
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
    </Card>
  );
}

function EmptyClassroom({ onJoin }: { onJoin: () => void }) {
  return (
    <Card pad="roomy" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="bg-brand-100 absolute -top-16 -right-12 size-44 rounded-full blur-2xl"
      />
      <div className="relative max-w-xl">
        <Eyebrow>Your classroom is ready</Eyebrow>
        <p className="text-text text-heading mt-2">No classes yet</p>
        <p className="text-text-soft mt-2 text-sm leading-relaxed">
          Join with a code and any practice your teacher assigns will appear here. Personal practice
          stays completely separate in your own account.
        </p>
        <Button className="mt-5" onClick={onJoin}>
          Enter a class code
        </Button>
      </div>
    </Card>
  );
}

function ClassroomCard({ classroom }: { classroom: StudentClassroom }) {
  return (
    <Card pad="flush" className="flex h-full flex-col overflow-hidden">
      <div className={`border-line bg-raised/60 border-b ${flushBandClass}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Eyebrow>{classroom.subject.code}</Eyebrow>
            <h2 className="text-text text-subheading mt-1">{classroom.name}</h2>
          </div>
          <Chip tone="outline">{classroom.subject.name}</Chip>
        </div>
        <p className="text-text-soft mt-2 text-sm">
          {classroom.teacherName ? `with ${classroom.teacherName}` : "Teacher classroom"}
        </p>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {classroom.assignments.length === 0 ? (
          <p className="text-text-soft text-sm leading-relaxed">
            Nothing assigned right now. When your teacher sends a practice brief, it will show up
            here.
          </p>
        ) : (
          <ul className="grid gap-3">
            {classroom.assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="rounded-control border-line bg-raised/45 border p-4"
              >
                <AssignmentCard assignment={assignment} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
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
        size="sm"
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
