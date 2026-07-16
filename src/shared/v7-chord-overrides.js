/* v7-chord-overrides.js — Page-local fingering overrides for the "chords and
   their V7" pages (major and minor). chords-db.js stays the single source of
   truth for the chord finder; these overrides only apply to the V7 pairing
   pages, where a different voicing reads better next to its neighbor.

   B♭7: chords-db's default sits at fret 1. E♭ and E♭m both sit at fret 6
   (barred), so pairing them with B♭7 at fret 1 is a big jump. This override
   keeps the same barre shape at fret 6 (the F7 shape moved up 5 frets) so the
   hand stays in place across the transition. */
window.V7_CHORD_OVERRIDES = {
  'B♭7': {
    name: 'B♭7', families: ['dom7'], aliases: ['A♯7'],
    notes: 'B♭ F A♭ D F B♭', position: 6, barres: [{ fromString: 6, toString: 1, fret: 6 }],
    fingers: [[5, 8, '3'], [3, 7, '2']]
  }
};
