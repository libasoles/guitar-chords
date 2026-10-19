'use strict';
/* chord-forms.js — Formas de acorde estaticas para los articulos: la Forma
   completa sale de la base de acordes del sitio (src/shared/chords-db.js) y se
   dibuja como diagrama SVG; la TAB la dibuja <ascii-tabs> en el navegador.

   Una forma es un arreglo de 6 posiciones, de la cuerda 1 (mi agudo) a la 6:
   un traste (0 = al aire) o null si la cuerda no suena (`x`). */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CHORDS_DB = path.join(__dirname, '..', '..', 'src', 'shared', 'chords-db.js');

let chords;
function chordsDb() {
  if (!chords) {
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(CHORDS_DB, 'utf8'), sandbox);
    chords = sandbox.window.CHORDS;
  }
  return chords;
}

/* Fingers de la base ([cuerda, traste|'x'|'o', dedo?]) -> forma de 6 posiciones. */
function fingersToForm(fingers) {
  const form = new Array(6).fill(null);
  fingers.forEach(([string, fret]) => {
    form[string - 1] = fret === 'o' ? 0 : fret === 'x' ? null : fret;
  });
  return form;
}

function chordFingers(name) {
  const chord = chordsDb().find((c) => c.name === name);
  if (!chord) throw new Error('Acorde fuera de la base: ' + name);
  return chord.fingers;
}

/* Forma completa (posicion abierta estandar) de un Acorde de la base. */
function fullForm(name) {
  return fingersToForm(chordFingers(name));
}

/* Acorde de la base como objeto para ChordDiagram (cuerdas, cejillas, posicion). */
function chordObject(name) {
  const chord = chordsDb().find((c) => c.name === name);
  if (!chord) throw new Error('Acorde fuera de la base: ' + name);
  return { name: chord.name, fingers: chord.fingers, barres: chord.barres || [], position: chord.position || 1 };
}

function escapeAttr(text) {
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/* Tarjeta de acorde: el mismo componente que los resultados del buscador. El
   HTML solo lleva los datos; /assets/chord-card.js dibuja el diagrama (con
   svguitar, como en el resto del sitio) y el nombre. */
function chordCard(chord, label) {
  return '<div class="chord-card-slot" data-chord-card data-chord="' + escapeAttr(JSON.stringify(chord)) +
    '" role="img" aria-label="' + escapeAttr(label) + '"></div>';
}

/* Librerias que dibujan las tarjetas; va una vez al final del articulo. */
const CHORD_CARD_LOADER = '<script src="/assets/vendor/svguitar.umd.js"></script>' +
  '<script src="/assets/chord-diagram.js"></script><script src="/assets/chord-card.js"></script>';

module.exports = { fullForm, chordFingers, chordObject, chordCard, CHORD_CARD_LOADER };
