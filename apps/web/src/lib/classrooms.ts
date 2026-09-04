import {
  assignmentReportSchema,
  studentClassroomListSchema,
  teacherClassroomListSchema,
  type AssignmentReport,
  type StudentClassroom,
  type TeacherClassroom,
} from "@samjho/contracts";

import { apiFetchAuthed } from "./api-client";

/** Server reads for the teaching loop. Classroom data is mutable by design. */
export async function loadStudentClassrooms(): Promise<StudentClassroom[]> {
  const data = await apiFetchAuthed("/api/v1/classrooms", studentClassroomListSchema, {
    cache: "no-store",
  });
  return data.classrooms;
}

export async function loadTeacherClassrooms(): Promise<TeacherClassroom[]> {
  const data = await apiFetchAuthed("/api/v1/classrooms", teacherClassroomListSchema, {
    cache: "no-store",
  });
  return data.classrooms;
}

export async function loadAssignmentReport(assignmentId: string): Promise<AssignmentReport> {
  const data = await apiFetchAuthed(
    `/api/v1/classrooms/assignments/${encodeURIComponent(assignmentId)}/report`,
    assignmentReportSchema,
    { cache: "no-store" },
  );
  return data;
}
