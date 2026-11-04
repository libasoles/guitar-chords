/** [string (6 = low E … 1 = high E), fret | "x" muted | "o" open, finger label?] */
export type ChordFinger = [number, number | 'x' | 'o', string?];

export interface ChordBarre {
  fromString: number;
  toString: number;
  fret: number;
}

/** One fingering of a chord. `position` (default 1) is the lowest fret drawn. */
export interface ChordFingering {
  fingers: ChordFinger[];
  barres?: ChordBarre[];
  position?: number;
  notes?: string;
}

export interface ChordDefinition extends ChordFingering {
  name: string;
  families?: string[];
  aliases?: string[];
  /** Extra hand-picked fingerings, offered after the default and the computed barre position. */
  alternatePositions?: ChordFingering[];
}

export const CHORDS: ChordDefinition[];
