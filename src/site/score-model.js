/* score-model.js — Modelo de la pagina /partitura: una partitura es una lista de
   renglones, un renglon una lista de compases y un compas una lista de figuras.
   Sin DOM: el navegador lo carga como script clasico y los tests lo requieren.

   Duraciones en divisiones de negra = 24 (el tresillo de corchea, 8, y la corchea
   con puntillo, 18, entran exactos). El MusicXML baja las alturas una octava para
   conservar la altura sonora al cambiar de clave (sol de guitarra por defecto).

   Campos de una figura:
   - `d`: valor base: w redonda (96), h blanca (48), q negra (24), e corchea (12), s semicorchea (6), f fusa (3).
     Con `dot` dura 1,5 veces; con `tp` (numero de tresillo dentro del compas) dura 2/3.
   - `n`: altura escrita como numero diatonico (C4 = 28, E4 = 30, la linea inferior de la clave de sol). En un
     silencio es opcional y solo indica a que altura se dibuja.
   - `at`: pista de orden, en divisiones de negra (24 por negra). Opcional: sin `at` la figura sigue a la anterior.
     NO es el inicio real ni ocupa tiempo: solo ordena las figuras de una misma voz y alinea las de voces distintas
     (las que comparten `at` empiezan juntas). `settle` lo reescribe con el inicio musical, sin huecos; el editor y
     `sanitize` asientan cada compas, asi que en una partitura guardada `at` coincide con el tiempo que se ve.
   - `v`: voz guardada, 1 = la mas aguda. Opcional: sin `v` la voz sale del registro (ver abajo).
   - `acc` (# b n), `tie`, `slur`, `beam` ('join' | 'break'): alteracion, ligaduras y barrado manual.
   - `dead`: nota muerta (cabeza en X); solo en notas, no en silencios.

   Tiempo y voces (`arrange`): lo que importa es el ORDEN de las figuras, no donde se dibujan.
   - Voces: una figura con `v` va a esa voz. Hacen falta tantas voces como la mayor `v`, o como figuras que no forman
     acorde empiezan en el mismo `at`. Con una sola voz todo va en orden; con varias, las notas sin `v` se reparten
     por registro: los saltos de altura mas grandes del compas separan la voz aguda (1) de la grave (entre saltos
     iguales, el corte que menos corre las figuras respecto de su `at`); un silencio sin `v` va a la primera voz que
     no tiene nada en ese `at`. Un acorde cuyas
     notas caen en registros distintos se parte, una nota por voz. Dentro de una voz no empiezan juntas dos figuras
     que no forman acorde (igual `at` y duracion): la mas grave pasa a la voz siguiente.
   - Tiempo: cada voz suena en orden, cada figura pegada a la anterior de su voz; la primera empieza en 0. Un hueco en
     `at` (antes de la primera figura o entre dos) no dura nada. Solo se espera para alinear: las figuras de voces
     distintas con el mismo `at` empiezan juntas, cuando termina la ultima de las que vienen antes. Un compas con una
     negra sola dura 24, caiga donde caiga.
   - El largo del compas es el de su voz mas larga; eso es lo que se compara con la capacidad del compas. Al exportar,
     los silencios ocultos (print-object="no") solo rellenan esas esperas de alineacion y el final del compas.
   - Partituras guardadas antes de contar en orden: si un compas con figuras sin `v` superpuestas por su `at` ya no
     entra contado en orden, `sanitize` le fija las voces de entonces (`legacyVoices`) en vez de perder figuras. */
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
  const DOUBLE_DOTTABLE = ['h', 'q']; // el doble puntillo de una corchea (21) no cae en la cuadricula
  const TRIPLETABLE = ['q', 'e', 's'];
  const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const ACCIDENTALS = {
    '#': { alter: 1, name: 'sharp' }, b: { alter: -1, name: 'flat' }, n: { alter: 0, name: 'natural' },
    '##': { alter: 2, name: 'double-sharp' }, bb: { alter: -2, name: 'flat-flat' },
  };

  const MAX_VOICE = 4;
  const REST_CLEARANCE = 6; // pasos diatonicos entre una nota y un silencio que suenan a la vez

  // Grupos de valoracion especial: n figuras (clave) ocupan el tiempo de TUPLETS[n] del mismo valor. `tp` identifica el
  // grupo dentro del compas y `tn` guarda cuantas figuras tiene (sin `tn` son 3: el tresillo). No admiten puntillo.
  const TUPLETS = { 2: 3, 3: 2, 4: 3, 5: 4, 6: 4, 7: 4, 8: 6, 9: 8 };
  const TUPLET_NAMES = { 2: 'dosillo', 3: 'tresillo', 4: 'cuatrillo', 5: 'quintillo', 6: 'sextillo', 7: 'septillo', 8: 'octillo', 9: 'nonillo' };
  const MULTIPLIER = 630; // divisiones extra al exportar: hace enteras las duraciones de todos los grupos (5, 7 y 9 figuras)

  // Los grupos dan duraciones fraccionarias (5 corcheas en 4: 9,6); se redondea para que las sumas sean exactas.
  // Un grupo completo vuelve a un entero (7 figuras de 24/7 suman 24 y no 23,999997).
  const tidy = (x) => (Math.abs(x - Math.round(x)) < 1e-4 ? Math.round(x) : Math.round(x * 1e6) / 1e6);

  function tupletSize(ev) {
    return TUPLETS[ev.tn] ? ev.tn : 3;
  }

  function length(ev) {
    return ev.tp ? tidy(VALUES[ev.d] * TUPLETS[tupletSize(ev)] / tupletSize(ev)) : ev.dot === 2 ? VALUES[ev.d] * 1.75 : ev.dot ? VALUES[ev.d] * 1.5 : VALUES[ev.d];
  }

  // Cuadricula de posicion para estas figuras: la mas fina que necesiten (un tresillo y una fusa juntos, 1).
  function gridOf(events) {
    const odd = events.some((ev) => ev.tp && tupletSize(ev) !== 3);
    const triplet = events.some((ev) => ev.tp);
    const thirtySecond = events.some((ev) => ev.d === 'f');
    return odd ? 0.1 : triplet ? (thirtySecond ? 1 : 2) : thirtySecond ? 3 : GRID;
  }

  function savedVoice(ev) {
    return Number.isInteger(ev.v) && ev.v >= 1 && ev.v <= MAX_VOICE ? ev.v : 0;
  }

  // `at` de cada figura como pista de orden: una figura sin `at` sigue a la anterior.
  function hints(measure) {
    let cursor = 0;
    return measure.map((ev) => {
      const at = Number.isInteger(ev.at) ? ev.at : cursor;
      cursor = tidy(Math.max(cursor, at + length(ev)));
      return at;
    });
  }

  // Reparte las figuras en voces y calcula cuando empieza cada una (ver el encabezado).
  function arrange(measure) {
    if (!measure.length) return { lanes: [{ end: 0, groups: [] }], starts: [] };
    const hint = hints(measure);
    // Cuantas voces hacen falta: la mayor `v` guardada, o cuantas figuras que no forman acorde empiezan juntas.
    let count = Math.max(1, ...measure.map(savedVoice));
    const byHint = new Map();
    measure.forEach((ev, i) => {
      if (!byHint.has(hint[i])) byHint.set(hint[i], []);
      byHint.get(hint[i]).push(i);
    });
    byHint.forEach((list) => {
      const slots = new Set();
      list.forEach((i) => {
        const ev = measure[i];
        if (ev.rest) slots.add('r' + i);
        else if (savedVoice(ev)) slots.add('n' + length(ev) + ':' + ev.v);
      });
      list.forEach((i) => {
        const ev = measure[i];
        if (ev.rest || savedVoice(ev)) return;
        if (![...slots].some((slot) => slot.startsWith('n' + length(ev) + ':'))) slots.add('n' + length(ev));
      });
      count = Math.max(count, slots.size);
    });
    // Registro: con varias voces, los saltos de altura mas grandes del compas separan las voces de agudo a grave.
    // Entre saltos iguales gana el corte que menos corre las figuras respecto de su `at`.
    const pitches = [...new Set(measure.filter((ev) => !ev.rest).map((ev) => ev.n))].sort((a, b) => a - b);
    const gaps = pitches.slice(1).map((p, j) => ({ size: p - pitches[j], above: p })).sort((a, b) => b.size - a.size || a.above - b.above);
    const need = Math.min(count - 1, gaps.length);
    let options = [gaps.slice(0, need).map((gap) => gap.above)];
    if (need > 0 && need < gaps.length && gaps[need].size === gaps[need - 1].size) {
      const threshold = gaps[need - 1].size;
      const sure = gaps.filter((gap) => gap.size > threshold).map((gap) => gap.above);
      const tied = gaps.filter((gap) => gap.size === threshold).map((gap) => gap.above);
      const combos = (from, k) => (k === 0 ? [[]] : from.length < k ? [] :
        combos(from.slice(1), k - 1).map((rest) => [from[0]].concat(rest)).concat(combos(from.slice(1), k)));
      options = combos(tied, need - sure.length).slice(0, 32).map((picked) => sure.concat(picked));
    }
    let best = null;
    options.forEach((cuts) => {
      const result = layout(measure, hint, cuts);
      result.shift = result.starts.reduce((sum, start, i) => sum + Math.abs(start - hint[i]), 0);
      if (!best || result.shift < best.shift) best = result;
    });
    return { lanes: best.lanes, starts: best.starts };
  }

  // Voces y tiempos de `arrange` para unos cortes de registro dados (`cuts`: la nota mas grave de cada voz superior).
  function layout(measure, hint, cuts) {
    const lane = measure.map((ev) => (savedVoice(ev) ? ev.v - 1 : ev.rest ? -1 : cuts.filter((above) => above > ev.n).length));
    // Un silencio sin voz va a la primera voz que no tiene nada en ese lugar.
    measure.forEach((ev, i) => {
      if (lane[i] >= 0) return;
      let k = 0;
      while (measure.some((o, j) => j !== i && lane[j] === k && hint[j] === hint[i])) k += 1;
      lane[i] = k;
    });
    // Dentro de una voz no empiezan juntas dos figuras que no forman acorde: queda la mas aguda y las demas bajan una voz.
    const top = (list) => (measure[list[0]].rest ? -Infinity : Math.max(...list.map((i) => measure[i].n)));
    for (let k = 0; k <= Math.max(...lane); k += 1) {
      const at = new Map();
      measure.forEach((ev, i) => {
        if (lane[i] !== k) return;
        const key = ev.rest ? 'r' + i : 'n' + length(ev);
        if (!at.has(hint[i])) at.set(hint[i], new Map());
        const keys = at.get(hint[i]);
        if (!keys.has(key)) keys.set(key, []);
        keys.get(key).push(i);
      });
      at.forEach((keys) => {
        if (keys.size < 2) return;
        const lists = [...keys.values()];
        const keep = lists.reduce((best, list) => (top(list) > top(best) ? list : best));
        lists.forEach((list) => { if (list !== keep) list.forEach((i) => { lane[i] = k + 1; }); });
      });
    }
    // Sin carriles vacios: las voces se numeran en orden, saltando las que no tienen figuras.
    const used = [...new Set(lane)].sort((a, b) => a - b);
    const lanes = used.map(() => ({ end: 0, groups: [] }));
    measure.map((ev, i) => i).sort((a, b) => hint[a] - hint[b] || a - b).forEach((i) => {
      const voice = lanes[used.indexOf(lane[i])];
      const last = voice.groups[voice.groups.length - 1];
      const ev = measure[i];
      if (last && !ev.rest && !last.rest && last.hint === hint[i] && last.size === length(ev)) last.indices.push(i);
      else voice.groups.push({ hint: hint[i], at: 0, size: length(ev), rest: !!ev.rest, v: ev.v, indices: [i] });
    });
    // Tiempo: cada voz suena en orden y sin huecos; solo las figuras con la misma pista `at` se esperan para empezar juntas.
    const starts = [];
    const pending = lanes.flatMap((voice) => voice.groups.map((g) => ({ g, voice }))).sort((a, b) => a.g.hint - b.g.hint);
    for (let p = 0; p < pending.length;) {
      let q = p;
      while (q < pending.length && pending[q].g.hint === pending[p].g.hint) q += 1;
      const batch = pending.slice(p, q);
      const start = Math.max(...batch.map((item) => item.voice.end));
      batch.forEach(({ g, voice }) => {
        g.at = start;
        voice.end = tidy(start + g.size);
        g.indices.forEach((i) => { starts[i] = start; });
      });
      p = q;
    }
    return { lanes, starts };
  }

  // Solo para cargar partituras guardadas antes de contar en orden, cuyas figuras sin `v` se superponian en `at` y
  // sumadas en orden no entran en el compas: fija `v` como se repartian entonces (cada figura en la primera voz donde no
  // pisaba a otra segun su `at`). Cada voz asi suma a lo sumo el compas, de modo que no se pierde ninguna figura.
  function legacyVoices(measure) {
    const hint = hints(measure);
    const lanes = [];
    const order = measure.map((ev, i) => i).sort((a, b) => hint[a] - hint[b] ||
      (measure[b].rest ? -Infinity : measure[b].n) - (measure[a].rest ? -Infinity : measure[a].n) || a - b);
    order.forEach((i) => {
      const ev = measure[i];
      const span = [hint[i], hint[i] + length(ev)];
      const fits = (lane) => lane.every((j) => (hint[j] === span[0] && !ev.rest && !measure[j].rest && length(measure[j]) === length(ev)) ||
        hint[j] + length(measure[j]) <= span[0] || span[1] <= hint[j]);
      let k = savedVoice(ev) && fits(lanes[ev.v - 1] || []) ? ev.v - 1 : lanes.findIndex(fits);
      if (k < 0) k = lanes.length;
      while (lanes.length <= k) lanes.push([]);
      lanes[k].push(i);
    });
    lanes.filter((lane) => lane.length).forEach((lane, k) => lane.forEach((i) => { measure[i].v = k + 1; }));
    return measure;
  }

  // Inicio musical de cada figura dentro del compas, ya sin huecos.
  function onsets(measure) {
    return arrange(measure).starts;
  }

  // Lo que dura el compas: su voz mas larga, sumando las figuras en orden (un hueco antes o entre figuras no cuenta).
  function measureLength(measure) {
    return Math.max(0, ...arrange(measure).lanes.map((voice) => voice.end));
  }

  // Reescribe `at` con el inicio musical (sin huecos) y, si hay varias voces, fija `v` en todas, para que agregar,
  // quitar o alargar otra figura no las mueva ni las reparta distinto.
  function settle(measure) {
    const { lanes, starts } = arrange(measure);
    measure.forEach((ev, i) => { ev.at = starts[i]; });
    if (lanes.length > 1) lanes.forEach((voice, k) => voice.groups.forEach((g) => g.indices.forEach((i) => { measure[i].v = k + 1; })));
    return measure;
  }

  // Lugar `at` (pista de orden, en la cuadricula) para soltar `ev` en el tiempo `t`; null si repite una nota que ya
  // suena ahi o si el compas, contado en orden, ya no la admite.
  function placement(others, ev, t, score, mi) {
    const limit = capacity(score, mi);
    const size = length(ev);
    if (size > limit) return null;
    const grid = gridOf([ev]);
    const at = Math.max(0, Math.min(limit - size, tidy(Math.round(t / grid) * grid)));
    const starts = hints(others);
    if (!ev.rest && others.some((o, i) => !o.rest && starts[i] === at && o.n === ev.n && o.acc === ev.acc)) return null;
    if (!ev.rest) {
      const trial = clone(others);
      insertNote(trial, Object.assign({}, ev), at);
      if (measureLength(trial) > limit) return null;
    }
    return { at, d: ev.d, dot: ev.dot };
  }

  // Inserta varias figuras ([[ev, at], ...]) cada una antes de la primera que tiene un `at` mayor, y recien entonces
  // asienta el compas (`settle`: `at` pasa a ser el inicio real, sin huecos). Las figuras que quedan conservan su `at`
  // hasta el final: si se acaba de sacar una figura (mover), su lugar en el orden sigue disponible. Devuelve los indices.
  function insertMany(measure, list) {
    const h = hints(measure);
    measure.forEach((o, i) => { o.at = h[i]; });
    list.forEach(([ev, at]) => {
      ev.at = at;
      let index = measure.findIndex((o) => o.at > at);
      if (index < 0) index = measure.length;
      measure.splice(index, 0, ev);
    });
    settle(measure);
    return list.map(([ev]) => measure.indexOf(ev));
  }

  // Inserta `ev` en el tiempo `at` (el de la partitura tal como se ve), antes de la primera figura que empieza despues.
  function insertAt(measure, ev, at) {
    return insertMany(measure, [[ev, at]])[0];
  }

  // Un fragmento conserva los compases intermedios y solo las figuras elegidas.
  function copySelection(score, refs, columns = score.tabs || {}) {
    const all = measures(score);
    const chosen = refs.filter((r) => all[r.mi]?.[r.i]);
    if (!chosen.length) return null;
    const first = Math.min(...chosen.map((r) => r.mi));
    const last = Math.max(...chosen.map((r) => r.mi));
    const fragment = Array.from({ length: last - first + 1 }, () => []);
    const positions = new Map();
    const pitches = fragment.map(() => []);
    const contexts = all.map((measure, mi) => pitchContexts(score, mi));
    all.forEach((measure, mi) => measure.forEach((ev, i) => {
      if (!chosen.some((r) => r.mi === mi && r.i === i)) return;
      positions.set(ev, { mi: mi - first, i: fragment[mi - first].length });
      fragment[mi - first].push(clone(ev));
      pitches[mi - first].push(contexts[mi][i]);
    }));
    const tabs = attacks(score, true).filter((attack) => columns[attack.key]).map((attack) => {
      const notes = attack.events.flatMap((ev, i) => positions.has(ev) ? [{ ...positions.get(ev), midi: attack.midis[i] }] : []);
      const column = columns[attack.key].map((fret, string) =>
        notes.length === attack.events.length || notes.some((note) => TAB_OPENS[string] + fret === note.midi) ? fret : null);
      return { notes, column };
    }).filter((entry) => entry.notes.length);
    const signatures = fragment.map((_, offset) => ({ meter: meterAt(score, first + offset), fifths: keyAt(score, first + offset) }));
    return { pitches, tabs, type: 'guitar-score-selection', version: 1, ...signatures[0], signatures, measures: fragment };
  }

  // Duplica las figuras elegidas justo despues de la ultima de ellas, conservando su ritmo relativo. Lo que no entra
  // en el compas sigue en los siguientes (se agregan los que falten; una figura partida queda ligada) y convive con
  // lo que ya hay: misma altura y duracion se ignora, misma altura y otra duracion actualiza la duracion.
  // Devuelve las figuras resultantes, o null (sin tocar la partitura) si algo no se puede colocar.
  function duplicateSelection(score, refs) {
    const trial = clone(score);
    const all = measures(trial);
    const chosen = refs.filter((r, k) => all[r.mi]?.[r.i] && refs.findIndex((o) => o.mi === r.mi && o.i === r.i) === k);
    if (!chosen.length) return null;
    const savedTabs = captureTabReferences(trial);
    const sourceAttacks = attacks(trial, true);
    const starts = () => {
      let total = 0;
      const list = measures(trial).map((_, mi) => { const at = total; total += capacity(trial, mi); return at; });
      return { list, total };
    };
    const origin = starts().list;
    const sources = chosen.map(({ mi, i }) => {
      const ev = all[mi][i];
      return { ev, abs: origin[mi] + onsets(all[mi])[i], pitch: pitchContexts(trial, mi)[i], clef: CLEFS[clefAt(trial, mi)].octave || 0 };
    }).sort((a, b) => a.abs - b.abs);
    const offset = Math.max(...sources.map((s) => s.abs + length(s.ev))) - sources[0].abs;
    const needed = Math.max(...sources.map((s) => s.abs + offset + length(s.ev)));
    while (starts().total < needed) trial.rows.push(emptyRow());
    const { list: first } = starts();
    const values = Object.keys(VALUES).flatMap((d) => [{ d }, ...(!['w', 's', 'f'].includes(d) ? [{ d, dot: true }] : [])])
      .sort((a, b) => length(b) - length(a));
    const decompose = (size) => {
      const pieces = [];
      while (size > 0) {
        const value = values.find((v) => length(v) <= size);
        if (!value) return null;
        pieces.push(value);
        size -= length(value);
      }
      return pieces;
    };
    // Cada figura elegida pasa a una o mas partes, cada una en el compas que le toca.
    const byMeasure = new Map();
    const partsOf = new Map();
    for (const source of sources) {
      const { ev } = source;
      let pos = source.abs + offset, remaining = length(ev);
      partsOf.set(ev, []);
      while (remaining > 0) {
        const mi = first.findLastIndex((at) => at <= pos);
        const room = first[mi] + capacity(trial, mi) - pos;
        const size = Math.min(room, remaining);
        let made;
        if (size === length(ev)) made = [clone(ev)];
        else {
          if (ev.tp) return null;
          const pieces = decompose(size);
          if (!pieces) return null;
          made = pieces.map((value, k) => {
            const part = Object.assign(clone(ev), value, { at: 0 });
            delete part.tp; delete part.tn; delete part.dot;
            if (value.dot) part.dot = true;
            if (k < pieces.length - 1 || remaining > size) { if (!ev.rest) part.tie = true; delete part.slur; }
            return part;
          });
        }
        made.forEach((part) => {
          part.at = pos - first[mi];
          if (!byMeasure.has(mi)) byMeasure.set(mi, []);
          byMeasure.get(mi).push({ part, source });
          partsOf.get(ev).push(part);
          pos += length(part);
        });
        remaining -= size;
      }
    }
    const fresh = new Set();
    const landed = new Map();
    for (const [mi, entries] of [...byMeasure].sort((a, b) => a[0] - b[0])) {
      const dest = measures(trial)[mi];
      const times = onsets(dest);
      const existing = pitchContexts(trial, mi);
      const desired = new Map(dest.map((ev, i) => [ev, existing[i]]));
      const octave = CLEFS[clefAt(trial, mi)].octave || 0;
      let nextId = Math.max(0, ...dest.map((ev) => ev.tp || 0));
      const ids = new Map();
      const inserts = [];
      for (const { part, source } of entries) {
        if (!part.rest) {
          part.n += 7 * (source.clef - octave);
          if (part.n < LOWEST || part.n > HIGHEST) return null;
        }
        const at = part.at;
        const twin = dest.findIndex((o, j) => times[j] === at && (part.rest
          ? o.rest
          : !o.rest && o.n === part.n && existing[j]?.alter === source.pitch?.alter));
        const blocked = part.rest && dest.some((o, j) => times[j] === at && !o.rest);
        if (blocked) continue;
        if (twin >= 0) {
          const other = dest[twin];
          if (length(other) !== length(part) && !other.tp && !part.tp) {
            delete other.dot;
            Object.assign(other, { d: part.d }, part.dot ? { dot: true } : {});
          }
          landed.set(part, other);
          continue;
        }
        if (part.tp) {
          if (!ids.has(part.tp)) ids.set(part.tp, ++nextId);
          part.tp = ids.get(part.tp);
        }
        if (!part.rest && source.pitch) desired.set(part, source.pitch);
        inserts.push([part, at]);
        fresh.add(part);
        landed.set(part, part);
      }
      insertMany(dest, inserts);
      if (measureLength(dest) > capacity(trial, mi)) return null;
      // Una alteracion copiada no debe cambiar la altura de lo que ya estaba en el compas.
      const actual = new Map();
      const order = onsets(dest);
      dest.map((ev, i) => i).sort((a, b) => order[a] - order[b]).forEach((i) => {
        const ev = dest[i];
        if (ev.rest) return;
        const pitch = desired.get(ev);
        const alter = ev.acc ? ACCIDENTALS[ev.acc].alter : actual.has(ev.n) ? actual.get(ev.n) : keyAlter(ev.n, trial, mi);
        if (pitch && alter !== pitch.alter) ev.acc = accidentalFor(pitch.alter);
        if (ev.acc) actual.set(ev.n, ACCIDENTALS[ev.acc].alter);
      });
    }
    // La digitacion de la TAB viaja con la nota, igual que al copiar y pegar.
    const columns = score.tabs || {};
    sourceAttacks.filter((attack) => columns[attack.key]).forEach((attack) => {
      const notes = attack.events.flatMap((ev, k) => {
        const target = partsOf.get(ev)?.[0];
        return target && fresh.has(target) ? [{ target, midi: attack.midis[k] }] : [];
      });
      if (!notes.length) return;
      const column = columns[attack.key].map((fret, string) =>
        notes.length === attack.events.length || notes.some((note) => TAB_OPENS[string] + fret === note.midi) ? fret : null);
      savedTabs.push({ refs: notes.map((note) => tabReference(note.target)), midis: notes.map((note) => note.midi), column });
    });
    restoreTabReferences(trial, savedTabs);
    const created = [];
    for (const { ev } of sources) {
      for (const part of partsOf.get(ev)) {
        const target = landed.get(part);
        const mi = target && measures(trial).findIndex((m) => m.includes(target));
        if (target && mi >= 0) created.push({ mi, i: measures(trial)[mi].indexOf(target) });
      }
    }
    score.rows = trial.rows;
    if (trial.tabs) score.tabs = trial.tabs;
    else delete score.tabs;
    return created.length ? created : null;
  }

  // Prepara todo antes de escribir: un pegado que no entra no cambia la partitura.
  function pasteSelection(score, fragment, mi, { preserveSignatures = true } = {}) {
    if (fragment?.type !== 'guitar-score-selection' || fragment.version !== 1 ||
      !Number.isInteger(mi) || mi < 0 || mi >= measures(score).length ||
      !Array.isArray(fragment.measures) || !fragment.measures.length ||
      !fragment.measures.every(Array.isArray)) return null;
    const clean = sanitize({ meter: fragment.meter, meters: Object.fromEntries((Array.isArray(fragment.signatures) ? fragment.signatures : []).map((signature, i) => [i, signature?.meter])), rows: [fragment.measures] }).rows[0];
    if (clean.some((m, i) => m.length !== fragment.measures[i].length) || !clean.some((m) => m.length)) return null;
    const savedTabs = captureTabReferences(score);
    // El portapapeles usa indices serializables; al pegar se les da una identidad nueva.
    if (Array.isArray(fragment.tabs)) fragment.tabs.forEach((entry) => {
      if (!entry || !Array.isArray(entry.notes) || !entry.notes.length || !Array.isArray(entry.column)) return;
      const notes = entry.notes.map((note) => note && Number.isInteger(note.mi) && Number.isInteger(note.i) &&
        Number.isInteger(note.midi) && clean[note.mi]?.[note.i] && !clean[note.mi][note.i].rest ? note : null);
      if (notes.some((note) => !note)) return;
      savedTabs.push({ refs: notes.map((note) => tabReference(clean[note.mi][note.i])), midis: notes.map((note) => note.midi),
        column: sanitizeTabs({ '0:0': entry.column }, 1)['0:0'] });
    });
    const trial = clone(score);
    while (measures(trial).length < mi + clean.length) trial.rows.push(emptyRow());
    const all = measures(trial);
    const destinationContexts = all.map((_, index) => pitchContexts(trial, index));
    if (preserveSignatures) {
      const end = mi + clean.length;
      const after = { meter: meterAt(trial, end), fifths: keyAt(trial, end) };
      for (let offset = 0; offset < clean.length; offset += 1) {
        const signature = fragment.signatures?.[offset] || (offset === 0 ? fragment : null);
        if (!signature) continue;
        if (METERS.includes(signature.meter)) {
          const changedMeter = meterAt(trial, mi + offset) !== signature.meter;
          if (mi + offset === 0) trial.meter = signature.meter;
          else (trial.meters ||= {})[mi + offset] = signature.meter;
          if (changedMeter && trial.measureDurations) delete trial.measureDurations[mi + offset];
        }
        if (Number.isInteger(signature.fifths) && Math.abs(signature.fifths) <= 7) {
          if (mi + offset === 0) trial.fifths = signature.fifths;
          else (trial.keys ||= {})[mi + offset] = signature.fifths;
        }
      }
      if (end < all.length) {
        (trial.meters ||= {})[end] = after.meter;
        (trial.keys ||= {})[end] = after.fifths;
      }
      pruneKeys(trial);
    }
    const refs = [];
    for (let offset = 0; offset < clean.length; offset += 1) {
      const destination = all[mi + offset];
      const destinationPitches = destinationContexts[mi + offset];
      const desired = new Map(destination.map((ev, i) => [ev, destinationPitches[i]]));
      const octave = CLEFS[clefAt(trial, mi + offset)].octave || 0;
      for (let i = 0; i < clean[offset].length; i += 1) {
        const ev = clean[offset][i];
        const pitch = fragment.pitches?.[offset]?.[i];
        if (ev.rest || !pitch || ![-1, 0, 1].includes(pitch.alter) || ![-1, 0].includes(pitch.octave)) continue;
        ev.n += 7 * (pitch.octave - octave);
        if (ev.n < LOWEST || ev.n > HIGHEST) return null;
        desired.set(ev, pitch);
        if (pitch.alter !== keyAlter(ev.n, trial, mi + offset)) ev.acc = accidentalFor(pitch.alter);
      }
      const starts = onsets(destination);
      const clashes = () => clean[offset].some((ev) => !ev.rest && destination.some((other, i) =>
        !other.rest && starts[i] === ev.at && other.n === ev.n &&
        (desired.has(ev) ? desired.get(other)?.alter === desired.get(ev).alter : other.acc === ev.acc)));
      // Si repite notas que ya suenan ahi (pegar sobre el mismo compas), sigue a lo que ya hay en el compas.
      if (clashes()) {
        const shift = measureLength(destination);
        clean[offset].forEach((ev) => { ev.at += shift; });
        if (clashes()) return null;
      }
      const ids = new Map();
      let nextId = Math.max(0, ...destination.map((ev) => ev.tp || 0));
      const list = clean[offset].map((ev) => {
        if (ev.tp) {
          if (!ids.has(ev.tp)) ids.set(ev.tp, ++nextId);
          ev.tp = ids.get(ev.tp);
        }
        return [ev, ev.at];
      });
      const indices = insertMany(destination, list);
      // Una alteracion pegada no debe cambiar las notas que ya estaban en el destino.
      const actual = new Map();
      const times = onsets(destination);
      destination.map((ev, i) => i).sort((a, b) => times[a] - times[b]).forEach((i) => {
        const ev = destination[i];
        if (ev.rest) return;
        const pitch = desired.get(ev);
        const alter = ev.acc ? ACCIDENTALS[ev.acc].alter : actual.has(ev.n) ? actual.get(ev.n) : keyAlter(ev.n, trial, mi + offset);
        if (pitch && alter !== pitch.alter) ev.acc = accidentalFor(pitch.alter);
        if (ev.acc) actual.set(ev.n, ACCIDENTALS[ev.acc].alter);
      });
      if (measureLength(destination) > capacity(trial, mi + offset)) return null;
      indices.forEach((i) => refs.push({ mi: mi + offset, i }));
    }
    restoreTabReferences(trial, savedTabs);
    score.rows = trial.rows;
    for (const name of ['meter', 'meters', 'fifths', 'keys', 'measureDurations']) {
      if (trial[name] !== undefined) score[name] = trial[name];
      else delete score[name];
    }
    if (trial.tabs) score.tabs = trial.tabs;
    else delete score.tabs;
    return refs;
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

  // Identidad interna de las figuras: no se serializa ni depende de compas, tiempo o indice.
  const tabReferences = new WeakMap();
  function tabReference(ev) {
    if (!tabReferences.has(ev)) tabReferences.set(ev, {});
    return tabReferences.get(ev);
  }

  function clone(score) {
    const result = JSON.parse(JSON.stringify(score));
    const remember = (from, to) => {
      if (!from || typeof from !== 'object' || !to || typeof to !== 'object') return;
      tabReferences.set(to, tabReference(from));
      Object.keys(to).forEach((key) => remember(from[key], to[key]));
    };
    remember(score, result);
    return result;
  }

  // Compases en orden de lectura; el indice plano es el que usan los ids del SVG.
  function measures(score) {
    return score.rows.flat();
  }

  // Indice plano del primer compas de cada renglon; dividir compases puede superar PER_ROW.
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
    ['navigation', 'barlines', 'keys', 'clefs', 'meters', 'barres', 'measureDurations', 'measureWidths'].forEach((name) => { if (score[name]) score[name] = shiftKeys(score[name], at, 1); });
    score.rows[row].push([]);
    return true;
  }

  // Inserta un compas vacio en la posicion plana `at` (0..total): el que estaba ahi y todos los siguientes se corren.
  // Queda en el renglon de `at` (o en el ultimo si `at` es el final). Si el renglon pasa de PER_ROW, su ultimo compas
  // baja al renglon siguiente, y asi hasta que todo entra; un renglon que ya pasaba de PER_ROW no se vuelve a partir.
  function insertMeasure(score, at) {
    const total = measures(score).length;
    if (!Number.isInteger(at) || at < 0 || at > total) return false;
    const target = at === total ? score.rows.length - 1 : rowOf(score, at).row;
    const limits = score.rows.map((row) => Math.max(PER_ROW, row.length));
    // Una cejilla que cruza el punto de insercion termina antes del compas nuevo.
    Object.entries(score.barres || {}).forEach(([key, barre]) => {
      const m = +key;
      if (m < at && barreLast(barre, m) >= at) {
        barre.span = at - 1 - m;
        delete barre.to;
        if (!barre.span) delete barre.span;
      }
    });
    ['navigation', 'barlines', 'keys', 'clefs', 'meters', 'barres', 'measureDurations', 'measureWidths'].forEach((name) => {
      if (score[name]) score[name] = shiftKeys(score[name], at, 1);
    });
    if (score.tabs) score.tabs = Object.fromEntries(Object.entries(score.tabs).map(([key, value]) => {
      const [mi, time] = key.split(':');
      return [(+mi >= at ? +mi + 1 : +mi) + ':' + time, value];
    }));
    score.rows[target].splice(at - rowStarts(score)[target], 0, []);
    for (let row = target; row < score.rows.length && score.rows[row].length > limits[row]; row += 1) {
      if (row === score.rows.length - 1) score.rows.push([]);
      score.rows[row + 1].unshift(score.rows[row].pop());
    }
    pruneKeys(score);
    return true;
  }

  // Quita el ultimo compas del renglon `row` (con sus figuras), salvo que sea el unico.
  function removeMeasure(score, row) {
    if (!Number.isInteger(row) || row < 0 || row >= score.rows.length || score.rows[row].length <= 1) return false;
    return removeMeasureAt(score, rowStarts(score)[row] + score.rows[row].length - 1);
  }

  // Quita el compas plano `at` con sus figuras; los siguientes se corren. Un renglon que queda vacio desaparece.
  function removeMeasureAt(score, at) {
    if (!Number.isInteger(at) || at < 0 || at >= measures(score).length || measures(score).length <= 1) return false;
    const { row } = rowOf(score, at);
    if (score.barres) Object.keys(score.barres).forEach((key) => {
      const barre = score.barres[key];
      if (+key === at) delete score.barres[key];
      else if (+key < at && barreLast(barre, +key) >= at) {
        barre.span -= 1;
        delete barre.to;
        if (!barre.span) delete barre.span;
      }
    });
    ['navigation', 'barlines', 'keys', 'clefs', 'meters', 'barres', 'measureDurations', 'measureWidths'].forEach((name) => {
      if (!score[name]) return;
      delete score[name][at];
      score[name] = shiftKeys(score[name], at, -1);
      if (!Object.keys(score[name]).length) delete score[name];
    });
    if (score.tabs) score.tabs = Object.fromEntries(Object.entries(score.tabs)
      .filter(([key]) => +key.split(':')[0] !== at)
      .map(([key, value]) => {
        const [mi, time] = key.split(':');
        return [(+mi > at ? +mi - 1 : +mi) + ':' + time, value];
      }));
    score.rows[row].splice(at - rowStarts(score)[row], 1);
    if (!score.rows[row].length) score.rows.splice(row, 1);
    pruneKeys(score);
    return true;
  }

  // `before` is an insertion boundary in the original order. Interior drops keep
  // row sizes; an append that fits transfers one slot from the source row.
  function moveMeasure(score, from, before, appendRow) {
    const all = measures(score);
    if (!Number.isInteger(from) || from < 0 || from >= all.length ||
        !Number.isInteger(before) || before < 0 || before > all.length) return false;
    const source = rowOf(score, from).row;
    const append = Number.isInteger(appendRow) && appendRow >= 0 && appendRow < score.rows.length;
    const counts = score.rows.map((row) => row.length);
    if (append && before !== rowStarts(score)[appendRow] + counts[appendRow]) return false;
    const target = before - (from < before ? 1 : 0);
    if (target === from && (!append || source === appendRow)) return false;
    if (append && source !== appendRow) {
      // A row always has at least one measure, including otherwise empty rows.
      if (counts[source] === 1) return false;
      counts[source] -= 1;
      counts[appendRow] += 1;
    }
    const signatures = all.map((_, mi) => ({ meter: meterAt(score, mi), fifths: keyAt(score, mi), clef: clefAt(score, mi) }));
    const order = all.map((_, mi) => mi);
    order.splice(target, 0, order.splice(from, 1)[0]);
    const positions = new Map(order.map((old, mi) => [old, mi]));
    ['navigation', 'barlines', 'barres', 'measureDurations', 'measureWidths'].forEach((name) => {
      if (!score[name]) return;
      const moved = {};
      Object.entries(score[name]).forEach(([old, value]) => {
        const mi = positions.get(+old);
        if (name === 'barres' && value.span) {
          const end = barreLast(value, +old);
          const intact = Array.from({ length: end - old + 1 }, (_, i) => positions.get(+old + i) === mi + i).every(Boolean);
          if (!intact) { value = { ...value }; delete value.span; delete value.to; }
        }
        moved[mi] = value;
      });
      score[name] = moved;
    });
    if (score.tabs) score.tabs = Object.fromEntries(Object.entries(score.tabs).map(([key, value]) => {
      const [mi, at] = key.split(':');
      return [positions.get(+mi) + ':' + at, value];
    }));
    all.forEach((measure, mi) => {
      if (positions.get(mi + 1) !== positions.get(mi) + 1) measure.forEach((ev) => { delete ev.tie; delete ev.slur; });
    });
    let offset = 0;
    score.rows = counts.map((count) => { const row = order.slice(offset, offset + count).map((mi) => all[mi]); offset += count; return row; });
    [['meter', 'meters'], ['fifths', 'keys'], ['clef', 'clefs']].forEach(([base, map]) => {
      score[base] = signatures[order[0]][base];
      const changes = {};
      order.forEach((old, mi) => { if (mi && signatures[old][base] !== signatures[order[mi - 1]][base]) changes[mi] = signatures[old][base]; });
      if (Object.keys(changes).length) score[map] = changes;
      else delete score[map];
    });
    return true;
  }

  // Las barras se guardan aparte: JSON no conserva propiedades de los arrays de figuras.
  function setBarline(score, mi, type, at) {
    if (!Number.isInteger(mi) || mi < 0 || mi >= measures(score).length || !['double', 'start', 'end'].includes(type)) return false;
    if (type === 'double' && Number.isFinite(at)) {
      at = Math.round(at / GRID) * GRID;
      if (at > 0 && at < capacity(score, mi)) return splitMeasure(score, mi, at);
    }
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

  // Hidden internal bars join stored measures into one visible measure.
  function visibleMeasureRange(score, mi, count) {
    const hidden = (index) => score.barlines?.[index]?.hidden && !score.barlines[index].end &&
      !score.barlines[index].double && !score.barlines?.[index + 1]?.start;
    let first = mi, last = mi;
    while (first > 0 && hidden(first - 1)) first -= 1;
    while (last + 1 < count && hidden(last)) last += 1;
    return { first, last };
  }

  // Navigation marks belong to measures and survive row edits and saved scores.
  const NAVIGATION = ['dc', 'ds', 'segno', 'first', 'second'];
  function setNavigation(score, mi, mark) {
    if (!Number.isInteger(mi) || mi < 0 || mi >= measures(score).length || !NAVIGATION.includes(mark)) return false;
    if (mark === 'first' || mark === 'second') {
      const { first, last } = visibleMeasureRange(score, mi, measures(score).length);
      const active = Array.from({ length: last - first + 1 }, (_, i) => score.navigation?.[first + i]?.[mark]).some(Boolean);
      for (let i = first; i <= last; i += 1) {
        removeNavigation(score, i, 'first');
        removeNavigation(score, i, 'second');
      }
      if (!active) {
        if (!score.navigation) score.navigation = {};
        score.navigation[first] = { ...score.navigation[first], [mark]: true };
      }
      return true;
    }
    const marks = Object.assign({}, score.navigation?.[mi]);
    if (marks[mark]) delete marks[mark];
    else {
      if (mark === 'dc' || mark === 'ds') { delete marks.dc; delete marks.ds; }
      marks[mark] = true;
    }
    if (!score.navigation) score.navigation = {};
    if (Object.keys(marks).length) score.navigation[mi] = marks;
    else delete score.navigation[mi];
    return true;
  }

  function removeNavigation(score, mi, mark) {
    if (!NAVIGATION.includes(mark) || score.navigation?.[mi]?.[mark] !== true) return false;
    delete score.navigation[mi][mark];
    if (!Object.keys(score.navigation[mi]).length) delete score.navigation[mi];
    if (!Object.keys(score.navigation).length) delete score.navigation;
    return true;
  }

  // A bracket covers visible measures; closing bars break consecutive endings.
  function navigationEndings(score) {
    const all = measures(score), endings = [];
    for (let mi = 0; mi < all.length;) {
      const { first, last } = visibleMeasureRange(score, mi, all.length);
      let mark = null;
      for (let i = first; i <= last && !mark; i += 1) {
        const nav = score.navigation?.[i];
        mark = nav?.first ? 'first' : nav?.second ? 'second' : null;
      }
      mi = last + 1;
      if (!mark) continue;
      const bar = score.barlines?.[last];
      const previous = endings.at(-1);
      const closing = score.barlines?.[first - 1];
      const closed = mark === 'first' || !!(bar?.end || bar?.double || (last === all.length - 1 && !bar?.hidden));
      if (previous?.mark === mark && previous.last === first - 1 && !closing?.end && !closing?.double) {
        previous.last = last;
        previous.closed = closed;
      } else endings.push({ first, last, mark, number: mark === 'first' ? '1' : '2', closed });
    }
    return endings;
  }

  // Una barra interior crea dos compases incompletos sin cambiar la indicacion de compas.
  function splitMeasure(score, mi, at) {
    const all = measures(score);
    const end = capacity(score, mi);
    const left = [], right = [];
    const starts = onsets(all[mi]);
    const carried = new Map(), accidentals = [];
    all[mi].map((ev, i) => i).sort((a, b) => starts[a] - starts[b]).forEach((i) => {
      const ev = all[mi][i];
      if (!ev.rest && ev.acc) carried.set(ev.n, ev.acc);
      accidentals[i] = !ev.rest ? carried.get(ev.n) : undefined;
    });
    const fragment = (ev, from, size, continues, into) => {
      let cursor = from;
      // Tambien permite cortar una figura con puntillo; las partes de una nota quedan ligadas.
      const values = Object.keys(VALUES).flatMap((d) => [
        { d }, ...(!['w', 's', 'f'].includes(d) ? [{ d, dot: true }] : []),
      ]).sort((a, b) => length(b) - length(a));
      while (size > 0) {
        const value = values.find((v) => length(v) <= size);
        if (!value) return false;
        const part = Object.assign(clone(ev), value, { at: cursor });
        delete part.tp;
        delete part.tn;
        delete part.dot;
        if (value.dot) part.dot = true;
        size -= length(value);
        if (!ev.rest && (size > 0 || continues)) { part.tie = true; delete part.slur; }
        into.push(part);
        cursor += length(value);
      }
      return true;
    };
    for (let i = 0; i < all[mi].length; i += 1) {
      const ev = all[mi][i], start = starts[i], stop = start + length(ev);
      const continuation = Object.assign(clone(ev), accidentals[i] ? { acc: accidentals[i] } : {});
      if (start >= at) right.push(Object.assign(continuation, { at: start - at }));
      else if (stop <= at) left.push(Object.assign(clone(ev), { at: start }));
      else if (!fragment(ev, start, at - start, true, left) || !fragment(continuation, 0, stop - at, false, right)) return false;
    }
    const oldBar = score.barlines && score.barlines[mi];
    const oldWidth = score.measureWidths && score.measureWidths[mi];
    const tabs = {};
    Object.entries(score.tabs || {}).forEach(([key, column]) => {
      let [m, t] = key.split(':').map(Number);
      if (m === mi && t >= at) { m += 1; t -= at; }
      else if (m > mi) m += 1;
      tabs[m + ':' + t] = column;
    });
    // Las cejillas conservan ambos extremos al insertar el nuevo compas.
    let movedBarre;
    Object.entries(score.barres || {}).forEach(([key, barre]) => {
      const m = +key, last = barreLast(barre, m);
      if (m <= mi && last >= mi) {
        if (m === mi && barre.at >= at) {
          delete score.barres[key];
          movedBarre = Object.assign({}, barre, { at: barre.at - at });
          if (Number.isInteger(movedBarre.to) && last === mi) movedBarre.to -= at;
        } else if (last > mi || (last === mi && (barre.to || end) > at)) {
          barre.span = (barre.span || 0) + 1;
          if (last === mi && Number.isInteger(barre.to)) barre.to -= at;
        }
      }
    });
    ['navigation', 'barlines', 'keys', 'clefs', 'meters', 'barres', 'measureDurations', 'measureWidths'].forEach((name) => {
      if (score[name]) score[name] = shiftKeys(score[name], mi + 1, 1);
    });
    const nav = score.navigation?.[mi];
    if (nav) {
      const rightNav = Object.assign({}, nav);
      delete rightNav.segno;
      delete nav.dc;
      delete nav.ds;
      if (Object.keys(rightNav).length) score.navigation[mi + 1] = rightNav;
      if (!Object.keys(nav).length) delete score.navigation[mi];
    }
    if (movedBarre) score.barres[mi + 1] = movedBarre;
    if (oldWidth) {
      score.measureWidths[mi] = oldWidth * at / end;
      score.measureWidths[mi + 1] = oldWidth * (end - at) / end;
    }
    score.measureDurations = Object.assign(score.measureDurations || {}, { [mi]: at, [mi + 1]: end - at });
    score.barlines = score.barlines || {};
    score.barlines[mi] = Object.assign({ double: true }, oldBar && oldBar.start ? { start: true, end: false } : {});
    if (oldBar) {
      const closing = Object.assign({}, oldBar);
      delete closing.start;
      if (Object.keys(closing).length) score.barlines[mi + 1] = closing;
    }
    if (score.tabs) score.tabs = tabs;
    const row = rowOf(score, mi);
    score.rows[row.row].splice(mi - row.first, 1, left, right);
    return true;
  }

  // Compases de la misma fila cubiertos por la cejilla que empieza en `mi`, y compas donde termina.
  function barreLast(barre, mi) {
    return mi + (barre.span || 0);
  }

  // Cejilla: va de `at` a `to` (por defecto el final del compas, que no se guarda). Una por compas.
  // Con `span` > 0 sigue por `span` compases mas de la misma fila y `to` es el final en el ultimo.
  function setBarre(score, mi, at, fret, to, span) {
    const end = capacity(score, mi);
    span = span || 0;
    const stop = capacity(score, mi + span);
    if (to === undefined) to = stop;
    if (!Number.isInteger(mi) || mi < 0 || mi >= measures(score).length || !Number.isInteger(at) || at < 0 || at >= end) return false;
    if (!Number.isInteger(span) || span < 0 || mi + span > rowOf(score, mi).last) return false;
    if (!Number.isInteger(to) || to > stop || (span === 0 ? to <= at : to <= 0)) return false;
    if (!Number.isInteger(fret) || fret < 1 || fret > MAX_FRET) return false;
    const taken = Object.keys(score.barres || {}).some((key) => {
      const other = +key;
      return other !== mi && other <= mi + span && barreLast(score.barres[key], other) >= mi;
    });
    if (taken) return false;
    if (!score.barres) score.barres = {};
    const barre = { at, fret };
    if (span) barre.span = span;
    if (to < stop) barre.to = to;
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

  // Indicacion de compas vigente desde el ultimo cambio.
  function meterAt(score, mi) {
    let meter = meterOf(score), last = -1;
    Object.entries(score?.meters || {}).forEach(([index, value]) => {
      if (/^(0|[1-9]\d*)$/.test(index) && +index <= mi && +index > last && METERS.includes(value)) { meter = value; last = +index; }
    });
    return meter;
  }

  function pruneMeters(score) {
    let previous = meterOf(score);
    for (const mi of Object.keys(score.meters || {}).map(Number).sort((a, b) => a - b)) {
      if (mi < 1 || mi >= measures(score).length || !METERS.includes(score.meters[mi]) || score.meters[mi] === previous) delete score.meters[mi];
      else previous = score.meters[mi];
    }
    if (score.meters && !Object.keys(score.meters).length) delete score.meters;
  }

  function clefOf(score) {
    return score && Object.hasOwn(CLEFS, score.clef) ? score.clef : 'guitar';
  }

  function fifthsOf(score) {
    return score && Number.isInteger(score.fifths) && Math.abs(score.fifths) <= 7 ? score.fifths : 0;
  }

  function bottomLine(score, mi) {
    return CLEFS[mi === undefined ? clefOf(score) : clefAt(score, mi)].bottom;
  }

  // Clave vigente en el compas `mi`: la inicial, cambiada por `score.clefs` (compas -> clave) hasta el siguiente cambio.
  function clefAt(score, mi) {
    let clef = clefOf(score);
    let last = 0;
    Object.entries((score && score.clefs) || {}).forEach(([index, value]) => {
      if (+index <= mi && +index > last && Object.hasOwn(CLEFS, value)) { clef = value; last = +index; }
    });
    return clef;
  }

  // La clave nueva rige desde el compas `mi` hasta el siguiente cambio; los compases anteriores no se tocan.
  function setClef(score, mi, clef) {
    if (!Number.isInteger(mi) || mi < 0 || mi >= measures(score).length || !Object.hasOwn(CLEFS, clef)) return false;
    if (mi === 0) score.clef = clef;
    else (score.clefs = score.clefs || {})[mi] = clef;
    pruneKeys(score);
    return true;
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
    pruneClefs(score);
    pruneMeters(score);
    if (!score.keys) return;
    let previous = fifthsOf(score);
    Object.keys(score.keys).map(Number).sort((a, b) => a - b).forEach((mi) => {
      if (mi < 1 || mi >= measures(score).length || score.keys[mi] === previous) delete score.keys[mi];
      else previous = score.keys[mi];
    });
    if (!Object.keys(score.keys).length) delete score.keys;
  }

  function pruneClefs(score) {
    if (!score.clefs) return;
    let previous = clefOf(score);
    Object.keys(score.clefs).map(Number).sort((a, b) => a - b).forEach((mi) => {
      if (mi < 1 || mi >= measures(score).length || score.clefs[mi] === previous) delete score.clefs[mi];
      else previous = score.clefs[mi];
    });
    if (!Object.keys(score.clefs).length) delete score.clefs;
  }

  function keyAlter(n, score, mi) {
    const fifths = mi === undefined ? fifthsOf(score) : keyAt(score, mi);
    const order = fifths > 0 ? ['F', 'C', 'G', 'D', 'A', 'E', 'B'] : ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
    return order.slice(0, Math.abs(fifths)).includes(STEPS[n % 7]) ? Math.sign(fifths) : 0;
  }

  function capacity(score, mi) {
    if (score && score.measureDurations && Number.isInteger(mi) && Number.isInteger(score.measureDurations[mi])) return score.measureDurations[mi];
    const [beats, unit] = meterAt(score, mi).split('/').map(Number);
    return beats * DIVISIONS * 4 / unit;
  }

  // No borrar ni recortar figuras al cambiar a un compas mas corto: si lo que suena en algun compas, contado en orden,
  // no entra, el compas no cambia. Las figuras no se tocan: sus inicios musicales no dependen del compas.
  function setMeter(score, meter) {
    if (!METERS.includes(meter)) return false;
    const limit = capacity({ meter });
    if (measures(score).some((m) => measureLength(m) > limit)) return false;
    score.meter = meter;
    delete score.meters;
    Object.keys(score.measureDurations || {}).forEach((mi) => {
      if (score.measureDurations[mi] >= capacity({ meter })) delete score.measureDurations[mi];
    });
    Object.keys(score.barres || {}).forEach((mi) => {
      const barre = score.barres[mi];
      if (barre.at >= capacity(score)) removeBarre(score, mi);
      else if (barre.to >= capacity(score)) delete barre.to;
    });    return true;
  }

  function fits(measure, ev, ignore, score) {
    const others = ignore === undefined ? measure : measure.filter((_, i) => i !== ignore);
    return measureLength(others) + length(ev) <= capacity(score, score && score.rows ? measures(score).indexOf(measure) : undefined);
  }

  function canDot(measure, index, score) {
    return dotPlan(measure, index, score) !== null;
  }

  // Plan para ponerle puntillo a la figura `index`: { start, moves: [] } o null si no se puede o el compas, contado
  // en orden, ya no la admite. Con el puntillo la figura sigue donde empieza y lo que viene despues en su voz se corre;
  // `moves` queda vacio porque ninguna otra figura cambia de lugar en el orden.
  function dotPlan(measure, index, score) {
    const ev = measure[index];
    if (ev.dot === 2 || ev.tp || ev.d === 'w' || ev.d === 's' || ev.d === 'f') return null;
    if (ev.dot && !DOUBLE_DOTTABLE.includes(ev.d)) return null;
    const limit = capacity(score, score && score.rows ? measures(score).indexOf(measure) : undefined);
    const trial = settle(clone(measure));
    const dot = ev.dot ? 2 : true;
    trial[index].dot = dot;
    if (measureLength(trial) > limit) return null;
    return { start: onsets(measure)[index], moves: [], dot };
  }

  function dotStart(measure, index, score) {
    const plan = dotPlan(measure, index, score);
    return plan ? plan.start : null;
  }

  // La tablatura sale de las notas; `tabs` guarda las correcciones y las posiciones conservadas al editar: { 'compas:inicio': [6 trastes] },
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
  const accidentalFor = (alter) => alter === 2 ? '##' : alter === -2 ? 'bb' : alter === 1 ? '#' : alter === -1 ? 'b' : 'n';

  // Altura efectiva de cada figura, incluso si su alteracion viene de una nota no seleccionada.
  function pitchContexts(score, mi) {
    const measure = measures(score)[mi];
    const starts = onsets(measure);
    const accidentals = new Map();
    const result = measure.map(() => null);
    const octave = CLEFS[clefAt(score, mi)].octave || 0;
    measure.map((ev, i) => i).sort((a, b) => starts[a] - starts[b]).forEach((i) => {
      const ev = measure[i];
      if (ev.rest) return;
      if (ev.acc) accidentals.set(ev.n, ACCIDENTALS[ev.acc].alter);
      result[i] = { alter: accidentals.has(ev.n) ? accidentals.get(ev.n) : keyAlter(ev.n, score, mi), octave };
    });
    return result;
  }

  // Cada momento en que suena algo, en orden de lectura: { mi, at, key, midis } con el tono real (la clave de guitarra
  // suena una octava mas grave que la escrita). Las notas ligadas a la anterior no se vuelven a tocar.
  function attacks(score, withEvents = false) {
    const result = [];
    let tied = new Set();
    measures(score).forEach((measure, mi) => {
      const clef = CLEFS[clefAt(score, mi)];
      const starts = onsets(measure);
      const accidentals = new Map();
      const moments = new Map();
      measure.map((ev, i) => i).sort((a, b) => starts[a] - starts[b]).forEach((i) => {
        const ev = measure[i];
        if (ev.rest) return;
        if (ev.acc) accidentals.set(ev.n, ACCIDENTALS[ev.acc].alter);
        const alter = accidentals.has(ev.n) ? accidentals.get(ev.n) : keyAlter(ev.n, score, mi);
        const midi = 12 * (Math.floor(ev.n / 7) + 1) + SEMITONES[ev.n % 7] + alter + 12 * (clef.octave || 0);
        if (!moments.has(starts[i])) moments.set(starts[i], []);
        moments.get(starts[i]).push({ n: ev.n, midi, tie: !!ev.tie, ev });
      });
      [...moments.keys()].sort((a, b) => a - b).forEach((at) => {
        const all = moments.get(at);
        const notes = all.filter((note) => !tied.has(note.n));
        all.forEach((note) => { if (note.tie) tied.add(note.n); else tied.delete(note.n); });
        if (notes.length) result.push(Object.assign({ mi, at, key: mi + ':' + at, midis: notes.map((note) => note.midi) }, withEvents ? { events: notes.map((note) => note.ev) } : {}));
      });
    });
    return result;
  }

  const TAB_OPENS = [64, 59, 55, 50, 45, 40];

  // Captura lo que se ve antes de editar, asociado a las figuras y su altura real.
  function captureTabReferences(score, columns = score.tabs || {}) {
    return attacks(score, true).filter((attack) => columns[attack.key]).map((attack) => ({
      refs: attack.events.map(tabReference), midis: attack.midis, column: columns[attack.key].slice(),
    }));
  }

  // Reconstruye las claves compas:inicio despues de asentar las figuras. Si cambia
  // la altura, se deja que la digitacion automatica calcule una posicion nueva.
  function restoreTabReferences(score, saved) {
    const byRef = new Map();
    saved.forEach((entry) => entry.refs.forEach((ref, i) => byRef.set(ref, { entry, midi: entry.midis[i] })));
    const tabs = {};
    attacks(score, true).forEach((attack) => {
      const refs = attack.events.map(tabReference);
      const entries = refs.map((ref) => byRef.get(ref));
      if (entries.some((entry, i) => !entry || entry.midi !== attack.midis[i])) return;
      const first = entries[0].entry;
      if (first.refs.length === refs.length && refs.every((ref) => first.refs.includes(ref))) {
        tabs[attack.key] = first.column.slice();
        return;
      }
      // Al partir o reunir un acorde, cada nota conserva su cuerda si siguen siendo compatibles.
      const column = new Array(TAB_STRINGS).fill(null);
      for (const { entry, midi } of entries) {
        const string = entry.column.findIndex((fret, s) => fret !== null && TAB_OPENS[s] + fret === midi && column[s] === null);
        if (string < 0) return;
        column[string] = entry.column[string];
      }
      tabs[attack.key] = column;
    });
    if (Object.keys(tabs).length) score.tabs = tabs;
    else delete score.tabs;
  }

  // Descarta lo que no sea una partitura valida (por ejemplo, datos viejos o editados a mano).
  // `scale` son las divisiones de negra con que se guardaron los datos (8 antes de los tresillos).
  function sanitize(data, scale) {
    if (!data || !Array.isArray(data.rows)) return emptyScore();
    const meter = meterOf(data);
    const factor = DIVISIONS / (scale || DIVISIONS);
    let measureIndex = 0;
    const rows = data.rows.map((row) => {
      const count = Array.isArray(row) && row.length ? row.length : PER_ROW;
      const result = Array.from({ length: count }, () => []);
      (Array.isArray(row) ? row : []).forEach((measure, m) => {
        const events = [];
        const limit = capacity({ meter: meterAt(data, measureIndex + m) });
        (Array.isArray(measure) ? measure : []).forEach((raw) => {
          if (!raw || !VALUES[raw.d]) return;
          const ev = { d: raw.d };
          if (raw.rest) { ev.rest = true; if (Number.isInteger(raw.n)) ev.n = clampPitch(raw.n); }
          else if (Number.isInteger(raw.n)) ev.n = clampPitch(raw.n);
          else return;
          if (Number.isInteger(raw.tp) && raw.tp > 0 && TRIPLETABLE.includes(raw.d)) { ev.tp = raw.tp; if (TUPLETS[raw.tn] && raw.tn !== 3) ev.tn = raw.tn; }
          else if (raw.dot && raw.d !== 'w' && raw.d !== 's' && raw.d !== 'f') ev.dot = raw.dot === 2 && DOUBLE_DOTTABLE.includes(raw.d) ? 2 : true;
          if (!ev.rest && ACCIDENTALS[raw.acc]) ev.acc = raw.acc;
          if (!ev.rest && raw.dead === true) ev.dead = true;
          if (!ev.rest && raw.tie === true) ev.tie = true;
          else if (!ev.rest && raw.slur === true) ev.slur = true;
          if (Number.isInteger(raw.v) && raw.v >= 1 && raw.v <= MAX_VOICE) ev.v = raw.v;
          if (raw.beam === 'join' || raw.beam === 'break') ev.beam = raw.beam;
          if (Number.isInteger(raw.at) && raw.at >= 0) ev.at = raw.at * factor;
          if (length(ev) > limit) return;
          // `at` sigue siendo la pista guardada (sin `at`, la figura sigue a la anterior); los huecos se quitan al final.
          ev.at = hints(events.concat(ev))[events.length];
          if (!ev.rest && events.some((o) => !o.rest && o.at === ev.at && o.n === ev.n && o.acc === ev.acc)) return;
          events.push(ev);
        });
        if (measureLength(events) > limit) legacyVoices(events);
        while (measureLength(events) > limit) events.pop();
        // En el orden de la pista, como se guardaban; despues `at` pasa a ser el inicio musical, sin huecos.
        events.sort((a, b) => a.at - b.at);
        result[m] = settle(events);
      });
      measureIndex += count;
      return result;
    });
    while (rows.length < MIN_ROWS) rows.push(emptyRow());
    const total = rows.flat().length;
    const lastOf = (index) => rowOf({ rows }, index).last;
    const navigation = {};
    Object.entries(data.navigation || {}).forEach(([index, marks]) => {
      if (!/^(0|[1-9]\d*)$/.test(index) || +index >= total || !marks) return;
      NAVIGATION.forEach((mark) => { if (marks[mark] === true) setNavigation({ rows, navigation }, +index, mark); });
    });
    const barlines = {};
    Object.entries(data.barlines || {}).forEach(([index, bar]) => {
      if (!/^(0|[1-9]\d*)$/.test(index) || +index >= total || !bar) return;
      if (bar.start === true || bar.end === true) {
        barlines[index] = { start: bar.start === true, end: bar.end === true };
        if (bar.double === true && bar.end !== true) barlines[index].double = true;
      }
      else if (bar.double === true || bar.single === true) barlines[index] = { double: true };
      if (bar.hidden === true && bar.end !== true) barlines[index] = Object.assign(barlines[index] || {}, { hidden: true });
    });
    const meterContext = { meter, meters: clone(data.meters || {}), rows };
    pruneMeters(meterContext);
    const meters = meterContext.meters || {};
    const keys = {};
    let previousKey = fifthsOf(data);
    Object.entries(data.keys || {}).filter(([index]) => /^[1-9]\d*$/.test(index) && +index < total).sort((a, b) => a[0] - b[0]).forEach(([index, value]) => {
      if (!Number.isInteger(value) || Math.abs(value) > 7 || value === previousKey) return;
      keys[index] = previousKey = value;
    });
    const clefs = {};
    let previousClef = clefOf(data);
    Object.entries(data.clefs || {}).filter(([index]) => /^[1-9]\d*$/.test(index) && +index < total).sort((a, b) => a[0] - b[0]).forEach(([index, value]) => {
      if (!Object.hasOwn(CLEFS, value) || value === previousClef) return;
      clefs[index] = previousClef = value;
    });
    const barres = {};
    Object.entries(data.barres || {}).forEach(([index, barre]) => {
      if (!/^(0|[1-9]\d*)$/.test(index) || +index >= total || !barre) return;
      const at = barre.at * factor;
      const to = barre.to * factor;
      const span = barre.span || 0;
      if (!Number.isInteger(at) || at < 0 || at >= capacity(meterContext, +index)) return;
      if (!Number.isInteger(barre.fret) || barre.fret < 1 || barre.fret > MAX_FRET) return;
      if (!Number.isInteger(span) || span < 0 || +index + span > lastOf(+index)) return;
      if (Object.keys(barres).some((key) => barreLast(barres[key], +key) >= +index)) return;
      const result = { at, fret: barre.fret };
      if (span) result.span = span;
      if (Number.isInteger(to) && (span ? to > 0 : to > at) && to < capacity(meterContext, +index + span)) result.to = to;
      barres[index] = result;
    });
    const measureDurations = {};
    Object.entries(data.measureDurations || {}).forEach(([index, duration]) => {
      const size = duration * factor;
      if (/^(0|[1-9]\d*)$/.test(index) && +index < total && Number.isInteger(size) && size > 0 && size < capacity(meterContext, +index) && measureLength(rows.flat()[+index]) <= size) measureDurations[index] = size;
    });
    const measureWidths = {};
    Object.entries(data.measureWidths || {}).forEach(([index, width]) => {
      if (/^(0|[1-9]\d*)$/.test(index) && +index < total && Number.isFinite(width) && width > 0 && width <= 1) measureWidths[index] = width;
    });
    const tabs = sanitizeTabs(data.tabs, rows.reduce((sum, row) => sum + row.length, 0));
    return Object.assign(Object.keys(navigation).length ? { navigation } : {}, Object.keys(meters).length ? { meters } : {}, Object.keys(measureWidths).length ? { measureWidths } : {}, Object.keys(measureDurations).length ? { measureDurations } : {}, Object.keys(barlines).length ? { barlines } : {}, Object.keys(keys).length ? { keys } : {}, Object.keys(clefs).length ? { clefs } : {}, Object.keys(barres).length ? { barres } : {}, data.showTabs === true ? { showTabs: true } : {}, Object.keys(tabs).length ? { tabs } : {}, { meter, clef: clefOf(data), fifths: fifthsOf(data), rows }, typeof data.title === 'string' ? { title: data.title } : {}, typeof data.author === 'string' && data.author ? { author: data.author } : {});
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
  // su columna de la siguiente; el acorde comparte las de su columna. `measure` son las figuras de una sola voz,
  // en orden y con `at` = su inicio musical.
  function beamStates(measure, score) {
    const states = measure.map(() => null);
    const starts = measure.map((ev) => ev.at);
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

  // Voces del compas, de la aguda (1) a la grave: [{ end, groups: [{ at, size, rest, v, hint, indices }] }].
  // Cada grupo es una figura o un acorde; `at` es su inicio musical, `hint` el `at` guardado y `indices` las figuras
  // originales, para seleccionar las notas en el SVG. Ver el encabezado para como se reparten y se cuentan.
  function voices(measure) {
    return arrange(measure).lanes;
  }

  // Descarta las `v` guardadas y vuelve a repartir las voces (por registro y por lo que empieza junto). Si salen mas de 2,
  // la voz sobrante se une a la voz mas cercana en altura: sus figuras se intercalan en el orden de su inicio. Si lo que
  // queda no cabe en `limit`, el compas no cambia. Devuelve si tuvo que unir voces.
  function mergeVoices(measure, limit) {
    const saved = measure.map((ev) => Object.assign({}, ev));
    measure.forEach((ev) => { delete ev.v; });
    const lanes = voices(measure).map((voice) => voice.groups.slice());
    const high = (groups) => Math.max(-Infinity, ...groups.flatMap((g) => g.indices.map((i) => (measure[i].rest ? -Infinity : measure[i].n))));
    const merged = lanes.length > 2;
    while (lanes.length > 2) {
      const extra = lanes.pop();
      const target = lanes.map((lane, k) => [Math.abs(high(lane) - high(extra)), k]).sort((a, b) => a[0] - b[0])[0][1];
      lanes[target] = lanes[target].concat(extra);
    }
    if (merged) {
      // Una voz unida queda en orden desde el inicio, sin huecos ni dos figuras empezando juntas.
      lanes.forEach((lane) => {
        let cursor = 0;
        lane.sort((a, b) => a.at - b.at || a.hint - b.hint);
        lane.forEach((group) => {
          group.indices.forEach((i) => { measure[i].at = cursor; });
          cursor += group.size;
        });
      });
    }
    lanes.forEach((lane, k) => lane.forEach((g) => g.indices.forEach((i) => { measure[i].v = k + 1; })));
    if (measureLength(measure) > limit) {
      measure.forEach((ev, i) => { Object.keys(ev).forEach((key) => delete ev[key]); Object.assign(ev, saved[i]); });
      return false;
    }
    settle(measure);
    settleVoices(measure);
    return merged;
  }

  // Fija `v` en todas las figuras segun la voz en la que hoy suenan, para que agregar otra no las reparta distinto.
  function settleVoices(measure) {
    voices(measure).forEach((voice, k) => voice.groups.forEach((g) => g.indices.forEach((i) => { measure[i].v = k + 1; })));
    return measure;
  }

  // Altura con la que se dibuja un silencio puesto en `n` sobre otras figuras: nunca encima de las notas que suenan ahi.
  function restPitch(measure, ev, at, n) {
    const starts = onsets(measure);
    const end = at + length(ev);
    let result = n;
    measure.forEach((o, i) => {
      if (o.rest || starts[i] >= end || at >= starts[i] + length(o) || Math.abs(o.n - result) >= REST_CLEARANCE) return;
      result = result >= o.n ? o.n + REST_CLEARANCE : o.n - REST_CLEARANCE;
    });
    return clampPitch(result);
  }

  // Pone el silencio `ev` en `at`, clickeado a la altura `n`, sin tocar `measure`.
  // Las voces se ordenan de arriba (1) a abajo: sobre una nota el silencio queda en una voz mas aguda, bajo ella en una mas grave.
  // Usa la voz libre mas cercana en ese sentido; si no hay, abre una nueva y las voces desde ahi bajan un lugar.
  // Antes de la primera columna, antepone el silencio en la voz mas cercana y corre las figuras existentes.
  // Devuelve { measure, index }, { voice } (la voz del click) si las MAX_VOICE voces estan ocupadas en ese tiempo, o
  // { full: true } si su voz, contada en orden, ya no entra en el compas.
  function placeRest(measure, ev, at, n, score, mi, beforeFirst = false) {
    // `at` explicito sin asentar: si el silencio se esta moviendo, las demas conservan el lugar en que se ven.
    const others = measure.map((o) => clone(o));
    const h = hints(others);
    others.forEach((o, i) => { o.at = h[i]; });
    settleVoices(others);
    const rest = clone(ev);
    delete rest.v;
    delete rest.n;
    if (beforeFirst && others.length) {
      const first = Math.min(...h);
      const leading = others.filter((o) => o.at === first);
      const ref = leading.reduce((a, b) => Math.abs((b.n ?? n) - n) < Math.abs((a.n ?? n) - n) ? b : a);
      rest.v = ref.v;
      others.forEach((o) => { o.at += length(rest); });
      rest.at = 0;
      others.unshift(rest);
      settle(others);
      if (measureLength(others) > capacity(score, mi)) return { full: true };
      return { measure: others, index: 0 };
    }
    const end = at + length(ev);
    const overlaps = (o) => o.at < end && at < o.at + length(o);
    const clash = others.filter(overlaps);
    if (clash.length) {
      const pitched = clash.filter((o) => !o.rest);
      const ref = pitched.length ? pitched.reduce((a, b) => Math.abs(a.n - n) <= Math.abs(b.n - n) ? a : b) : clash[0];
      const above = pitched.length ? n > ref.n : n >= bottomLine(score, mi) + 4;
      const lanes = Math.max(...others.map((o) => o.v));
      const free = (k) => others.every((o) => o.v - 1 !== k || !overlaps(o));
      let target = -1;
      for (let k = ref.v - 1 + (above ? -1 : 1); k >= 0 && k < lanes; k += above ? -1 : 1) {
        if (free(k)) { target = k; break; }
      }
      if (target < 0) {
        if (lanes >= MAX_VOICE) return { voice: ref.v };
        target = above ? ref.v - 1 : ref.v;
        others.forEach((o) => { if (o.v - 1 >= target) o.v += 1; });
      }
      rest.v = target + 1;
      rest.n = restPitch(others, rest, at, n);
    }
    const index = insertAt(others, rest, at);
    if (!clash.length) settleVoices(others);
    if (measureLength(others) > capacity(score, mi)) return { full: true };
    return { measure: others, index };
  }

  // Inserta una nota; si cae en un acorde existente (mismo inicio y duracion) toma su voz.
  // Con varios acordes posibles (uno por voz), el mas cercano en altura.
  function insertNote(measure, ev, at) {
    const h = hints(measure);
    const chords = measure.filter((o, i) => !o.rest && h[i] === at && length(o) === length(ev));
    if (chords.length) {
      const chord = chords.reduce((a, b) => (Math.abs(b.n - ev.n) < Math.abs(a.n - ev.n) ? b : a));
      if (Number.isInteger(chord.v)) ev.v = chord.v;
      else delete ev.v;
    }
    return insertAt(measure, ev, at);
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
    const joined = picked.every((g, k) => lane.groups[first + k] === g && (k === 0 || tidy(picked[k - 1].at + picked[k - 1].size) === tidy(g.at)));
    return joined ? { measure, lane, groups: picked, mi: sel[0].mi } : null;
  }

  // Seleccion de 2 a 9 figuras seguidas del mismo valor: ofrece el grupo que corresponde a su cantidad.
  function tripletRun(score, sel) {
    const r = run(score, sel);
    if (!r || !TUPLETS[r.groups.length]) return null;
    const d = r.measure[r.groups[0].indices[0]].d;
    const plain = r.groups.every((g) => g.indices.every((i) => {
      const ev = r.measure[i];
      return ev.d === d && !ev.dot && !ev.tp;
    }));
    return plain && TRIPLETABLE.includes(d) ? r : null;
  }

  function untripletRun(score, sel) {
    const r = run(score, sel);
    if (!r || !r.groups.every((g) => g.indices.every((i) => r.measure[i].tp))) return null;
    const size = tupletSize(r.measure[r.groups[0].indices[0]]);
    return r.groups.every((g) => g.indices.every((i) => tupletSize(r.measure[i]) === size)) ? Object.assign(r, { size }) : null;
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
    const states = beamStates(order.map((i) => Object.assign({}, r.measure[i], { at: starts[i] })), { meter: meterAt(score, measures(score).indexOf(r.measure)) });
    const joins = r.groups.slice(0, -1).map((g) => {
      const state = states[order.indexOf(g.indices[0])];
      return !!state && (state[1] === 'begin' || state[1] === 'continue');
    });
    return Object.assign(r, { joins });
  }

  // 'triplet' para 3 figuras (el nombre de siempre) y 'tupletN' para las demas.
  const tupletAction = (size) => (size === 3 ? 'triplet' : 'tuplet' + size);

  // Acciones disponibles para una seleccion de figuras [{ mi, i }], en el orden en que se ofrecen.
  function selectionActions(score, sel) {
    const actions = [];
    const group = tripletRun(score, sel);
    if (group) actions.push(tupletAction(group.groups.length));
    const loose = untripletRun(score, sel);
    if (loose) actions.push('un' + tupletAction(loose.size));
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
    if (/^(triplet|tuplet\d)$/.test(action)) {
      // El orden no cambia: las figuras se acortan y lo que sigue en su voz se adelanta.
      const r = tripletRun(score, sel);
      const size = r.groups.length;
      const id = Math.max(0, ...r.measure.map((ev) => ev.tp || 0)) + 1;
      settle(r.measure);
      r.groups.forEach((g) => {
        eachEvent(r, g, (ev) => { ev.tp = id; if (size === 3) delete ev.tn; else ev.tn = size; });
      });
      settle(r.measure);
      return true;
    }
    if (/^(untriplet|untuplet\d)$/.test(action)) {
      // Las figuras se alargan y lo que sigue en su voz se corre; no se hace si la voz deja de entrar en el compas.
      const r = untripletRun(score, sel);
      settle(r.measure);
      const saved = clone(r.measure);
      r.groups.forEach((g) => eachEvent(r, g, (ev) => { delete ev.tp; delete ev.tn; }));
      if (measureLength(r.measure) > capacity(score, sel[0].mi)) {
        r.measure.splice(0, r.measure.length, ...saved);
        return false;
      }
      settle(r.measure);
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
      const auto = autoBeam(r.measure[g.indices[0]], starts[g.indices[0]], r.measure[right.indices[0]], starts[right.indices[0]], { meter: meterAt(score, measures(score).indexOf(r.measure)) });
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
  function noteXml(ev, id, beams, chord, voice, alter, roles, stem, mult) {
    const dur = length(ev);
    const base = VALUES[ev.d];
    const ties = (roles && roles.tie) || [];
    const slurs = (roles && roles.slur) || [];
    const tuplet = roles && roles.tuplet;
    let xml = `<note id="${id}">`;
    if (chord) xml += '<chord/>';
    if (ev.rest) {
      xml += Number.isInteger(ev.n) ? `<rest><display-step>${STEPS[ev.n % 7]}</display-step><display-octave>${Math.floor(ev.n / 7) - 1}</display-octave></rest>` : '<rest/>';
    } else {
      xml += `<pitch><step>${STEPS[ev.n % 7]}</step>${alter ? `<alter>${alter}</alter>` : ''}` +
        `<octave>${Math.floor(ev.n / 7) - 1}</octave></pitch>`;
    }
    xml += `<duration>${dur * mult}</duration>${ties.map((type) => `<tie type="${type}"/>`).join('')}` +
      `<voice>${voice}</voice><type>${TYPES[base]}</type>${ev.dot === 2 ? '<dot/><dot/>' : ev.dot ? '<dot/>' : ''}`;
    if (!ev.rest && ev.acc) xml += `<accidental>${ACCIDENTALS[ev.acc].name}</accidental>`;
    if (ev.tp) xml += `<time-modification><actual-notes>${tupletSize(ev)}</actual-notes><normal-notes>${TUPLETS[tupletSize(ev)]}</normal-notes></time-modification>`;
    if (!ev.rest && stem) xml += `<stem>${stem}</stem>`;
    if (!ev.rest && ev.dead) xml += '<notehead>x</notehead>';
    if (beams) Object.keys(beams).forEach((level) => { xml += `<beam number="${level}">${beams[level]}</beam>`; });
    const marks = ties.map((type) => `<tied type="${type}"/>`).concat(slurs.map((type) => `<slur type="${type}" number="1"/>`));
    if (tuplet) (tuplet === 'both' ? ['start', 'stop'] : [tuplet]).forEach((type) => { marks.push(`<tuplet type="${type}"/>`); });
    if (marks.length) xml += `<notations>${marks.join('')}</notations>`;
    return xml + '</note>';
  }

  // Con varias voces las plicas se separan por convencion: las agudas hacia arriba y la mas grave hacia abajo.
  const stemOf = (voice, count) => (count < 2 ? null : voice < count - 1 ? 'up' : 'down');

  function toMusicXml(score) {
    const all = measures(score);
    const clef = CLEFS[clefOf(score)];
    const mult = all.some((measure) => measure.some((ev) => ev.tp && tupletSize(ev) !== 3)) ? MULTIPLIER : 1;
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
    const endings = navigationEndings(score);
    all.forEach((measure, mi) => {
      const [beats, unit] = meterAt(score, mi).split('/');
      xml += `<measure number="${mi + 1}" id="m${mi}"${capacity(score, mi) < capacity({ meter: meterAt(score, mi) }) ? ' implicit="yes"' : ''}>`;
      if (rowFirsts.has(mi)) xml += '<print new-system="yes"/>';
      if (mi === 0) {
        xml += `<attributes><divisions>${DIVISIONS * mult}</divisions><key><fifths>${fifthsOf(score)}</fifths></key>` +
          `<time><beats>${beats}</beats><beat-type>${unit}</beat-type></time>` +
          `<clef><sign>${clef.sign}</sign><line>${clef.line}</line>${clef.octave ? `<clef-octave-change>${clef.octave}</clef-octave-change>` : ''}</clef></attributes>`;
      }
      if (mi > 0 && (meterAt(score, mi) !== meterAt(score, mi - 1) || keyAt(score, mi) !== keyAt(score, mi - 1) || clefAt(score, mi) !== clefAt(score, mi - 1))) {
        const changed = clefAt(score, mi) !== clefAt(score, mi - 1) ? CLEFS[clefAt(score, mi)] : null;
        xml += '<attributes>' + (keyAt(score, mi) !== keyAt(score, mi - 1) ? `<key><fifths>${keyAt(score, mi)}</fifths></key>` : '') +
          (meterAt(score, mi) !== meterAt(score, mi - 1) ? `<time><beats>${beats}</beats><beat-type>${unit}</beat-type></time>` : '') +
          (changed ? `<clef><sign>${changed.sign}</sign><line>${changed.line}</line>${changed.octave ? `<clef-octave-change>${changed.octave}</clef-octave-change>` : ''}</clef>` : '') + '</attributes>';
      }
      const bar = score.barlines && score.barlines[mi];
      const nav = score.navigation?.[mi] || {};
      const endingStart = endings.find((ending) => ending.first === mi);
      const endingStop = endings.find((ending) => ending.last === mi);
      if (bar?.start || endingStart) xml += '<barline location="left">' +
        (endingStart ? `<ending number="${endingStart.number}" type="start"/>` : '') +
        (bar?.start ? '<repeat direction="forward"/>' : '') + '</barline>';
      if (nav.segno) xml += `<direction id="nav-segno-${mi}" placement="above"><direction-type><segno/></direction-type><sound segno="segno"/></direction>`;

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
        ...(barre.span ? [] : [stop(Number.isInteger(barre.to) ? barre.to : capacity(score, mi))]),
      ] : closing ? [stop(Number.isInteger(closing.to) ? closing.to : capacity(score, mi))] : [];
      const stopXml = !barre && closing ? marks[0].xml : marks.length > 1 ? marks[1].xml : '';
      let barreOpen = !barre && Boolean(closing);
      let barreClosed = false;
      voices(measure).forEach((voice, vi, all) => {
        if (vi > 0) xml += `<backup><duration>${capacity(score, mi) * mult}</duration></backup>`;
        const indices = voice.groups.flatMap((g) => g.indices);
        const events = indices.map((i) => Object.assign({}, measure[i], { at: starts[i] }));
        const beams = beamStates(events, { meter: meterAt(score, mi) });
        const pad = (from, to) => {
          padding(to - from).forEach((size) => {
            xml += `<note print-object="no"><rest/><duration>${size * mult}</duration><voice>${vi + 1}</voice>${TYPES[size] ? `<type>${TYPES[size]}</type>` : ''}</note>`;
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
            xml += noteXml(measure[i], `e${mi}-${i}`, beams[index++], ci > 0, vi + 1, alters[i], Object.assign({}, own, { tuplet }), stemOf(vi, all.length), mult);
          });
          cursor = group.at + group.size;
        });
        hidden(cursor, capacity(score, mi));
        if (barreOpen && !barreClosed && vi === all.length - 1) xml += stopXml;
      });
      if (nav.dc || nav.ds) xml += `<direction id="nav-jump-${mi}" placement="above"><direction-type><words justify="right">${nav.dc ? 'D.C.' : 'D.S.'}</words></direction-type><sound ${nav.dc ? 'dacapo="yes"' : 'dalsegno="segno"'}/></direction>`;
      if (bar?.end || bar?.hidden || bar?.double || endingStop) xml += '<barline location="right">' +
        (bar?.end ? '' : bar?.hidden ? '<bar-style>none</bar-style>' : bar?.double ? '<bar-style>light-light</bar-style>' : '') +
        (endingStop ? `<ending number="${endingStop.number}" type="${endingStop.closed ? 'stop' : 'discontinue'}"/>` : '') +
        (bar?.end ? '<repeat direction="backward"/>' : '') + '</barline>';
      xml += '</measure>';
    });
    return xml + '</part></score-partwise>\n';
  }

  // Nombre de cada figura para el comando `voces` de la consola del navegador.
  const FIGURES = {
    w: ['redonda', 'redondas'], h: ['blanca', 'blancas'], q: ['negra', 'negras'], e: ['corchea', 'corcheas'],
    s: ['semicorchea', 'semicorcheas'], f: ['fusa', 'fusas'],
  };
  const MULTIPLES = { 2: 'doble ', 3: 'triple ' };

  function figureName(ev) {
    const name = FIGURES[ev.d][0] + (ev.dot === 2 ? ' con doble puntillo' : ev.dot ? ' con puntillo' : '');
    return ev.rest ? 'silencio de ' + name : name;
  }

  // Figuras unidas por una barra: "doble corchea" (dos), "triple corchea" (tres), "4 corcheas unidas"; si no son
  // todas iguales, cada una por su nombre.
  function beamedName(evs) {
    const first = evs[0];
    if (!evs.every((ev) => ev.d === first.d && (ev.dot || 0) === (first.dot || 0))) return evs.map(figureName).join(' + ');
    const [one, many] = FIGURES[first.d];
    const dotted = first.dot === 2 ? ' con doble puntillo' : first.dot ? ' con puntillo' : '';
    return MULTIPLES[evs.length] ? MULTIPLES[evs.length] + one + dotted : evs.length + ' ' + many + dotted + ' unidas';
  }

  // Figuras de una voz en orden: un tresillo o una barra cuentan como una sola.
  function voiceFigures(measure, voice, score) {
    const starts = onsets(measure);
    const indices = voice.groups.flatMap((g) => g.indices);
    const beams = beamStates(indices.map((i) => Object.assign({}, measure[i], { at: starts[i] })), { meter: meterAt(score, measures(score).indexOf(measure)) });
    const items = voice.groups.map((g) => ({ ev: measure[g.indices[0]], beam: beams[indices.indexOf(g.indices[0])] }));
    const names = [];
    for (let k = 0; k < items.length; k += 1) {
      const { ev, beam } = items[k];
      let end = k;
      if (ev.tp) {
        while (end + 1 < items.length && items[end + 1].ev.tp === ev.tp) end += 1;
        names.push(TUPLET_NAMES[tupletSize(ev)] + ' de ' + FIGURES[ev.d][1]);
      } else if (beam && beam[1] === 'begin') {
        while (end + 1 < items.length && items[end].beam[1] !== 'end') end += 1;
        names.push(beamedName(items.slice(k, end + 1).map((item) => item.ev)));
      } else {
        names.push(figureName(ev));
      }
      k = end;
    }
    return names;
  }

  // Una linea por voz con las figuras de cada compas separadas por comas y los compases por " | ".
  function voicesText(score) {
    const bars = measures(score).map((measure) => ({ measure, lanes: voices(measure).filter((voice) => voice.groups.length) }));
    while (bars.length && !bars[bars.length - 1].lanes.length) bars.pop(); // sin los compases vacios del final
    const count = Math.max(0, ...bars.map((bar) => bar.lanes.length));
    return Array.from({ length: count }, (_, k) => 'voz ' + (k + 1) + ': ' + bars.map(({ measure, lanes }) => (
      lanes[k] ? voiceFigures(measure, lanes[k], score).join(', ') : '-'
    )).join(' | ')).join('\n');
  }

  return {
    voicesText, TUPLETS, tupletSize, DIVISIONS, MEASURE, METERS, CLEFS, GRID, PER_ROW, MIN_ROWS, BOTTOM_LINE, LOWEST, HIGHEST, VALUES, ACCIDENTALS,
    captureTabReferences, restoreTabReferences, copySelection, pasteSelection, duplicateSelection, length, gridOf, hints, onsets, settle, placement, insertAt, insertMany, placeRest, insertNote, restPitch, settleVoices, mergeVoices, voices, measureLength, clampPitch, emptyRow, emptyScore, clone, measures, rowStarts, rowOf, moveMeasure, addMeasure, insertMeasure, removeMeasure, removeMeasureAt, fits, canDot, dotStart, dotPlan,
    meterOf, meterAt, clefOf, clefAt, setClef, fifthsOf, bottomLine, keyAt, setKey, pruneKeys, keyAlter, capacity, setMeter, setNavigation, removeNavigation, navigationEndings, setBarline, removeBarline, setBarre, removeBarre, MAX_FRET, sanitize, sanitizeTabs, attacks, toMusicXml,
    links, selectionActions, applySelection, sequence,
  };
});
