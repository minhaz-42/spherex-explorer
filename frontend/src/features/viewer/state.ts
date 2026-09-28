import type { SequenceSpec } from "../../lib/sequence";

export type CompareMode = "single" | "blink" | "side" | "diff";

/** What the URL remembers about a view. Frames are named by observation ID, which never shifts. */
export interface ViewerState {
  spec: SequenceSpec;
  frame: string | null;
  reference: string | null;
  compare: CompareMode;
  fov: number;
}

/** Fields of view offered, in degrees. */
export const FIELDS = [0.1, 0.2, 0.3, 0.5];
