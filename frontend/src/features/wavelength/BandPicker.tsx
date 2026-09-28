import { BANDS } from "../../lib/bands";

interface Props {
  counts: Record<number, number>;
  detector: number;
  onChange: (detector: number) => void;
}

/** The six detector bands, with their wavelength ranges and how many frames each has. */
export function BandPicker({ counts, detector, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Wavelength band" className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:grid-cols-3">
      {BANDS.map((b) => {
        const n = counts[b.detector] ?? 0;
        const selected = b.detector === detector;
        return (
          <button
            key={b.detector}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={n === 0}
            onClick={() => onChange(b.detector)}
            aria-label={`Detector ${b.detector}, ${b.minUm} to ${b.maxUm} micrometres, ${n} frames`}
            className={`flex min-h-12 flex-col items-start justify-center rounded-sm border px-2.5 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              selected ? "border-accent bg-accent-wash" : "border-rule hover:border-rule-strong"
            }`}
          >
            <span className="flex w-full items-center gap-1.5 text-[0.8125rem] font-medium text-text">
              <span className="h-2 w-2 rounded-full" style={{ background: b.color }} aria-hidden />
              D{b.detector}
              <span className="num ml-auto text-[0.6875rem] font-normal text-faint">{n}</span>
            </span>
            <span className="num whitespace-nowrap text-[0.6875rem] text-faint">
              {b.minUm.toFixed(2)}–{b.maxUm.toFixed(2)} µm
            </span>
          </button>
        );
      })}
    </div>
  );
}
