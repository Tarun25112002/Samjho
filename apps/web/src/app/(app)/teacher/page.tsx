import type { Metadata } from "next";

import { TeacherDashboardView } from "@/features/teacher/dashboard";
import { TeacherShell } from "@/features/teacher/teacher-shell";
import { loadTeacherDashboard } from "@/lib/teacher";
import { requireTeacher } from "@/lib/me";

export const metadata: Metadata = { title: "Teaching" };
export const dynamic = "force-dynamic";

export default async function TeacherOverviewPage() {
  const me = await requireTeacher();
  const dashboard = await loadTeacherDashboard();

  const firstName = me.user.name?.split(" ")[0];

  return (
    <TeacherShell
      title={firstName ? `Where things stand, ${firstName}.` : "Where things stand."}
      blurb="What needs you next, and nothing that does not. Student answers stay with the student."
    >
      <TeacherDashboardView data={dashboard} />
    </TeacherShell>
  );
}
