/* ----- Posiciones alternativas de acordes -----
   Muchos acordes (mayor, menor, 7, m7) se pueden tocar en más de un sitio del
   diapasón: en posición abierta o con una forma movible de cejilla basada en
   el acorde de Mi (cejilla en la 6ª cuerda) o en el de La (cejilla en la 5ª).
   `chords-db.js` sólo guarda una digitación por acorde (la que se muestra por
   defecto); este módulo calcula, a partir de esa forma y del nombre del
   acorde, una segunda posición "alternativa" usando la forma de cejilla que
   todavía no se está usando.

   window.ChordPositions.getPositions(chord) siempre devuelve al menos
   [{ fingers, barres, position, label, hasBarre }] con la posición por
   defecto del propio `chord`, y añade una segunda entrada cuando la familia
   del acorde (mayor/menor/7/m7) soporta el cálculo. */
(function () {
  'use strict';

  var NOTE_INDEX = {
    'C': 0, 'B♯': 0,
    'C♯': 1, 'D♭': 1,
    'D': 2,
    'D♯': 3, 'E♭': 3,
    'E': 4, 'F♭': 4,
    'F': 5, 'E♯': 5,
    'F♯': 6, 'G♭': 6,
    'G': 7,
    'G♯': 8, 'A♭': 8,
    'A': 9,
    'A♯': 10, 'B♭': 10,
    'B': 11, 'C♭': 11,
  };

  // Notas extra sobre la forma abierta de Mi/La para cada familia soportada,
  // como [cuerda, traste-relativo-a-la-cejilla]. Las cuerdas no listadas
  // quedan cubiertas por la propia cejilla (mismo traste que ella).
  var SHAPES = {
    major: { E: [[3, 1], [4, 2], [5, 2]], A: [[2, 2], [3, 2], [4, 2]] },
    minor: { E: [[4, 2], [5, 2]], A: [[2, 1], [3, 2], [4, 2]] },
    dom7: { E: [[3, 1], [5, 2]], A: [[2, 2], [4, 2]] },
    m7: { E: [[5, 2]], A: [[2, 1], [4, 2]] },
  };

  var FAMILY_ALIASES = { major: 'major', minor: 'minor', dom7: 'dom7', m7: 'm7' };

  function rootPitchClass(name) {
    var match = /^([A-G][♯♭]?)/.exec(name || '');
    if (!match) return null;
    return NOTE_INDEX[match[1]];
  }

  function familyFor(chord) {
    var families = chord.families || [];
    for (var i = 0; i < families.length; i++) {
      if (FAMILY_ALIASES[families[i]]) return FAMILY_ALIASES[families[i]];
    }
    return null;
  }

  function buildShape(family, shapeKey, fret) {
    var template = SHAPES[family][shapeKey];
    var items = template.map(function (pair) { return { string: pair[0], rel: pair[1] }; });
    if (shapeKey === 'A') items.push({ string: 6, mute: true });

    var ranked = items.filter(function (it) { return !it.mute; }).slice().sort(function (a, b) {
      if (a.rel !== b.rel) return a.rel - b.rel;
      return b.string - a.string;
    });
    var labelByString = {};
    ranked.forEach(function (it, i) { labelByString[it.string] = String(i + 2); });

    var fingers = items.slice().sort(function (a, b) { return b.string - a.string; }).map(function (it) {
      if (it.mute) return [it.string, 'x'];
      return [it.string, fret + it.rel, labelByString[it.string]];
    });

    return {
      fingers: fingers,
      barres: [{ fromString: shapeKey === 'E' ? 6 : 5, toString: 1, fret: fret }],
      position: fret,
      hasBarre: true,
      kind: shapeKey === 'E' ? 'barre6' : 'barre5',
    };
  }

  function computeAlternate(chord) {
    var family = familyFor(chord);
    if (!family) return null;

    var pc = rootPitchClass(chord.name);
    if (pc == null) return null;

    var fretE = (pc - 4 + 12) % 12;
    var fretA = (pc - 9 + 12) % 12;

    if (chord.barres && chord.barres.length) {
      var usedShape = chord.barres[0].fromString === 6 ? 'E' : 'A';
      var altShape = usedShape === 'E' ? 'A' : 'E';
      var altFret = altShape === 'E' ? fretE : fretA;
      if (!altFret) return null;
      return buildShape(family, altShape, altFret);
    }

    var candidates = [];
    if (fretE) candidates.push({ shape: 'E', fret: fretE });
    if (fretA) candidates.push({ shape: 'A', fret: fretA });
    if (!candidates.length) return null;

    candidates.sort(function (a, b) {
      if (a.fret !== b.fret) return a.fret - b.fret;
      return a.shape === 'E' ? -1 : 1;
    });

    return buildShape(family, candidates[0].shape, candidates[0].fret);
  }

  function getPositions(chord) {
    var hasBarre = !!(chord.barres && chord.barres.length);
    var base = {
      fingers: chord.fingers,
      barres: chord.barres || [],
      position: chord.position || 1,
      hasBarre: hasBarre,
      kind: !hasBarre ? 'open' : (chord.barres[0].fromString === 6 ? 'barre6' : 'barre5'),
    };

    var alt = computeAlternate(chord);
    return alt ? [base, alt] : [base];
  }

  window.ChordPositions = { getPositions: getPositions };
})();
