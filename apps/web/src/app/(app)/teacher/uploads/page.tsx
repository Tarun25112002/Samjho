import { subjectListResponseSchema } from "@samjho/contracts";
import type { Metadata } from "next";

import { TeacherShell } from "@/features/teacher/teacher-shell";
import { UploadList } from "@/features/teacher/upload-list";
import { apiFetchAuthed } from "@/lib/api-client";
import { requireTeacher } from "@/lib/me";
import { loadUploads } from "@/lib/teacher";

export const metadata: Metadata = { title: "Papers" };
export const dynamic = "force-dynamic";

export default async function TeacherUploadsPage() {
  await requireTeacher();

  const [uploadList, subjects] = await Promise.all([
    loadUploads(),
    apiFetchAuthed("/api/v1/catalog/subjects?board=CBSE&classLevel=10", subjectListResponseSchema, {
      cache: "no-store",
    }),
  ]);

  return (
    <TeacherShell
      title="Your papers."
      blurb="Upload a paper and Samjho writes out its questions — you check the ones it was unsure about."
    >
      <UploadList
        uploads={uploadList.uploads}
        subjects={subjects.subjects}
        aiConfigured={uploadList.aiConfigured}
      />
    </TeacherShell>
  );
}
