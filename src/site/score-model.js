/* score-model.js — Modelo de la pagina /partitura: una partitura es una lista de
   renglones, un renglon una lista de compases y un compas una lista de figuras.
   Sin DOM: el navegador lo carga como script clasico y los tests lo requieren.

   Duraciones en divisiones de negra = 24 (el tresillo de corchea, 8, y la corchea
   con puntillo, 18, entran exactos). Las alturas se guardan como numero diatonico escrito (C4 = 28, E4 =
   30, la linea inferior de la clave de sol); el MusicXML las baja una octava
   para conservar la altura sonora al cambiar de clave (sol de guitarra por defecto). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScoreModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIVISIONS = 24;
  const MEASURE = 96; // valor por defecto: 4/4
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
  const MAX_FRET = 24;
  const GRID = 6; // semicorchea: la posicion se redondea a esta cuadricula (2 dentro de un tresillo, 3 con fusas)
  const BOTTOM_LINE = 30; // E4: linea inferior de la clave de sol
  const LOWEST = 15;
  const HIGHEST = 51;
  const VALUES = { w: 96, h: 48, q: 24, e: 12, s: 6, f: 3 };
  const TYPES = { 96: 'whole', 48: 'half', 24: 'quarter', 12: 'eighth', 6: '16th', 3: '32nd' };
  const TRIPLETABLE = ['q', 'e', 's'];
  const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const ACCIDENTALS = { '#': { alter: 1, name: 'sharp' }, b: { alter: -1, name: 'flat' }, n: { alter: 0, name: 'natural' } };

  // Un tresillo ocupa dos tercios de su valor; no admite puntillo.
  function length(ev) {
    return ev.tp ? VALUES[ev.d] * 2 / 3 : ev.dot ? VALUES[ev.d] * 1.5 : VALUES[ev.d];
  }

  // Cuadricula de posicion para estas figuras: la mas fina que necesiten (un tresillo y una fusa juntos, 1).
  function gridOf(events) {
    const triplet = events.some((ev) => ev.tp);
    const thirtySecond = events.some((ev) => ev.d === 'f');
    return triplet ? (thirtySecond ? 1 : 2) : thirtySecond ? 3 : GRID;
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
    const grid = gridOf([ev]);
    const at = Math.max(0, Math.min(limit - size, Math.round(t / grid) * grid));
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

  // Indice plano del primer compas de cada renglon; los renglones tienen de 1 a PER_ROW compases.
  function rowStarts(score) {
    let start = 0;
    return score.rows.map((row) => { const first = start; start += row.length; return first; });
  }

  // Renglon que contiene el compas `mi`: { row, first, last } con indices planos.
  function rowOf(score, mi) {
    const starts = rowStarts(score);
    let row = starts.length - 1;
    while (row > 0 && starts[row] > mi) row -= 1;
    return { row, first: starts[row], last: starts[row] + score.rows[row].length - 1 };
  }

  // Mueve las claves numericas (compases) de un mapa: las >= `from` se corren `by`; las que caen en [from, from - by) al achicar se pierden.
  function shiftKeys(map, from, by) {
    if (!map) return undefined;
    const moved = {};
    Object.keys(map).forEach((key) => {
      const mi = +key;
      if (mi < from) moved[key] = map[key];
      else if (mi + by >= from) moved[mi + by] = map[key];
    });
    return moved;
  }

  // Agrega un compas vacio al final del renglon `row`, si cabe.
  function addMeasure(score, row) {
    if (!Number.isInteger(row) || row < 0 || row >= score.rows.length || score.rows[row].length >= PER_ROW) return false;
    const at = rowStarts(score)[row] + score.rows[row].length;
    ['barlines', 'keys', 'barres'].forEach((name) => { if (score[name]) score[name] = shiftKeys(score[name], at, 1); });
    score.rows[row].push([]);
    return true;
  }

  // Quita el ultimo compas del renglon `row` (con sus figuras), salvo que sea el unico.
  function removeMeasure(score, row) {
    if (!Number.isInteger(row) || row < 0 || row >= score.rows.length || score.rows[row].length <= 1) return false;
    const at = rowStarts(score)[row] + score.rows[row].length - 1;
    if (score.barres) Object.keys(score.barres).forEach((key) => {
      const barre = score.barres[key];
      if (+key === at) delete score.barres[key];
      else if (+key < at && barreLast(barre, +key) >= at) {
        barre.span -= 1;
        delete barre.to;
        if (!barre.span) delete barre.span;
      }
    });
    ['barlines', 'keys', 'barres'].forEach((name) => {
      if (!score[name]) return;
      delete score[name][at];
      score[name] = shiftKeys(score[name], at, -1);
      if (!Object.keys(score[name]).length) delete score[name];
    });
    score.rows[row].pop();
    pruneKeys(score);
    return true;
  }

  // Las barras se guardan aparte: JSON no conserva propiedades de los arrays de figuras.
  function setBarline(score, mi, type) {
    if (!Number.isInteger(mi) || mi < 0 || mi >= measures(score).length || !['double', 'start', 'end'].includes(type)) return false;
    if (!score.barlines) score.barlines = {};
    if (type === 'double') score.barlines[mi] = { double: true };
    else {
      const bar = score.barlines[mi] || {};
      delete bar.double;
      if (type === 'end') delete bar.hidden;
      bar[type] = true;
      score.barlines[mi] = bar;
    }
    return true;
  }

  // Compases de la misma fila cubiertos por la cejilla que empieza en `mi`, y compas donde termina.
  function barreLast(barre, mi) {
    return mi + (barre.span || 0);
  }

  // Cejilla: va de `at` a `to` (por defecto el final del compas, que no se guarda). Una por compas.
  // Con `span` > 0 sigue por `span` compases mas de la misma fila y `to` es el final en el ultimo.
  function setBarre(score, mi, at, fret, to, span) {
    const end = capacity(score);
    span = span || 0;
    if (to === undefined) to = end;
    if (!Number.isInteger(mi) || mi < 0 || mi >= measures(score).length || !Number.isInteger(at) || at < 0 || at >= end) return false;
    if (!Number.isInteger(span) || span < 0 || mi + span > rowOf(score, mi).last) return false;
    if (!Number.isInteger(to) || to > end || (span === 0 ? to <= at : to <= 0)) return false;
    if (!Number.isInteger(fret) || fret < 1 || fret > MAX_FRET) return false;
    const taken = Object.keys(score.barres || {}).some((key) => {
      const other = +key;
      return other !== mi && other <= mi + span && barreLast(score.barres[key], other) >= mi;
    });
    if (taken) return false;
    if (!score.barres) score.barres = {};
    const barre = { at, fret };
    if (span) barre.span = span;
    if (to < end) barre.to = to;
    score.barres[mi] = barre;
    return true;
  }

  function removeBarre(score, mi) {
    if (!score.barres || !score.barres[mi]) return false;
    delete score.barres[mi];
    if (!Object.keys(score.barres).length) delete score.barres;
    return true;
  }

  function removeBarline(score, mi, side) {
    if (!Number.isInteger(mi) || mi < 0 || mi >= measures(score).length || !['start', 'end'].includes(side)) return false;
    if (!score.barlines) score.barlines = {};
    const bar = score.barlines[mi] || {};
    delete bar[side];
    Object.keys(bar).forEach((key) => { if (!bar[key]) delete bar[key]; });
    if (side === 'end') {
      delete bar.double;
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

  // Armadura vigente en el compas `mi`: la inicial, cambiada por `score.keys` (compas -> quintas) hasta el siguiente cambio.
  function keyAt(score, mi) {
    let fifths = fifthsOf(score);
    let last = 0;
    Object.entries((score && score.keys) || {}).forEach(([index, value]) => {
      if (+index <= mi && +index > last && Number.isInteger(value) && Math.abs(value) <= 7) { fifths = value; last = +index; }
    });
    return fifths;
  }

  // La armadura nueva rige desde el compas `mi` hasta el siguiente cambio; los compases anteriores no se tocan.
  function setKey(score, mi, fifths) {
    if (!Number.isInteger(mi) || mi < 0 || mi >= measures(score).length || !Number.isInteger(fifths) || Math.abs(fifths) > 7) return false;
    if (mi === 0) score.fifths = fifths;
    else (score.keys = score.keys || {})[mi] = fifths;
    pruneKeys(score);
    return true;
  }

  // Quita los cambios fuera de la partitura y los que repiten la armadura anterior.
  function pruneKeys(score) {
    if (!score.keys) return;
    let previous = fifthsOf(score);
    Object.keys(score.keys).map(Number).sort((a, b) => a - b).forEach((mi) => {
      if (mi < 1 || mi >= measures(score).length || score.keys[mi] === previous) delete score.keys[mi];
      else previous = score.keys[mi];
    });
    if (!Object.keys(score.keys).length) delete score.keys;
  }

  function keyAlter(n, score, mi) {
    const fifths = mi === undefined ? fifthsOf(score) : keyAt(score, mi);
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
    Object.keys(score.barres || {}).forEach((mi) => {
      const barre = score.barres[mi];
      if (barre.at >= capacity(score)) removeBarre(score, mi);
      else if (barre.to >= capacity(score)) delete barre.to;
    });    return true;
  }

  function fits(measure, ev, ignore, score) {
    const others = ignore === undefined ? measure : measure.filter((_, i) => i !== ignore);
    return measureLength(others) + length(ev) <= capacity(score);
  }

  function canDot(measure, index, score) {
    const ev = measure[index];
    if (ev.dot || ev.tp || ev.d === 'w' || ev.d === 's' || ev.d === 'f') return false;
    const starts = onsets(measure);
    const end = starts[index] + VALUES[ev.d] * 1.5;
    return end <= capacity(score);
  }

  // La tablatura sale sola de las notas; `tabs` guarda solo lo que el usuario corrigio a mano: { 'compas:inicio': [6 trastes] },
  // con la cuerda 1 primero y null donde no suena nada. Corregirla no cambia las notas del pentagrama.
  const TAB_STRINGS = 6;
  function sanitizeTabs(tabs, measureCount) {
    const result = {};
    if (!tabs || typeof tabs !== 'object' || Array.isArray(tabs)) return result;
    Object.keys(tabs).forEach((key) => {
      const column = tabs[key];
      if (!/^\d+:\d+$/.test(key) || +key.split(':')[0] >= measureCount || !Array.isArray(column)) return;
      result[key] = Array.from({ length: TAB_STRINGS }, (_, s) => (
        Number.isInteger(column[s]) && column[s] >= 0 && column[s] <= MAX_FRET ? column[s] : null));
    });
    return result;
  }

  const SEMITONES = [0, 2, 4, 5, 7, 9, 11];

  // Cada momento en que suena algo, en orden de lectura: { mi, at, key, midis } con el tono real (la clave de guitarra
  // suena una octava mas grave que la escrita). Las notas ligadas a la anterior no se vuelven a tocar.
  function attacks(score) {
    const clef = CLEFS[clefOf(score)];
    const result = [];
    let tied = new Set();
    measures(score).forEach((measure, mi) => {
      const starts = onsets(measure);
      const accidentals = new Map();
      const moments = new Map();
      measure.map((ev, i) => i).sort((a, b) => starts[a] - starts[b]).forEach((i) => {
        const ev = measure[i];
        if (ev.rest) return;
        if (ev.acc) accidentals.set(ev.n, ACCIDENTALS[ev.acc].alter);
        const alter = accidentals.has(ev.n) ? accidentals.get(ev.n) : keyAlter(ev.n, score, mi);
        const midi = 12 * Math.floor(ev.n / 7) + SEMITONES[ev.n % 7] + alter + 12 * (clef.octave || 0);
        if (!moments.has(starts[i])) moments.set(starts[i], []);
        moments.get(starts[i]).push({ n: ev.n, midi, tie: !!ev.tie });
      });
      [...moments.keys()].sort((a, b) => a - b).forEach((at) => {
        const all = moments.get(at);
        const notes = all.filter((note) => !tied.has(note.n));
        all.forEach((note) => { if (note.tie) tied.add(note.n); else tied.delete(note.n); });
        if (notes.length) result.push({ mi, at, key: mi + ':' + at, midis: notes.map((note) => note.midi) });
      });
    });
    return result;
  }

  // Descarta lo que no sea una partitura valida (por ejemplo, datos viejos o editados a mano).
  // `scale` son las divisiones de negra con que se guardaron los datos (8 antes de los tresillos).
  function sanitize(data, scale) {
    if (!data || !Array.isArray(data.rows)) return emptyScore();
    const meter = meterOf(data);
    const factor = DIVISIONS / (scale || DIVISIONS);
    const rows = data.rows.map((row) => {
      const result = emptyRow().slice(0, Array.isArray(row) && row.length ? Math.min(PER_ROW, row.length) : PER_ROW);
      (Array.isArray(row) ? row : []).slice(0, PER_ROW).forEach((measure, m) => {
        const events = [];
        (Array.isArray(measure) ? measure : []).forEach((raw) => {
          if (!raw || !VALUES[raw.d]) return;
          const ev = { d: raw.d };
          if (raw.rest) ev.rest = true;
          else if (Number.isInteger(raw.n)) ev.n = clampPitch(raw.n);
          else return;
          if (Number.isInteger(raw.tp) && raw.tp > 0 && TRIPLETABLE.includes(raw.d)) ev.tp = raw.tp;
          else if (raw.dot && raw.d !== 'w' && raw.d !== 's' && raw.d !== 'f') ev.dot = true;
          if (!ev.rest && ACCIDENTALS[raw.acc]) ev.acc = raw.acc;
          if (!ev.rest && raw.tie === true) ev.tie = true;
          else if (!ev.rest && raw.slur === true) ev.slur = true;
          if (raw.beam === 'join' || raw.beam === 'break') ev.beam = raw.beam;
          if (Number.isInteger(raw.at) && raw.at >= 0) ev.at = raw.at * factor;
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
    const total = rows.flat().length;
    const lastOf = (index) => rowOf({ rows }, index).last;
    const barlines = {};
    Object.entries(data.barlines || {}).forEach(([index, bar]) => {
      if (!/^(0|[1-9]\d*)$/.test(index) || +index >= total || !bar) return;
      if (bar.start === true || bar.end === true) barlines[index] = { start: bar.start === true, end: bar.end === true };
      else if (bar.double === true || bar.single === true) barlines[index] = { double: true };
      if (bar.hidden === true && bar.end !== true) barlines[index] = Object.assign(barlines[index] || {}, { hidden: true });
    });
    const keys = {};
    let previousKey = fifthsOf(data);
    Object.entries(data.keys || {}).filter(([index]) => /^[1-9]\d*$/.test(index) && +index < total).sort((a, b) => a[0] - b[0]).forEach(([index, value]) => {
      if (!Number.isInteger(value) || Math.abs(value) > 7 || value === previousKey) return;
      keys[index] = previousKey = value;
    });
    const barres = {};
    Object.entries(data.barres || {}).forEach(([index, barre]) => {
      if (!/^(0|[1-9]\d*)$/.test(index) || +index >= total || !barre) return;
      const at = barre.at * factor;
      const to = barre.to * factor;
      const span = barre.span || 0;
      if (!Number.isInteger(at) || at < 0 || at >= capacity({ meter })) return;
      if (!Number.isInteger(barre.fret) || barre.fret < 1 || barre.fret > MAX_FRET) return;
      if (!Number.isInteger(span) || span < 0 || +index + span > lastOf(+index)) return;
      if (Object.keys(barres).some((key) => barreLast(barres[key], +key) >= +index)) return;
      const result = { at, fret: barre.fret };
      if (span) result.span = span;
      if (Number.isInteger(to) && (span ? to > 0 : to > at) && to < capacity({ meter })) result.to = to;
      barres[index] = result;
    });
    const tabs = sanitizeTabs(data.tabs, rows.reduce((sum, row) => sum + row.length, 0));
    return Object.assign(Object.keys(barlines).length ? { barlines } : {}, Object.keys(keys).length ? { keys } : {}, Object.keys(barres).length ? { barres } : {}, data.showTabs === true ? { showTabs: true } : {}, Object.keys(tabs).length ? { tabs } : {}, { meter, clef: clefOf(data), fifths: fifthsOf(data), rows }, typeof data.title === 'string' ? { title: data.title } : {}, typeof data.author === 'string' && data.author ? { author: data.author } : {});
  }

  // Rellena huecos con silencios ocultos: el final del compas y el espacio entre figuras sueltas.
  function padding(left) {
    const parts = [];
    [96, 48, 24, 16, 12, 8, 6, 4, 3, 2, 1].forEach((size) => {
      while (left >= size) {
        parts.push(size);
        left -= size;
      }
    });
    return parts;
  }

  function beatLength(score) {
    const [beats, unit] = meterOf(score).split('/').map(Number);
    return unit === 8 && beats % 3 === 0 && beats > 3 ? DIVISIONS * 1.5 : DIVISIONS * 4 / unit;
  }

  // Sin indicacion manual, dos figuras se barran si caen en el mismo pulso o en el mismo tresillo.
  function autoBeam(left, leftAt, right, rightAt, score) {
    const size = beatLength(score);
    return Math.floor(leftAt / size) === Math.floor(rightAt / size) || !!(left.tp && left.tp === right.tp);
  }

  function isBeamable(ev) {
    return !ev.rest && (ev.d === 'e' || ev.d === 's' || ev.d === 'f');
  }

  // Columnas de una voz (acordes) en orden, con el inicio de cada una.
  function columnsOf(measure, starts) {
    const columns = [];
    measure.forEach((ev, i) => {
      const last = columns[columns.length - 1];
      if (last && starts[last[0]] === starts[i]) last.push(i);
      else columns.push([i]);
    });
    return columns;
  }

  // Barras de corchea y semicorchea: por pulso, salvo que `beam` en una figura una ('join') o separe ('break')
  // su columna de la siguiente; el acorde comparte las de su columna.
  function beamStates(measure, score) {
    const states = measure.map(() => null);
    const starts = onsets(measure);
    const runs = [];
    let run = null;
    let end = 0;
    let prev = null;
    columnsOf(measure, starts).forEach((col) => {
      const ev = measure[col[0]];
      const at = starts[col[0]];
      if (isBeamable(ev)) {
        const flag = prev && prev.col.map((i) => measure[i].beam).find(Boolean);
        const joined = run && end === at && (flag === 'join' || (flag !== 'break' && autoBeam(prev.ev, prev.at, ev, at, score)));
        if (joined) run.items.push(col);
        else runs.push((run = { items: [col] }));
      } else {
        run = null;
      }
      end = at + length(ev);
      prev = { col, ev, at };
    });
    runs.filter((r) => r.items.length > 1).forEach((r) => {
      r.items.forEach((col, k) => {
        const first = k === 0;
        const last = k === r.items.length - 1;
        const state = { 1: first ? 'begin' : last ? 'end' : 'continue' };
        // Nivel 2 para semicorcheas y fusas, nivel 3 solo para fusas.
        [['s', 'f'], ['f']].forEach((ds, level) => {
          if (!ds.includes(measure[col[0]].d)) return;
          const prevShort = k > 0 && ds.includes(measure[r.items[k - 1][0]].d);
          const nextShort = !last && ds.includes(measure[r.items[k + 1][0]].d);
          if (prevShort && nextShort) state[level + 2] = 'continue';
          else if (prevShort) state[level + 2] = 'end';
          else if (nextShort) state[level + 2] = 'begin';
          else state[level + 2] = first ? 'forward hook' : 'backward hook';
        });
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

  // ---- seleccion: tresillos, ligaduras y barrado -------------------------

  // Indices de las figuras con el primer (o ultimo) inicio del compas, sin silencios.
  function edge(measure, side) {
    if (!measure.length) return [];
    const starts = onsets(measure);
    const at = side === 'first' ? Math.min(...starts) : Math.max(...starts);
    return measure.map((ev, i) => i).filter((i) => starts[i] === at && !measure[i].rest);
  }

  // Ligaduras validas: una nota de la ultima columna de un compas con la primera del siguiente.
  // Con la misma altura es una ligadura de prolongacion (`tie`); con otra, de expresion (`slur`).
  function links(score) {
    const all = measures(score);
    const result = [];
    all.forEach((measure, mi) => {
      if (mi + 1 >= all.length) return;
      const last = edge(measure, 'last');
      const next = edge(all[mi + 1], 'first');
      measure.forEach((ev, i) => {
        if (ev.rest || !(ev.tie || ev.slur) || !last.includes(i)) return;
        const j = ev.tie ? next.find((k) => all[mi + 1][k].n === ev.n) : next[0];
        if (j !== undefined) result.push({ type: ev.tie ? 'tie' : 'slur', from: { mi, i }, to: { mi: mi + 1, i: j } });
      });
    });
    return result;
  }

  // Columnas seleccionadas, seguidas y de una sola voz de un solo compas; null si no lo son.
  function run(score, sel) {
    const all = measures(score);
    if (!sel.length || sel.some((s) => s.mi !== sel[0].mi || !all[s.mi] || !all[s.mi][s.i])) return null;
    const measure = all[sel[0].mi];
    const lane = voices(measure).find((v) => v.groups.some((g) => g.indices.includes(sel[0].i)));
    const picked = lane.groups.filter((g) => g.indices.some((i) => sel.some((s) => s.i === i)));
    if (!sel.every((s) => picked.some((g) => g.indices.includes(s.i)))) return null;
    const first = lane.groups.indexOf(picked[0]);
    const joined = picked.every((g, k) => lane.groups[first + k] === g && (k === 0 || picked[k - 1].at + picked[k - 1].size === g.at));
    return joined ? { measure, lane, groups: picked, mi: sel[0].mi } : null;
  }

  function tripletRun(score, sel) {
    const r = run(score, sel);
    if (!r || r.groups.length < 3 || r.groups.length % 3) return null;
    const d = r.measure[r.groups[0].indices[0]].d;
    const plain = r.groups.every((g) => g.indices.every((i) => {
      const ev = r.measure[i];
      return ev.d === d && !ev.dot && !ev.tp;
    }));
    return plain && TRIPLETABLE.includes(d) ? r : null;
  }

  function untripletRun(score, sel) {
    const r = run(score, sel);
    return r && r.groups.every((g) => g.indices.every((i) => r.measure[i].tp)) ? r : null;
  }

  // Dos notas, una al final de un compas y otra al comienzo del siguiente.
  function linkPair(score, sel) {
    const all = measures(score);
    const notes = sel.filter((s, k) => all[s.mi] && all[s.mi][s.i] && sel.findIndex((o) => o.mi === s.mi && o.i === s.i) === k);
    if (notes.length !== 2) return null;
    const [from, to] = notes.sort((a, b) => a.mi - b.mi);
    if (to.mi !== from.mi + 1 || all[from.mi][from.i].rest || all[to.mi][to.i].rest) return null;
    if (!edge(all[from.mi], 'last').includes(from.i) || !edge(all[to.mi], 'first').includes(to.i)) return null;
    const existing = links(score).some((l) => l.from.mi === from.mi && l.from.i === from.i);
    return { from, to, existing };
  }

  function beamRun(score, sel) {
    const r = run(score, sel);
    if (!r || r.groups.length < 2 || !r.groups.every((g) => g.indices.every((i) => isBeamable(r.measure[i])))) return null;
    const starts = onsets(r.measure);
    const order = r.lane.groups.flatMap((g) => g.indices);
    const states = beamStates(order.map((i) => Object.assign({}, r.measure[i], { at: starts[i] })), score);
    const joins = r.groups.slice(0, -1).map((g) => {
      const state = states[order.indexOf(g.indices[0])];
      return !!state && (state[1] === 'begin' || state[1] === 'continue');
    });
    return Object.assign(r, { joins });
  }

  // Acciones disponibles para una seleccion de figuras [{ mi, i }], en el orden en que se ofrecen.
  function selectionActions(score, sel) {
    const actions = [];
    if (tripletRun(score, sel)) actions.push('triplet');
    if (untripletRun(score, sel)) actions.push('untriplet');
    const pair = linkPair(score, sel);
    if (pair) actions.push(pair.existing ? 'unlink' : 'link');
    const beams = beamRun(score, sel);
    if (beams && beams.joins.some((j) => !j)) actions.push('beam');
    if (beams && beams.joins.some((j) => j)) actions.push('unbeam');
    return actions;
  }

  function eachEvent(r, group, fn) {
    group.indices.forEach((i) => fn(r.measure[i]));
  }

  // Aplica una de las acciones de `selectionActions`; false si no corresponde o no entra.
  function applySelection(score, sel, action) {
    if (!selectionActions(score, sel).includes(action)) return false;
    if (action === 'triplet') {
      const r = tripletRun(score, sel);
      let id = Math.max(0, ...r.measure.map((ev) => ev.tp || 0));
      let cursor = r.groups[0].at;
      settle(r.measure);
      r.groups.forEach((g, k) => {
        if (k % 3 === 0) id += 1;
        eachEvent(r, g, (ev) => { ev.tp = id; ev.at = cursor; });
        cursor += length(r.measure[g.indices[0]]);
      });
      return true;
    }
    if (action === 'untriplet') {
      const r = untripletRun(score, sel);
      settle(r.measure);
      const next = r.lane.groups[r.lane.groups.indexOf(r.groups[r.groups.length - 1]) + 1];
      let cursor = r.groups[0].at;
      const moves = r.groups.map((g) => {
        const at = cursor;
        cursor += VALUES[r.measure[g.indices[0]].d];
        return { g, at };
      });
      if (cursor > capacity(score) || (next && next.at < cursor)) return false;
      moves.forEach(({ g, at }) => eachEvent(r, g, (ev) => { delete ev.tp; ev.at = at; }));
      return true;
    }
    if (action === 'link' || action === 'unlink') {
      const { from, to } = linkPair(score, sel);
      const ev = measures(score)[from.mi][from.i];
      delete ev.tie;
      delete ev.slur;
      if (action === 'link') ev[ev.n === measures(score)[to.mi][to.i].n ? 'tie' : 'slur'] = true;
      return true;
    }
    const r = beamRun(score, sel);
    const starts = onsets(r.measure);
    r.groups.slice(0, -1).forEach((g, k) => {
      const right = r.groups[k + 1];
      const auto = autoBeam(r.measure[g.indices[0]], starts[g.indices[0]], r.measure[right.indices[0]], starts[right.indices[0]], score);
      const want = action === 'beam';
      eachEvent(r, g, (ev) => {
        if (want === auto) delete ev.beam;
        else ev.beam = want ? 'join' : 'break';
      });
    });
    return true;
  }

  // Figuras en orden de lectura, para extender la seleccion con el teclado.
  function sequence(score) {
    return measures(score).flatMap((measure, mi) => {
      const starts = onsets(measure);
      return measure.map((ev, i) => ({ mi, i, at: starts[i] })).sort((a, b) => a.at - b.at || a.i - b.i);
    }).map(({ mi, i }) => ({ mi, i }));
  }

  // `roles`: { tie: ['start'|'stop'], slur: [...], tuplet: 'start'|'stop'|'both' } de los extremos de esta nota.
  function noteXml(ev, id, beams, chord, voice, alter, roles) {
    const dur = length(ev);
    const base = VALUES[ev.d];
    const ties = (roles && roles.tie) || [];
    const slurs = (roles && roles.slur) || [];
    const tuplet = roles && roles.tuplet;
    let xml = `<note id="${id}">`;
    if (chord) xml += '<chord/>';
    if (ev.rest) {
      xml += '<rest/>';
    } else {
      xml += `<pitch><step>${STEPS[ev.n % 7]}</step>${alter ? `<alter>${alter}</alter>` : ''}` +
        `<octave>${Math.floor(ev.n / 7) - 1}</octave></pitch>`;
    }
    xml += `<duration>${dur}</duration>${ties.map((type) => `<tie type="${type}"/>`).join('')}` +
      `<voice>${voice}</voice><type>${TYPES[base]}</type>${ev.dot ? '<dot/>' : ''}`;
    if (!ev.rest && ev.acc) xml += `<accidental>${ACCIDENTALS[ev.acc].name}</accidental>`;
    if (ev.tp) xml += '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>';
    if (beams) Object.keys(beams).forEach((level) => { xml += `<beam number="${level}">${beams[level]}</beam>`; });
    const marks = ties.map((type) => `<tied type="${type}"/>`).concat(slurs.map((type) => `<slur type="${type}" number="1"/>`));
    if (tuplet) (tuplet === 'both' ? ['start', 'stop'] : [tuplet]).forEach((type) => { marks.push(`<tuplet type="${type}"/>`); });
    if (marks.length) xml += `<notations>${marks.join('')}</notations>`;
    return xml + '</note>';
  }

  function toMusicXml(score) {
    const all = measures(score);
    const clef = CLEFS[clefOf(score)];
    const [beats, unit] = meterOf(score).split('/');
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1">' +
      (score.title ? '<work><work-title>' + score.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</work-title></work>' : '') +
      (score.author ? '<identification><creator type="composer">' + score.author.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</creator></identification>' : '') +
      '<part-list><score-part id="P1"><part-name print-object="no">Guitar</part-name></score-part></part-list><part id="P1">';
    const roles = new Map();
    const roleOf = (ref) => {
      const key = ref.mi + '-' + ref.i;
      if (!roles.has(key)) roles.set(key, { tie: [], slur: [] });
      return roles.get(key);
    };
    links(score).forEach((link) => {
      roleOf(link.from)[link.type].push('start');
      roleOf(link.to)[link.type].push('stop');
    });
    const rowFirsts = new Set(rowStarts(score));
    all.forEach((measure, mi) => {
      xml += `<measure number="${mi + 1}" id="m${mi}">`;
      if (rowFirsts.has(mi)) xml += '<print new-system="yes"/>';
      if (mi === 0) {
        xml += `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${fifthsOf(score)}</fifths></key>` +
          `<time><beats>${beats}</beats><beat-type>${unit}</beat-type></time>` +
          `<clef><sign>${clef.sign}</sign><line>${clef.line}</line>${clef.octave ? `<clef-octave-change>${clef.octave}</clef-octave-change>` : ''}</clef></attributes>`;
      }
      if (mi > 0 && keyAt(score, mi) !== keyAt(score, mi - 1)) xml += `<attributes><key><fifths>${keyAt(score, mi)}</fifths></key></attributes>`;
      const bar = score.barlines && score.barlines[mi];
      if (bar && bar.start) xml += '<barline location="left"><repeat direction="forward"/></barline>';
      const starts = onsets(measure);
      // Las voces se exportan por separado, pero las alteraciones siguen el orden temporal del compas.
      const accidentals = new Map();
      const alters = [];
      measure.map((ev, i) => i).sort((a, b) => starts[a] - starts[b]).forEach((i) => {
        const ev = measure[i];
        if (!ev.rest && ev.acc) accidentals.set(ev.n, ACCIDENTALS[ev.acc].alter);
        alters[i] = accidentals.has(ev.n) ? accidentals.get(ev.n) : keyAlter(ev.n, score, mi);
      });
      const barre = score.barres && score.barres[mi];
      // Una cejilla que viene de compases anteriores solo cierra aqui.
      const origin = Object.keys(score.barres || {}).map(Number).find((key) => key < mi && barreLast(score.barres[key], key) === mi);
      const closing = origin === undefined ? null : score.barres[origin];
      const stop = (time) => ({ t: time, xml: '<direction placement="above"><direction-type><bracket type="stop" number="1" line-end="none"/></direction-type></direction>' });
      const marks = barre ? [
        { t: barre.at, start: true, xml: `<direction placement="above"><direction-type><words>C ${barre.fret}</words></direction-type></direction>` +
          '<direction placement="above"><direction-type><bracket type="start" number="1" line-end="none" line-type="dashed"/></direction-type></direction>' },
        ...(barre.span ? [] : [stop(Number.isInteger(barre.to) ? barre.to : capacity(score))]),
      ] : closing ? [stop(Number.isInteger(closing.to) ? closing.to : capacity(score))] : [];
      const stopXml = !barre && closing ? marks[0].xml : marks.length > 1 ? marks[1].xml : '';
      let barreOpen = !barre && Boolean(closing);
      let barreClosed = false;
      voices(measure).forEach((voice, vi, all) => {
        if (vi > 0) xml += `<backup><duration>${capacity(score)}</duration></backup>`;
        const indices = voice.groups.flatMap((g) => g.indices);
        const events = indices.map((i) => Object.assign({}, measure[i], { at: starts[i] }));
        const beams = beamStates(events, score);
        const pad = (from, to) => {
          padding(to - from).forEach((size) => {
            xml += `<note print-object="no"><rest/><duration>${size}</duration><voice>${vi + 1}</voice>${TYPES[size] ? `<type>${TYPES[size]}</type>` : ''}</note>`;
          });
        };
        // Inicio y fin de la cejilla se escriben en la primera voz con un hueco (o un limite) justo en ese tiempo.
        const hidden = (from, to) => {
          let at = from;
          marks.forEach((mark) => {
            if (mark.done || mark.t < at || mark.t > to || (!mark.start && !barreOpen)) return;
            pad(at, mark.t);
            xml += mark.xml;
            at = mark.t;
            mark.done = true;
            if (mark.start) barreOpen = true;
            else barreClosed = true;
          });
          pad(at, to);
        };
        const tuplets = new Map();
        voice.groups.forEach((group, gi) => {
          const id = measure[group.indices[0]].tp;
          if (id) tuplets.set(id, Object.assign(tuplets.get(id) || { first: gi }, { last: gi }));
        });
        let cursor = 0;
        let index = 0;
        voice.groups.forEach((group, gi) => {
          hidden(cursor, group.at);
          const span = tuplets.get(measure[group.indices[0]].tp);
          group.indices.forEach((i, ci) => {
            const own = roles.get(mi + '-' + i) || {};
            const tuplet = ci === 0 && span && (span.first === span.last ? 'both' : gi === span.first ? 'start' : gi === span.last ? 'stop' : undefined);
            xml += noteXml(measure[i], `e${mi}-${i}`, beams[index++], ci > 0, vi + 1, alters[i], Object.assign({}, own, { tuplet }));
          });
          cursor = group.at + group.size;
        });
        hidden(cursor, capacity(score));
        if (barreOpen && !barreClosed && vi === all.length - 1) xml += stopXml;
      });
      if (bar && bar.end) xml += '<barline location="right"><repeat direction="backward"/></barline>';
      else if (bar && bar.hidden) xml += '<barline location="right"><bar-style>none</bar-style></barline>';
      else if (bar && bar.double) xml += '<barline location="right"><bar-style>light-light</bar-style></barline>';
      xml += '</measure>';
    });
    return xml + '</part></score-partwise>\n';
  }

  return {
    DIVISIONS, MEASURE, METERS, CLEFS, GRID, PER_ROW, MIN_ROWS, BOTTOM_LINE, LOWEST, HIGHEST, VALUES, ACCIDENTALS,
    length, gridOf, onsets, settle, placement, insertAt, measureLength, clampPitch, emptyRow, emptyScore, clone, measures, rowStarts, rowOf, addMeasure, removeMeasure, fits, canDot,
    meterOf, clefOf, fifthsOf, bottomLine, keyAt, setKey, pruneKeys, keyAlter, capacity, setMeter, setBarline, removeBarline, setBarre, removeBarre, MAX_FRET, sanitize, sanitizeTabs, attacks, toMusicXml,
    links, selectionActions, applySelection, sequence,
  };
});
