/* ----- chord-search.js -----
   Costura pura y testeable del buscador de acordes.
   Funciona como <script> en el popup (expone window.ChordSearch)
   y como módulo importado en Node (module.exports) para los tests.

   Es la MISMA normalización que usa el buscador web (reference/chord-finder.html):
   minúsculas; ♭→b, ♯→#, △/Δ→maj, ø→m7b5; sin espacios. */

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;           // Node (tests)
  }
  if (typeof window !== 'undefined') {
    window.ChordSearch = api;       // navegador (popup)
    // Conveniencia: exponer sueltas para paridad con el buscador web.
    window.normalize = window.normalize || api.normalize;
    window.matchChords = window.matchChords || api.matchChords;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Normaliza un string de acorde/query a una forma comparable.
  //   ♭ → b, ♯ → #, △/Δ → maj, ø → m7b5, minúsculas, sin espacios.
  // △ = U+25B3 (triángulo), Δ = U+0394 (delta griega): ambos significan maj7.
  function normalize(s) {
    return String(s == null ? '' : s)
      // Símbolos primero: toLowerCase() mapearía Δ (U+0394) a δ (U+03B4)
      // y ya no matchearía la clase, así que reemplazamos antes de bajar caso.
      .replace(/♭/g, 'b')
      .replace(/♯/g, '#')
      .replace(/[△Δ]/g, 'maj')
      .replace(/ø/g, 'm7b5')
      .toLowerCase()
      .replace(/\s+/g, '');
  }

  // Devuelve los acordes cuyo nombre o algún alias, normalizados,
  // EMPIEZAN CON la query normalizada. Orden estable de la base.
  // Query vacía (o sólo espacios/símbolos que colapsan a '') → [].
  function matchChords(query, chords) {
    const q = normalize(query);
    if (q === '') return [];
    const list = chords || [];
    return list.filter(function (chord) {
      const candidates = [chord.name].concat(chord.aliases || []);
      return candidates.some(function (candidate) {
        return normalize(candidate).startsWith(q);
      });
    });
  }

  return { normalize: normalize, matchChords: matchChords };
});
