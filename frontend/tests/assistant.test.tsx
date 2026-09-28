import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routes } from "../src/app/router";
import { AnswerText } from "../src/features/assistant/AnswerText";
import { toBlocks } from "../src/features/assistant/blocks";
import { type EvidenceSource, historyFor, parseEvents, viewPayload } from "../src/features/assistant/stream";
import type { ViewContext } from "../src/features/assistant/viewContext";

const LOCAL = { mode: "local-model", provider: "ollama", model: "qwen3:4b", local: true, detail: "ready" };
const OFF = { mode: "built-in", provider: "off", model: null, local: true, detail: "The assistant answers from the app's own data only." };

const SOURCES: EvidenceSource[] = [
  { tag: "K1", kind: "method", title: "What SPHEREx is", text: "A NASA space telescope launched on 12 March 2025.", source: "About" },
  { tag: "E1", kind: "lookup", title: "Looking up “M31”", text: "M 31 is at RA 10.6847°.", source: "CDS Sesame" },
];

function sse(events: [string, unknown][]): string {
  return events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
}

/** A fetch response whose body arrives in awkward pieces, as it can over a real network. */
function streamed(text: string, pieces = 4, signal?: AbortSignal | null) {
  const bytes = new TextEncoder().encode(text);
  const size = Math.ceil(bytes.length / pieces);
  let at = 0;
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    body: {
      getReader: () => ({
        read: () =>
          at < bytes.length
            ? Promise.resolve({ value: bytes.slice(at, (at += size)), done: false })
            : signal
              ? new Promise((_, reject) =>
                  signal.addEventListener("abort", () => reject(new DOMException("stopped", "AbortError"))),
                )
              : Promise.resolve({ value: undefined, done: true }),
      }),
    },
  };
}

let chatBodies: unknown[] = [];

