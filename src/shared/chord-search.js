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
  //
  // También se acepta la abreviatura de una sola letra (r/m/l/s) para quien
  // busca "R" esperando Re, como con las letras americanas ("f" ya funciona
  // sin cambios: Fa y F son la misma letra). "d" y "do" quedan fuera: "d" ya
  // es la letra americana de Re, así que abreviar Do como "d" chocaría con
  // eso. "s" es ambigua entre Sol y Si; se prioriza Sol por ser la más
  // buscada, y Si sigue accesible escribiendo "si" completo.
  const ES_NOTE_PREFIX = /^(sol|do|re|mi|fa|la|si|r|m|l|s)/;
  const ES_TO_EN_NOTE = {
    sol: 'g', do: 'c', re: 'd', mi: 'e', fa: 'f', la: 'a', si: 'b',
    r: 'd', m: 'e', l: 'a', s: 'g',
  };

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

  // Nota inicial de un nombre/alias normalizado (letra + # o b opcional).
  const ROOT_RE = /^[a-g](?:#|b)?/;

  // Separa un string normalizado en { root, rest }: la nota inicial (si la
  // tiene) y el resto (calidad/extensión). "cmaj9" → { root: 'c', rest: 'maj9' }.
  function splitRoot(s) {
    const m = s.match(ROOT_RE);
    return m ? { root: m[0], rest: s.slice(m[0].length) } : { root: '', rest: s };
  }

  // Devuelve los acordes cuyo nombre o algún alias, normalizados, matchean
  // la query normalizada, ordenados por relevancia (match más cercano al
  // exacto primero, vía fuzzysort). Ante empate de score se conserva el
  // orden estable de la base.
  //
  // Si la query empieza con una nota (p. ej. "c9", "cmaj"), la nota debe
  // matchear EXACTO (no alcanza con "c" para matchear "c#") y el resto de
  // la query sólo necesita aparecer como subsecuencia en el resto del
  // candidato: "c9" matchea "Cmaj9" (resto "9" es subsecuencia de "maj9").
  // Si la query no empieza con una nota (p. ej. "9", "sus4"), se busca esa
  // subsecuencia en el candidato completo, sin restricción de nota: "9"
  // matchea cualquier acorde de novena, sin importar la raíz.
  //
  // Query vacía (o sólo espacios/símbolos que colapsan a '') → [].
  function matchChords(query, chords) {
    const q = normalize(query);
    if (q === '') return [];
    const qSplit = splitRoot(q);
    const list = chords || [];
    const scored = [];
    list.forEach(function (chord, index) {
      const candidates = [chord.name].concat(chord.aliases || []);
      let bestScore = null;
      candidates.forEach(function (candidate) {
        const normalized = normalize(candidate);
        let included;
        if (qSplit.root !== '') {
          const cSplit = splitRoot(normalized);
          included = cSplit.root === qSplit.root &&
            (qSplit.rest === '' || !!fuzzysort.single(qSplit.rest, cSplit.rest));
        } else {
          included = !!fuzzysort.single(q, normalized);
        }
        if (!included) return;
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
