import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routes } from "../src/app/router";
import { AnswerText } from "../src/features/assistant/AnswerText";
import { groupChats, reloadChats, resetChats, STORAGE_KEY, type Chat } from "../src/features/assistant/chats";
import { toBlocks } from "../src/features/assistant/blocks";
import { type EvidenceSource, historyFor, parseEvents, viewPayload } from "../src/features/assistant/stream";
import { publishView, resetViewContext, type ViewContext } from "../src/features/assistant/viewContext";

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
      if (url.startsWith("/api/assistant/status"))
        return status === null ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, status: 200, json: async () => status };
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

const IRIS: ViewContext = {
  source: "snapshot",
  target: { ra: 161.29678, dec: 2.44824, name: "Asteroid (7) Iris near 36 Sextantis" },
  frameKey: "qr2/level2/b.fits",
  referenceKey: "qr2/level2/a.fits",
  compare: "blink",
  fov: 0.3,
  sequenceMode: "pass",
  sequenceKeys: ["qr2/level2/a.fits", "qr2/level2/b.fits"],
  frameIndex: 9,
  frameCount: 19,
  detector: 2,
  href: "/explore?ra=161.296780&dec=2.448240&cmp=blink&source=snapshot",
};

const question = () => screen.getByRole("textbox", { name: "Your question" });
const sidebar = () => screen.getAllByRole("navigation", { name: "Chats" })[0]!;

