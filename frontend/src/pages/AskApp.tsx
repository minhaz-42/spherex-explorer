import { ArrowDown, PanelLeft, SquarePen } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { OrbitMark } from "../components/Wordmark";
import { ChatSidebar } from "../features/assistant/ChatSidebar";
import { ask, clearChats, deleteChat, isBusy, regenerate, stop, type Turn, useChats } from "../features/assistant/chats";
import { Composer } from "../features/assistant/Composer";
import { AssistantMessage, UserMessage } from "../features/assistant/Message";
import { type AssistantStatus, fetchStatus, isAbort, MAX_QUESTION } from "../features/assistant/stream";
import { forgetView, useViewStore, type ViewContext } from "../features/assistant/viewContext";
import { ApiError, type DataSource } from "../lib/api";
import { defineMessages, type Lang, translate, useLang, useT } from "../lib/i18n";

const NO_TURNS: Turn[] = [];

/** On a phone, focusing the box would pop up a keyboard the visitor did not ask for. */
function focusComposer(input: HTMLTextAreaElement | null): void {
  if (window.matchMedia?.("(pointer: fine)").matches) input?.focus();
}

const M = defineMessages({
  en: {
    checking: "Checking…",
    unavailable: "Not available on this server",
    localModel: "Local model",
    modelServer: "Model server",
    builtIn: "Built-in answers",
    modelOff: " · local model not running",
    openList: "Open the chat list",
    showList: "Show the chat list",
    hideList: "Hide the chat list",
    newChat: "New chat",
    newChatTitle: "New chat (Ctrl + Shift + O)",
    emptyView: "Ask about the view you had open",
    emptyGeneral: "What would you like to know?",
    intro:
      "Answers come from this app's own measurements, JPL's predictions and short method notes, and list their sources. They can still be wrong, so check them.",
    english: "",
    scroll: "Scroll to the latest message",
    placeholderView: "Ask about this view, or anything else",
    placeholder: "Message SPHEREx Assistant",
    privacyLocal:
      "Answered by a language model on this app's own server, from the app's data. It can make mistakes; check the sources.",
    privacyRemote:
      "Answered by the model server this app is set up with, from the app's data. It can make mistakes; check the sources.",
    privacyBuiltIn: "Answers are put together from the app's own data; no language model is running.",
    answering: "Answering…",
    ready: "Answer ready.",
    reach: "The assistant could not be reached.",
    hintSpherex: "The telescope and its 102 colours",
    hintMoved: "Asteroids caught by SPHEREx",
    hintSubtract: "Wavelength, not only time",
    hintPlanet: "What it can and cannot do",
    hintLooking: "The view you had open",
    hintMove: "JPL's predictions and the search",
    hintBrightness: "Measured by this app",
    hintCompare: "Whether a difference image is valid",
    hintDifferent: "Time, wavelength and motion",
  },
  bn: {
    checking: "যাচাই করা হচ্ছে…",
    unavailable: "এই সার্ভারে পাওয়া যাচ্ছে না",
    localModel: "লোকাল মডেল",
    modelServer: "মডেল সার্ভার",
    builtIn: "বিল্ট-ইন উত্তর",
    modelOff: " · লোকাল মডেল চলছে না",
    openList: "চ্যাটের তালিকা খুলুন",
    showList: "চ্যাটের তালিকা দেখান",
    hideList: "চ্যাটের তালিকা লুকান",
    newChat: "নতুন চ্যাট",
    newChatTitle: "নতুন চ্যাট (Ctrl + Shift + O)",
    emptyView: "যে দৃশ্যটি খোলা ছিল, সেটি নিয়ে জিজ্ঞাসা করুন",
    emptyGeneral: "আপনি কী জানতে চান?",
    intro:
      "উত্তর আসে এই অ্যাপের নিজস্ব পরিমাপ, JPL-এর পূর্বাভাস আর ছোট পদ্ধতি-নোট থেকে, সঙ্গে থাকে উৎসের তালিকা। তবু ভুল হতে পারে, তাই উৎসগুলো মিলিয়ে দেখুন।",
    english: "উত্তর ইংরেজিতে দেওয়া হয়, আর প্রশ্নও ইংরেজিতে করলে সবচেয়ে ভালো কাজ করে।",
    scroll: "সর্বশেষ বার্তায় যান",
    placeholderView: "এই দৃশ্য বা অন্য যেকোনো বিষয়ে জিজ্ঞাসা করুন",
    placeholder: "SPHEREx Assistant-কে বার্তা লিখুন",
    privacyLocal:
      "উত্তর দেয় এই অ্যাপের নিজস্ব সার্ভারে চলা একটি ভাষা মডেল, অ্যাপের ডেটা থেকে। ভুল হতে পারে; উৎসগুলো মিলিয়ে দেখুন।",
    privacyRemote:
      "উত্তর দেয় এই অ্যাপের জন্য ঠিক করা মডেল সার্ভার, অ্যাপের ডেটা থেকে। ভুল হতে পারে; উৎসগুলো মিলিয়ে দেখুন।",
    privacyBuiltIn: "উত্তর সাজানো হয় অ্যাপের নিজস্ব ডেটা থেকে; কোনো ভাষা মডেল চলছে না।",
    answering: "উত্তর তৈরি হচ্ছে…",
    ready: "উত্তর তৈরি।",
    reach: "সহকারীর সঙ্গে যোগাযোগ করা যায়নি।",
    hintSpherex: "টেলিস্কোপ আর তার 102টি রং",
    hintMoved: "SPHEREx-এর চোখে ধরা পড়া গ্রহাণু",
    hintSubtract: "শুধু সময় নয়, তরঙ্গদৈর্ঘ্যও",
    hintPlanet: "এটি কী পারে আর কী পারে না",
    hintLooking: "যে দৃশ্যটি খোলা ছিল",
    hintMove: "JPL-এর পূর্বাভাস আর অনুসন্ধান",
    hintBrightness: "এই অ্যাপের মাপা উজ্জ্বলতা",
    hintCompare: "পার্থক্যের ছবি বৈধ কি না",
    hintDifferent: "সময়, তরঙ্গদৈর্ঘ্য আর গতি",
  },
});

