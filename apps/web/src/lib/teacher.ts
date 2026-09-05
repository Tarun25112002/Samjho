import {
  paperUploadDetailSchema,
  paperUploadListSchema,
  teacherBankResponseSchema,
  teacherDashboardSchema,
  type PaperUploadDetail,
  type PaperUploadList,
  type TeacherBankResponse,
  type TeacherDashboard,
} from "@samjho/contracts";

import { apiFetchAuthed } from "./api-client";

/**
 * Server reads for the teacher workspace.
 *
 * All `cache: "no-store"`, and not out of caution: every one of these changes
 * under the teacher while they watch. An upload's status moves from EXTRACTING
 * to READY on its own, a bank grows the moment an import lands, and a dashboard
 * counting overdue work is wrong the instant it is stale. A cached teacher
 * dashboard is a teacher chasing students who already finished.
 */

export async function loadTeacherDashboard(): Promise<TeacherDashboard> {
  return apiFetchAuthed("/api/v1/teacher/dashboard", teacherDashboardSchema, {
    cache: "no-store",
  });
}

export async function loadUploads(): Promise<PaperUploadList> {
  return apiFetchAuthed("/api/v1/teacher/uploads", paperUploadListSchema, { cache: "no-store" });
}

export async function loadUpload(uploadId: string): Promise<PaperUploadDetail> {
  return apiFetchAuthed(
    `/api/v1/teacher/uploads/${encodeURIComponent(uploadId)}`,
    paperUploadDetailSchema,
    { cache: "no-store" },
  );
}

export async function loadTeacherBank(
  search: Record<string, string | undefined>,
): Promise<TeacherBankResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && value !== "") params.set(key, value);
  }

  const query = params.toString();
  return apiFetchAuthed(
    `/api/v1/teacher/questions${query ? `?${query}` : ""}`,
    teacherBankResponseSchema,
    { cache: "no-store" },
  );
}
