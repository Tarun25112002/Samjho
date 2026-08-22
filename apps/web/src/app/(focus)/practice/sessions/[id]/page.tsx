import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PracticeRunner } from "@/features/practice/practice-runner";
import { ApiClientError } from "@/lib/api-client";
import { loadSession } from "@/lib/practice";

export const metadata: Metadata = { title: "Practice" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * The practice runner.
 *
 * The whole session — questions, the student's place in it, and any answers
 * already given — is fetched on the server and handed to the client component as
 * its initial state. That is what makes a reload mid-set resume rather than
 * restart, and it is the same shape the runner receives back from every
 * mutation, so there is one description of a session rather than two.
 *
 * A finished session redirects to its result instead of re-rendering as a
 * read-only runner. There is exactly one thing a student wants from a URL for a
 * set they have already completed, and it is not the questions again.
 */
export default async function PracticeSessionPage({ params }: PageProps) {
  const { id } = await params;

  let session;
  try {
    session = await loadSession(id);
  } catch (error) {
    // 404 covers both "no such session" and "not yours" — the API deliberately
    // does not distinguish them, and neither does this.
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }

  if (session.status !== "IN_PROGRESS") redirect(`/practice/sessions/${id}/result`);

  return <PracticeRunner initial={session} />;
}
