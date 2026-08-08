import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DataState } from "./data-state.js";
import { describeError } from "./display-error.js";

/**
 * The four states are a product rule (docs/01 §8), so they are tested as a
 * product rule: precedence between them, what each one is obliged to offer, and
 * the one thing that must never happen — an internal error string reaching a
 * student.
 */

function renderList(props: Partial<Parameters<typeof DataState<string[]>>[0]> = {}) {
  return render(
    <DataState<string[]> data={props.data ?? ["Real Numbers"]} {...props}>
      {(items) => (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </DataState>,
  );
}

describe("DataState — state selection", () => {
  it("renders the content when there is data", () => {
    renderList();
    expect(screen.getByText("Real Numbers")).toBeInTheDocument();
  });

  it("treats an empty array as empty by default", () => {
    renderList({ data: [], emptyTitle: "No chapters yet" });
    expect(screen.getByText("No chapters yet")).toBeInTheDocument();
  });

  it("treats null and undefined as empty rather than crashing on them", () => {
    renderList({ data: null, emptyTitle: "Nothing" });
    expect(screen.getByText("Nothing")).toBeInTheDocument();

    renderList({ data: undefined, emptyTitle: "Nothing" });
    expect(screen.getAllByText("Nothing")).toHaveLength(2);
  });

  it("honours a custom emptiness test", () => {
    render(
      <DataState<{ items: string[] }>
        data={{ items: [] }}
        isEmpty={(value) => value.items.length === 0}
        emptyTitle="No questions"
      >
        {(value) => <p>{value.items.length} questions</p>}
      </DataState>,
    );

    expect(screen.getByText("No questions")).toBeInTheDocument();
  });

  it("shows the error, not the empty state, when a failed request returned no data", () => {
    // The precedence that matters. "Nothing here yet" over a failed fetch is a
    // lie — and specifically the kind that makes a student stop believing a
    // number the app shows them.
    renderList({
      data: [],
      error: { message: "We could not load your chapters.", retryable: true },
      emptyTitle: "No chapters yet",
    });

    expect(screen.getByRole("alert")).toHaveTextContent("We could not load your chapters.");
    expect(screen.queryByText("No chapters yet")).not.toBeInTheDocument();
  });

  it("shows the error rather than the skeleton when a retry is in flight", () => {
    renderList({
      loading: true,
      error: { message: "Still down.", retryable: true },
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("DataState — loading", () => {
  it("renders a skeleton, not a spinner, and announces the wait once", () => {
    const { container } = renderList({ loading: true });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading…");

    // The skeleton itself is decorative; the live region carries the meaning.
    const skeleton = container.querySelector(".samjho-skeleton");
    expect(skeleton).not.toBeNull();
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
  });

  it("accepts a caller-supplied skeleton shaped like the real content", () => {
    renderList({ loading: true, loadingFallback: <div data-testid="question-skeleton" /> });

    expect(screen.getByTestId("question-skeleton")).toBeInTheDocument();
  });

  it("does not render the children while loading", () => {
    renderList({ loading: true });
    expect(screen.queryByText("Real Numbers")).not.toBeInTheDocument();
  });
});

describe("DataState — empty", () => {
  it("can carry the action that fills it", () => {
    renderList({
      data: [],
      emptyTitle: "No mistakes yet",
      emptyBody: "That's good!",
      emptyAction: <a href="/subjects">Practise a chapter</a>,
    });

    expect(screen.getByText("That's good!")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Practise a chapter" })).toBeInTheDocument();
  });
});

describe("DataState — error", () => {
  it("shows the support reference id so a student can quote it", () => {
    renderList({
      data: null,
      error: { message: "Something went wrong.", requestId: "req_abc123", retryable: true },
    });

    expect(screen.getByText("req_abc123")).toBeInTheDocument();
  });

  it("offers a retry and calls it", async () => {
    const onRetry = vi.fn();
    renderList({
      data: null,
      error: { message: "Something went wrong.", retryable: true },
      onRetry,
    });

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("hides the retry when retrying cannot help", () => {
    // A 404 will not fix itself. A button that does nothing teaches people that
    // buttons here do nothing.
    renderList({
      data: null,
      error: { message: "We could not find that.", retryable: false },
      onRetry: vi.fn(),
    });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("hides the retry when no handler was given", () => {
    renderList({
      data: null,
      error: { message: "Something went wrong.", retryable: true },
    });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses role=alert so the failure is announced without moving focus", () => {
    renderList({ data: null, error: { message: "Something went wrong.", retryable: true } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("describeError — nothing internal reaches the page", () => {
  it("trusts a message that arrived with a requestId, because we wrote it", () => {
    const result = describeError({
      message: "You have already used today's 20 AI explanations.",
      requestId: "req_1",
      status: 429,
    });

    expect(result.message).toBe("You have already used today's 20 AI explanations.");
    expect(result.requestId).toBe("req_1");
    expect(result.retryable).toBe(true);
  });

  it("replaces a contract-parse failure with plain language", () => {
    // This is the exact string that must never be shown to a fifteen-year-old.
    const raw = new Error("Response from /catalog/subjects did not match the expected contract");
    const result = describeError(raw);

    expect(result.message).not.toContain("contract");
    expect(result.message).not.toContain("/catalog/subjects");
    expect(result.requestId).toBeUndefined();
  });

  it("does not leak a stack trace or an exception name", () => {
    const result = describeError(new RangeError("index 7 out of bounds"));
    expect(result.message).not.toContain("RangeError");
    expect(result.message).not.toContain("index 7");
  });

  it("tells the student to check their connection when fetch never left the device", () => {
    // `fetch` rejects with a TypeError on aeroplane mode or a captive portal.
    const result = describeError(new TypeError("Failed to fetch"));

    expect(result.message).toMatch(/connection/i);
    expect(result.retryable).toBe(true);
  });

  it("does not offer a retry on 404 or 401", () => {
    expect(describeError({ message: "x", requestId: "r", status: 404 }).retryable).toBe(false);
    expect(describeError({ message: "x", requestId: "r", status: 401 }).retryable).toBe(false);
  });

  it("rewrites 404 and 401 rather than echoing the API's wording", () => {
    expect(
      describeError({ message: "Chapter not found", requestId: "r", status: 404 }).message,
    ).toMatch(/could not find/i);
    expect(
      describeError({ message: "Unauthenticated", requestId: "r", status: 401 }).message,
    ).toMatch(/sign in/i);
  });

  it("offers a retry on a 5xx", () => {
    expect(describeError({ message: "x", requestId: "r", status: 503 }).retryable).toBe(true);
  });

  it("survives being handed something that is not an error at all", () => {
    for (const value of [null, undefined, "boom", 42, {}, { message: 12 }]) {
      const result = describeError(value);
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.requestId).toBeUndefined();
    }
  });
});
