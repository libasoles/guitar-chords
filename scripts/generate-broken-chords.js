'use strict';

/* Genera src/shared/broken-chords-db.js: la biblioteca de acordes rotos (posiciones de cuatro
   cuerdas para arpegios) que publica el paquete junto a CHORDS. La fuente es GROUPS de
   scripts/lib/article-arpeggios.js; este archivo es solo su volcado de datos, sin dependencias
   del build del sitio. `node scripts/generate-broken-chords.js` lo reescribe; con `--check` solo
   verifica que esté al día (lo usa test/broken-chords-db.unit.js). */

const fs = require('node:fs');
const path = require('node:path');
const { GROUPS, chordCardData } = require('./lib/article-arpeggios');

const OUTPUT = path.join(__dirname, '..', 'src', 'shared', 'broken-chords-db.js');

function brokenChords() {
  return GROUPS.flatMap(([, root, quality, names, forms, fingerings]) => names.map((name, i) => {
    const card = chordCardData(name, forms[i], fingerings[i]);
    return {
      name, root, quality,
      form: forms[i],
      fingering: fingerings[i],
      notes: card.stringNotes.filter(Boolean).reverse().join(' '),
      fingers: card.fingers.map(([string, fret, finger]) => finger ? [string, fret, String(finger)] : [string, fret]),
    };
  }));
}

function render() {
  const lines = brokenChords().map((chord) => '  ' + JSON.stringify(chord).replace(/"([a-zA-Z]+)":/g, '$1:').replace(/"/g, "'") + ',');
  return `/* ----- Biblioteca de acordes rotos (arpegios) -----
   GENERADO por scripts/generate-broken-chords.js desde scripts/lib/article-arpeggios.js: no editar a mano.

   Cada entrada es una posición de cuatro cuerdas pensada para arpegiar, no la forma completa del acorde.
   \`name\`: nombre con bajo (C/E). \`root\`: fundamental en letras (Dim7 = séptima disminuida, simétrica).
   \`quality\`: Major, Minor, Seventh, SeventhNoFifth, MinorSeventh, MajorSeventh, Diminished, Dim7C, Dim7Db, Dim7D.
   \`form\`: traste por cuerda, de la 1 (mi agudo) a la 6; null = no suena.
   \`fingering\`: dedos de la mano izquierda en el mismo orden (0 = al aire, - = no suena).
   \`fingers\` y \`notes\` siguen el formato de CHORDS (chords-db.js); \`notes\` va del bajo al agudo. */

(typeof window !== 'undefined' ? window : module.exports).BROKEN_CHORDS = [
${lines.join('\n')}
];

/* Los bundlers del navegador también ven \`window\`: exportar igualmente. */
if (typeof module !== 'undefined' && module.exports && typeof window !== 'undefined') module.exports.BROKEN_CHORDS = window.BROKEN_CHORDS;
`;
}

if (require.main === module) {
  const source = render();
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(OUTPUT, 'utf8') !== source) {
      console.error('src/shared/broken-chords-db.js is out of date: run node scripts/generate-broken-chords.js');
      process.exit(1);
    }
  } else {
    fs.writeFileSync(OUTPUT, source);
    console.log('Wrote ' + path.relative(process.cwd(), OUTPUT));
  }
}

module.exports = { render };