function mockServer({
  status = LOCAL,
  chat,
}: {
  status?: unknown;
  chat: (signal: AbortSignal | null | undefined) => unknown;
}) {
  chatBodies = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/assistant/status")) return { ok: true, status: 200, json: async () => status };
      if (url.startsWith("/api/assistant/chat")) {
        chatBodies.push(JSON.parse(String(init?.body)));
        return chat(init?.signal);
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

async function openAssistant() {
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  return screen.getByRole("complementary", { name: "Ask about the sky" });
}

beforeEach(() => {
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assistant stream parsing", () => {
  it("splits events and keeps an unfinished one for later", () => {
    const { events, rest } = parseEvents('event: delta\ndata: {"text":"a"}\n\nevent: delta\r\ndata: {"te');
    expect(events).toEqual([{ event: "delta", data: '{"text":"a"}' }]);
    expect(rest).toBe('event: delta\r\ndata: {"te');
  });

  it("keeps only answered turns in the history, trimmed to what the server reads", () => {
    const pairs = Array.from({ length: 5 }, (_, i) => ({ question: `q${i}`, answer: i === 2 ? "" : "a".repeat(1500) }));
    const messages = historyFor(pairs, "now?");
    expect(messages).toHaveLength(7);
    expect(messages.at(-1)).toEqual({ role: "user", content: "now?" });
    expect(messages.map((m) => m.content.slice(0, 2))).not.toContain("q2");
    expect(Math.max(...messages.map((m) => m.content.length))).toBe(1200);
  });

  it("sends the viewer's identifiers only from the explorer", () => {
    const view: ViewContext = {
      source: "snapshot",
      target: { ra: 1, dec: 2, name: "x".repeat(200) },
      frameKey: "k",
      referenceKey: null,
      compare: "single",
      fov: 0.2,
      sequenceMode: "pass",
      sequenceKeys: ["k"],
      frameIndex: 0,
      frameCount: 1,
    };
    const payload = viewPayload("explore", view);
    expect(payload).toMatchObject({ page: "explore", frameKey: "k", sequenceKeys: ["k"] });
    expect(payload).not.toHaveProperty("source");
    expect((payload.target as { name: string }).name).toHaveLength(120);
    expect(viewPayload("about", view)).toEqual({ page: "about" });
  });
});

describe("answer text", () => {
  it("finds paragraphs and lists", () => {
    expect(toBlocks("Here:\n- one\n- two\n\n## Next\n1. a\n2) b")).toEqual([
      { kind: "p", text: "Here:" },
      { kind: "ul", items: ["one", "two"] },
      { kind: "p", text: "Next" },
      { kind: "ol", items: ["a", "b"] },
    ]);
  });

  it("renders bold and citations safely, and marks citations of missing sources", async () => {
    const onCite = vi.fn();
    render(<AnswerText text={"**Iris** moved [E1, K1]. See [E9] and C1. <b>no</b>"} sources={SOURCES} onCite={onCite} />);
    expect(screen.getByText("Iris").tagName).toBe("STRONG");
    await userEvent.click(screen.getByRole("button", { name: "Source K1: What SPHEREx is" }));
    expect(onCite).toHaveBeenCalledWith("K1");
    expect(screen.getByText("[E9?]")).toBeInTheDocument();
    // A candidate's name stays text, and markup in an answer is shown, never rendered.
    const para = screen.getByText("Iris").closest("p")!;
    expect(para.textContent).toContain("and C1. <b>no</b>");
    expect(para.querySelector("b")).toBeNull();
  });
});

describe("assistant panel", () => {
  it("streams an answer with its sources, links and checks", async () => {
    mockServer({
      chat: () =>
        streamed(
          sse([
            ["meta", { mode: "local-model", model: "qwen3:4b", sources: SOURCES, actions: [{ label: "Explore M 31", href: "/explore?q=M31" }, { label: "Elsewhere", href: "//evil.example" }], notes: [] }],
            ["delta", { text: "SPHEREx is a NASA telescope [K1]. " }],
            ["delta", { text: "It is 3.2 au away [E1]." }],
            ["done", { grounding: { checked: 2, unverified: ["3.2"], unknownTags: [] }, mode: "local-model" }],
          ]),
        ),
    });
    renderAt("/about");
    const panel = await openAssistant();
    expect(await within(panel).findByText("qwen3:4b")).toBeInTheDocument();
    expect(within(panel).getByRole("textbox", { name: "Your question" })).toHaveFocus();

    await userEvent.click(within(panel).getByRole("button", { name: "What is SPHEREx?" }));
    expect(await within(panel).findByText(/It is 3.2 au away/)).toBeInTheDocument();
    expect(chatBodies[0]).toEqual({ messages: [{ role: "user", content: "What is SPHEREx?" }], view: { page: "about" } });

    expect(within(panel).getByRole("link", { name: /Explore M 31/ })).toHaveAttribute("href", "/explore?q=M31");
    expect(within(panel).queryByRole("link", { name: /Elsewhere/ })).not.toBeInTheDocument();
    expect(within(panel).getByText(/Not found in the sources: 3.2/)).toBeInTheDocument();
    expect(within(panel).getByText(/Phrased by/)).toHaveTextContent("qwen3:4b");

    await userEvent.click(within(panel).getByRole("button", { name: "Source K1: What SPHEREx is" }));
    const sources = within(panel).getByText("Sources (2)").closest("details")!;
    expect(sources).toHaveAttribute("open");
    expect(within(sources).getByText("A NASA space telescope launched on 12 March 2025.")).toBeVisible();
  });

  it("says when answers are built in, and closes with Escape", async () => {
    mockServer({
      status: OFF,
      chat: () =>
        streamed(
          sse([
            ["meta", { mode: "built-in", model: null, sources: [SOURCES[0]], actions: [], notes: [] }],
            ["delta", { text: "What SPHEREx is. A NASA space telescope. [K1]" }],
            ["done", { grounding: { checked: 0, unverified: [], unknownTags: [] }, mode: "built-in" }],
          ]),
        ),
    });
    renderAt("/about");
    const panel = await openAssistant();
    expect(await within(panel).findByText(/Built-in answers/)).toBeInTheDocument();
    await userEvent.type(within(panel).getByRole("textbox", { name: "Your question" }), "What is SPHEREx?{Enter}");
    expect(await within(panel).findByText(/Built-in answer, put together/)).toBeInTheDocument();
    expect(within(panel).getByText(/no language model is running/)).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(panel).not.toBeVisible();
    expect(screen.getByRole("button", { name: "Ask" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Ask" })).toHaveAttribute("aria-expanded", "false");
  });

  it("stops an answer on request and keeps what arrived", async () => {
    mockServer({
      chat: (signal) =>
        streamed(
          sse([
            ["meta", { mode: "local-model", model: "qwen3:4b", sources: [], actions: [], notes: [] }],
            ["delta", { text: "Partly written" }],
          ]),
          1,
          signal,
        ),
    });
    renderAt("/about");
    const panel = await openAssistant();
    await userEvent.type(within(panel).getByRole("textbox", { name: "Your question" }), "Tell me a lot{Enter}");
    expect(await within(panel).findByText("Partly written")).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Stop the answer" }));
    expect(await within(panel).findByText("Stopped.")).toBeInTheDocument();
    expect(within(panel).getByText("Partly written")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("shows the server's message when a question is refused", async () => {
    mockServer({
      chat: () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: { code: "rate_limited", message: "Too many requests in a short time." } }),
      }),
    });
    renderAt("/about");
    const panel = await openAssistant();
    await userEvent.type(within(panel).getByRole("textbox", { name: "Your question" }), "hello{Enter}");
    expect(await within(panel).findByText("Too many requests in a short time.")).toBeInTheDocument();
    await waitFor(() => expect(within(panel).getByRole("button", { name: "Clear" })).toBeEnabled());
    await userEvent.click(within(panel).getByRole("button", { name: "Clear" }));
    expect(within(panel).getByRole("button", { name: "What is SPHEREx?" })).toBeInTheDocument();
  });
});

describe("header", () => {
  it("puts the theme toggle next to Ask", () => {
    mockServer({ chat: () => streamed("") });
    renderAt("/about");
    const ask = screen.getByRole("button", { name: "Ask" });
    expect(ask).toHaveAttribute("aria-controls", "assistant");
    expect(ask.nextElementSibling).toBe(screen.getByRole("button", { name: /Switch to the (dark|light) theme/ }));
  });
});
