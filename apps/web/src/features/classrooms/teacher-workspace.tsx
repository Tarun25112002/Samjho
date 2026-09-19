"use client";

import {
  createClassroomAssignmentResponseSchema,
  createClassroomAssignmentSchema,
  createClassroomResponseSchema,
  createClassroomSchema,
  type AssignmentSourcePool,
  type PastPaperYearOption,
  type TeacherBankQuestion,
  type TeacherClassroom,
} from "@medhavi/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { inputClass, selectClass, textareaClass } from "@/components/ui/form";
import { Eyebrow } from "@/components/ui/page";
import { Card, flushBandClass } from "@/components/ui/surface";
import { QuestionPicker } from "@/features/teacher/question-picker";
import { sendJson } from "@/lib/client-api";
import { INDIA_TIME_ZONE, indiaDateTimeLocalToIso } from "@/lib/india-time";

/**
 * Narrow a `<select>` value back to the union.
 *
 * A cast would compile and would be a lie the moment the enum grows a value the
 * form does not offer. This falls back to the default instead, which is the
 * behaviour anyone would want from a dropdown that somehow produced a value it
 * does not contain.
 */
function toSourcePool(value: string): AssignmentSourcePool {
  return value === "TEACHER_BANK" || value === "CURATED" ? value : "SHARED";
}

