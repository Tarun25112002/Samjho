import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TeacherShell } from "@/features/teacher/teacher-shell";
import { UploadReview } from "@/features/teacher/upload-review";
import { ApiClientError } from "@/lib/api-client";
import { requireTeacher } from "@/lib/me";
import { loadUpload } from "@/lib/teacher";

export const metadata: Metadata = { title: "Review paper" };
export const dynamic = "force-dynamic";

export default async function UploadReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTeacher();
  const { id } = await params;

  let upload;
  try {
    upload = await loadUpload(id);
  } catch (error) {
    // Scoped to the teacher in the API, so a 404 here means either "no such
    // upload" or "somebody else's" — and the page must not distinguish them.
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }

  return (
    <TeacherShell
      title="Check what was read."
      blurb="The questions Samjho was least sure about come first. Nothing reaches your bank until you accept it."
      action={
        <Link
          href="/teacher/uploads"
          className="text-text-soft hover:text-text text-sm font-semibold"
        >
          ← All papers
        </Link>
      }
    >
      <UploadReview upload={upload} />
    </TeacherShell>
  );
}
