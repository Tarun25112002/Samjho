"use client";

import type { StudentProfile, SubjectSummary } from "@samjho/contracts";
import { useMemo } from "react";

import { suggestBoardSessions } from "@/features/onboarding/board-sessions";

import { useProfileForm } from "./use-profile-form";

/**
 * Edit form for the parts of a profile a student may change.
 *
 * Class level and board are absent, and that is a product decision rather than
 * an unfinished one: changing either invalidates every enrolment, mastery rollup
 * and practice attempt on the account. The API refuses it too — this form simply
 * does not offer a control the server would reject.
 */
export function ProfileForm({
  profile,
  subjectOptions,
}: {
  profile: StudentProfile;
  subjectOptions: SubjectSummary[];
}) {
  const form = useProfileForm(profile);
  const sessions = useMemo(() => suggestBoardSessions(new Date()), []);

  // The student's current target may be older than anything `suggestBoardSessions`
  // offers — they onboarded a year ago. Merging it in stops the radio group from
  // silently showing nothing selected.
  const sessionOptions = useMemo(() => {
    const current = form.draft.session;
    const known = sessions.some(
      (option) => option.session === current && option.phase === form.draft.phase,
    );
    if (known || current.length === 0) return sessions;

    return [
      {
        session: current,
        phase: form.draft.phase,
        label: `${form.draft.phase === "PHASE_1" ? "February" : "May"} ${current}`,
        hint: "Your current target.",
      },
      ...sessions,
    ];
  }, [sessions, form.draft.session, form.draft.phase]);

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void form.save();
      }}
    >
      <div className="space-y-2">
        <label
          htmlFor="school"
          className="text-ink-700 dark:text-ink-100 block text-sm font-medium"
        >
          School
        </label>
        <input
          id="school"
          value={form.draft.school}
          onChange={(event) => {
            form.update({ school: event.target.value });
          }}
          aria-invalid={Boolean(form.errors["school"])}
          className="border-ink-300 dark:border-ink-700 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
        />
        <Error message={form.errors["school"]} />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="preferredLanguage"
          className="text-ink-700 dark:text-ink-100 block text-sm font-medium"
        >
          Preferred language
        </label>
        <select
          id="preferredLanguage"
          value={form.draft.preferredLanguage}
          onChange={(event) => {
            form.update({
              preferredLanguage: event.target.value === "HINDI" ? "HINDI" : "ENGLISH",
            });
          }}
          className="border-ink-300 dark:border-ink-700 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
        >
          <option value="ENGLISH">English</option>
          <option value="HINDI">Hindi</option>
        </select>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-ink-700 dark:text-ink-100 text-sm font-medium">Subjects</legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {subjectOptions.map((subject) => (
            <li key={subject.id}>
              <label className="border-ink-100 dark:border-ink-700 flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.draft.subjectIds.includes(subject.id)}
                  onChange={() => {
                    form.toggleSubject(subject.id);
                  }}
                />
                <span className="text-ink-900 dark:text-ink-50">{subject.name}</span>
              </label>
            </li>
          ))}
        </ul>
        <Error message={form.errors["subjectIds"]} />
        <p className="text-ink-500 dark:text-ink-300 text-xs">
          Un-ticking a subject hides it, but keeps everything you have already practised in it.
        </p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-ink-700 dark:text-ink-100 text-sm font-medium">
          Target sitting
        </legend>
        <ul className="space-y-2">
          {sessionOptions.map((option) => (
            <li key={`${option.session}-${option.phase}`}>
              <label className="border-ink-100 dark:border-ink-700 flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm">
                <input
                  type="radio"
                  name="targetExam"
                  checked={
                    form.draft.session === option.session && form.draft.phase === option.phase
                  }
                  onChange={() => {
                    form.update({ session: option.session, phase: option.phase });
                  }}
                />
                <span className="text-ink-900 dark:text-ink-50">{option.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="space-y-2">
        <label
          htmlFor="parentEmail"
          className="text-ink-700 dark:text-ink-100 block text-sm font-medium"
        >
          Parent or guardian&rsquo;s email
        </label>
        <input
          id="parentEmail"
          type="email"
          value={form.draft.parentEmail}
          onChange={(event) => {
            form.update({ parentEmail: event.target.value });
          }}
          aria-invalid={Boolean(form.errors["parentEmail"])}
          aria-describedby="parentEmail-hint"
          className="border-ink-300 dark:border-ink-700 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
        />
        <p id="parentEmail-hint" className="text-ink-500 dark:text-ink-300 text-xs text-pretty">
          Changing this clears any consent already recorded, because consent was given by the person
          at the old address.
        </p>
        <Error message={form.errors["parentEmail"]} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={form.state.status === "saving"}
          className="bg-brand-600 hover:bg-brand-500 rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
        >
          {form.state.status === "saving" ? "Saving…" : "Save changes"}
        </button>

        {/* `role="status"` so the outcome is announced, not just shown. */}
        <p role="status" className="text-sm">
          {form.state.status === "saved" ? (
            <span className="text-success">Saved.</span>
          ) : form.state.status === "error" ? (
            <span className="text-danger">{form.state.message}</span>
          ) : null}
        </p>
      </div>
    </form>
  );
}

function Error({ message }: { message: string | undefined }) {
  if (message === undefined) return null;
  return (
    <p role="alert" className="text-danger text-sm">
      {message}
    </p>
  );
}
