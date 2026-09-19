import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ExamRunner } from "@/features/exam/exam-runner";
import { ApiClientError } from "@/lib/api-client";
import { loadExamAttempt } from "@/lib/exam";

export const metadata: Metadata = { title: "Exam in progress" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * The live paper.
 *
 * Rendered on the server on every load, which is what makes a refresh at two
 * hours and fifty minutes safe: the attempt comes back with every saved answer,
 * its per-slot status and the original `deadlineAt`, and the runner rehydrates
 * from that rather than from anything it kept locally.
 *
 * A finished attempt redirects to its result instead of rendering a paper
 * nobody can write in. That covers the student who submitted on one device and
 * still has the tab open on another — and, more commonly, the one who reloads
 * after the sweeper closed an attempt they left overnight.
 */
export default async function ExamAttemptPage({ params }: PageProps) {
  const { id } = await params;

  const attempt = await loadOr404(id);

  if (attempt.status !== "IN_PROGRESS") {
    redirect(`/exams/attempts/${id}/result`);
  }

  return <ExamRunner attempt={attempt} />;
}

async function loadOr404(id: string) {
  try {
    return await loadExamAttempt(id);
  } catch (error) {
    // An attempt belonging to somebody else answers 404, not 403, so this page
    // cannot be used to find out which attempt ids exist.
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }
}
