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
  const MEASURE = 32; // valor por defecto: 4/4
  const METERS = ['2/4', '3/4', '4/4', '2/2', '3/8', '6/8', '9/8', '12/8'];
  const PER_ROW = 4;
  const MIN_ROWS = 3;
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

  function measureLength(measure) {
    return measure.reduce((sum, ev) => sum + length(ev), 0);
  }

  function clampPitch(n) {
    return Math.max(LOWEST, Math.min(HIGHEST, n));
  }

  function emptyRow() {
    return Array.from({ length: PER_ROW }, () => []);
  }

  function emptyScore() {
    return { meter: '4/4', rows: Array.from({ length: MIN_ROWS }, emptyRow) };
  }

  function clone(score) {
    return JSON.parse(JSON.stringify(score));
  }

  // Compases en orden de lectura; el indice plano es el que usan los ids del SVG.
  function measures(score) {
    return score.rows.flat();
  }

  function meterOf(score) {
    return score && METERS.includes(score.meter) ? score.meter : '4/4';
  }

  function capacity(score) {
    const [beats, unit] = meterOf(score).split('/').map(Number);
    return beats * DIVISIONS * 4 / unit;
  }

  // No borrar ni recortar figuras al cambiar a un compas mas corto.
  function setMeter(score, meter) {
    if (!METERS.includes(meter) || measures(score).some((m) => measureLength(m) > capacity({ meter }))) return false;
    score.meter = meter;
    return true;
  }

  function fits(measure, ev, ignore, score) {
    const others = ignore === undefined ? measure : measure.filter((_, i) => i !== ignore);
    return measureLength(others) + length(ev) <= capacity(score);
  }

  function canDot(measure, index, score) {
    const ev = measure[index];
    return !ev.dot && ev.d !== 'w' && measureLength(measure) + VALUES[ev.d] / 2 <= capacity(score) && ev.d !== 's';
  }

  // Descarta lo que no sea una partitura valida (por ejemplo, datos viejos o editados a mano).
  function sanitize(data) {
    if (!data || !Array.isArray(data.rows)) return emptyScore();
    const meter = meterOf(data);
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
          if (measureLength(events) + length(ev) <= capacity({ meter })) events.push(ev);
        });
        result[m] = events;
      });
      return result;
    });
    while (rows.length < MIN_ROWS) rows.push(emptyRow());
    return { meter, rows };
  }

  // Rellena lo que falta del compas con silencios ocultos para que mida lo mismo que uno completo.
  function padding(used, score) {
    const parts = [];
    let left = capacity(score) - used;
    [32, 16, 8, 4, 2, 1].forEach((size) => {
      while (left >= size) {
        parts.push(size);
        left -= size;
      }
    });
    return parts;
  }

  // Ligaduras de corchea y semicorchea dentro de cada pulso.
  function beamStates(measure, score) {
    const [beats, unit] = meterOf(score).split('/').map(Number);
    const beatLength = unit === 8 && beats % 3 === 0 && beats > 3 ? DIVISIONS * 1.5 : DIVISIONS * 4 / unit;
    const states = measure.map(() => null);
    let onset = 0;
    const runs = [];
    let run = null;
    measure.forEach((ev, i) => {
      const beat = Math.floor(onset / beatLength);
      if (!ev.rest && (ev.d === 'e' || ev.d === 's')) {
        if (run && run.beat === beat) run.items.push(i);
        else runs.push((run = { beat, items: [i] }));
      } else {
        run = null;
      }
      onset += length(ev);
    });
    runs.filter((r) => r.items.length > 1).forEach((r) => {
      r.items.forEach((i, k) => {
        const first = k === 0;
        const last = k === r.items.length - 1;
        const state = { 1: first ? 'begin' : last ? 'end' : 'continue' };
        if (measure[i].d === 's') {
          const prev = k > 0 && measure[r.items[k - 1]].d === 's';
          const next = !last && measure[r.items[k + 1]].d === 's';
          if (prev && next) state[2] = 'continue';
          else if (prev) state[2] = 'end';
          else if (next) state[2] = 'begin';
          else state[2] = first ? 'forward hook' : 'backward hook';
        }
        states[i] = state;
      });
    });
    return states;
  }

  function noteXml(ev, id, beams) {
    const dur = length(ev);
    const base = VALUES[ev.d];
    let xml = `<note id="${id}">`;
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
    const [beats, unit] = meterOf(score).split('/');
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1">' +
      '<part-list><score-part id="P1"><part-name print-object="no">Guitar</part-name></score-part></part-list><part id="P1">';
    all.forEach((measure, mi) => {
      xml += `<measure number="${mi + 1}" id="m${mi}">`;
      if (mi % PER_ROW === 0) xml += '<print new-system="yes"/>';
      if (mi === 0) {
        xml += `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>0</fifths></key>` +
          `<time><beats>${beats}</beats><beat-type>${unit}</beat-type></time>` +
          '<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef></attributes>';
      }
      const beams = beamStates(measure, score);
      measure.forEach((ev, i) => { xml += noteXml(ev, `e${mi}-${i}`, beams[i]); });
      padding(measureLength(measure), score).forEach((size) => {
        xml += `<note print-object="no"><rest/><duration>${size}</duration><voice>1</voice><type>${TYPES[size]}</type></note>`;
      });
      xml += '</measure>';
    });
    return xml + '</part></score-partwise>\n';
  }

  return {
    DIVISIONS, MEASURE, METERS, PER_ROW, MIN_ROWS, BOTTOM_LINE, LOWEST, HIGHEST, VALUES, ACCIDENTALS,
    length, measureLength, clampPitch, emptyRow, emptyScore, clone, measures, fits, canDot,
    meterOf, capacity, setMeter, sanitize, toMusicXml,
  };
});
