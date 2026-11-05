import type { ChordDefinition } from './chords-db';

/** Lowercases and unifies symbols (♭ → b, △ → maj, accents removed, Spanish root → American). */
export function normalize(text: unknown, notation?: 'es' | 'en'): string;

/**
 * Chords whose name or alias matches `query`, best match first (fuzzy ranking).
 * Case-insensitive; roots may be American (C, Bb) or solfège (Do, Sib). Empty query → [].
 */
export function matchChords<T extends Pick<ChordDefinition, 'name' | 'aliases'>>(
  query: string,
  chords: readonly T[],
  notation?: 'es' | 'en',
): T[];
