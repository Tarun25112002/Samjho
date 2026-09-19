import { AI_CONTEXT_LABELS, type AIConversation } from "@medhavi/contracts";
import type { Metadata } from "next";
import Link from "next/link";

import { ChevronRight, SparkIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, Chip, IconTile, Meter } from "@/components/ui/surface";
import { loadConversations, loadTutorStatus } from "@/lib/ai";
import { requireStudent } from "@/lib/me";

export const metadata: Metadata = { title: "AI tutor" };
export const dynamic = "force-dynamic";

/**
 * The tutor, as a place rather than as a panel.
 *
 * ## Why this page does not have a "start a chat" box
 *
 * The tutor is grounded: every fact it is given about a question is assembled
 * server-side from the database, and the API refuses a conversation that names
 * neither a question nor a chapter (docs/05 §2). That is not a limitation to be
 * worked around here — it is the reason the tutor can be trusted at all. A
 * free-text box on this page would be a general-purpose chatbot wearing the
 * product's name, answering CBSE questions from memory instead of from the
 * marking scheme.
 *
 * So this page does the two things a standalone tutor space usefully can: it
 * shows what has already been asked, and it says where asking happens. Every
 * conversation here can be picked up where it was left.
 *
 * ## The quota is at the top, not at the bottom
 *
 * docs/05 §5.1 — a limit a student can see coming feels fair, and the same
 * limit arriving unannounced mid-revision feels punitive.
 */
export default async function AITutorPage() {
  await requireStudent();

  const [status, conversations] = await Promise.all([
    loadTutorStatus(),
    loadConversations().catch(() => ({
      items: [],
      pageInfo: { hasMore: false, nextCursor: null },
    })),
  ]);

  const used = status.quota.messagesUsed;
  const limit = status.quota.messagesLimit;

  return (
    <PageShell width="default">
      <PageHeader
        eyebrow="AI tutor"
        title="Ask about anything you have been stuck on."
        lede="The tutor works from Medhavi's own marking schemes, so it explains the method your paper expects rather than a method that happens to work."
      />

      {status.available ? null : (
        <p className="rounded-control border-half-200 bg-half-50 text-sand-800 border px-4 py-3 text-sm">
          The tutor is unavailable right now. You will still get the stored worked solution for
          every question — it just will not be able to answer follow-ups.
        </p>
      )}

      <Card aria-labelledby="quota-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="quota-heading" className="text-text font-semibold">
            Today&rsquo;s allowance
          </h2>
          <p className="text-text-soft text-sm tabular-nums">
            {status.quota.messagesRemaining} of {limit} left
          </p>
        </div>

        <Meter percent={(used / Math.max(limit, 1)) * 100} className="mt-3" />

        <p className="text-text-faint mt-2 text-xs">
          Resets at midnight. Hints and worked solutions that come from the question bank do not
          count against it.
        </p>
      </Card>

      <section aria-labelledby="where-heading" className="flex flex-col gap-4">
        <SectionHeading
          id="where-heading"
          eyebrow="Where to ask"
          title="The tutor sits with the question"
          lede="It needs to know what you are looking at, so it is opened from a question rather than from here."
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <EntryCard
            href="/practice"
            title="Under any question you practise"
            body="Hints first, then an explanation, then the full worked solution — in that order, so you get the chance to solve it yourself."
          />
          <EntryCard
            href="/revision"
            title="On a mistake you are reviewing"
            body="Once you have answered, the tutor can read your own attempt and tell you what went wrong with it specifically."
          />
        </div>
      </section>

      <section aria-labelledby="history-heading" className="flex flex-col gap-4">
        <SectionHeading
          id="history-heading"
          eyebrow="Your conversations"
          title="What you have asked"
          lede="Every one can be picked up where you left it."
        />

        {conversations.items.length === 0 ? (
          <Card pad="roomy" className="flex flex-col items-start gap-4">
            <SparkIcon className="text-brand-600 size-7" />
            <div>
              <p className="text-text font-semibold">You have not asked the tutor anything yet.</p>
              <p className="text-text-soft mt-2 max-w-xl text-sm leading-relaxed">
                Next time a question does not make sense, open &ldquo;Stuck? Ask the tutor&rdquo;
                underneath it. Start with a hint — it is the rung that leaves you something to work
                out.
              </p>
            </div>
            <ButtonLink href="/practice">Start practising</ButtonLink>
          </Card>
        ) : (
          <Card pad="flush" className="overflow-hidden">
            <ul className="divide-line divide-y">
              {conversations.items.map((conversation) => (
                <ConversationRow key={conversation.id} conversation={conversation} />
              ))}
            </ul>
          </Card>
        )}
      </section>
    </PageShell>
  );
}

function EntryCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Card as="article" className="flex flex-col gap-3">
      <h3 className="text-text text-sm font-semibold">{title}</h3>
      <p className="text-text-soft flex-1 text-sm leading-relaxed">{body}</p>
      <Link
        href={href}
        className="text-brand-700 inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline"
      >
        Go there <ChevronRight className="size-4" />
      </Link>
    </Card>
  );
}

function ConversationRow({ conversation }: { conversation: AIConversation }) {
  return (
    <li>
      <Link
        href={`/ai-tutor/${conversation.id}`}
        className="hover:bg-raised/60 flex min-h-16 items-center gap-4 px-5 py-4 transition-colors sm:px-6"
      >
        <IconTile tone="brand">
          <SparkIcon className="size-5" />
        </IconTile>

        <div className="min-w-0 flex-1">
          <p className="text-text truncate text-sm font-medium">{conversation.title}</p>
          <p className="text-text-faint mt-0.5 truncate text-xs">
            {conversation.messageCount} {conversation.messageCount === 1 ? "message" : "messages"} ·{" "}
            {formatWhen(conversation.updatedAt)}
          </p>
        </div>

        <Chip tone={conversation.status === "ARCHIVED" ? "neutral" : "outline"}>
          {AI_CONTEXT_LABELS[conversation.context]}
        </Chip>

        <ChevronRight className="text-text-faint size-5 shrink-0" />
      </Link>
    </li>
  );
}

/**
 * Dates in IST, because that is the only calendar this product has and a
 * conversation from "yesterday evening" must not read as today's.
 */
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}
