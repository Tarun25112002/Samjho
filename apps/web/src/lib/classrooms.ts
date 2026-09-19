import {
  assignmentItemAnalysisSchema,
  assignmentReportSchema,
  classroomDiagnosticsSchema,
  studentClassroomListSchema,
  teacherClassroomListSchema,
  type AssignmentItemAnalysis,
  type AssignmentReport,
  type ClassroomDiagnostics,
  type StudentClassroom,
  type TeacherClassroom,
} from "@medhavi/contracts";

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

/**
 * Class diagnostics and per-item analysis.
 *
 * `cache: "no-store"` like everything else in this file, and here for a reason
 * worth naming: these pages are read *during* a lesson, minutes after a class
 * finished a test. A cached answer to "what did they get wrong?" is an answer
 * about a different lesson.
 */
export async function loadClassroomDiagnostics(classroomId: string): Promise<ClassroomDiagnostics> {
  return apiFetchAuthed(
    `/api/v1/classrooms/${encodeURIComponent(classroomId)}/diagnostics`,
    classroomDiagnosticsSchema,
    { cache: "no-store" },
  );
}

export async function loadAssignmentItemAnalysis(
  assignmentId: string,
): Promise<AssignmentItemAnalysis> {
  return apiFetchAuthed(
    `/api/v1/classrooms/assignments/${encodeURIComponent(assignmentId)}/item-analysis`,
    assignmentItemAnalysisSchema,
    { cache: "no-store" },
  );
}