type Key = keyof (typeof M)["en"];

// The questions stay in English, the language the assistant's evidence is matched in; their hints
// follow the site's language.
function generalSuggestions(lang: Lang) {
  const t = (k: Key) => translate(M, lang, k);
  return [
    { q: "What is SPHEREx?", hint: t("hintSpherex") },
    { q: "Show me something that moved", hint: t("hintMoved") },
    { q: "Why can't I always subtract two frames?", hint: t("hintSubtract") },
    { q: "Could SPHEREx find Planet Nine?", hint: t("hintPlanet") },
  ];
}

function viewSuggestions(view: ViewContext, lang: Lang) {
  const t = (k: Key) => translate(M, lang, k);
  return [
    { q: "What am I looking at?", hint: view.target.name ?? t("hintLooking") },
    { q: "Did anything move here?", hint: t("hintMove") },
    view.compare === "single"
      ? { q: "What is the brightness at the target?", hint: t("hintBrightness") }
      : { q: "Can I compare these two frames?", hint: t("hintCompare") },
    { q: "Why do the frames look different?", hint: t("hintDifferent") },
  ];
}

type Status =
  | { kind: "checking" }
  | { kind: "ready"; status: AssistantStatus }
  | { kind: "unavailable"; message: string | null; missing: boolean };

/**
 * The assistant as a chat app of its own: the chats on the left, the conversation in the middle,
 * the message box at the bottom. It sits outside the site's layout, like any chat app, and links
 * back to Explore, Discover and About from its sidebar.
 */
