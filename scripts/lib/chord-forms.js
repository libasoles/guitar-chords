'use strict';
/* chord-forms.js — Formas de acorde estaticas para los articulos: la Forma
   completa sale de la base de acordes del sitio (src/shared/chords-db.js) y se
   dibuja como diagrama SVG y como TAB de texto, sin JS en el navegador.

   Una forma es un arreglo de 6 posiciones, de la cuerda 1 (mi agudo) a la 6:
   un traste (0 = al aire) o null si la cuerda no suena (`x`). */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CHORDS_DB = path.join(__dirname, '..', '..', 'src', 'shared', 'chords-db.js');
const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];

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

/* Forma completa (posicion abierta estandar) de un Acorde de la base. */
function fullForm(name) {
  const chord = chordsDb().find((c) => c.name === name);
  if (!chord) throw new Error('Acorde fuera de la base: ' + name);
  return fingersToForm(chord.fingers);
}

function chordFingers(name) {
  const chord = chordsDb().find((c) => c.name === name);
  if (!chord) throw new Error('Acorde fuera de la base: ' + name);
  return chord.fingers;
}

/* Cifras de la forma separadas por espacios; `x` marca la cuerda que no suena. */
function formText(form) {
  return form.map((fret) => (fret === null ? 'x' : String(fret))).join(' ');
}

/* TAB de una sola columna, de la cuerda 1 a la 6, para un <pre>. */
function formTab(form) {
  return form.map((fret, i) => STRING_LABELS[i] + '|-' + (fret === null ? 'x' : fret) + '-').join('\n');
}

/* Diagrama de acorde: cuerda grave a la izquierda, cejuela arriba. Los
   marcadores de arriba son `o` (al aire) y `x` (no suena). */
function diagramSvg(fingers, label) {
  const LEFT = 18, GAP = 16, TOP = 30, FRET_H = 20, FRETS = 4;
  const width = LEFT * 2 + GAP * 5, height = TOP + FRET_H * FRETS + 12;
  const xOf = (string) => LEFT + (6 - string) * GAP;
  const parts = [
    '<svg class="chord-diagram" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + label + '">',
    '<rect x="' + LEFT + '" y="' + TOP + '" width="' + GAP * 5 + '" height="' + FRET_H * FRETS + '" fill="#fff"/>',
  ];
  for (let s = 1; s <= 6; s++) {
    parts.push('<line x1="' + xOf(s) + '" y1="' + TOP + '" x2="' + xOf(s) + '" y2="' + (TOP + FRET_H * FRETS) + '" stroke="#1a1a1a" stroke-width="1"/>');
  }
  for (let f = 0; f <= FRETS; f++) {
    const y = TOP + f * FRET_H;
    parts.push('<line x1="' + LEFT + '" y1="' + y + '" x2="' + (LEFT + GAP * 5) + '" y2="' + y + '" stroke="#1a1a1a" stroke-width="' + (f === 0 ? 4 : 1) + '"/>');
  }
  fingers.forEach(([string, fret, finger]) => {
    const x = xOf(string);
    if (fret === 'o') {
      parts.push('<circle class="open" cx="' + x + '" cy="' + (TOP - 12) + '" r="4" fill="none" stroke="#1a1a1a" stroke-width="1.2"/>');
    } else if (fret === 'x') {
      const y = TOP - 12;
      parts.push('<path class="muted" d="M' + (x - 4) + ' ' + (y - 4) + 'L' + (x + 4) + ' ' + (y + 4) + 'M' + (x + 4) + ' ' + (y - 4) + 'L' + (x - 4) + ' ' + (y + 4) + '" stroke="#1a1a1a" stroke-width="1.2"/>');
    } else {
      const y = TOP + (fret - 0.5) * FRET_H;
      parts.push('<circle class="finger" cx="' + x + '" cy="' + y + '" r="7" fill="#1a1a1a"/>');
      if (finger) parts.push('<text x="' + x + '" y="' + (y + 3.5) + '" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#fff">' + finger + '</text>');
    }
  });
  return parts.join('') + '</svg>';
}

module.exports = { fullForm, chordFingers, fingersToForm, formText, formTab, diagramSvg, STRING_LABELS };
