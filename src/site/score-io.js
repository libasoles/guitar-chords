/* score-io.js — Cargar y exportar partituras: MusicXML (leer) y MIDI (leer y escribir).
   El MusicXML de salida ya lo arma ScoreModel.toMusicXml; aca solo se traduce desde y hacia otros formatos.
   Sin estado: recibe el modelo (`M`) y devuelve partituras ya saneadas. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScoreIO = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TICKS = 480; // MIDI: ticks por negra al escribir
  const STEP_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  const TYPE_VALUE = { whole: 'w', half: 'h', quarter: 'q', eighth: 'e', '16th': 's', '32nd': 'f' };
  const ACC_NAME = { sharp: '#', flat: 'b', natural: 'n', 'double-sharp': '##', 'flat-flat': 'bb', 'sharp-sharp': '##' };
  const ACC_ALTER = { '#': 1, b: -1, n: 0, '##': 2, bb: -2 };
  const SHARP_SPELL = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
  const FLAT_SPELL = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
  const SEMITONES = [0, 2, 4, 5, 7, 9, 11];

  // ---- MusicXML -> partitura ----------------------------------------------

  function child(node, name) {
    return Array.from(node.children).find((c) => c.localName === name) || null;
  }

  function children(node, name) {
    return Array.from(node.children).filter((c) => c.localName === name);
  }

  function text(node, name) {
    const c = child(node, name);
    return c ? c.textContent.trim() : '';
  }

  function clefName(sign, line, change) {
    if (sign === 'F') return 'bass';
    if (sign === 'C') return line === 4 ? 'tenor' : 'alto';
    return change === -1 ? 'guitar' : 'treble';
  }

  // Valor y puntillo de una nota que dura `size` (divisiones de negra del modelo), o null si no se puede escribir.
  function figureFor(M, size) {
    for (const d of Object.keys(M.VALUES)) {
      if (M.VALUES[d] === size) return { d };
      if (d !== 'w' && d !== 's' && d !== 'f' && M.VALUES[d] * 1.5 === size) return { d, dot: true };
    }
    return null;
  }

  function parseMusicXml(source, M) {
    const doc = new DOMParser().parseFromString(source, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('xml');
    const root = doc.documentElement;
    if (root.localName !== 'score-partwise') throw new Error('xml');
    const part = child(root, 'part');
    if (!part) throw new Error('xml');

    const score = M.emptyScore();
    const title = text(child(root, 'work') || root, 'work-title') || text(root, 'movement-title');
    if (title) score.title = title;
    const identification = child(root, 'identification');
    const composer = identification && children(identification, 'creator').find((c) => c.getAttribute('type') === 'composer');
    if (composer) score.author = composer.textContent.trim();

    let divisions = 1;
    const flat = [];
    const barlines = {};
    const meters = {};
    const keys = {};
    const clefs = {};
    let meter = '4/4';
    let currentClef = M.clefOf(score);
    let currentFifths = 0;

    children(part, 'measure').forEach((measureNode, mi) => {
      const events = [];
      let cursor = 0; // en divisiones del archivo
      let last = 0; // inicio de la ultima nota (para los acordes)
      let tuplet = 0;
      let tupletLeft = 0;
      const voices = new Map();

      Array.from(measureNode.children).forEach((node) => {
        const name = node.localName;
        if (name === 'attributes') {
          const div = child(node, 'divisions');
          if (div && +div.textContent > 0) divisions = +div.textContent;
          const key = child(node, 'key');
          if (key && child(key, 'fifths')) {
            const fifths = parseInt(text(key, 'fifths'), 10);
            if (Math.abs(fifths) <= 7) {
              if (mi === 0) currentFifths = score.fifths = fifths;
              else if (fifths !== currentFifths) { keys[mi] = fifths; currentFifths = fifths; }
            }
          }
          const time = child(node, 'time');
          if (time) {
            const value = text(time, 'beats') + '/' + text(time, 'beat-type');
            if (M.METERS.includes(value)) {
              if (mi === 0) meter = score.meter = value;
              else if (value !== meter) { meters[mi] = value; meter = value; }
            }
          }
          const clef = child(node, 'clef');
          if (clef) {
            const number = clef.getAttribute('number');
            if (!number || number === '1') {
              const name2 = clefName(text(clef, 'sign'), parseInt(text(clef, 'line'), 10), parseInt(text(clef, 'clef-octave-change'), 10));
              if (mi === 0) currentClef = score.clef = name2;
              else if (name2 !== currentClef) { clefs[mi] = name2; currentClef = name2; }
            }
          }
        } else if (name === 'backup') {
          cursor -= parseInt(text(node, 'duration'), 10) || 0;
        } else if (name === 'forward') {
          cursor += parseInt(text(node, 'duration'), 10) || 0;
        } else if (name === 'barline') {
          const repeat = child(node, 'repeat');
          const style = text(node, 'bar-style');
          const at = node.getAttribute('location') === 'left' ? 'start' : 'end';
          if (repeat) {
            const bar = barlines[mi] = barlines[mi] || {};
            if (repeat.getAttribute('direction') === 'forward') bar.start = true;
            else bar.end = true;
          } else if (at === 'end' && style === 'light-light') {
            barlines[mi] = Object.assign(barlines[mi] || {}, { double: true });
          }
        } else if (name === 'note') {
          const duration = parseInt(text(node, 'duration'), 10) || 0;
          const chord = !!child(node, 'chord');
          const grace = !!child(node, 'grace');
          const start = chord ? last : cursor;
          if (!chord) last = cursor;
          if (!chord && !grace) cursor += duration;
          if (grace) return;
          const size = duration * M.DIVISIONS / divisions;
          const rest = !!child(node, 'rest');
          const ev = {};
          const typeName = text(node, 'type');
          const modification = child(node, 'time-modification');
          let figure = null;
          if (TYPE_VALUE[typeName]) {
            ev.d = TYPE_VALUE[typeName];
            const dots = children(node, 'dot').length;
            if (dots && !modification) ev.dot = dots > 1 && (ev.d === 'h' || ev.d === 'q') ? 2 : true;
          } else if (!modification) {
            figure = figureFor(M, size);
            if (!figure && rest && size === M.MEASURE) figure = { d: 'w' };
            if (!figure) return;
            Object.assign(ev, figure);
          } else {
            return;
          }
          if (modification) {
            const actual = parseInt(text(modification, 'actual-notes'), 10);
            if (!M.TUPLETS[actual] || !['q', 'e', 's'].includes(ev.d)) return;
            if (!tupletLeft) { tuplet += 1; tupletLeft = actual; }
            ev.tp = tuplet;
            if (actual !== 3) ev.tn = actual;
            tupletLeft -= 1;
          }
          if (rest) {
            ev.rest = true;
            const step = child(node, 'rest') && text(child(node, 'rest'), 'display-step');
            if (step) ev.n = 7 * (parseInt(text(child(node, 'rest'), 'display-octave'), 10) + 1) + STEP_INDEX[step];
          } else {
            const pitch = child(node, 'pitch');
            if (!pitch || !(text(pitch, 'step') in STEP_INDEX)) return;
            ev.n = 7 * (parseInt(text(pitch, 'octave'), 10) + 1) + STEP_INDEX[text(pitch, 'step')];
            const acc = ACC_NAME[text(node, 'accidental')];
            if (acc) ev.acc = acc;
            if (children(node, 'tie').some((t) => t.getAttribute('type') === 'start')) ev.tie = true;
            else {
              const notations = child(node, 'notations');
              if (notations && children(notations, 'slur').some((s) => s.getAttribute('type') === 'start')) ev.slur = true;
            }
            const head = child(node, 'notehead');
            if (head && head.textContent.trim() === 'x') ev.dead = true;
          }
          const voice = text(node, 'voice') || '1';
          if (!voices.has(voice)) voices.set(voice, voices.size + 1);
          const v = voices.get(voice);
          if (v <= M.MAX_VOICE) ev.v = v;
          ev.at = Math.round(start * M.DIVISIONS / divisions);
          events.push(ev);
        }
      });
      // Conservar tambien la voz unica: los <chord> importados son decisiones explicitas de notacion.
      flat.push(events);
    });

    if (!flat.length) throw new Error('xml');
    score.rows = [];
    for (let i = 0; i < flat.length; i += M.PER_ROW) {
      const row = flat.slice(i, i + M.PER_ROW);
      while (row.length < M.PER_ROW) row.push([]);
      score.rows.push(row);
    }
    if (Object.keys(barlines).length) score.barlines = barlines;
    if (Object.keys(meters).length) score.meters = meters;
    if (Object.keys(keys).length) score.keys = keys;
    if (Object.keys(clefs).length) score.clefs = clefs;
    return M.sanitize(score);
  }

  // ---- MIDI -> partitura --------------------------------------------------

  function readVarLen(bytes, pos) {
    let value = 0;
    let byte;
    do {
      byte = bytes[pos.i++];
      value = (value << 7) | (byte & 0x7f);
    } while (byte & 0x80 && pos.i < bytes.length);
    return value;
  }

  function parseMidiFile(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (at) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
    if (bytes.length < 14 || tag(0) !== 'MThd') throw new Error('midi');
    const division = view.getUint16(12);
    if (division & 0x8000) throw new Error('midi');
    const notes = [];
    let meter = null;
    let fifths = null;
    let at = 8 + view.getUint32(4);
    while (at + 8 <= bytes.length) {
      const length = view.getUint32(at + 4);
      const end = Math.min(at + 8 + length, bytes.length);
      if (tag(at) === 'MTrk') {
        const pos = { i: at + 8 };
        const open = new Map();
        let tick = 0;
        let status = 0;
        while (pos.i < end) {
          tick += readVarLen(bytes, pos);
          let first = bytes[pos.i];
          if (first === undefined) break;
          if (first & 0x80) { status = first; pos.i += 1; }
          if (status === 0xff) {
            const type = bytes[pos.i++];
            const size = readVarLen(bytes, pos);
            if (type === 0x58 && !meter) meter = [bytes[pos.i], 2 ** bytes[pos.i + 1]];
            if (type === 0x59 && fifths === null) fifths = (bytes[pos.i] << 24) >> 24;
            pos.i += size;
          } else if (status === 0xf0 || status === 0xf7) {
            pos.i += readVarLen(bytes, pos);
          } else {
            const kind = status & 0xf0;
            const channel = status & 0x0f;
            const a = bytes[pos.i++];
            const b = kind === 0xc0 || kind === 0xd0 ? 0 : bytes[pos.i++];
            if (kind === 0x90 && b > 0) {
              open.set(channel * 128 + a, tick);
            } else if (kind === 0x80 || (kind === 0x90 && b === 0)) {
              const key = channel * 128 + a;
              if (open.has(key) && channel !== 9) notes.push({ midi: a, start: open.get(key), end: tick });
              open.delete(key);
            }
          }
        }
      }
      at = end;
    }
    return { notes, division, meter, fifths };
  }

  // Descompone una duracion (multiplo de la semicorchea) en figuras que existen en el modelo, de mayor a menor.
  function splitDuration(M, size) {
    const options = [];
    Object.keys(M.VALUES).forEach((d) => {
      options.push({ d, size: M.VALUES[d] });
      if (d !== 'w' && d !== 's' && d !== 'f') options.push({ d, dot: true, size: M.VALUES[d] * 1.5 });
    });
    options.sort((a, b) => b.size - a.size);
    const result = [];
    let left = size;
    while (left >= M.GRID) {
      const pick = options.find((o) => o.size <= left && o.size % M.GRID === 0);
      if (!pick) break;
      result.push(pick);
      left -= pick.size;
    }
    return result;
  }

  function parseMidi(buffer, M) {
    const { notes, division, meter, fifths } = parseMidiFile(buffer);
    if (!notes.length) throw new Error('midi');
    const score = M.emptyScore();
    const name = meter ? meter[0] + '/' + meter[1] : '4/4';
    if (M.METERS.includes(name)) score.meter = name;
    if (fifths !== null && Math.abs(fifths) <= 7) score.fifths = fifths;
    const capacity = M.capacity(score, 0);
    const clef = M.CLEFS[score.clef];
    const unit = M.DIVISIONS / division;
    const quant = (ticks) => Math.round(ticks * unit / M.GRID) * M.GRID;

    // Todo lo que empieza junto es un acorde que dura hasta la siguiente entrada (o lo que dure su nota mas larga).
    const chords = new Map();
    notes.forEach((note) => {
      const start = quant(note.start);
      const end = Math.max(quant(note.end), start + M.GRID);
      const chord = chords.get(start) || { start, end: start, midis: new Set() };
      chord.end = Math.max(chord.end, end);
      chord.midis.add(note.midi);
      chords.set(start, chord);
    });
    const list = [...chords.values()].sort((a, b) => a.start - b.start);
    list.forEach((chord, i) => { if (list[i + 1]) chord.end = Math.min(chord.end, list[i + 1].start); });

    const measures = [];
    const place = (start, size, make) => {
      let at = start;
      let left = size;
      const pieces = [];
      while (left > 0) {
        const mi = Math.floor(at / capacity);
        const room = capacity - (at - mi * capacity);
        const take = Math.min(left, room);
        splitDuration(M, take).forEach((figure, k, all) => pieces.push({ mi, figure, last: k === all.length - 1 && take === left }));
        at += take;
        left -= take;
        if (!splitDuration(M, take).length) break;
      }
      pieces.forEach((piece, k) => {
        measures[piece.mi] = measures[piece.mi] || [];
        make(piece.figure, k < pieces.length - 1).forEach((ev) => measures[piece.mi].push(ev));
      });
    };

    let cursor = 0;
    const spelled = score.fifths >= 0 ? SHARP_SPELL : FLAT_SPELL;
    list.forEach((chord) => {
      if (chord.start > cursor) place(cursor, chord.start - cursor, (figure) => [Object.assign({ d: figure.d, rest: true }, figure.dot ? { dot: true } : {})]);
      const midis = [...chord.midis].sort((a, b) => a - b);
      place(chord.start, chord.end - chord.start, (figure, tied) => midis.map((midi) => {
        const written = midi - 12 * (clef.octave || 0);
        const [step, alter] = spelled[written % 12];
        const ev = { d: figure.d, n: 7 * (Math.floor(written / 12) - 1) + step, alter };
        if (figure.dot) ev.dot = true;
        if (tied) ev.tie = true;
        return ev;
      }));
      cursor = chord.end;
    });
    // Completa el ultimo compas con silencio y arma los accidentales segun la armadura, compas a compas.
    const total = Math.max(1, Math.ceil(cursor / capacity));
    if (cursor < total * capacity) place(cursor, total * capacity - cursor, (figure) => [Object.assign({ d: figure.d, rest: true }, figure.dot ? { dot: true } : {})]);
    const flat = Array.from({ length: total }, (_, mi) => {
      const state = new Map();
      return (measures[mi] || []).map((ev) => {
        if (ev.rest) return ev;
        const { alter } = ev;
        delete ev.alter;
        const current = state.has(ev.n) ? state.get(ev.n) : M.keyAlter(ev.n, score);
        if (current !== alter) {
          ev.acc = alter === 0 ? 'n' : alter === 1 ? '#' : 'b';
          state.set(ev.n, alter);
        }
        return ev;
      });
    });
    score.rows = [];
    for (let i = 0; i < flat.length; i += M.PER_ROW) {
      const row = flat.slice(i, i + M.PER_ROW);
      while (row.length < M.PER_ROW) row.push([]);
      score.rows.push(row);
    }
    return M.sanitize(score);
  }

  // ---- partitura -> MIDI --------------------------------------------------

  function varLen(value) {
    const out = [value & 0x7f];
    while ((value >>= 7)) out.unshift((value & 0x7f) | 0x80);
    return out;
  }

  function toMidi(score, M) {
    const all = M.measures(score);
    const sounding = [];
    const tied = new Map(); // altura -> nota que sigue sonando por una ligadura
    let origin = 0;
    all.forEach((measure, mi) => {
      const clef = M.CLEFS[M.clefAt(score, mi)];
      const starts = M.onsets(measure);
      const accidentals = new Map();
      const order = measure.map((ev, i) => i).sort((a, b) => starts[a] - starts[b]);
      order.forEach((i) => {
        const ev = measure[i];
        if (ev.rest) return;
        if (ev.acc) accidentals.set(ev.n, M.ACCIDENTALS[ev.acc].alter);
        const alter = accidentals.has(ev.n) ? accidentals.get(ev.n) : M.keyAlter(ev.n, score, mi);
        const midi = 12 * (Math.floor(ev.n / 7) + 1) + SEMITONES[ev.n % 7] + alter + 12 * (clef.octave || 0);
        const start = origin + starts[i];
        const size = M.length(ev);
        let note = tied.get(midi);
        if (note && note.end === start) note.end = start + size;
        else sounding.push(note = { midi, start, end: start + size });
        if (ev.tie) tied.set(midi, note);
        else tied.delete(midi);
      });
      origin += M.capacity(score, mi);
    });

    const events = [];
    sounding.forEach((note) => {
      events.push({ tick: Math.round(note.start * TICKS / M.DIVISIONS), order: 1, data: [0x90, note.midi & 0x7f, 80] });
      events.push({ tick: Math.round(note.end * TICKS / M.DIVISIONS), order: 0, data: [0x80, note.midi & 0x7f, 0] });
    });
    events.sort((a, b) => a.tick - b.tick || a.order - b.order);

    const [beats, unit] = M.meterAt(score, 0).split('/').map(Number);
    const track = [];
    const meta = (type, data) => track.push(0, 0xff, type, ...varLen(data.length), ...data);
    if (score.title) meta(0x03, Array.from(new TextEncoder().encode(score.title)));
    meta(0x51, [0x07, 0xa1, 0x20]); // 120 negras por minuto
    meta(0x58, [beats, Math.log2(unit), 24, 8]);
    meta(0x59, [M.keyAt(score, 0) & 0xff, 0]);
    track.push(0, 0xc0, 24); // guitarra de cuerdas de nylon
    let previous = 0;
    events.forEach((ev) => {
      track.push(...varLen(ev.tick - previous), ...ev.data);
      previous = ev.tick;
    });
    track.push(0, 0xff, 0x2f, 0);

    const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, TICKS >> 8, TICKS & 0xff];
    const size = track.length;
    return new Uint8Array([...header, 0x4d, 0x54, 0x72, 0x6b, size >>> 24, (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff, ...track]);
  }

  return { parseMusicXml, parseMidi, toMidi };
});