export function TeacherWorkspace({
  classrooms,
  subjects,
  pastPaperYearsBySubject,
  assignmentPrefill,
}: {
  classrooms: TeacherClassroom[];
  subjects: { id: string; name: string; code: string }[];
  pastPaperYearsBySubject: Record<string, PastPaperYearOption[]>;
  assignmentPrefill?: { classroomId: string; chapterId: string; source: "diagnostics" };
}) {
  const [showCreate, setShowCreate] = useState(classrooms.length === 0);

  return (
    <div className="flex flex-col gap-6">
      <Card
        pad="flush"
        className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6"
      >
        <div>
          <p className="text-text text-sm font-semibold">
            {classrooms.length === 0
              ? "Set up your first classroom"
              : `${String(classrooms.length)} ${classrooms.length === 1 ? "classroom" : "classrooms"}`}
          </p>
          <p className="text-text-faint mt-0.5 text-xs">
            Create a focused space, share its code, then set practice when it helps.
          </p>
        </div>
        <Button onClick={() => setShowCreate((open) => !open)}>
          {showCreate ? "Close setup" : "New classroom"}
        </Button>
      </Card>

      {showCreate ? (
        <CreateClassroom subjects={subjects} onCreated={() => setShowCreate(false)} />
      ) : null}

      {classrooms.length === 0 ? <TeacherEmpty onCreate={() => setShowCreate(true)} /> : null}

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {classrooms.map((classroom) => (
          <TeacherClassroomCard
            key={classroom.id}
            classroom={classroom}
            pastPaperYears={pastPaperYearsBySubject[classroom.subject.id] ?? []}
            {...(assignmentPrefill?.classroomId === classroom.id ? { assignmentPrefill } : {})}
          />
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
    <Card tone="brand">
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
            className={selectClass}
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
    </Card>
  );
}

function TeacherEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <Card pad="roomy" className="relative min-h-72 overflow-hidden">
      <div
        aria-hidden="true"
        className="bg-brand-100 absolute -right-10 -bottom-16 size-56 rounded-full blur-2xl"
      />
      <div className="relative max-w-2xl">
        <p className="text-text text-heading">Start with one class.</p>
        <p className="text-text-soft mt-2 text-sm leading-relaxed">
          Make a classroom for a subject, share its code, and send a short chapter practice set.
          Completion becomes visible here—without turning private student work into a feed.
        </p>
        <Button className="mt-5" onClick={onCreate}>
          Create your first classroom
        </Button>
      </div>
    </Card>
  );
}

function TeacherClassroomCard({
  classroom,
  pastPaperYears,
  assignmentPrefill,
}: {
  classroom: TeacherClassroom;
  pastPaperYears: PastPaperYearOption[];
  assignmentPrefill?: { chapterId: string; source: "diagnostics" };
}) {
  const recommendedChapter = classroom.subject.chapters.find(
    (chapter) => chapter.id === assignmentPrefill?.chapterId,
  );
  const [assigning, setAssigning] = useState(recommendedChapter !== undefined);

  return (
    <Card
      pad="flush"
      className="hover:border-line-strong hover:shadow-lift overflow-hidden transition-[border-color,box-shadow]"
    >
      <div className={`border-line bg-raised/60 border-b ${flushBandClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Eyebrow>{classroom.subject.code}</Eyebrow>
            <h2 className="text-text text-heading mt-1">{classroom.name}</h2>
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
          <div>
            <h3 className="text-text font-semibold">Assigned practice</h3>
            <p className="text-text-faint mt-0.5 text-xs">
              {classroom.assignments.length === 0
                ? "Nothing has been set yet"
                : `${String(classroom.assignments.length)} ${classroom.assignments.length === 1 ? "set" : "sets"}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            {/*
              Beside "Set practice" rather than buried in an assignment, because
              the question it answers — what does this class need next — is the
              one a teacher has *before* they decide what to set.
            */}
            <Link
              href={`/teacher/classrooms/${encodeURIComponent(classroom.id)}/diagnostics`}
              className="text-brand-700 inline-flex min-h-11 items-center text-sm font-semibold hover:underline"
            >
              What they got wrong
            </Link>
            <button
              type="button"
              onClick={() => setAssigning((open) => !open)}
              className="text-brand-700 inline-flex min-h-11 items-center text-sm font-semibold hover:underline"
            >
              {assigning ? "Close" : "Set practice"}
            </button>
          </div>
        </div>

        {assigning ? (
          <AssignmentForm
            classroom={classroom}
            pastPaperYears={pastPaperYears}
            onCreated={() => setAssigning(false)}
            diagnosticPrefill={recommendedChapter !== undefined}
            {...(recommendedChapter ? { initialChapterId: recommendedChapter.id } : {})}
          />
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
                  <div className="min-w-0">
                    <p className="text-text font-semibold">{assignment.title}</p>
                    <p className="text-text-faint mt-1 text-sm">
                      {assignment.chapterName ?? "Whole subject"} · {assignment.questionCount}{" "}
                      questions
                      {assignment.sourcePool === "TEACHER_BANK" ? " · from your bank" : ""}
                      {assignment.sourcePool === "CURATED" ? " · you picked these" : ""}
                      {assignment.timeLimitMinutes === null
                        ? ""
                        : ` · ${String(assignment.timeLimitMinutes)} min`}
                      {assignment.dueAt ? ` · due ${dueLabel(assignment.dueAt)}` : ""}
                    </p>
                    <p className="text-text-soft mt-2 text-sm">
                      {assignment.completedCount}/{classroom.studentCount} completed ·{" "}
                      {assignment.startedCount} started
                    </p>
                  </div>
                  <Link
                    href={`/teacher/assignments/${assignment.id}`}
                    className="text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-pill inline-flex min-h-11 shrink-0 items-center px-4 text-sm font-semibold transition-colors"
                  >
                    See progress
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
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
      className="border-line bg-card hover:border-brand-400 rounded-control min-h-11 shrink-0 border px-3 py-1.5 text-left transition-colors"
      aria-label={`Copy class code ${code}`}
    >
      <Eyebrow tone="muted">{copied ? "Copied" : "Class code"}</Eyebrow>
      <span className="text-text tracking-code block font-mono text-sm font-bold">{code}</span>
    </button>
  );
}

function AssignmentForm({
  classroom,
  pastPaperYears,
  onCreated,
  initialChapterId,
  diagnosticPrefill = false,
}: {
  classroom: TeacherClassroom;
  pastPaperYears: PastPaperYearOption[];
  onCreated: () => void;
  initialChapterId?: string;
  diagnosticPrefill?: boolean;
}) {
  const router = useRouter();
  const initialChapter = classroom.subject.chapters.find(
    (chapter) => chapter.id === initialChapterId,
  );
  const [title, setTitle] = useState(
    initialChapter ? `${initialChapter.name} follow-up practice` : "",
  );
  const [chapterId, setChapterId] = useState(initialChapter?.id ?? "");
  const [questionCount, setQuestionCount] = useState("10");
  const [sourcePool, setSourcePool] = useState<AssignmentSourcePool>("SHARED");
  const [picked, setPicked] = useState<TeacherBankQuestion[]>([]);
  const [timeLimit, setTimeLimit] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const curated = sourcePool === "CURATED";
  // `datetime-local` deliberately has no zone. Classroom deadlines do: CBSE
  // work is scheduled in India, so the stored instant must not vary with the
  // teacher's laptop zone.
  const normalizedDueAt = dueAt ? indiaDateTimeLocalToIso(dueAt) : null;

  async function create(): Promise<void> {
    const parsed = createClassroomAssignmentSchema.safeParse({
      title,
      instructions: instructions || undefined,
      chapterId: chapterId || null,
      // Ignored by the server for a curated test, which counts the list instead.
      // Sent anyway so the schema's shape is the same either way rather than
      // conditionally absent.
      questionCount: Number(questionCount),
      sourcePool,
      questionIds: curated ? picked.map((question) => question.id) : [],
      timeLimitMinutes: timeLimit ? Number(timeLimit) : null,
      // Preserve an invalid raw value for the shared schema to reject rather
      // than silently turning a malformed deadline into no deadline.
      dueAt: dueAt ? (normalizedDueAt ?? dueAt) : null,
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
    // A diagnostic prefill lives in the URL so the teacher can land here from a
    // shareable teaching signal. Once it has been acted on, remove it; a later
    // refresh should show the newly created assignment, not reopen the composer
    // with a stale recommendation.
    router.replace("/teacher/classrooms");
    router.refresh();
  }

  return (
    <form
      className="border-brand-200 bg-brand-50 rounded-control mt-4 grid gap-4 border p-4 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void create();
      }}
    >
      {diagnosticPrefill && initialChapter ? (
        <p className="border-brand-200 bg-card text-text-soft rounded-control -mb-1 border px-3 py-2.5 text-sm leading-relaxed">
          <strong className="text-text font-semibold">Diagnostic follow-up:</strong> this starts
          with <span className="font-medium">{initialChapter.name}</span>, the chapter containing
          the class&apos;s weakest topic. Review the set, then choose when to send it.
        </p>
      ) : null}
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
            className={selectClass}
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
      <div className="grid gap-3 sm:grid-cols-3">
        {/*
          Hidden for a curated test, where the count is however many questions
          were picked. Showing a "10 questions" dropdown beside a list of seven
          chosen ones invites a teacher to change a number that does nothing.
        */}
        {curated ? null : (
          <Field label="Questions" htmlFor={`${classroom.id}-count`}>
            <select
              id={`${classroom.id}-count`}
              value={questionCount}
              onChange={(event) => setQuestionCount(event.target.value)}
              className={selectClass}
            >
              {[5, 8, 10, 15, 20, 25, 30].map((count) => (
                <option key={count} value={count}>
                  {count} questions
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Time limit (optional)" htmlFor={`${classroom.id}-limit`}>
          <select
            id={`${classroom.id}-limit`}
            value={timeLimit}
            onChange={(event) => setTimeLimit(event.target.value)}
            className={selectClass}
          >
            <option value="">No time limit</option>
            {[15, 20, 30, 45, 60, 90, 120, 180].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </Field>

        <Field label="Due time in IST (optional)" htmlFor={`${classroom.id}-due`}>
          <input
            id={`${classroom.id}-due`}
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      {timeLimit ? (
        <p className="text-text-faint -mt-1 text-xs leading-relaxed">
          {/*
            Two different things a teacher might mean by "time", stated so they
            do not have to find out which one they set. The due date is a
            deadline for starting; the limit is a clock once they have.
          */}
          The clock starts when each student opens the set, not at the due time. Whatever they have
          answered when it runs out is what gets marked.
        </p>
      ) : null}
      <Field label="Questions come from" htmlFor={`${classroom.id}-pool`}>
        <select
          id={`${classroom.id}-pool`}
          value={sourcePool}
          onChange={(event) => {
            setSourcePool(toSourcePool(event.target.value));
          }}
          className={selectClass}
        >
          <option value="SHARED">Medhavi&rsquo;s bank, drawn at random</option>
          <option value="TEACHER_BANK">My own questions, drawn at random</option>
          <option value="CURATED">Questions I pick myself, including CBSE PYQs</option>
        </select>
      </Field>

      {sourcePool === "TEACHER_BANK" ? (
        <p className="text-text-faint -mt-1 text-xs leading-relaxed">
          Only questions you have imported from your own papers and set for students. Nobody outside
          this class ever sees them.
        </p>
      ) : null}

      {curated ? (
        <div>
          <p className="text-text-faint text-xs leading-relaxed">
            {/*
              The reason to pick rather than draw, in one sentence. It is not
              obvious, and a teacher who does not know it will keep choosing the
              default and then wonder why the item analysis says nothing.
            */}
            Every student sits the same questions in the same order, so their marks compare and the
            report afterwards can tell you which question the class got wrong. Turn on CBSE PYQs
            below to choose by paper year.
          </p>

          <QuestionPicker
            subjectId={classroom.subject.id}
            chapters={classroom.subject.chapters}
            pastPaperYears={pastPaperYears}
            selected={picked}
            onChange={setPicked}
          />
        </div>
      ) : null}

      <Field label="A note for students (optional)" htmlFor={`${classroom.id}-instructions`}>
        <textarea
          id={`${classroom.id}-instructions`}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          rows={2}
          placeholder="What should they pay attention to in this set?"
          className={`${textareaClass} min-h-20`}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Sending…" : curated ? "Set this test" : "Send practice"}
        </Button>
        <p className="text-text-faint text-xs">
          {curated
            ? `${String(picked.length)} question${picked.length === 1 ? "" : "s"}, the same for everyone.`
            : "Students receive their own question set when they start."}
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
      <label htmlFor={htmlFor} className="text-text mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
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
