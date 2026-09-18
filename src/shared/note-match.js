/* ----- note-match.js -----
   Empareja un conjunto de notas seleccionadas (por clase de altura, 0-11)
   contra la base de acordes (chords-db.js), para la página "identificar
   acordes a partir de notas": el usuario marca notas en un teclado y ve los
   acordes de guitarra que las contienen todas.

   El matching usa la fórmula TEÓRICA del acorde (fundamental + intervalos de
   su calidad), no el campo `notes` de chords-db: `notes` son las notas que
   efectivamente suenan en ESA digitación puntual, y en la guitarra es común
   omitir la 5ª (p. ej. el C7 en posición abierta de este dataset no toca la
   Sol) sin que el acorde deje de ser, armónicamente, un C7. Si se matcheara
   contra `notes`, elegir Do-Mi-Sol-Sib (la fórmula de C7) no encontraría C7.

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

  // Nota → clase de altura 0-11 ('C♯' → 1). Devuelve null si no reconoce el token.
  function pitchClass(note) {
    const key = String(note == null ? '' : note).trim();
    return Object.prototype.hasOwnProperty.call(PITCH_CLASS, key) ? PITCH_CLASS[key] : null;
  }

  // El campo `notes` de un acorde ('E B E G♯ B E') → Set de clases de altura únicas ({4, 11, 8}).
  // Representa lo que efectivamente SUENA en esa digitación (ver nota arriba
  // sobre por qué el matching no usa esto directamente).
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

  const ROOT_RE = /^([A-G])([♯♭]?)/;

  // Intervalos (semitonos desde la fundamental) por calidad, cubriendo el
  // vocabulario cerrado de chords-db.js (ver el comentario de cabecera de
  // ese archivo): mayor, menor, 7, m7, maj7, 6, m6, maj9, 9, m9, 7♭9, sus2,
  // sus4, dim7, aug, m7♭5, m(add9). La clave es el sufijo del nombre del
  // acorde tras la fundamental y (si es un acorde con bajo, "C7/B") antes
  // de la barra.
  const QUALITY_INTERVALS = {
    '': [0, 4, 7],
    m: [0, 3, 7],
    '6': [0, 4, 7, 9],
    m6: [0, 3, 7, 9],
    '7': [0, 4, 7, 10],
    m7: [0, 3, 7, 10],
    m7b5: [0, 3, 6, 10],
    maj7: [0, 4, 7, 11],
    mMaj7: [0, 3, 7, 11],
    '9': [0, 4, 7, 10, 2],
    m9: [0, 3, 7, 10, 2],
    maj9: [0, 4, 7, 11, 2],
    '7♭9': [0, 4, 7, 10, 1],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
    dim7: [0, 3, 6, 9],
    aug: [0, 4, 8],
    'm(add9)': [0, 3, 7, 2],
  };

  // Nota de bajo de un acorde con barra ('C#' en "C7/C#") → clase de altura.
  // El bajo se escribe siempre en cifrado americano con '#' ascii (nunca ♯/♭).
  function bassPitchClass(bass) {
    if (!bass) return null;
    const letter = bass[0];
    const accidental = bass[1] === '#' ? '♯' : '';
    return pitchClass(letter + accidental);
  }

  // Clases de altura TEÓRICAS de un acorde: fundamental + intervalos de su
  // calidad (más el bajo explícito si es un acorde con barra, p. ej. "C/E").
  // Si la calidad no está en QUALITY_INTERVALS (no debería pasar con la base
  // actual), cae de vuelta a chordPitchClasses (las notas de esa digitación).
  function chordToneClasses(chord) {
    const name = String((chord && chord.name) || '');
    const m = ROOT_RE.exec(name);
    if (!m) return chordPitchClasses(chord);
    const rootPc = pitchClass(m[1] + m[2]);
    const rest = name.slice(m[0].length);
    const slashIndex = rest.indexOf('/');
    const quality = slashIndex === -1 ? rest : rest.slice(0, slashIndex);
    const bass = slashIndex === -1 ? null : rest.slice(slashIndex + 1);
    const intervals = QUALITY_INTERVALS[quality];
    if (rootPc === null || !intervals) return chordPitchClasses(chord);
    const set = new Set(intervals.map(function (i) { return (rootPc + i) % 12; }));
    const bassPc = bassPitchClass(bass);
    if (bassPc !== null) set.add(bassPc);
    return set;
  }

  // Acordes cuyas notas TEÓRICAS incluyen TODAS las clases de altura
  // seleccionadas (selected ⊆ chordToneClasses(chord)), ordenados por menor
  // cantidad de notas "extra" primero (match más exacto), y a igualdad, el
  // orden de la base.
  function matchByNotes(selectedPitchClasses, chords) {
    const selected = Array.from(selectedPitchClasses || []);
    if (selected.length === 0) return [];
    const list = chords || [];
    const scored = [];
    list.forEach(function (chord, index) {
      const chordSet = chordToneClasses(chord);
      const containsAll = selected.every(function (pc) { return chordSet.has(pc); });
      if (!containsAll) return;
      scored.push({ chord: chord, extra: chordSet.size - selected.length, index: index });
    });
    scored.sort(function (a, b) {
      return a.extra - b.extra || a.index - b.index;
    });
    return scored.map(function (s) { return s.chord; });
  }

  return {
    pitchClass: pitchClass,
    chordPitchClasses: chordPitchClasses,
    chordToneClasses: chordToneClasses,
    matchByNotes: matchByNotes,
  };
});
