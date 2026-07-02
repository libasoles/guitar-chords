/* ----- chord-search.js -----
   Costura pura y testeable del buscador de acordes.
   Funciona como <script> en el popup (expone window.ChordSearch)
   y como módulo importado en Node (module.exports) para los tests.

   Es la MISMA normalización que usa el buscador web (reference/chord-finder.html):
   minúsculas; ♭→b, ♯→#, △/Δ→maj, ø→m7b5; sin espacios.

   Soporta buscar en cifrado español (Do, Re, Mi, Fa, Sol, La, Si) además del
   americano (C D E F G A B): la nota inicial en español se traduce a su
   equivalente americano antes de comparar, ya que la base sólo guarda nombres
   en cifrado americano (ver note-names.js para la conversión inversa, usada
   para MOSTRAR nombres en español).

   El ranking de relevancia usa fuzzysort (vendor/fuzzysort.js), cargado
   como <script> global en el navegador y vía require() en Node. */

(function (root, factory) {
  const fuzzysort = typeof module !== 'undefined' && module.exports
    ? require('../../vendor/fuzzysort.js')
    : root.fuzzysort;
  const api = factory(fuzzysort);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;           // Node (tests)
  }
  if (typeof window !== 'undefined') {
    window.ChordSearch = api;       // navegador (popup)
    // Conveniencia: exponer sueltas para paridad con el buscador web.
    window.normalize = window.normalize || api.normalize;
    window.matchChords = window.matchChords || api.matchChords;
  }
})(typeof self !== 'undefined' ? self : this, function (fuzzysort) {
  'use strict';

  // Nota inicial en español → letra americana equivalente. Ninguna candidata
  // (nombre/alias en la base) empieza con estas sílabas, así que aplicar esto
  // siempre es seguro: sólo puede matchear queries en cifrado español.
  const ES_NOTE_PREFIX = /^(sol|do|re|mi|fa|la|si)/;
  const ES_TO_EN_NOTE = { sol: 'g', do: 'c', re: 'd', mi: 'e', fa: 'f', la: 'a', si: 'b' };

  // Normaliza un string de acorde/query a una forma comparable.
  //   ♭ → b, ♯ → #, △/Δ → maj, ø → m7b5, minúsculas, sin espacios.
  // △ = U+25B3 (triángulo), Δ = U+0394 (delta griega): ambos significan maj7.
  function normalize(s) {
    const normalized = String(s == null ? '' : s)
      // Símbolos primero: toLowerCase() mapearía Δ (U+0394) a δ (U+03B4)
      // y ya no matchearía la clase, así que reemplazamos antes de bajar caso.
      .replace(/♭/g, 'b')
      .replace(/♯/g, '#')
      .replace(/[△Δ]/g, 'maj')
      .replace(/ø/g, 'm7b5')
      .toLowerCase()
      .replace(/\s+/g, '');
    return normalized.replace(ES_NOTE_PREFIX, function (m) { return ES_TO_EN_NOTE[m]; });
  }

  // Devuelve los acordes cuyo nombre o algún alias, normalizados,
  // EMPIEZAN CON la query normalizada, ordenados por relevancia
  // (match más cercano al exacto primero, vía fuzzysort). Ante empate
  // de score se conserva el orden estable de la base.
  // Query vacía (o sólo espacios/símbolos que colapsan a '') → [].
  function matchChords(query, chords) {
    const q = normalize(query);
    if (q === '') return [];
    const list = chords || [];
    const scored = [];
    list.forEach(function (chord, index) {
      const candidates = [chord.name].concat(chord.aliases || []);
      let bestScore = null;
      candidates.forEach(function (candidate) {
        const normalized = normalize(candidate);
        if (!normalized.startsWith(q)) return;
        const score = fuzzysort.single(q, normalized).score;
        if (bestScore === null || score > bestScore) bestScore = score;
      });
      if (bestScore !== null) scored.push({ chord: chord, score: bestScore, index: index });
    });
    scored.sort(function (a, b) {
      return b.score - a.score || a.index - b.index;
    });
    return scored.map(function (s) { return s.chord; });
  }

  return { normalize: normalize, matchChords: matchChords };
});
