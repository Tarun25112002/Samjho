"use client";

import {
  meResponseSchema,
  profileUpdateInputSchema,
  type ExamPhase,
  type Language,
  type StudentProfile,
} from "@samjho/contracts";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { sendJson } from "@/lib/client-api";

/**
 * Profile editing logic.
 *
 * The interesting part is `diff()`. `PATCH` means "change these fields", so
 * sending the whole form back would make every save a rewrite of every column —
 * which matters here rather than being merely inelegant: re-submitting the
 * unchanged parent email must not look like a change, because a *changed* parent
 * email deliberately clears recorded consent. Sending only what moved is what
 * keeps that server-side rule from firing on a no-op save.
 */

export interface ProfileDraft {
  school: string;
  preferredLanguage: Language;
  subjectIds: string[];
  session: string;
  phase: ExamPhase;
  parentEmail: string;
}

export function draftFromProfile(profile: StudentProfile): ProfileDraft {
  return {
    school: profile.school ?? "",
    preferredLanguage: profile.preferredLanguage,
    subjectIds: profile.subjects.map((subject) => subject.id),
    session: profile.targetExam?.session ?? "",
    phase: profile.targetExam?.phase ?? "PHASE_1",
    parentEmail: profile.parentEmail ?? "",
  };
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((value) => set.has(value));
}

/** Only the fields that actually moved. */
function diff(initial: ProfileDraft, draft: ProfileDraft): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  const school = draft.school.trim();
  if (school !== initial.school.trim()) {
    // Null, not "", to clear it: the contract allows null and rejects a
    // two-character minimum on an empty string.
    patch["school"] = school.length > 0 ? school : null;
  }

  if (draft.preferredLanguage !== initial.preferredLanguage) {
    patch["preferredLanguage"] = draft.preferredLanguage;
  }

  if (!sameSet(draft.subjectIds, initial.subjectIds)) {
    patch["subjectIds"] = draft.subjectIds;
  }

  if (draft.session !== initial.session || draft.phase !== initial.phase) {
    patch["targetExam"] = { session: draft.session, phase: draft.phase };
  }

  const parentEmail = draft.parentEmail.trim();
  if (parentEmail.toLowerCase() !== initial.parentEmail.trim().toLowerCase()) {
    patch["parentEmail"] = parentEmail;
  }

  return patch;
}

export type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string };

export function useProfileForm(profile: StudentProfile) {
  const router = useRouter();
  const [initial, setInitial] = useState(() => draftFromProfile(profile));
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<SaveState>({ status: "idle" });

  const update = useCallback((patch: Partial<ProfileDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors({});
    setState({ status: "idle" });
  }, []);

  const toggleSubject = useCallback((subjectId: string) => {
    setDraft((current) => ({
      ...current,
      subjectIds: current.subjectIds.includes(subjectId)
        ? current.subjectIds.filter((id) => id !== subjectId)
        : [...current.subjectIds, subjectId],
    }));
    setErrors({});
    setState({ status: "idle" });
  }, []);

  const save = useCallback(async () => {
    const patch = diff(initial, draft);

    if (Object.keys(patch).length === 0) {
      setState({ status: "error", message: "Nothing has changed yet." });
      return;
    }

    // Same schema the API validates with, so a rule can never be enforced on
    // only one side of the network.
    const parsed = profileUpdateInputSchema.safeParse(patch);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.map(String).join(".")] ??= issue.message;
      }
      setErrors(fieldErrors);
      setState({ status: "error", message: "Please fix the highlighted fields." });
      return;
    }

    setState({ status: "saving" });
    const result = await sendJson("PATCH", "/api/v1/me/profile", patch, meResponseSchema);

    if (!result.ok) {
      setErrors(result.failure.fieldErrors);
      setState({ status: "error", message: result.failure.message });
      return;
    }

    // Re-baseline from what the server actually stored, not from the draft. If
    // the API normalised anything — lower-casing the parent's email, say — the
    // next diff must be against that, or the field looks permanently dirty.
    if (result.data.profile) {
      const saved = draftFromProfile(result.data.profile);
      setInitial(saved);
      setDraft(saved);
    }

    setErrors({});
    setState({ status: "saved" });
    router.refresh();
  }, [draft, initial, router]);

  return { draft, errors, state, update, toggleSubject, save };
}
