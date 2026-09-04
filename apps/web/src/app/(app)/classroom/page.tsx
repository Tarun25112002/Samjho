import type { Metadata } from "next";

import { StudentClassroom } from "@/features/classrooms/student-classroom";
import { loadStudentClassrooms } from "@/lib/classrooms";
import { requireStudent } from "@/lib/me";

export const metadata: Metadata = { title: "Classroom" };
export const dynamic = "force-dynamic";

/** Student-facing assignment inbox. Private practice deliberately lives elsewhere. */
export default async function ClassroomPage() {
  await requireStudent();
  const classrooms = await loadStudentClassrooms();
  return <StudentClassroom classrooms={classrooms} />;
}
