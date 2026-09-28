import { Compass, Ellipsis, Info, MessageSquare, Orbit, Pencil, Search, SquarePen, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router";

import { LanguageToggle } from "../../components/LanguageToggle";
import { ThemeToggle } from "../../components/ThemeToggle";
import { Wordmark } from "../../components/Wordmark";
import { defineMessages, useT } from "../../lib/i18n";
import { type Chat, groupChats, renameChat } from "./chats";

const M = defineMessages({
  en: {
    home: "SPHEREx Explorer, home",
    close: "Close the chat list",
    newChat: "New chat",
    search: "Search chats",
    empty: "Your chats will appear here.",
    noMatch: "No chat matches “{q}”.",
    today: "Today",
    yesterday: "Yesterday",
    week: "Previous 7 days",
    month: "Previous 30 days",
    earlier: "Earlier",
    confirm: "Delete this chat?",
    delete: "Delete",
    cancel: "Cancel",
    more: "More for “{title}”",
    moreTitle: "Rename or delete",
    rename: "Rename",
    newName: "New name for “{title}”",
    explore: "Explore the sky",
    discover: "Discover",
    about: "About and methods",
    deleteAll: "Delete all chats",
    confirmAll: "Delete all chats?",
    kept: "Chats are kept only in this browser.",
  },
  bn: {
    home: "SPHEREx Explorer, প্রথম পাতা",
    close: "চ্যাটের তালিকা বন্ধ করুন",
    newChat: "নতুন চ্যাট",
    search: "চ্যাট খুঁজুন",
    empty: "আপনার চ্যাটগুলো এখানে দেখা যাবে।",
    noMatch: "“{q}”-এর সঙ্গে মেলে এমন কোনো চ্যাট নেই।",
    today: "আজ",
    yesterday: "গতকাল",
    week: "গত 7 দিন",
    month: "গত 30 দিন",
    earlier: "আরও আগে",
    confirm: "এই চ্যাটটি মুছবেন?",
    delete: "মুছুন",
    cancel: "বাতিল",
    more: "“{title}”-এর আরও বিকল্প",
    moreTitle: "নাম বদলান বা মুছুন",
    rename: "নাম বদলান",
    newName: "“{title}”-এর নতুন নাম",
    explore: "আকাশ অন্বেষণ",
    discover: "পরিবর্তন",
    about: "পরিচিতি ও পদ্ধতি",
    deleteAll: "সব চ্যাট মুছুন",
    confirmAll: "সব চ্যাট মুছবেন?",
    kept: "চ্যাটগুলো শুধু এই ব্রাউজারেই রাখা থাকে।",
  },
});

function matches(chat: Chat, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return chat.title.toLowerCase().includes(q) || chat.turns.some((t) => t.question.toLowerCase().includes(q));
}

export function ChatSidebar({
  chats,
  activeId,
  onNewChat,
  onDelete,
  onClearAll,
  onClose,
}: {
  chats: Chat[];
  activeId: string | null;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  /** Present when the sidebar is a drawer (phones): closes it. */
  onClose?: () => void;
}) {
  const t = useT(M);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const shown = chats.filter((c) => matches(c, query));

  // A chat's menu closes on a click elsewhere or on Escape.
  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuFor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuFor(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuFor]);
  const [confirmAll, setConfirmAll] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
        <Link to="/" className="rounded-md px-1.5 py-1 no-underline" aria-label={t("home")}>
          <Wordmark />
        </Link>
        {onClose && (
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("close")} onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        )}
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-10 w-full items-center gap-2.5 rounded-[var(--radius)] px-3 text-[0.9375rem] font-semibold text-text transition-colors hover:bg-hover"
        >
          <SquarePen size={17} aria-hidden /> {t("newChat")}
        </button>
      </div>

      {chats.length > 0 && (
        <div className="px-3 pb-2">
          <label htmlFor="chat-search" className="visually-hidden">
            {t("search")}
          </label>
          <div className="flex h-9 items-center gap-2 rounded-[var(--radius)] border border-rule bg-raised px-3 focus-within:border-rule-control">
            <Search size={15} className="shrink-0 text-faint" aria-hidden />
            <input
              id="chat-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-faint"
            />
          </div>
        </div>
      )}

      <nav aria-label="Chats" className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {chats.length === 0 ? (
          <p className="px-3 py-2 text-sm text-faint">{t("empty")}</p>
        ) : shown.length === 0 ? (
          <p className="px-3 py-2 text-sm text-faint">{t("noMatch", { q: query.trim() })}</p>
        ) : (
          groupChats(shown).map((group) => (
            <section key={group.key} className="mb-4">
              <h2 className="px-3 pb-1 text-xs font-semibold text-faint">{t(group.key)}</h2>
              <ul className="space-y-0.5">
                {group.chats.map((chat) => (
                  <li key={chat.id} className="group relative">
                    {confirming === chat.id ? (
                      <div className="flex items-center gap-1 rounded-[var(--radius)] bg-hover px-3 py-1.5 text-sm">
                        <span className="min-w-0 flex-1 truncate text-muted">{t("confirm")}</span>
                        <button
                          type="button"
                          className="rounded-full px-2 py-1 font-semibold text-danger hover:bg-bg"
                          onClick={() => {
                            setConfirming(null);
                            onDelete(chat.id);
                          }}
                        >
                          {t("delete")}
                        </button>
                        <button type="button" className="rounded-full px-2 py-1 text-muted hover:bg-bg" onClick={() => setConfirming(null)}>
                          {t("cancel")}
                        </button>
                      </div>
                    ) : renaming === chat.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const value = new FormData(e.currentTarget).get("title");
                          renameChat(chat.id, String(value ?? ""));
                          setRenaming(null);
                        }}
                      >
                        <label htmlFor={`rename-${chat.id}`} className="visually-hidden">
                          {t("newName", { title: chat.title })}
                        </label>
                        <input
                          id={`rename-${chat.id}`}
                          name="title"
                          defaultValue={chat.title}
                          autoFocus
                          maxLength={60}
                          onBlur={() => setRenaming(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setRenaming(null);
                          }}
                          className="h-9 w-full rounded-[var(--radius)] border border-rule-control bg-raised px-3 text-sm text-text outline-none"
                        />
                      </form>
                    ) : (
                      <>
                        <NavLink
                          to={`/ask/${chat.id}`}
                          onClick={onClose}
                          className={({ isActive }) =>
                            `flex h-9 items-center gap-2 rounded-[var(--radius)] py-1 pl-3 pr-9 text-sm no-underline transition-colors ${
                              isActive || chat.id === activeId ? "bg-hover font-medium text-text" : "text-muted hover:bg-hover hover:text-text"
                            }`
                          }
                        >
                          <span className="truncate">{chat.title}</span>
                        </NavLink>
                        <button
                          type="button"
                          aria-label={t("more", { title: chat.title })}
                          aria-haspopup="menu"
                          aria-expanded={menuFor === chat.id}
                          title={t("moreTitle")}
                          onClick={() => setMenuFor((m) => (m === chat.id ? null : chat.id))}
                          className={`absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-faint transition-opacity hover:bg-bg hover:text-text focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100 ${
                            menuFor === chat.id ? "opacity-100" : "opacity-0"
                          }`}
                        >
                          <Ellipsis size={15} aria-hidden />
                        </button>
                        {menuFor === chat.id && (
                          <div
                            ref={menuRef}
                            role="menu"
                            aria-label={`“${chat.title}”`}
                            className="absolute right-1 top-[calc(100%+2px)] z-10 w-40 rounded-[var(--radius)] border border-rule bg-raised p-1 shadow-[var(--shadow-lg)]"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="flex h-9 w-full items-center gap-2 rounded-[8px] px-2.5 text-sm text-text hover:bg-hover"
                              onClick={() => {
                                setMenuFor(null);
                                setRenaming(chat.id);
                              }}
                            >
                              <Pencil size={14} aria-hidden /> {t("rename")}
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="flex h-9 w-full items-center gap-2 rounded-[8px] px-2.5 text-sm text-danger hover:bg-hover"
                              onClick={() => {
                                setMenuFor(null);
                                setConfirming(chat.id);
                              }}
                            >
                              <Trash2 size={14} aria-hidden /> {t("delete")}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </nav>

      <div className="space-y-1 border-t border-rule px-3 py-3">
        <ul className="space-y-0.5">
          {[
            { to: "/explore", label: t("explore"), icon: Compass },
            { to: "/discover", label: t("discover"), icon: Orbit },
            { to: "/about", label: t("about"), icon: Info },
          ].map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex h-9 items-center gap-2.5 rounded-[var(--radius)] px-3 text-sm text-muted no-underline transition-colors hover:bg-hover hover:text-text"
              >
                <Icon size={16} aria-hidden /> {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          {confirmAll ? (
            <span className="flex items-center gap-1 text-sm">
              <span className="text-muted">{t("confirmAll")}</span>
              <button
                type="button"
                className="rounded-full px-2 py-1 font-semibold text-danger hover:bg-hover"
                onClick={() => {
                  setConfirmAll(false);
                  onClearAll();
                }}
              >
                {t("delete")}
              </button>
              <button type="button" className="rounded-full px-2 py-1 text-muted hover:bg-hover" onClick={() => setConfirmAll(false)}>
                {t("cancel")}
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={chats.length === 0}
              onClick={() => setConfirmAll(true)}
              className="inline-flex h-8 items-center gap-2 rounded-full px-2 text-xs text-faint transition-colors hover:bg-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageSquare size={14} aria-hidden /> {t("deleteAll")}
            </button>
          )}
          <span className="flex items-center">
            <LanguageToggle />
            <ThemeToggle />
          </span>
        </div>
        <p className="px-2 text-xs leading-snug text-faint">{t("kept")}</p>
      </div>
    </div>
  );
}
