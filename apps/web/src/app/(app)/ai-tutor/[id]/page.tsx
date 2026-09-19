import { AI_CONTEXT_LABELS } from "@samjho/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader, PageShell } from "@/components/ui/page";
import { Card, Chip } from "@/components/ui/surface";
import { ResumedConversation } from "@/features/ai/resumed-conversation";
import { ApiClientError } from "@/lib/api-client";
import { loadConversation } from "@/lib/ai";
import { requireStudent } from "@/lib/me";

export const metadata: Metadata = { title: "Tutor conversation" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * One conversation, picked up where it was left.
 *
 * The transcript is rendered on the server and the live part takes over from
 * there, so a student opening this on a slow connection reads what they asked
 * last week without waiting for any JavaScript.
 *
 * Which actions are still available comes from the API rather than being
 * recomputed here. The server knows whether this conversation has an attempt
 * behind it — which is what gates "why was I wrong" — and a client-side guess
 * at that would be a chip that produces an error.
 */
export default async function TutorConversationPage({ params }: PageProps) {
  const { id } = await params;
  await requireStudent();

  const conversation = await loadOr404(id);

  return (
    <PageShell width="narrow">
      <PageHeader
        back={{ href: "/ai-tutor", label: "AI tutor" }}
        eyebrow="Tutor conversation"
        title={conversation.title}
        action={<Chip tone="outline">{AI_CONTEXT_LABELS[conversation.context]}</Chip>}
      />

      {conversation.status === "ARCHIVED" ? (
        <p className="rounded-control border-line bg-raised text-text-soft border px-4 py-3 text-sm">
          This conversation is archived. You can read it, but new questions belong in a fresh one
          alongside the question you are working on.
        </p>
      ) : null}

      <Card pad="roomy">
        <ResumedConversation
          conversationId={conversation.id}
          questionId={conversation.questionId}
          availableActions={conversation.availableActions}
          readOnly={conversation.status === "ARCHIVED"}
          initialTurns={conversation.messages
            .filter((message) => message.role !== "SYSTEM")
            .map((message) => ({
              id: message.id,
              role: message.role === "USER" ? ("USER" as const) : ("ASSISTANT" as const),
              content: message.content,
            }))}
        />
      </Card>
    </PageShell>
  );
}

async function loadOr404(id: string) {
  try {
    return await loadConversation(id);
  } catch (error) {
    // A conversation belonging to somebody else is a 404 from the API, not a
    // 403, so that this page cannot be used to find out which ids exist.
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }
}
