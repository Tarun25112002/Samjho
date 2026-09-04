"use client";

import {
  createClassroomAssignmentResponseSchema,
  createClassroomAssignmentSchema,
  createClassroomResponseSchema,
  createClassroomSchema,
  type TeacherClassroom,
} from "@samjho/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { sendJson } from "@/lib/client-api";

export function TeacherWorkspace({
  classrooms,
  subjects,
}: {
  classrooms: TeacherClassroom[];
  subjects: { id: string; name: string; code: string }[];
}) {
  const [showCreate, setShowCreate] = useState(classrooms.length === 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-brand-700 text-sm font-semibold">Teaching space</p>
          <h1 className="text-text mt-1 text-[1.9rem] leading-tight font-semibold tracking-[-0.035em] sm:text-4xl">
            See the next useful conversation.
          </h1>
          <p className="text-text-soft mt-2 max-w-2xl text-sm leading-relaxed">
            Set focused practice, notice who needs a nudge, and keep student answers private to the
            student.
          </p>
        </div>
        <Button onClick={() => setShowCreate((open) => !open)}>
          {showCreate ? "Close" : "New classroom"}
        </Button>
      </header>

      {showCreate ? (
        <CreateClassroom subjects={subjects} onCreated={() => setShowCreate(false)} />
      ) : null}

      {classrooms.length === 0 ? <TeacherEmpty onCreate={() => setShowCreate(true)} /> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {classrooms.map((classroom) => (
          <TeacherClassroomCard key={classroom.id} classroom={classroom} />
        ))}
      </div>
    </div>
  );
}

function CreateClassroom({
  subjects,
  onCreated,
}: {
  subjects: { id: string; name: string; code: string }[];
  onCreated: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function create(): Promise<void> {
    const parsed = createClassroomSchema.safeParse({ name, subjectId });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Add a name and subject for this classroom.");
      return;
    }

    setBusy(true);
    setMessage(null);
    const result = await sendJson(
      "POST",
      "/api/v1/classrooms",
      parsed.data,
      createClassroomResponseSchema,
    );
    setBusy(false);

    if (!result.ok) {
      setMessage(result.failure.message);
      return;
    }

    onCreated();
    router.refresh();
  }

  return (
    <section className="border-brand-200 bg-brand-50 rounded-panel border p-5 sm:p-6">
      <form
        className="grid gap-4 sm:grid-cols-[1.2fr_1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <Field label="Classroom name" htmlFor="classroom-name">
          <input
            id="classroom-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. 10B Mathematics"
            className={inputClass}
          />
        </Field>
        <Field label="Subject" htmlFor="classroom-subject">
          <select
            id="classroom-subject"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            className={inputClass}
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} · {subject.name}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" disabled={busy || subjects.length === 0}>
          {busy ? "Creating…" : "Create class"}
        </Button>
      </form>
      {subjects.length === 0 ? (
        <p className="text-marker-700 mt-3 text-sm">No Class 10 subjects are available yet.</p>
      ) : null}
      {message ? (
        <p role="alert" className="text-marker-700 mt-3 text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function TeacherEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="border-line bg-card rounded-panel relative overflow-hidden border p-7 sm:p-9">
      <div className="bg-brand-100 absolute -right-10 -bottom-16 size-56 rounded-full blur-2xl" />
      <div className="relative max-w-2xl">
        <p className="text-text text-xl font-semibold">Begin with one class, not a dashboard.</p>
        <p className="text-text-soft mt-2 text-sm leading-relaxed">
          Make a classroom for a subject, share its code, and send a short chapter practice set.
          Completion becomes visible here—without turning private student work into a feed.
        </p>
        <Button className="mt-5" onClick={onCreate}>
          Create your first classroom
        </Button>
      </div>
    </section>
  );
}

function TeacherClassroomCard({ classroom }: { classroom: TeacherClassroom }) {
  const [assigning, setAssigning] = useState(false);

  return (
    <section className="border-line bg-card rounded-panel overflow-hidden border">
      <div className="border-line bg-raised/60 border-b p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-brand-700 text-xs font-bold tracking-[0.12em] uppercase">
              {classroom.subject.code}
            </p>
            <h2 className="text-text mt-1 text-xl font-semibold tracking-[-0.02em]">
              {classroom.name}
            </h2>
            <p className="text-text-soft mt-1 text-sm">
              {classroom.subject.name} · {classroom.studentCount}{" "}
              {classroom.studentCount === 1 ? "student" : "students"}
            </p>
          </div>
          <ClassCode code={classroom.joinCode} />
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-text font-semibold">Assigned practice</h3>
          <button
            type="button"
            onClick={() => setAssigning((open) => !open)}
            className="text-brand-700 text-sm font-semibold hover:underline"
          >
            {assigning ? "Close" : "Set practice"}
          </button>
        </div>

        {assigning ? (
          <AssignmentForm classroom={classroom} onCreated={() => setAssigning(false)} />
        ) : null}

        {classroom.assignments.length === 0 ? (
          <p className="text-text-soft mt-4 text-sm leading-relaxed">
            Send a compact practice brief when it supports the next lesson. Students get a
            materialised set and can work through it at their own pace.
          </p>
        ) : (
          <ul className="divide-line mt-4 divide-y">
            {classroom.assignments.map((assignment) => (
              <li key={assignment.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-text font-semibold">{assignment.title}</p>
                    <p className="text-text-faint mt-1 text-sm">
                      {assignment.chapterName ?? "Whole subject"} · {assignment.questionCount}{" "}
                      questions
                      {assignment.dueAt ? ` · due ${dueLabel(assignment.dueAt)}` : ""}
                    </p>
                    <p className="text-text-soft mt-2 text-sm">
                      {assignment.completedCount}/{classroom.studentCount} completed ·{" "}
                      {assignment.startedCount} started
                    </p>
                  </div>
                  <Link
                    href={`/teacher/assignments/${assignment.id}`}
                    className="text-brand-700 rounded-pill bg-brand-50 px-3 py-2 text-sm font-semibold transition hover:bg-brand-100"
                  >
                    See progress
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ClassCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="border-line bg-card rounded-control min-h-11 border px-3 text-left transition hover:border-brand-400"
      aria-label={`Copy class code ${code}`}
    >
      <span className="text-text-faint block text-[0.65rem] font-bold tracking-[0.12em] uppercase">
        {copied ? "Copied" : "Class code"}
      </span>
      <span className="text-text block font-mono text-sm font-bold tracking-[0.13em]">{code}</span>
    </button>
  );
}

function AssignmentForm({
  classroom,
  onCreated,
}: {
  classroom: TeacherClassroom;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [questionCount, setQuestionCount] = useState("10");
  const [dueAt, setDueAt] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function create(): Promise<void> {
    const parsed = createClassroomAssignmentSchema.safeParse({
      title,
      instructions: instructions || undefined,
      chapterId: chapterId || null,
      questionCount: Number(questionCount),
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Check the assignment details.");
      return;
    }

    setBusy(true);
    setMessage(null);
    const result = await sendJson(
      "POST",
      `/api/v1/classrooms/${encodeURIComponent(classroom.id)}/assignments`,
      parsed.data,
      createClassroomAssignmentResponseSchema,
    );
    setBusy(false);

    if (!result.ok) {
      setMessage(result.failure.message);
      return;
    }

    onCreated();
    router.refresh();
  }

  return (
    <form
      className="border-brand-200 bg-brand-50 mt-4 grid gap-3 rounded-2xl border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void create();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Assignment title" htmlFor={`${classroom.id}-title`}>
          <input
            id={`${classroom.id}-title`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Quadratics before Friday"
            className={inputClass}
          />
        </Field>
        <Field label="Chapter" htmlFor={`${classroom.id}-chapter`}>
          <select
            id={`${classroom.id}-chapter`}
            value={chapterId}
            onChange={(event) => setChapterId(event.target.value)}
            className={inputClass}
          >
            <option value="">Whole subject</option>
            {classroom.subject.chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Questions" htmlFor={`${classroom.id}-count`}>
          <select
            id={`${classroom.id}-count`}
            value={questionCount}
            onChange={(event) => setQuestionCount(event.target.value)}
            className={inputClass}
          >
            {[5, 8, 10, 15, 20, 25, 30].map((count) => (
              <option key={count} value={count}>
                {count} questions
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due time (optional)" htmlFor={`${classroom.id}-due`}>
          <input
            id={`${classroom.id}-due`}
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="A note for students (optional)" htmlFor={`${classroom.id}-instructions`}>
        <textarea
          id={`${classroom.id}-instructions`}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          rows={2}
          placeholder="What should they pay attention to in this set?"
          className={`${inputClass} min-h-20 py-3`}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Sending…" : "Send practice"}
        </Button>
        <p className="text-text-faint text-xs">
          Students receive their own question set when they start.
        </p>
      </div>
      {message ? (
        <p role="alert" className="text-marker-700 text-sm">
          {message}
        </p>
      ) : null}
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="text-text mb-1.5 block text-xs font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "border-brand-200 bg-card text-text h-11 w-full rounded-xl border px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function dueLabel(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
