import { Compass, Ellipsis, Info, MessageSquare, Orbit, Pencil, Search, SquarePen, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router";

import { ThemeToggle } from "../../components/ThemeToggle";
import { Wordmark } from "../../components/Wordmark";
import { type Chat, groupChats, renameChat } from "./chats";

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
        <Link to="/" className="rounded-md px-1.5 py-1 no-underline" aria-label="SPHEREx Explorer, home">
          <Wordmark />
        </Link>
        {onClose && (
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Close the chat list" onClick={onClose}>
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
          <SquarePen size={17} aria-hidden /> New chat
        </button>
      </div>

      {chats.length > 0 && (
        <div className="px-3 pb-2">
          <label htmlFor="chat-search" className="visually-hidden">
            Search chats
          </label>
          <div className="flex h-9 items-center gap-2 rounded-[var(--radius)] border border-rule bg-raised px-3 focus-within:border-rule-control">
            <Search size={15} className="shrink-0 text-faint" aria-hidden />
            <input
              id="chat-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-faint"
            />
          </div>
        </div>
      )}

      <nav aria-label="Chats" className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {chats.length === 0 ? (
          <p className="px-3 py-2 text-sm text-faint">Your chats will appear here.</p>
        ) : shown.length === 0 ? (
          <p className="px-3 py-2 text-sm text-faint">No chat matches “{query.trim()}”.</p>
        ) : (
          groupChats(shown).map((group) => (
            <section key={group.label} className="mb-4">
              <h2 className="px-3 pb-1 text-xs font-semibold text-faint">{group.label}</h2>
              <ul className="space-y-0.5">
                {group.chats.map((chat) => (
                  <li key={chat.id} className="group relative">
                    {confirming === chat.id ? (
                      <div className="flex items-center gap-1 rounded-[var(--radius)] bg-hover px-3 py-1.5 text-sm">
                        <span className="min-w-0 flex-1 truncate text-muted">Delete this chat?</span>
                        <button
                          type="button"
                          className="rounded-full px-2 py-1 font-semibold text-danger hover:bg-bg"
                          onClick={() => {
                            setConfirming(null);
                            onDelete(chat.id);
                          }}
                        >
                          Delete
                        </button>
                        <button type="button" className="rounded-full px-2 py-1 text-muted hover:bg-bg" onClick={() => setConfirming(null)}>
                          Cancel
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
                          New name for “{chat.title}”
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
                          aria-label={`More for “${chat.title}”`}
                          aria-haspopup="menu"
                          aria-expanded={menuFor === chat.id}
                          title="Rename or delete"
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
                              <Pencil size={14} aria-hidden /> Rename
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
                              <Trash2 size={14} aria-hidden /> Delete
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
            { to: "/explore", label: "Explore the sky", icon: Compass },
            { to: "/discover", label: "Discover", icon: Orbit },
            { to: "/about", label: "About and methods", icon: Info },
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
              <span className="text-muted">Delete all chats?</span>
              <button
                type="button"
                className="rounded-full px-2 py-1 font-semibold text-danger hover:bg-hover"
                onClick={() => {
                  setConfirmAll(false);
                  onClearAll();
                }}
              >
                Delete
              </button>
              <button type="button" className="rounded-full px-2 py-1 text-muted hover:bg-hover" onClick={() => setConfirmAll(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={chats.length === 0}
              onClick={() => setConfirmAll(true)}
              className="inline-flex h-8 items-center gap-2 rounded-full px-2 text-xs text-faint transition-colors hover:bg-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageSquare size={14} aria-hidden /> Delete all chats
            </button>
          )}
          <ThemeToggle />
        </div>
        <p className="px-2 text-xs leading-snug text-faint">Chats are kept only in this browser.</p>
      </div>
    </div>
  );
}
