import { chapterListResponseSchema, subjectListResponseSchema } from "@samjho/contracts";
import type { Metadata } from "next";

import { QuestionBank } from "@/features/teacher/question-bank";
import { TeacherShell } from "@/features/teacher/teacher-shell";
import { apiFetchAuthed } from "@/lib/api-client";
import { requireTeacher } from "@/lib/me";
import { loadTeacherBank } from "@/lib/teacher";

export const metadata: Metadata = { title: "Question bank" };
export const dynamic = "force-dynamic";

/**
 * The filters are read from the URL and applied server-side, so the first paint
 * is already filtered. The alternative — render everything, then narrow in the
 * browser — shows a teacher a page of questions that is about to be replaced.
 */
export default async function TeacherQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireTeacher();
  const params = await searchParams;

  const single = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const subjectId = single("subjectId");

  const [bank, subjects, chapters] = await Promise.all([
    loadTeacherBank({
      subjectId,
      chapterId: single("chapterId"),
      difficulty: single("difficulty"),
      status: single("status"),
      marks: single("marks"),
      uploadId: single("uploadId"),
      search: single("search"),
      cursor: single("cursor"),
    }),
    apiFetchAuthed("/api/v1/catalog/subjects?board=CBSE&classLevel=10", subjectListResponseSchema, {
      cache: "no-store",
    }),
    // Chapters need a subject. With none chosen the picker falls back to the
    // chapters the bank itself reports, which is exactly the set that has
    // questions behind it.
    subjectId
      ? apiFetchAuthed(
          `/api/v1/catalog/subjects/${encodeURIComponent(subjectId)}/chapters`,
          chapterListResponseSchema,
          { cache: "no-store" },
        )
      : Promise.resolve(null),
  ]);

  const chapterOptions =
    chapters?.chapters.map((chapter) => ({ id: chapter.id, name: chapter.name })) ??
    bank.facets.byChapter.map((facet) => ({ id: facet.chapterId, name: facet.chapterName }));

  return (
    <TeacherShell
      title="Your question bank."
      blurb="Everything you have imported, filtered the way you actually need it — chapter, difficulty, marks."
    >
      <QuestionBank data={bank} chapters={chapterOptions} subjects={subjects.subjects} />
    </TeacherShell>
  );
}
