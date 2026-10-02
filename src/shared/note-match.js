/* ----- note-match.js -----
   Empareja un conjunto de notas seleccionadas (por clase de altura, 0-11)
   contra la base de acordes (chords-db.js), para la página "identificar
   acordes a partir de notas": el usuario marca notas en un teclado y ve los
   acordes de guitarra que las contienen todas.

   El matching usa las notas que efectivamente SUENAN en cada digitación
   (calculadas desde fingers + barres con afinación estándar), no la fórmula
   teórica del acorde: la página muestra digitaciones concretas, y en la
   guitarra es común omitir notas (el F6 abierto de este dataset no toca el
   Do). Un acorde aparece si al menos una de sus posiciones (la base más las
   alternativas de ChordPositions.getPositions) suena todas las notas
   marcadas, y sólo con esas posiciones.

   Cada digitación se reduce a una máscara de 12 bits (bit n = clase de
   altura n), así que "contiene todas las notas" es (mask & sel) === sel.

   Funciona como <script> global (expone window.NoteMatch) y como módulo
   Node (module.exports) para los tests. */

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.NoteMatch = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PITCH_CLASS = {
    C: 0, 'B♯': 0,
    'C♯': 1, 'D♭': 1,
    D: 2,
    'D♯': 3, 'E♭': 3,
    E: 4, 'F♭': 4,
    F: 5, 'E♯': 5,
    'F♯': 6, 'G♭': 6,
    G: 7,
    'G♯': 8, 'A♭': 8,
    A: 9,
    'A♯': 10, 'B♭': 10,
    B: 11, 'C♭': 11,
  };

  const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

  // Clase de altura de cada cuerda al aire en afinación estándar (6 = Mi grave … 1 = Mi agudo).
  const OPEN_STRING = { 6: 4, 5: 9, 4: 2, 3: 7, 2: 11, 1: 4 };

  // Nota → clase de altura 0-11 ('C♯' → 1). Devuelve null si no reconoce el token.
  function pitchClass(note) {
    const key = String(note == null ? '' : note).trim();
    return Object.prototype.hasOwnProperty.call(PITCH_CLASS, key) ? PITCH_CLASS[key] : null;
  }

  // El campo `notes` de un acorde ('E B E G♯ B E') → Set de clases de altura únicas ({4, 11, 8}).
  function chordPitchClasses(chord) {
    const notes = String((chord && chord.notes) || '').trim();
    if (notes === '') return new Set();
    const set = new Set();
    notes.split(/\s+/).forEach(function (token) {
      const pc = pitchClass(token);
      if (pc !== null) set.add(pc);
    });
    return set;
  }

  // Traste que suena en cada cuerda: las cejillas ponen el piso y los dedos
  // lo pisan ('x' silencia, 'o' = al aire, número = ese traste). Devuelve
  // { cuerda: traste } sólo para las cuerdas que suenan.
  function soundingFrets(fingers, barres) {
    const frets = {};
    (barres || []).forEach(function (barre) {
      const lo = Math.min(barre.fromString, barre.toString);
      const hi = Math.max(barre.fromString, barre.toString);
      for (let s = lo; s <= hi; s++) frets[s] = barre.fret;
    });
    (fingers || []).forEach(function (finger) {
      const string = finger[0];
      const value = finger[1];
      if (value === 'x') delete frets[string];
      else if (value === 'o') frets[string] = 0;
      else frets[string] = value;
    });
    return frets;
  }

  // Deletreo preferido por el propio acorde (E♭ y no D♯), para que las notas
  // de una posición alternativa se escriban igual que las de la base.
  function spellingForPitch(chord, pc) {
    const spellings = String((chord && chord.notes) || '').split(/\s+/);
    for (let i = 0; i < spellings.length; i++) {
      if (pitchClass(spellings[i]) === pc) return spellings[i];
    }
    return SHARP_NAMES[pc];
  }

  // Notas que suenan en una posición ({ fingers, barres }), de la 6ª a la 1ª
  // cuerda, sin las cuerdas silenciadas: [{ note: 'C', pc: 0 }, ...].
  function voicingNotes(chord, position) {
    const frets = soundingFrets(position && position.fingers, position && position.barres);
    const notes = [];
    for (let string = 6; string >= 1; string--) {
      if (frets[string] == null) continue;
      const pc = (OPEN_STRING[string] + Number(frets[string])) % 12;
      notes.push({ note: spellingForPitch(chord, pc), pc: pc });
    }
    return notes;
  }

  // Clases de altura → entero de 12 bits.
  function toMask(pitchClasses) {
    let mask = 0;
    Array.from(pitchClasses || []).forEach(function (pc) { mask |= 1 << pc; });
    return mask;
  }

  function bitCount(mask) {
    let n = 0;
    for (; mask; mask &= mask - 1) n++;
    return n;
  }

  function basePosition(chord) {
    return { fingers: chord.fingers, barres: chord.barres || [], position: chord.position || 1, kind: 'open' };
  }

  // Acordes con al menos una posición que suene TODAS las clases de altura
  // seleccionadas. Cada resultado es { chord, positions } donde `positions`
  // son sólo las posiciones que matchean, cada una con su texto `notes`.
  // getPositions(chord) (opcional, p. ej. ChordPositions.getPositions) da
  // las posiciones candidatas; sin él se usa sólo la digitación base.
  // Orden: menos notas "extra" en la mejor posición primero (match más
  // exacto) y, a igualdad, el orden de la base.
  function matchByNotes(selectedPitchClasses, chords, getPositions) {
    const sel = toMask(selectedPitchClasses);
    if (sel === 0) return [];
    const selCount = bitCount(sel);
    const scored = [];
    (chords || []).forEach(function (chord, index) {
      const candidates = getPositions ? getPositions(chord) : [basePosition(chord)];
      let bestExtra = Infinity;
      const positions = [];
      candidates.forEach(function (pos) {
        const notes = voicingNotes(chord, pos);
        const mask = toMask(notes.map(function (n) { return n.pc; }));
        if ((mask & sel) !== sel) return;
        bestExtra = Math.min(bestExtra, bitCount(mask) - selCount);
        positions.push(Object.assign({}, pos, {
          notes: notes.map(function (n) { return n.note; }).join(' '),
        }));
      });
      if (positions.length === 0) return;
      scored.push({ chord: chord, positions: positions, extra: bestExtra, index: index });
    });
    scored.sort(function (a, b) {
      return a.extra - b.extra || a.index - b.index;
    });
    return scored.map(function (s) { return { chord: s.chord, positions: s.positions }; });
  }

  return {
    pitchClass: pitchClass,
    chordPitchClasses: chordPitchClasses,
    soundingFrets: soundingFrets,
    voicingNotes: voicingNotes,
    toMask: toMask,
    matchByNotes: matchByNotes,
  };
});
