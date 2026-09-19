import type { Metadata } from "next";

import { BackLink } from "@/components/ui/page";
import { ClassDiagnostics } from "@/features/teacher/class-diagnostics";
import { TeacherShell } from "@/features/teacher/teacher-shell";
import { loadClassroomDiagnostics } from "@/lib/classrooms";
import { requireTeacher } from "@/lib/me";

export const metadata: Metadata = { title: "Class diagnostics" };
export const dynamic = "force-dynamic";

/**
 * What one class got wrong.
 *
 * A page rather than a panel on the classroom card, because it is read in a
 * different posture: the workspace is scanned between lessons to see who has
 * finished, and this is read while planning the next lesson. Folding it into the
 * card would put twenty questions of item analysis inside a list of classrooms.
 *
 * Ownership is enforced in the service, not here — the classroom query has the
 * teacher's id in its `where`, so a teacher opening another teacher's classroom
 * id gets a 404 rather than a 403. `requireTeacher` above is the role check and
 * is not the ownership one.
 */
export default async function ClassDiagnosticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();

  const { id } = await params;
  const diagnostics = await loadClassroomDiagnostics(id);

  return (
    <TeacherShell
      title={`${diagnostics.classroomName}: what they got wrong.`}
      blurb="Class-wide patterns only. Individual answers stay with the student who wrote them."
    >
      <div className="mb-5">
        <BackLink href="/teacher/classrooms">Classrooms</BackLink>
      </div>

      <ClassDiagnostics diagnostics={diagnostics} />
    </TeacherShell>
  );
}
