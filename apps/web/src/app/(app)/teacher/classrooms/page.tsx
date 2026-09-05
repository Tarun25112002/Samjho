import { subjectListResponseSchema } from "@samjho/contracts";
import type { Metadata } from "next";

import { TeacherWorkspace } from "@/features/classrooms/teacher-workspace";
import { TeacherShell } from "@/features/teacher/teacher-shell";
import { apiFetchAuthed } from "@/lib/api-client";
import { loadTeacherClassrooms } from "@/lib/classrooms";
import { requireTeacher } from "@/lib/me";

export const metadata: Metadata = { title: "Classrooms" };
export const dynamic = "force-dynamic";

/**
 * Class 10 subjects only, and that is the catalog rather than a rule: the API
 * accepts any active CBSE subject, and this list becomes longer on its own the
 * day Class 12 is seeded. Two requests in parallel because the page needs both
 * before it can render either.
 */
export default async function TeacherClassroomsPage() {
  await requireTeacher();

  const [classrooms, subjects] = await Promise.all([
    loadTeacherClassrooms(),
    apiFetchAuthed("/api/v1/catalog/subjects?board=CBSE&classLevel=10", subjectListResponseSchema, {
      cache: "no-store",
    }),
  ]);

  return (
    <TeacherShell
      title="Your classrooms."
      blurb="Set focused practice, notice who needs a nudge, and keep student answers private to the student."
    >
      <TeacherWorkspace classrooms={classrooms} subjects={subjects.subjects} />
    </TeacherShell>
  );
}
