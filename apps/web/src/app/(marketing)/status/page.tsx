import { readinessResponseSchema, type ReadinessResponse } from "@samjho/contracts";

import { ApiClientError, ApiParseError, apiFetch } from "@/lib/api-client";

/**
 * Unauthenticated status page.
 *
 * Its job is to prove the wiring end to end: this React Server Component calls
 * the Express API over HTTP, the response is parsed against a schema shared by
 * both apps, and the result renders. If this page shows "ready", the whole
 * spine — monorepo, shared contracts, API, database — is connected.
 *
 * Deliberately kept public and token-free even now that auth exists. When
 * something is broken, "is the API up?" must be answerable *without* a working
 * session — a status page that needs you to sign in is useless in exactly the
 * outage where you need it.
 */

// Never cached: a status page showing a stale "ready" is worse than useless.
export const dynamic = "force-dynamic";

type ProbeResult =
  | { ok: true; readiness: ReadinessResponse }
  | { ok: false; title: string; detail: string; requestId?: string };

async function probeApi(): Promise<ProbeResult> {
  try {
    // 503 is expected when a dependency is down — the body still describes
    // which one, and that is the interesting part of this page.
    return {
      ok: true,
      readiness: await apiFetch("/ready", readinessResponseSchema, { allowStatuses: [503] }),
    };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return {
        ok: false,
        title: "The API responded with an error",
        detail: error.message,
        requestId: error.requestId,
      };
    }
    if (error instanceof ApiParseError) {
      // This is the failure mode `packages/contracts` exists to surface: the API
      // replied, but not in the shape both apps agreed on.
      return {
        ok: false,
        title: "Contract mismatch",
        detail: "The API replied in a shape that does not match @samjho/contracts.",
      };
    }
    return {
      ok: false,
      title: "Could not reach the API",
      detail: "Is it running? Try `pnpm dev`, and `pnpm db:up` for Postgres.",
    };
  }
}

export default async function StatusPage() {
  const result = await probeApi();

  return (
    // A `<div>`, not a `<main>`: the marketing layout now supplies the landmark,
    // and two of them on one page means a screen reader offers a choice of "main
    // content" — which is not a choice anyone can make. The rest of this page's
    // styling is Phase 2's and is redesigned with the other utility surfaces.
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-text text-title">System status</h1>
        <p className="text-text-soft text-base">
          Live health of the API and its database, checked on every page load.
        </p>
      </header>

      <section
        aria-labelledby="status-heading"
        className="border-ink-100 dark:border-ink-700 rounded-xl border p-5"
      >
        {/* Was a second "System status" under the first. The heading now names
            what is in the list rather than repeating the page. */}
        <h2 id="status-heading" className="text-text mb-4 text-sm font-semibold">
          Checks
        </h2>

        {result.ok ? (
          <dl className="space-y-3 text-sm">
            <Row
              label="Overall"
              value={result.readiness.status}
              ok={result.readiness.status === "ready"}
            />
            <Row label="Web → API" value="connected" ok />
            <Row
              label="API"
              value={`${result.readiness.service} v${result.readiness.version}`}
              ok
            />
            {result.readiness.checks.map((check) => (
              <Row
                key={check.name}
                label={check.name}
                value={
                  check.status === "up"
                    ? `up${check.latencyMs === null ? "" : ` · ${check.latencyMs}ms`}`
                    : (check.error ?? "down")
                }
                ok={check.status === "up"}
              />
            ))}
          </dl>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-danger font-medium">{result.title}</p>
            <p className="text-ink-500 dark:text-ink-300">{result.detail}</p>
            {result.requestId ? (
              <p className="text-ink-500 dark:text-ink-300 font-mono text-xs">
                request id: {result.requestId}
              </p>
            ) : null}
          </div>
        )}
      </section>

      <footer className="text-ink-500 dark:text-ink-300 text-sm">
        Specification and architecture live in{" "}
        <code className="text-ink-700 dark:text-ink-100 font-mono">docs/</code>.
      </footer>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-500 dark:text-ink-300">{label}</dt>
      <dd className="flex items-center gap-2 text-right font-medium">
        {/* Status is carried by the text, not only the dot — a colour-only
            signal is invisible to a colour-vision-deficient reader. */}
        <span
          aria-hidden="true"
          className={`inline-block size-2 rounded-full ${ok ? "bg-success" : "bg-danger"}`}
        />
        <span className={ok ? "text-ink-900 dark:text-ink-50" : "text-danger"}>{value}</span>
      </dd>
    </div>
  );
}