beforeEach(() => {
  resetChats();
  resetViewContext();
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

  it("sends the view's identifiers, never its link or data source", () => {
    const payload = viewPayload("ask", { ...IRIS, target: { ...IRIS.target, name: "x".repeat(200) } });
    expect(payload).toMatchObject({ page: "explore", frameKey: IRIS.frameKey, sequenceKeys: IRIS.sequenceKeys });
    expect(payload).not.toHaveProperty("source");
    expect(payload).not.toHaveProperty("href");
    expect(payload).not.toHaveProperty("detector");
    expect((payload.target as { name: string }).name).toHaveLength(120);
    expect(viewPayload("ask", null)).toEqual({ page: "ask" });
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

describe("chat history", () => {
  it("groups chats the way chat apps do", () => {
    const now = new Date("2026-09-28T15:00:00").getTime();
    const at = (iso: string): Chat => ({ id: iso, title: iso, createdAt: 0, updatedAt: new Date(iso).getTime(), turns: [] });
    const groups = groupChats([at("2026-09-28T09:00:00"), at("2026-09-27T20:00:00"), at("2026-09-24T10:00:00"), at("2026-09-10T10:00:00"), at("2026-01-01T10:00:00")], now);
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Earlier"]);
  });
});

describe("Ask, the chat app", () => {
  const answer = (text: string, grounding = { checked: 0, unverified: [] as string[], unknownTags: [] as string[] }) =>
    sse([
      ["meta", { mode: "local-model", model: "qwen3:4b", sources: SOURCES, actions: [{ label: "Explore M 31", href: "/explore?q=M31" }, { label: "Elsewhere", href: "//evil.example" }], notes: [] }],
      ["delta", { text }],
      ["done", { grounding, mode: "local-model" }],
    ]);

  it("is a chat app of its own, reached from the main navigation", async () => {
    mockServer({ chat: () => streamed("") });
    const router = renderAt("/about");
    const [link] = screen.getAllByRole("link", { name: "Ask" });
    await userEvent.click(link!);
    expect(router.state.location.pathname).toBe("/ask");
    expect(screen.getByRole("heading", { level: 1, name: "SPHEREx Assistant" })).toBeInTheDocument();
    expect(await screen.findByText("qwen3:4b")).toBeInTheDocument();
    // Its own window: a chat list and links back to the site, not the site's header and footer.
    expect(screen.getAllByRole("button", { name: "New chat" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Explore the sky/ })[0]).toHaveAttribute("href", "/explore");
    expect(screen.queryByText(/Not affiliated with or endorsed by NASA/)).not.toBeInTheDocument();
  });

  it("streams an answer with its sources, links and checks, and files the chat", async () => {
    mockServer({
      chat: () => streamed(answer("SPHEREx is a NASA telescope [K1]. It is 3.2 au away [E1].", { checked: 2, unverified: ["3.2"], unknownTags: [] })),
    });
    const router = renderAt("/ask");
    await userEvent.click(await screen.findByRole("button", { name: /What is SPHEREx\?/ }));
    expect(await screen.findByText(/It is 3.2 au away/)).toBeInTheDocument();
    expect(chatBodies[0]).toEqual({ messages: [{ role: "user", content: "What is SPHEREx?" }], view: { page: "ask" } });
    expect(router.state.location.pathname).toMatch(/^\/ask\/[\w-]+$/);
    expect(within(sidebar()).getByRole("link", { name: "What is SPHEREx?" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Explore M 31/ })).toHaveAttribute("href", "/explore?q=M31");
    expect(screen.queryByRole("link", { name: /Elsewhere/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Not found in the sources: 3.2/)).toBeInTheDocument();
    expect(screen.getByText(/Phrased by/)).toHaveTextContent("qwen3:4b");

    await userEvent.click(screen.getByRole("button", { name: "Source K1: What SPHEREx is" }));
    expect(screen.getByRole("button", { name: /Sources \(2\)/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("A NASA space telescope launched on 12 March 2025.")).toBeVisible();
  });

  it("keeps chats in this browser, across a reload, until they are deleted", async () => {
    mockServer({ chat: () => streamed(answer("A NASA telescope [K1].")) });
    renderAt("/ask");
    await userEvent.type(question(), "What is SPHEREx?{Enter}");
    expect(await screen.findByText(/A NASA telescope/)).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Chat[];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ title: "What is SPHEREx?", turns: [{ question: "What is SPHEREx?", status: "done" }] });

    reloadChats();
    expect(within(sidebar()).getByRole("link", { name: "What is SPHEREx?" })).toBeInTheDocument();

    await userEvent.click(within(sidebar()).getByRole("button", { name: "Delete “What is SPHEREx?”" }));
    await userEvent.click(within(sidebar()).getByRole("button", { name: "Delete" }));
    expect(within(sidebar()).queryByRole("link", { name: "What is SPHEREx?" })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([]);
    expect(await screen.findByRole("heading", { name: "What would you like to know?" })).toBeInTheDocument();
  });

  it("starts new chats and keeps the old ones", async () => {
    mockServer({ chat: () => streamed(answer("An answer [K1].")) });
    renderAt("/ask");
    await userEvent.type(question(), "First question{Enter}");
    expect(await screen.findByText(/An answer/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "New chat" })[0]!);
    expect(screen.getByRole("heading", { name: "What would you like to know?" })).toBeInTheDocument();
    await userEvent.type(question(), "Second question{Enter}");
    await waitFor(() => expect(within(sidebar()).getAllByRole("link")).toHaveLength(2));
    // A new chat does not carry the old one's history.
    expect(chatBodies[1]).toEqual({ messages: [{ role: "user", content: "Second question" }], view: { page: "ask" } });
    await userEvent.click(within(sidebar()).getByRole("link", { name: "First question" }));
    expect(screen.getByText("First question", { selector: "p" })).toBeInTheDocument();
  });

  it("asks about the view the visitor had open, until they set it aside", async () => {
    mockServer({ chat: () => streamed(answer("Iris moved [E1].")) });
    publishView(IRIS);
    renderAt("/ask");
    expect(screen.getByRole("heading", { name: "Ask about the view you had open" })).toBeInTheDocument();
    expect(screen.getByText(/frame 10 of 19 · detector 2 · blinking A and B · demo snapshot/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", IRIS.href);

    await userEvent.click(screen.getByRole("button", { name: /Can I compare these two frames\?/ }));
    expect(await screen.findByText(/Iris moved/)).toBeInTheDocument();
    expect(chatBodies[0]).toMatchObject({ view: { page: "explore", frameKey: IRIS.frameKey, compare: "blink" } });
    expect(screen.getByText("About the view of Asteroid (7) Iris near 36 Sextantis")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Don't ask about this view" }));
    await userEvent.type(question(), "What is SPHEREx?{Enter}");
    await waitFor(() => expect(chatBodies).toHaveLength(2));
    expect(chatBodies[1]).toMatchObject({ view: { page: "ask" } });
  });

  it("asks the last question again, and copies an answer", async () => {
    let n = 0;
    mockServer({ chat: () => streamed(answer(n++ === 0 ? "First try [K1]." : "Second try [K1].")) });
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderAt("/ask");
    await userEvent.type(question(), "What is SPHEREx?{Enter}");
    expect(await screen.findByText(/First try/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copy the answer" }));
    expect(writeText).toHaveBeenCalledWith("First try [K1].");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Ask again" }));
    expect(await screen.findByText(/Second try/)).toBeInTheDocument();
    expect(screen.queryByText(/First try/)).not.toBeInTheDocument();
    expect(chatBodies[1]).toEqual(chatBodies[0]);
  });

  it("keeps the conversation while the visitor looks elsewhere", async () => {
    mockServer({ chat: () => streamed(answer("A NASA telescope [K1].")) });
    renderAt("/ask");
    await userEvent.type(question(), "What is SPHEREx?{Enter}");
    expect(await screen.findByText(/A NASA telescope/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /Explore M 31/ }));
    expect(screen.queryByText(/A NASA telescope/)).not.toBeInTheDocument();
    const [link] = screen.getAllByRole("link", { name: "Ask" });
    await userEvent.click(link!);
    await userEvent.click(within(sidebar()).getByRole("link", { name: "What is SPHEREx?" }));
    expect(screen.getByText(/A NASA telescope/)).toBeInTheDocument();
  });

  it("says when answers are built in", async () => {
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
    renderAt("/ask");
    expect(await screen.findByText(/Built-in answers/)).toBeInTheDocument();
    await userEvent.type(question(), "What is SPHEREx?{Enter}");
    expect(await screen.findByText("Built-in answer")).toBeInTheDocument();
    expect(screen.getByText(/no language model is running/)).toBeInTheDocument();
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
    renderAt("/ask");
    await userEvent.type(question(), "Tell me a lot{Enter}");
    expect(await screen.findByText("Partly written")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Stop the answer" }));
    expect(await screen.findByText("Stopped.")).toBeInTheDocument();
    expect(screen.getByText("Partly written")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("explains a server that has no assistant instead of waiting forever", async () => {
    mockServer({ status: null, chat: () => streamed("") });
    renderAt("/ask");
    expect(await screen.findByText("Not available on this server")).toBeInTheDocument();
    expect(screen.getByText(/restart its API server/)).toBeInTheDocument();
    expect(question()).toBeDisabled();
    expect(screen.getByRole("button", { name: /What is SPHEREx\?/ })).toBeDisabled();
  });

  it("shows the server's message when a question is refused", async () => {
    mockServer({
      chat: () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: { code: "rate_limited", message: "Too many requests in a short time." } }),
      }),
    });
    renderAt("/ask");
    await userEvent.type(question(), "hello{Enter}");
    expect(await screen.findByText("Too many requests in a short time.")).toBeInTheDocument();
  });
});

describe("header", () => {
  it("puts the theme toggle right after the navigation", () => {
    mockServer({ chat: () => streamed("") });
    renderAt("/about");
    const toggle = screen.getByRole("button", { name: /Switch to the (dark|light) theme/ });
    expect(toggle.previousElementSibling?.previousElementSibling?.tagName).toBe("NAV");
  });
});
