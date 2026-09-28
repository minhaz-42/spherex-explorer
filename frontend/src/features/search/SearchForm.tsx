import { Search } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

interface Props {
  initial?: string;
  error?: string | null;
  busy?: boolean;
  onSearch: (query: string) => void;
  size?: "large" | "compact";
}

export function SearchForm({ initial = "", error, busy, onSearch, size = "large" }: Props) {
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const id = useId();
  const empty = touched && value.trim() === "";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (value.trim()) onSearch(value.trim());
  };

  const message = empty ? "Type an object name or coordinates." : error;
  return (
    <form role="search" onSubmit={submit} noValidate className="w-full">
      <label htmlFor={id} className={size === "large" ? "mb-2 block text-sm text-muted" : "visually-hidden"}>
        Object name or sky coordinates
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <input
            id={id}
            className={`field !pl-10 ${size === "large" ? "!min-h-12 text-[1.0625rem]" : ""}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={size === "large" ? "M31, Orion Nebula, 10.6847 41.2690, 00:42:44 +41:16:08" : "Name or coordinates"}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? `${id}-error` : `${id}-hint`}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
        </div>
        <button type="submit" className={`btn btn-primary ${size === "large" ? "!min-h-12 px-5" : ""}`} disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </button>
      </div>
      {message ? (
        <p id={`${id}-error`} className="mt-2 text-sm text-danger" role="alert">
          {message}
        </p>
      ) : (
        size === "large" && (
          <p id={`${id}-hint`} className="mt-2 text-sm text-faint">
            Names are looked up in SIMBAD, NED and VizieR. Coordinates can be decimal degrees, hours and degrees, or
            galactic (l=… b=…).
          </p>
        )
      )}
    </form>
  );
}
