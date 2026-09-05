"use client";

import type { StudentProfile, SubjectSummary } from "@samjho/contracts";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceCard, FieldError, inputClass, Label, selectClass } from "@/components/ui/form";
import { cardClass } from "@/components/ui/surface";
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
      className={`${cardClass()} flex flex-col gap-7`}
      onSubmit={(event) => {
        event.preventDefault();
        void form.save();
      }}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="school">School</Label>
          <input
            id="school"
            value={form.draft.school}
            onChange={(event) => {
              form.update({ school: event.target.value });
            }}
            aria-invalid={Boolean(form.errors["school"])}
            className={inputClass}
          />
          <FieldError message={form.errors["school"]} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="preferredLanguage">Preferred language</Label>
          <select
            id="preferredLanguage"
            value={form.draft.preferredLanguage}
            onChange={(event) => {
              form.update({
                preferredLanguage: event.target.value === "HINDI" ? "HINDI" : "ENGLISH",
              });
            }}
            className={selectClass}
          >
            <option value="ENGLISH">English</option>
            <option value="HINDI">Hindi</option>
          </select>
        </div>
      </div>

      <fieldset className="border-line flex flex-col gap-3 border-t pt-7">
        <legend className="text-text text-sm font-semibold">Subjects</legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {subjectOptions.map((subject) => (
            <li key={subject.id}>
              <ChoiceCard
                selected={form.draft.subjectIds.includes(subject.id)}
                className="items-center p-3.5"
              >
                <input
                  type="checkbox"
                  checked={form.draft.subjectIds.includes(subject.id)}
                  onChange={() => {
                    form.toggleSubject(subject.id);
                  }}
                  className="accent-brand-500 size-4"
                />
                <span className="text-text text-sm font-medium">{subject.name}</span>
              </ChoiceCard>
            </li>
          ))}
        </ul>
        <FieldError message={form.errors["subjectIds"]} />
        <p className="text-text-soft text-xs leading-relaxed">
          Un-ticking a subject hides it, but keeps everything you have already practised in it.
        </p>
      </fieldset>

      <fieldset className="border-line flex flex-col gap-3 border-t pt-7">
        <legend className="text-text text-sm font-semibold">Target sitting</legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {sessionOptions.map((option) => (
            <li key={`${option.session}-${option.phase}`}>
              <ChoiceCard
                selected={
                  form.draft.session === option.session && form.draft.phase === option.phase
                }
                className="items-center p-3.5"
              >
                <input
                  type="radio"
                  name="targetExam"
                  checked={
                    form.draft.session === option.session && form.draft.phase === option.phase
                  }
                  onChange={() => {
                    form.update({ session: option.session, phase: option.phase });
                  }}
                  className="accent-brand-500 size-4"
                />
                <span className="text-text text-sm font-medium">{option.label}</span>
              </ChoiceCard>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="border-line flex flex-col gap-2 border-t pt-7">
        <Label htmlFor="parentEmail">Parent or guardian&rsquo;s email</Label>
        <input
          id="parentEmail"
          type="email"
          value={form.draft.parentEmail}
          onChange={(event) => {
            form.update({ parentEmail: event.target.value });
          }}
          aria-invalid={Boolean(form.errors["parentEmail"])}
          aria-describedby="parentEmail-hint"
          className={inputClass}
        />
        <p id="parentEmail-hint" className="text-text-soft text-xs leading-relaxed">
          Changing this clears any consent already recorded, because consent was given by the person
          at the old address.
        </p>
        <FieldError message={form.errors["parentEmail"]} />
      </div>

      <div className="border-line flex flex-wrap items-center gap-4 border-t pt-6">
        <Button type="submit" disabled={form.state.status === "saving"}>
          {form.state.status === "saving" ? "Saving…" : "Save changes"}
        </Button>

        {/* `role="status"` so the outcome is announced, not just shown. */}
        <p role="status" className="text-sm font-medium">
          {form.state.status === "saved" ? (
            <span className="text-tick-700">Saved.</span>
          ) : form.state.status === "error" ? (
            <span className="text-marker-700">{form.state.message}</span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
