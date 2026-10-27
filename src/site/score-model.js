/* score-model.js — Modelo de la pagina /partitura: una partitura es una lista de
   renglones, un renglon una lista de compases y un compas una lista de figuras.
   Sin DOM: el navegador lo carga como script clasico y los tests lo requieren.

   Duraciones en divisiones de negra = 8 (la semicorchea con puntillo, 3, entra
   exacta). Las alturas se guardan como numero diatonico escrito (C4 = 28, E4 =
   30, la linea inferior de la clave de sol); el MusicXML las baja una octava
   para conservar la altura sonora al cambiar de clave (sol de guitarra por defecto). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScoreModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIVISIONS = 8;
  const MEASURE = 32; // valor por defecto: 4/4
  const METERS = ['2/4', '3/4', '4/4', '2/2', '3/8', '6/8', '9/8', '12/8'];
  const CLEFS = {
    guitar: { sign: 'G', line: 2, octave: -1, bottom: 30 },
    treble: { sign: 'G', line: 2, bottom: 37 },
    bass: { sign: 'F', line: 4, bottom: 25 },
    alto: { sign: 'C', line: 3, bottom: 31 },
    tenor: { sign: 'C', line: 4, bottom: 29 },
  };
  const PER_ROW = 4;
  const MIN_ROWS = 3;
  const GRID = 2; // semicorchea: la posicion se redondea a esta cuadricula
  const BOTTOM_LINE = 30; // E4: linea inferior de la clave de sol
  const LOWEST = 15;
  const HIGHEST = 51;
  const VALUES = { w: 32, h: 16, q: 8, e: 4, s: 2 };
  const TYPES = { 32: 'whole', 16: 'half', 8: 'quarter', 4: 'eighth', 2: '16th', 1: '32nd' };
  const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const ACCIDENTALS = { '#': { alter: 1, name: 'sharp' }, b: { alter: -1, name: 'flat' }, n: { alter: 0, name: 'natural' } };

  function length(ev) {
    return ev.dot ? VALUES[ev.d] * 1.5 : VALUES[ev.d];
  }

  // Inicio de cada figura dentro del compas. Una figura sin `at` sigue a la anterior;
  // las que comparten `at` y duracion forman un acorde.
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

  // Cada figura conserva su duracion y tiempo; las superposiciones crean voces al exportar.
  function placement(others, ev, t, score) {
    const limit = capacity(score);
    const size = length(ev);
    if (size > limit) return null;
    const at = Math.max(0, Math.min(limit - size, Math.round(t / GRID) * GRID));
    const starts = onsets(others);
    if (!ev.rest && others.some((o, i) => !o.rest && starts[i] === at && o.n === ev.n && o.acc === ev.acc)) return null;
    return { at, d: ev.d, dot: ev.dot };
  }

  // Inserta `ev` con su `at`, antes de la primera figura que empieza despues.
  function insertAt(measure, ev, at) {
    settle(measure);
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
    return { meter: '4/4', clef: 'guitar', fifths: 0, rows: Array.from({ length: MIN_ROWS }, emptyRow) };
  }

  function clone(score) {
    return JSON.parse(JSON.stringify(score));
  }

  // Compases en orden de lectura; el indice plano es el que usan los ids del SVG.
  function measures(score) {
    return score.rows.flat();
  }

  // Las barras se guardan aparte: JSON no conserva propiedades de los arrays de figuras.
  function setBarline(score, mi, type) {
    if (!Number.isInteger(mi) || mi < 0 || mi >= measures(score).length || !['single', 'start', 'end'].includes(type)) return false;
    if (!score.barlines) score.barlines = {};
    if (type === 'single') score.barlines[mi] = { single: true };
    else {
      const bar = score.barlines[mi] || {};
      delete bar.single;
      if (type === 'end') delete bar.hidden;
      bar[type] = true;
      score.barlines[mi] = bar;
    }
    return true;
  }

  function removeBarline(score, mi, side) {
    if (!Number.isInteger(mi) || mi < 0 || mi >= measures(score).length || !['start', 'end'].includes(side)) return false;
    if (!score.barlines) score.barlines = {};
    const bar = score.barlines[mi] || {};
    delete bar[side];
    Object.keys(bar).forEach((key) => { if (!bar[key]) delete bar[key]; });
    if (side === 'end') {
      delete bar.single;
      bar.hidden = true;
    }
    if (Object.values(bar).some(Boolean)) score.barlines[mi] = bar;
    else delete score.barlines[mi];
    return true;
  }

  function meterOf(score) {
    return score && METERS.includes(score.meter) ? score.meter : '4/4';
  }

  function clefOf(score) {
    return score && Object.hasOwn(CLEFS, score.clef) ? score.clef : 'guitar';
  }

  function fifthsOf(score) {
    return score && Number.isInteger(score.fifths) && Math.abs(score.fifths) <= 7 ? score.fifths : 0;
  }

  function bottomLine(score) {
    return CLEFS[clefOf(score)].bottom;
  }

  function keyAlter(n, score) {
    const fifths = fifthsOf(score);
    const order = fifths > 0 ? ['F', 'C', 'G', 'D', 'A', 'E', 'B'] : ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
    return order.slice(0, Math.abs(fifths)).includes(STEPS[n % 7]) ? Math.sign(fifths) : 0;
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
    if (ev.dot || ev.d === 'w' || ev.d === 's') return false;
    const starts = onsets(measure);
    const end = starts[index] + VALUES[ev.d] * 1.5;
    return end <= capacity(score);
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
          if (Number.isInteger(raw.at) && raw.at >= 0) ev.at = raw.at;
          const at = Number.isInteger(ev.at) ? ev.at : measureLength(events);
          if (at + length(ev) > capacity({ meter })) return;
          const taken = placement(events, ev, at, { meter });
          if (!taken || taken.at !== at || taken.d !== ev.d || !taken.dot !== !ev.dot) return;
          insertAt(events, ev, at);
        });
        result[m] = events;
      });
      return result;
    });
    while (rows.length < MIN_ROWS) rows.push(emptyRow());
    const barlines = {};
    Object.entries(data.barlines || {}).forEach(([index, bar]) => {
      if (!/^(0|[1-9]\d*)$/.test(index) || +index >= rows.length * PER_ROW || !bar) return;
      if (bar.start === true || bar.end === true) barlines[index] = { start: bar.start === true, end: bar.end === true };
      else if (bar.single === true) barlines[index] = { single: true };
      if (bar.hidden === true && bar.end !== true) barlines[index] = Object.assign(barlines[index] || {}, { hidden: true });
    });
    return Object.assign(Object.keys(barlines).length ? { barlines } : {}, { meter, clef: clefOf(data), fifths: fifthsOf(data), rows }, typeof data.title === 'string' ? { title: data.title } : {});
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
  function beamStates(measure, score) {
    const [beats, unit] = meterOf(score).split('/').map(Number);
    const beatLength = unit === 8 && beats % 3 === 0 && beats > 3 ? DIVISIONS * 1.5 : DIVISIONS * 4 / unit;
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
      const beat = Math.floor(at / beatLength);
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

  // Agrupa acordes de igual inicio y duracion; cada voz contiene figuras sin superposicion.
  // Se conservan los indices originales para seleccionar las notas en el SVG.
  function voices(measure) {
    const starts = onsets(measure);
    const groups = [];
    measure.forEach((ev, i) => {
      let group = !ev.rest && groups.find((g) => !g.rest && g.at === starts[i] && g.size === length(ev));
      if (!group) {
        group = { at: starts[i], size: length(ev), rest: !!ev.rest, indices: [] };
        groups.push(group);
      }
      group.indices.push(i);
    });
    const result = [];
    groups.sort((a, b) => a.at - b.at || b.size - a.size).forEach((group) => {
      let voice = result.find((v) => v.end <= group.at);
      if (!voice) { voice = { end: 0, groups: [] }; result.push(voice); }
      voice.groups.push(group);
      voice.end = group.at + group.size;
    });
    return result.length ? result : [{ end: 0, groups: [] }];
  }

  function noteXml(ev, id, beams, chord, voice, alter, octaveShift) {
    const dur = length(ev);
    const base = VALUES[ev.d];
    let xml = `<note id="${id}">`;
    if (chord) xml += '<chord/>';
    if (ev.rest) {
      xml += '<rest/>';
    } else {
      xml += `<pitch><step>${STEPS[ev.n % 7]}</step>${alter ? `<alter>${alter}</alter>` : ''}` +
        `<octave>${Math.floor(ev.n / 7) - 1 + octaveShift}</octave></pitch>`;
    }
    xml += `<duration>${dur}</duration><voice>${voice}</voice><type>${TYPES[base]}</type>${ev.dot ? '<dot/>' : ''}`;
    if (!ev.rest && ev.acc) xml += `<accidental>${ACCIDENTALS[ev.acc].name}</accidental>`;
    if (beams) Object.keys(beams).forEach((level) => { xml += `<beam number="${level}">${beams[level]}</beam>`; });
    return xml + '</note>';
  }

  function toMusicXml(score, { plainGuitarClef = false } = {}) {
    const all = measures(score);
    const clef = CLEFS[clefOf(score)];
    // Para dibujar la clave sin el 8, usamos alturas escritas y conservamos el modelo sonoro.
    const octaveShift = plainGuitarClef && clef.octave ? -clef.octave : 0;
    const [beats, unit] = meterOf(score).split('/');
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1">' +
      (score.title ? '<work><work-title>' + score.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</work-title></work>' : '') +
      '<part-list><score-part id="P1"><part-name print-object="no">Guitar</part-name></score-part></part-list><part id="P1">';
    all.forEach((measure, mi) => {
      xml += `<measure number="${mi + 1}" id="m${mi}">`;
      if (mi % PER_ROW === 0) xml += '<print new-system="yes"/>';
      if (mi === 0) {
        xml += `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${fifthsOf(score)}</fifths></key>` +
          `<time><beats>${beats}</beats><beat-type>${unit}</beat-type></time>` +
          `<clef><sign>${clef.sign}</sign><line>${clef.line}</line>${clef.octave && !plainGuitarClef ? `<clef-octave-change>${clef.octave}</clef-octave-change>` : ''}</clef></attributes>`;
      }
      const bar = score.barlines && score.barlines[mi];
      if (bar && bar.start) xml += '<barline location="left"><repeat direction="forward"/></barline>';
      const starts = onsets(measure);
      // Las voces se exportan por separado, pero las alteraciones siguen el orden temporal del compas.
      const accidentals = new Map();
      const alters = [];
      measure.map((ev, i) => i).sort((a, b) => starts[a] - starts[b]).forEach((i) => {
        const ev = measure[i];
        if (!ev.rest && ev.acc) accidentals.set(ev.n, ACCIDENTALS[ev.acc].alter);
        alters[i] = accidentals.has(ev.n) ? accidentals.get(ev.n) : keyAlter(ev.n, score);
      });
      voices(measure).forEach((voice, vi) => {
        if (vi > 0) xml += `<backup><duration>${capacity(score)}</duration></backup>`;
        const indices = voice.groups.flatMap((g) => g.indices);
        const events = indices.map((i) => Object.assign({}, measure[i], { at: starts[i] }));
        const beams = beamStates(events, score);
        const hidden = (from, to) => {
          padding(to - from).forEach((size) => {
            xml += `<note print-object="no"><rest/><duration>${size}</duration><voice>${vi + 1}</voice><type>${TYPES[size]}</type></note>`;
          });
        };
        let cursor = 0;
        let index = 0;
        voice.groups.forEach((group) => {
          hidden(cursor, group.at);
          group.indices.forEach((i, ci) => {
            xml += noteXml(measure[i], `e${mi}-${i}`, beams[index++], ci > 0, vi + 1, alters[i], octaveShift);
          });
          cursor = group.at + group.size;
        });
        hidden(cursor, capacity(score));
      });
      if (bar && bar.end) xml += '<barline location="right"><repeat direction="backward"/></barline>';
      else if (bar && bar.hidden) xml += '<barline location="right"><bar-style>none</bar-style></barline>';
      else if (bar && bar.single) xml += '<barline location="right"><bar-style>regular</bar-style></barline>';
      xml += '</measure>';
    });
    return xml + '</part></score-partwise>\n';
  }

  return {
    DIVISIONS, MEASURE, METERS, CLEFS, GRID, PER_ROW, MIN_ROWS, BOTTOM_LINE, LOWEST, HIGHEST, VALUES, ACCIDENTALS,
    length, onsets, settle, placement, insertAt, measureLength, clampPitch, emptyRow, emptyScore, clone, measures, fits, canDot,
    meterOf, clefOf, fifthsOf, bottomLine, keyAlter, capacity, setMeter, setBarline, removeBarline, sanitize, toMusicXml,
  };
});
