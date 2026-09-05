import type { Metadata } from "next";

import { readinessResponseSchema, type ReadinessResponse } from "@samjho/contracts";

import { cardClass } from "@/components/ui/surface";
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
export const metadata: Metadata = {
  title: "System status",
};

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
  const operational = result.ok && result.readiness.status === "ready";

  return (
    // A `<div>`, not a `<main>`: the marketing layout already supplies the
    // landmark. The wider composition gives a small operational page the same
    // deliberate rhythm as the rest of the public site.
    <div className="mx-auto flex w-full max-w-5xl flex-col px-5 py-12 sm:px-8 sm:py-16 lg:py-20">
      <header className="border-line grid gap-7 border-b pb-9 md:grid-cols-[minmax(0,1fr)_20rem] md:items-end md:gap-12 lg:pb-12">
        <div>
          <p className="text-brand-700 text-eyebrow uppercase">Service health</p>
          <h1 className="text-text text-title mt-3">System status</h1>
          <p className="text-text-soft mt-4 max-w-[48ch] leading-relaxed">
            Live health of the API and its database. This page checks the service again whenever it
            opens, so it never reports a cached result.
          </p>
        </div>

        <section
          aria-label="Overall service status"
          className={[
            "rounded-panel border p-5 sm:p-6",
            operational ? "border-tick-200 bg-tick-50" : "border-marker-200 bg-marker-50",
          ].join(" ")}
        >
          <p className="text-sand-600 text-eyebrow uppercase">Overall</p>
          <div className="mt-3 flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-1.5 size-2.5 shrink-0 rounded-full ${operational ? "bg-tick-600" : "bg-marker-600"}`}
            />
            <div>
              <p className="text-sand-900 text-subheading">
                {operational ? "All systems operational" : "Service needs attention"}
              </p>
              <p className="text-sand-600 mt-1 text-sm leading-relaxed">
                {operational
                  ? "Samjho is ready for practice."
                  : "See the detailed check below for the current issue."}
              </p>
            </div>
          </div>
        </section>
      </header>

      <div className="mt-8 grid gap-5 lg:mt-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.8fr)] lg:gap-6">
        <section
          aria-labelledby="status-heading"
          className={`${cardClass({ pad: "flush" })} overflow-hidden`}
        >
          <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
            <div>
              <h2 id="status-heading" className="text-text text-base font-semibold">
                Live checks
              </h2>
              <p className="text-text-faint mt-0.5 text-sm">
                Each check comes directly from the service.
              </p>
            </div>
            <StatusPill ok={operational} label={operational ? "Ready" : "Needs attention"} />
          </div>

          {result.ok ? (
            <dl className="divide-line divide-y px-5 sm:px-6">
              <Row label="Overall" value={result.readiness.status} ok={operational} />
              <Row label="Web → API" value="Connected" ok />
              <Row
                label="API service"
                value={`${result.readiness.service} v${result.readiness.version}`}
                ok
              />
              {result.readiness.checks.map((check) => (
                <Row
                  key={check.name}
                  label={check.name}
                  value={
                    check.status === "up"
                      ? `Up${check.latencyMs === null ? "" : ` · ${check.latencyMs}ms`}`
                      : (check.error ?? "Down")
                  }
                  ok={check.status === "up"}
                />
              ))}
            </dl>
          ) : (
            <div className="space-y-3 px-5 py-6 sm:px-6">
              <p className="text-marker-700 font-semibold">{result.title}</p>
              <p className="text-text-soft max-w-[58ch] leading-relaxed">{result.detail}</p>
              {result.requestId ? (
                <p className="border-line bg-raised text-text-faint w-fit rounded-control border px-3 py-2 font-mono text-xs">
                  Request ID: {result.requestId}
                </p>
              ) : null}
            </div>
          )}
        </section>

        <aside className={cardClass({ tone: "raised" })}>
          <p className="text-brand-700 text-eyebrow uppercase">What this checks</p>
          <h2 className="text-text text-heading mt-3">A short, honest signal</h2>
          <p className="text-text-soft mt-3 text-sm leading-relaxed">
            The status page confirms that the web app can reach Samjho&apos;s API and that the API
            can reach its required services. It does not inspect your account or practice data.
          </p>
          <div className="border-line mt-6 border-t pt-5">
            <p className="text-text text-sm font-semibold">Need support?</p>
            <p className="text-text-soft mt-1.5 text-sm leading-relaxed">
              If a check is down, refresh once. When contacting support, include the request ID if
              one is shown.
            </p>
          </div>
        </aside>
      </div>

      <p className="text-text-faint mt-6 text-sm">
        Status is refreshed on every visit and is independent of sign-in.
      </p>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-xs font-semibold",
        ok ? "bg-tick-100 text-sand-900" : "bg-marker-100 text-sand-900",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${ok ? "bg-tick-600" : "bg-marker-600"}`}
      />
      {label}
    </span>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-5 py-4 sm:py-[1.125rem]">
      <dt className="text-text-soft text-sm">{label}</dt>
      <dd className="flex max-w-[60%] items-center gap-2 text-right text-sm font-semibold">
        {/* Status is carried by the text, not only the dot — a colour-only
            signal is invisible to a colour-vision-deficient reader. */}
        <span
          aria-hidden="true"
          className={`inline-block size-2 rounded-full ${ok ? "bg-tick-600" : "bg-marker-600"}`}
        />
        <span className={ok ? "text-text" : "text-marker-700"}>{value}</span>
      </dd>
    </div>
  );
}
