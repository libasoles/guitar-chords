/* ----- note-names.js -----
   Conversión de nombres de acorde/notas entre cifrado americano (C D E F G A B)
   y cifrado latino/español (Do Re Mi Fa Sol La Si). Sólo transforma los TOKENS
   de nota (raíz y bajo tras "/"); el resto del símbolo (m, 7, sus4, maj7, °...)
   queda igual en ambos cifrados.

   Funciona como <script> global (expone window.NoteNames) y como módulo
   Node (module.exports) para los tests. */

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.NoteNames = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const EN_TO_ES = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };

  // Solfejo brasileiro: con tilde (Dó Ré Mi Fá Sol Lá Si).
  const EN_TO_PT = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };

  function convertToken(letter, accidental, table) {
    let out = (table || EN_TO_ES)[letter];
    if (accidental === '♯' || accidental === '#') out += '♯';
    else if (accidental === '♭' || accidental === 'b') out += '♭';
    return out;
  }

  // Convierte sólo las notas raíz (inicio de string) y de bajo (tras "/"),
  // dejando intacta la calidad del acorde (m, 7, sus4, dim, °, etc.).
  //   'C' → 'Do'    'C♯m' → 'Do♯m'    'D/F♯' → 'Re/Fa♯'    'Bm7b5' → 'Sim7b5'
  function convertName(name, table) {
    const s = String(name == null ? '' : name);
    return s.replace(/([A-G])([♯#♭b]?)/g, function (match, letter, accidental, offset) {
      if (offset === 0 || s[offset - 1] === '/') {
        return convertToken(letter, accidental, table);
      }
      return match;
    });
  }

  function convertNotes(notes, table) {
    const s = String(notes == null ? '' : notes);
    if (s === '') return s;
    return s.split(' ').map(function (note) { return convertName(note, table); }).join(' ');
  }

  function toSpanishName(name) { return convertName(name, EN_TO_ES); }

  // Convierte una lista de notas separadas por espacios ('C E G' → 'Do Mi Sol').
  function toSpanishNotes(notes) { return convertNotes(notes, EN_TO_ES); }

  // Portugués de Brasil: 'C' → 'Dó', 'D/F♯' → 'Ré/Fá♯'.
  function toPortugueseName(name) { return convertName(name, EN_TO_PT); }
  function toPortugueseNotes(notes) { return convertNotes(notes, EN_TO_PT); }

  // Solfejo según el idioma de la página: 'pt…' → con tilde; cualquier otro → español.
  function usesPortuguese(lang) { return /^pt/i.test(String(lang || '')); }
  function toSolfegeName(name, lang) {
    return usesPortuguese(lang) ? toPortugueseName(name) : toSpanishName(name);
  }
  function toSolfegeNotes(notes, lang) {
    return usesPortuguese(lang) ? toPortugueseNotes(notes) : toSpanishNotes(notes);
  }

  return {
    toSpanishName: toSpanishName,
    toSpanishNotes: toSpanishNotes,
    toPortugueseName: toPortugueseName,
    toPortugueseNotes: toPortugueseNotes,
    toSolfegeName: toSolfegeName,
    toSolfegeNotes: toSolfegeNotes,
  };
});
