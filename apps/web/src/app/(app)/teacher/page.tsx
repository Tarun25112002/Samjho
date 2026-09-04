import { subjectListResponseSchema } from "@samjho/contracts";
import type { Metadata } from "next";

import { TeacherWorkspace } from "@/features/classrooms/teacher-workspace";
import { apiFetchAuthed } from "@/lib/api-client";
import { loadTeacherClassrooms } from "@/lib/classrooms";
import { requireTeacher } from "@/lib/me";

export const metadata: Metadata = { title: "Teaching" };
export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  await requireTeacher();
  const [classrooms, subjects] = await Promise.all([
    loadTeacherClassrooms(),
    apiFetchAuthed("/api/v1/catalog/subjects?board=CBSE&classLevel=10", subjectListResponseSchema, {
      cache: "no-store",
    }),
  ]);

  return <TeacherWorkspace classrooms={classrooms} subjects={subjects.subjects} />;
}
