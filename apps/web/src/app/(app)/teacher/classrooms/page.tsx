import { subjectListResponseSchema, type PastPaperYearOption } from "@samjho/contracts";
import type { Metadata } from "next";

import { TeacherWorkspace } from "@/features/classrooms/teacher-workspace";
import { TeacherShell } from "@/features/teacher/teacher-shell";
import { apiFetchAuthed } from "@/lib/api-client";
import { loadTeacherClassrooms } from "@/lib/classrooms";
import { requireTeacher } from "@/lib/me";
import { loadPastPaperYears } from "@/lib/past-papers";

export const metadata: Metadata = { title: "Classrooms" };
export const dynamic = "force-dynamic";

/**
 * Class 10 subjects only, and that is the catalog rather than a rule: the API
 * accepts any active CBSE subject, and this list becomes longer on its own the
 * day Class 12 is seeded. The classroom and subject catalog reads run in
 * parallel; the optional PYQ-year reads then follow from the subject ids.
 */
export default async function TeacherClassroomsPage({
  searchParams,
}: {
  searchParams: Promise<{ classroom?: string | string[]; chapter?: string | string[] }>;
}) {
  await requireTeacher();

  // These values only decide whether a form opens pre-filled. The classroom
  // card verifies the chapter belongs to that classroom before using it, and
  // the API repeats ownership + subject validation when the teacher submits.
  const query = await searchParams;
  const classroomId = singleQueryValue(query.classroom);
  const chapterId = singleQueryValue(query.chapter);

  const [classrooms, subjects] = await Promise.all([
    loadTeacherClassrooms(),
    apiFetchAuthed("/api/v1/catalog/subjects?board=CBSE&classLevel=10", subjectListResponseSchema, {
      cache: "no-store",
    }),
  ]);
  // A teacher only needs years which already have published questions behind
  // them. Loading these on the server avoids a flash of empty year controls in
  // the curated-test composer, and `loadPastPaperYears` turns a temporary
  // source failure into an empty optional control rather than a failed page.
  const pastPaperYearsBySubject: Record<string, PastPaperYearOption[]> = Object.fromEntries(
    await Promise.all(
      subjects.subjects.map(
        async (subject) => [subject.id, await loadPastPaperYears(subject.id)] as const,
      ),
    ),
  );

  return (
    <TeacherShell
      title="Your classrooms."
      blurb="Set focused practice, notice who needs a nudge, and keep student answers private to the student."
    >
      <TeacherWorkspace
        classrooms={classrooms}
        subjects={subjects.subjects}
        pastPaperYearsBySubject={pastPaperYearsBySubject}
        {...(classroomId && chapterId
          ? { assignmentPrefill: { classroomId, chapterId, source: "diagnostics" as const } }
          : {})}
      />
    </TeacherShell>
  );
}

function singleQueryValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
