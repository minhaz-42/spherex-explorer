import { Search } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import { defineMessages, useT } from "../../lib/i18n";

const M = defineMessages({
  en: {
    label: "Object name or sky coordinates",
    placeholderLarge: "M31 or 10.6847 41.2690",
    placeholderCompact: "Name or coordinates",
    searching: "Searching…",
    search: "Search",
    empty: "Type an object name or coordinates.",
    hint: "Names are looked up in SIMBAD, NED and VizieR. Coordinates can be decimal degrees, hours and degrees, or galactic (l=… b=…).",
  },
  bn: {
    label: "বস্তুর নাম বা আকাশের স্থানাঙ্ক",
    placeholderLarge: "M31 অথবা 10.6847 41.2690",
    placeholderCompact: "নাম বা স্থানাঙ্ক",
    searching: "খোঁজা হচ্ছে…",
    search: "খুঁজুন",
    empty: "কোনো বস্তুর নাম বা স্থানাঙ্ক লিখুন।",
    hint: "নাম খোঁজা হয় SIMBAD, NED ও VizieR-এ। স্থানাঙ্ক দশমিক ডিগ্রিতে, ঘণ্টা ও ডিগ্রিতে, অথবা গ্যালাক্টিক (l=… b=…) আকারে দেওয়া যায়।",
  },
});

interface Props {
  initial?: string;
  error?: string | null;
  busy?: boolean;
  onSearch: (query: string) => void;
  size?: "large" | "compact";
}

export function SearchForm({ initial = "", error, busy, onSearch, size = "large" }: Props) {
  const t = useT(M);
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const id = useId();
  const empty = touched && value.trim() === "";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (value.trim()) onSearch(value.trim());
  };

  const message = empty ? t("empty") : error;
  return (
    <form role="search" onSubmit={submit} noValidate className="w-full">
      <label htmlFor={id} className={size === "large" ? "mb-2 block text-sm text-muted" : "visually-hidden"}>
        {t("label")}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <input
            id={id}
            className={`field !pl-10 ${size === "large" ? "!min-h-12 text-[1.0625rem]" : ""}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={size === "large" ? t("placeholderLarge") : t("placeholderCompact")}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? `${id}-error` : `${id}-hint`}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
        </div>
        <button type="submit" className={`btn btn-primary ${size === "large" ? "!min-h-12 px-5" : ""}`} disabled={busy}>
          {busy ? t("searching") : t("search")}
        </button>
      </div>
      {message ? (
        <p id={`${id}-error`} className="mt-2 text-sm text-danger" role="alert">
          {message}
        </p>
      ) : (
        size === "large" && (
          <p id={`${id}-hint`} className="mt-2 text-sm text-faint">
            {t("hint")}
          </p>
        )
      )}
    </form>
  );
}
