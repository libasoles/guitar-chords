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

  function convertToken(letter, accidental) {
    let out = EN_TO_ES[letter];
    if (accidental === '♯' || accidental === '#') out += '♯';
    else if (accidental === '♭' || accidental === 'b') out += '♭';
    return out;
  }

  // Convierte sólo las notas raíz (inicio de string) y de bajo (tras "/"),
  // dejando intacta la calidad del acorde (m, 7, sus4, dim, °, etc.).
  //   'C' → 'Do'    'C♯m' → 'Do♯m'    'D/F♯' → 'Re/Fa♯'    'Bm7b5' → 'Sim7b5'
  function toSpanishName(name) {
    const s = String(name == null ? '' : name);
    return s.replace(/([A-G])([♯#♭b]?)/g, function (match, letter, accidental, offset) {
      if (offset === 0 || s[offset - 1] === '/') {
        return convertToken(letter, accidental);
      }
      return match;
    });
  }

  // Convierte una lista de notas separadas por espacios ('C E G' → 'Do Mi Sol').
  function toSpanishNotes(notes) {
    const s = String(notes == null ? '' : notes);
    if (s === '') return s;
    return s.split(' ').map(toSpanishName).join(' ');
  }

  return { toSpanishName: toSpanishName, toSpanishNotes: toSpanishNotes };
});
