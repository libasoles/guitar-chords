import type { ChordFinger } from './chords-db';

export type BrokenChordQuality =
  | 'Major' | 'Minor' | 'Seventh' | 'SeventhNoFifth' | 'MinorSeventh' | 'MajorSeventh'
  | 'Diminished' | 'Dim7C' | 'Dim7Db' | 'Dim7D';

/** One four-string position meant for arpeggios (not the chord's full shape). */
export interface BrokenChordDefinition {
  /** Chord name with its bass, e.g. `C`, `C/E`, `Dm7/C`. */
  name: string;
  /** Root in letters (`C`, `Db`, `F#`…). `Dim7` for the symmetric diminished sevenths. */
  root: string;
  quality: BrokenChordQuality;
  /** Fret per string, string 1 (high E) first … string 6; `null` = not played. */
  form: (number | null)[];
  /** Left-hand fingers in the same order as `form`: `0` open, `-` not played. */
  fingering: string;
  /** Sounding notes, bass first (same style as `ChordDefinition.notes`). */
  notes: string;
  /** Same format as `ChordDefinition.fingers`, so the position can be drawn like any chord. */
  fingers: ChordFinger[];
}

export const BROKEN_CHORDS: BrokenChordDefinition[];