export function AskApp() {
  const { chatId } = useParams();
  const t = useT(M);
  const lang = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const chats = useChats();
  const chat = chatId ? chats.find((c) => c.id === chatId) : undefined;
  const { view, source: lastSource } = useViewStore();
  const source: DataSource = view?.source ?? (params.get("source") === "snapshot" ? "snapshot" : lastSource);
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [draft, setDraft] = useState(() => (params.get("q") ?? "").slice(0, MAX_QUESTION));
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openSources, setOpenSources] = useState<Record<string, boolean>>({});
  const [atBottom, setAtBottom] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const busy = isBusy(chats);
  const missing = status.kind === "unavailable" && status.missing;
  const turns = chat?.turns ?? NO_TURNS;

  useEffect(() => {
    const controller = new AbortController();
    fetchStatus(controller.signal).then(
      (s) => setStatus({ kind: "ready", status: s }),
      (err: unknown) => {
        if (isAbort(err)) return;
        setStatus({
          kind: "unavailable",
          message: err instanceof ApiError ? err.message : null,
          missing: err instanceof ApiError && err.status === 404,
        });
      },
    );
    return () => controller.abort();
  }, []);

  // A chat that is not in this browser (deleted, or a link from elsewhere) opens a new chat.
  useEffect(() => {
    if (chatId && !chat) navigate("/ask", { replace: true });
  }, [chatId, chat, navigate]);

  useEffect(() => {
    focusComposer(inputRef.current);
    stick.current = true;
  }, [chatId]);

  // Follow the answer as it streams in, unless the visitor has scrolled up to read.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current && turns.length > 0) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stick.current = bottom;
    setAtBottom(bottom);
  };

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    stick.current = true;
  };

  const send = (text: string) => {
    if (!text.trim() || busy || missing) return;
    stick.current = true;
    const id = ask(chat?.id ?? null, text, view, source);
    if (!id) return;
    setDraft("");
    if (!chat) navigate(`/ask/${id}`);
  };

  const newChat = () => {
    setDrawer(false);
    setDraft("");
    navigate("/ask");
    focusComposer(inputRef.current);
  };

  // Ctrl or ⌘ + Shift + O starts a new chat, as in other chat apps; Escape closes the drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setDrawer(false);
        setDraft("");
        navigate("/ask");
        focusComposer(inputRef.current);
      } else if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const cite = (turnId: string, tag: string) => {
    setOpenSources((s) => ({ ...s, [turnId]: true }));
    requestAnimationFrame(() => {
      const item = document.getElementById(`src-${turnId}-${tag}`);
      const list = listRef.current;
      if (!item || !list) return;
      list.scrollTop += item.getBoundingClientRect().top - list.getBoundingClientRect().top - 96;
      item.focus({ preventScroll: true });
    });
  };

  const onDelete = (id: string) => {
    deleteChat(id);
    if (id === chat?.id) navigate("/ask", { replace: true });
  };

  const last = turns.at(-1);
  const liveText = busy ? t("answering") : last?.status === "done" ? t("ready") : "";
  const suggestions = view ? viewSuggestions(view, lang) : generalSuggestions(lang);

  const sidebar = (close?: () => void) => (
    <ChatSidebar
      chats={chats}
      activeId={chat?.id ?? null}
      onNewChat={newChat}
      onDelete={onDelete}
      onClearAll={() => {
        clearChats();
        navigate("/ask", { replace: true });
      }}
      onClose={close}
    />
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-raised text-text">
      <aside
        aria-label="Chat history"
        className={`hidden w-[17.5rem] shrink-0 border-r border-rule bg-bg ${collapsed ? "" : "lg:block"}`}
      >
        {sidebar()}
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[rgb(11_20_55/0.45)]" onClick={() => setDrawer(false)} aria-hidden="true" />
          <aside aria-label="Chat history" className="absolute inset-y-0 left-0 w-[18rem] max-w-[86vw] bg-bg shadow-[var(--shadow-lg)]">
            {sidebar(() => setDrawer(false))}
          </aside>
        </div>
      )}

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-rule/70 px-3 sm:px-4">
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm lg:hidden"
            aria-label={t("openList")}
            onClick={() => setDrawer(true)}
          >
            <PanelLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm hidden lg:grid"
            aria-label={collapsed ? t("showList") : t("hideList")}
            aria-pressed={!collapsed}
            onClick={() => setCollapsed((v) => !v)}
          >
            <PanelLeft size={18} aria-hidden />
          </button>
          <div className="flex min-w-0 items-baseline gap-2.5">
            <h1 className="shrink-0 font-display text-[1.0625rem] font-semibold tracking-[-0.02em]">SPHEREx Assistant</h1>
            <ModeLine status={status} t={t} />
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm ml-auto"
            aria-label={t("newChat")}
            title={t("newChatTitle")}
            onClick={newChat}
          >
            <SquarePen size={17} aria-hidden />
          </button>
        </header>

        <div ref={listRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto flex min-h-full w-full max-w-[48rem] flex-col px-4 sm:px-6">
            {status.kind === "unavailable" && <p className="note note-danger mt-6">{status.message ?? t("reach")}</p>}
            {turns.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                <div className="grid size-14 place-items-center rounded-full border border-rule bg-bg shadow-[var(--shadow-sm)]">
                  <OrbitMark size={34} />
                </div>
                <h2 className="mt-6 font-display text-[clamp(1.6rem,1.2rem+1.4vw,2.2rem)] font-semibold tracking-[-0.03em]">
                  {view ? t("emptyView") : t("emptyGeneral")}
                </h2>
                <p className="mt-3 max-w-md text-[0.975rem] leading-relaxed text-muted">{t("intro")}</p>
                {t("english") && <p className="mt-2 max-w-md text-sm text-faint">{t("english")}</p>}
                <ul className="mt-9 grid w-full gap-3 text-left sm:grid-cols-2">
                  {suggestions.map((s) => (
                    <li key={s.q}>
                      <button
                        type="button"
                        disabled={missing}
                        onClick={() => send(s.q)}
                        className="h-full w-full rounded-[var(--radius-lg)] border border-rule bg-raised px-4 py-3.5 text-left transition-colors hover:border-rule-control hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="block text-[0.9375rem] font-semibold text-text">{s.q}</span>
                        <span className="mt-0.5 block text-sm text-faint">{s.hint}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ol className="space-y-9 py-8">
                {turns.map((t, i) => (
                  <li key={t.id} className="space-y-6">
                    <UserMessage turn={t} />
                    <AssistantMessage
                      turn={t}
                      last={i === turns.length - 1}
                      sourcesOpen={!!openSources[t.id]}
                      onSourcesOpen={(v) => setOpenSources((s) => ({ ...s, [t.id]: v }))}
                      onCite={(tag) => cite(t.id, tag)}
                      onRegenerate={() => chat && regenerate(chat.id, view, source)}
                      canRegenerate={!busy && !missing}
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {!atBottom && turns.length > 0 && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label={t("scroll")}
            className="absolute bottom-40 left-1/2 grid size-9 -translate-x-1/2 place-items-center rounded-full border border-rule-strong bg-raised text-muted shadow-[var(--shadow)] hover:text-text"
          >
            <ArrowDown size={16} aria-hidden />
          </button>
        )}

        <div className="shrink-0 px-3 pb-3 pt-2 sm:px-6">
          <div className="mx-auto w-full max-w-[48rem]">
            <Composer
              value={draft}
              onChange={setDraft}
              onSend={() => send(draft)}
              onStop={stop}
              busy={busy}
              disabled={missing}
              view={view}
              onForgetView={forgetView}
              inputRef={inputRef}
              placeholder={view ? t("placeholderView") : t("placeholder")}
            />
            <p className="mt-2 text-center text-xs text-faint">{privacyNote(status, t)}</p>
          </div>
        </div>
        <p className="visually-hidden" role="status" aria-live="polite">
          {liveText}
        </p>
      </main>
    </div>
  );
}

function privacyNote(status: Status, t: (k: Key) => string): string {
  if (status.kind === "ready" && status.status.mode === "local-model") {
    return status.status.local ? t("privacyLocal") : t("privacyRemote");
  }
  return t("privacyBuiltIn");
}

function ModeLine({ status, t }: { status: Status; t: (k: Key) => string }) {
  if (status.kind === "checking") return <span className="truncate text-sm text-faint">{t("checking")}</span>;
  if (status.kind === "unavailable") return <span className="truncate text-sm text-danger">{t("unavailable")}</span>;
  const s = status.status;
  if (s.mode === "local-model") {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
        <span className="size-1.5 shrink-0 rounded-full bg-live" aria-hidden />
        <span className="shrink-0">{s.local ? t("localModel") : t("modelServer")}</span>
        <span className="mono hidden truncate text-xs text-faint sm:inline" title={s.model ?? undefined}>
          {s.model}
        </span>
      </span>
    );
  }
  return (
    <span className="truncate text-sm text-muted" title={s.provider === "off" ? undefined : s.detail}>
      {t("builtIn")}
      {s.provider === "off" ? "" : t("modelOff")}
    </span>
  );
}
