/** Formatting for times, positions and measurements. Everything is shown in UTC. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MJD_UNIX_EPOCH = 40587;

export function mjdToDate(mjd: number): Date {
  return new Date(Math.round((mjd - MJD_UNIX_EPOCH) * 86400000));
}

export function dateToMjd(date: Date): number {
  return date.getTime() / 86400000 + MJD_UNIX_EPOCH;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** "2 Dec 2025" */
export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso.endsWith("Z") ? iso : `${iso}Z`) : iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "12:06:59 UTC" */
export function formatTime(iso: string | Date, seconds = true): string {
  const d = typeof iso === "string" ? new Date(iso.endsWith("Z") ? iso : `${iso}Z`) : iso;
  const t = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return seconds ? `${t}:${pad(d.getUTCSeconds())} UTC` : `${t} UTC`;
}

/** "Jul 2025" */
export function formatMonth(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso.endsWith("Z") ? iso : `${iso}Z`) : iso;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "9 – 22 Jul 2025", "18 Dec 2025 – 4 Jan 2026" */
export function formatRange(startIso: string, endIso: string): string {
  const a = new Date(`${startIso.slice(0, 10)}T00:00:00Z`);
  const b = new Date(`${endIso.slice(0, 10)}T00:00:00Z`);
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${formatDate(a)} – ${formatDate(b)}`;
  if (a.getUTCMonth() !== b.getUTCMonth()) {
    return `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  }
  if (a.getUTCDate() === b.getUTCDate()) return formatDate(a);
  return `${a.getUTCDate()} – ${b.getUTCDate()} ${MONTHS[a.getUTCMonth()]} ${a.getUTCFullYear()}`;
}

/** A time gap in plain units: "2 min", "9.7 h", "3.2 days", "5.8 months". */
export function formatGap(days: number): string {
  const minutes = days * 1440;
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  if (minutes < 90) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;
  if (days < 60) return `${days < 10 ? days.toFixed(1) : Math.round(days)} days`;
  return `${(days / 30.44).toFixed(1)} months`;
}

export function formatWavelength(um: number | null | undefined, digits = 3): string {
  return um == null ? "—" : `${um.toFixed(digits)} µm`;
}

export function formatDeg(value: number, digits = 4): string {
  return `${value.toFixed(digits)}°`;
}

/** Flux in µJy with a sensible number of digits, e.g. "191,207 µJy", "1.24 Jy". */
export function formatFlux(microJy: number | null | undefined): string {
  if (microJy == null || !Number.isFinite(microJy)) return "—";
  const abs = Math.abs(microJy);
  if (abs >= 1e6) return `${(microJy / 1e6).toPrecision(3)} Jy`;
  if (abs >= 1e3) return `${(microJy / 1e3).toPrecision(3)} mJy`;
  return `${microJy.toPrecision(3)} µJy`;
}

export function formatNumber(value: number | null | undefined, digits = 3): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value !== 0 && (Math.abs(value) < 1e-3 || Math.abs(value) >= 1e5)) return value.toExponential(2);
  return Number(value.toPrecision(digits)).toString();
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}
