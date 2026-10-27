/* score-model.js — Modelo de la pagina /partitura: una partitura es una lista de
   renglones, un renglon una lista de compases y un compas una lista de figuras.
   Sin DOM: el navegador lo carga como script clasico y los tests lo requieren.

   Duraciones en divisiones de negra = 8 (la semicorchea con puntillo, 3, entra
   exacta). Las alturas se guardan como numero diatonico escrito (C4 = 28, E4 =
   30, la linea inferior de la clave de sol); el MusicXML las baja una octava
   porque la guitarra suena asi y la clave lleva el 8 debajo. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScoreModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIVISIONS = 8;
  const MEASURE = 32; // 4/4
  const PER_ROW = 4;
  const MIN_ROWS = 3;
  const GRID = 2; // semicorchea: la posicion se redondea a esta cuadricula
  const BOTTOM_LINE = 30; // E4: linea inferior de la clave de sol
  const LOWEST = 20;
  const HIGHEST = 44;
  const VALUES = { w: 32, h: 16, q: 8, e: 4, s: 2 };
  const TYPES = { 32: 'whole', 16: 'half', 8: 'quarter', 4: 'eighth', 2: '16th', 1: '32nd' };
  const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const ACCIDENTALS = { '#': { alter: 1, name: 'sharp' }, b: { alter: -1, name: 'flat' }, n: { alter: 0, name: 'natural' } };

  function length(ev) {
    return ev.dot ? VALUES[ev.d] * 1.5 : VALUES[ev.d];
  }

  // Inicio de cada figura dentro del compas. Una figura sin `at` sigue a la anterior;
  // las que comparten `at` forman un acorde.
  function onsets(measure) {
    let cursor = 0;
    return measure.map((ev) => {
      const at = Number.isInteger(ev.at) ? ev.at : cursor;
      cursor = Math.max(cursor, at + length(ev));
      return at;
    });
  }

  function measureLength(measure) {
    const starts = onsets(measure);
    return measure.reduce((end, ev, i) => Math.max(end, starts[i] + length(ev)), 0);
  }

  // Deja `at` explicito en todas las figuras para que ninguna se mueva si se agrega o quita otra.
  function settle(measure) {
    const starts = onsets(measure);
    measure.forEach((ev, i) => { ev.at = starts[i]; });
    return measure;
  }

  // Donde cae `ev` si se suelta cerca del tiempo `t`, entre las figuras `others` (ya sin `ev`).
  // Sobre la columna de una nota se vuelve acorde (y toma su duracion); si no, el hueco libre mas cercano.
  function placement(others, ev, t) {
    const starts = onsets(others);
    const want = Math.max(0, Math.min(MEASURE - 1, Math.round(t / GRID) * GRID));
    if (!ev.rest) {
      const column = others.findIndex((o, i) => !o.rest && starts[i] === want);
      if (column >= 0) {
        if (others.some((o, i) => starts[i] === want && !o.rest && o.n === ev.n)) return null;
        return { at: want, d: others[column].d, dot: others[column].dot };
      }
    }
    const size = length(ev);
    const spans = others.map((o, i) => [starts[i], starts[i] + length(o)]);
    const free = (c) => c >= 0 && c + size <= MEASURE && spans.every(([a, b]) => c >= b || c + size <= a);
    const candidates = [want, 0, MEASURE - size];
    spans.forEach(([a, b]) => candidates.push(b, a - size));
    const best = candidates.filter(free).sort((x, y) => Math.abs(x - want) - Math.abs(y - want))[0];
    return best === undefined ? null : { at: best, d: ev.d, dot: ev.dot };
  }

  // Inserta `ev` con su `at`, antes de la primera figura que empieza despues.
  function insertAt(measure, ev, at) {
    const starts = onsets(measure);
    let index = starts.findIndex((s) => s > at);
    if (index < 0) index = measure.length;
    ev.at = at;
    measure.splice(index, 0, ev);
    return index;
  }

  function clampPitch(n) {
    return Math.max(LOWEST, Math.min(HIGHEST, n));
  }

  function emptyRow() {
    return Array.from({ length: PER_ROW }, () => []);
  }

  function emptyScore() {
    return { rows: Array.from({ length: MIN_ROWS }, emptyRow) };
  }

  function clone(score) {
    return JSON.parse(JSON.stringify(score));
  }

  // Compases en orden de lectura; el indice plano es el que usan los ids del SVG.
  function measures(score) {
    return score.rows.flat();
  }

  function fits(measure, ev, ignore) {
    const others = ignore === undefined ? measure : measure.filter((_, i) => i !== ignore);
    return measureLength(others) + length(ev) <= MEASURE;
  }

  function canDot(measure, index) {
    const ev = measure[index];
    if (ev.dot || ev.d === 'w' || ev.d === 's') return false;
    const starts = onsets(measure);
    const end = starts[index] + VALUES[ev.d] * 1.5;
    return end <= MEASURE && starts.every((s) => s <= starts[index] || s >= end);
  }

  // Descarta lo que no sea una partitura valida (por ejemplo, datos viejos o editados a mano).
  function sanitize(data) {
    if (!data || !Array.isArray(data.rows)) return emptyScore();
    const rows = data.rows.map((row) => {
      const result = emptyRow();
      (Array.isArray(row) ? row : []).slice(0, PER_ROW).forEach((measure, m) => {
        const events = [];
        (Array.isArray(measure) ? measure : []).forEach((raw) => {
          if (!raw || !VALUES[raw.d]) return;
          const ev = { d: raw.d };
          if (raw.rest) ev.rest = true;
          else if (Number.isInteger(raw.n)) ev.n = clampPitch(raw.n);
          else return;
          if (raw.dot && raw.d !== 'w' && raw.d !== 's') ev.dot = true;
          if (!ev.rest && ACCIDENTALS[raw.acc]) ev.acc = raw.acc;
          if (Number.isInteger(raw.at) && raw.at >= 0) ev.at = raw.at;
          const at = Number.isInteger(ev.at) ? ev.at : measureLength(events);
          if (at + length(ev) > MEASURE) return;
          const taken = placement(events, ev, at);
          if (!taken || taken.at !== at || taken.d !== ev.d || !taken.dot !== !ev.dot) return;
          insertAt(events, ev, at);
        });
        result[m] = events;
      });
      return result;
    });
    while (rows.length < MIN_ROWS) rows.push(emptyRow());
    return { rows };
  }

  // Rellena huecos con silencios ocultos: el final del compas y el espacio entre figuras sueltas.
  function padding(left) {
    const parts = [];
    [32, 16, 8, 4, 2, 1].forEach((size) => {
      while (left >= size) {
        parts.push(size);
        left -= size;
      }
    });
    return parts;
  }

  // Ligaduras de corchea y semicorchea dentro de cada pulso; el acorde comparte las de su columna.
  function beamStates(measure) {
    const states = measure.map(() => null);
    const starts = onsets(measure);
    const columns = [];
    measure.forEach((ev, i) => {
      const last = columns[columns.length - 1];
      if (last && starts[last[0]] === starts[i]) last.push(i);
      else columns.push([i]);
    });
    const runs = [];
    let run = null;
    let end = 0;
    columns.forEach((col) => {
      const ev = measure[col[0]];
      const at = starts[col[0]];
      const beat = Math.floor(at / DIVISIONS);
      if (!ev.rest && (ev.d === 'e' || ev.d === 's')) {
        if (run && run.beat === beat && end === at) run.items.push(col);
        else runs.push((run = { beat, items: [col] }));
      } else {
        run = null;
      }
      end = at + length(ev);
    });
    runs.filter((r) => r.items.length > 1).forEach((r) => {
      r.items.forEach((col, k) => {
        const first = k === 0;
        const last = k === r.items.length - 1;
        const state = { 1: first ? 'begin' : last ? 'end' : 'continue' };
        if (measure[col[0]].d === 's') {
          const prev = k > 0 && measure[r.items[k - 1][0]].d === 's';
          const next = !last && measure[r.items[k + 1][0]].d === 's';
          if (prev && next) state[2] = 'continue';
          else if (prev) state[2] = 'end';
          else if (next) state[2] = 'begin';
          else state[2] = first ? 'forward hook' : 'backward hook';
        }
        col.forEach((i) => { states[i] = state; });
      });
    });
    return states;
  }

  function noteXml(ev, id, beams, chord) {
    const dur = length(ev);
    const base = VALUES[ev.d];
    let xml = `<note id="${id}">`;
    if (chord) xml += '<chord/>';
    if (ev.rest) {
      xml += '<rest/>';
    } else {
      const acc = ev.acc && ACCIDENTALS[ev.acc];
      xml += `<pitch><step>${STEPS[ev.n % 7]}</step>${acc && acc.alter ? `<alter>${acc.alter}</alter>` : ''}` +
        `<octave>${Math.floor(ev.n / 7) - 1}</octave></pitch>`;
    }
    xml += `<duration>${dur}</duration><voice>1</voice><type>${TYPES[base]}</type>${ev.dot ? '<dot/>' : ''}`;
    if (!ev.rest && ev.acc) xml += `<accidental>${ACCIDENTALS[ev.acc].name}</accidental>`;
    if (beams) Object.keys(beams).forEach((level) => { xml += `<beam number="${level}">${beams[level]}</beam>`; });
    return xml + '</note>';
  }

  function toMusicXml(score) {
    const all = measures(score);
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1">' +
      '<part-list><score-part id="P1"><part-name print-object="no">Guitar</part-name></score-part></part-list><part id="P1">';
    all.forEach((measure, mi) => {
      xml += `<measure number="${mi + 1}" id="m${mi}">`;
      if (mi % PER_ROW === 0) xml += '<print new-system="yes"/>';
      if (mi === 0) {
        xml += `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>0</fifths></key>` +
          '<time><beats>4</beats><beat-type>4</beat-type></time>' +
          '<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef></attributes>';
      }
      const beams = beamStates(measure);
      const starts = onsets(measure);
      const hidden = (from, to) => {
        padding(to - from).forEach((size) => {
          xml += `<note print-object="no"><rest/><duration>${size}</duration><voice>1</voice><type>${TYPES[size]}</type></note>`;
        });
      };
      let cursor = 0;
      measure.forEach((ev, i) => {
        const chord = i > 0 && starts[i] === starts[i - 1];
        if (!chord) {
          hidden(cursor, starts[i]);
          cursor = starts[i];
        }
        xml += noteXml(ev, `e${mi}-${i}`, beams[i], chord);
        if (!chord) cursor = starts[i] + length(ev);
      });
      hidden(cursor, MEASURE);
      xml += '</measure>';
    });
    return xml + '</part></score-partwise>\n';
  }

  return {
    DIVISIONS, MEASURE, GRID, PER_ROW, MIN_ROWS, BOTTOM_LINE, LOWEST, HIGHEST, VALUES, ACCIDENTALS,
    length, onsets, settle, placement, insertAt, measureLength, clampPitch, emptyRow, emptyScore, clone, measures, fits, canDot,
    sanitize, toMusicXml,
  };
});
