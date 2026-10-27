/* score-fingering.js — Digitacion automatica para la tablatura de /partitura, al vuelo y sin servidor.
   Version reducida de backend/engine/fingering.py (criterios en docs/criterios-de-digitacion.md): una celda es
   [cuerda, traste] con la cuerda 0 como la mas aguda. Se elige por Viterbi la secuencia mas barata:
   1. dos notas distintas seguidas no comparten cuerda (la primera dejaria de sonar al pisar la segunda);
   2. una nota repetida se queda en su cuerda;
   3. la mano se mueve poco y prefiere las primeras posiciones;
   4. un acorde cabe en una posicion (cuatro trastes) con las notas mas graves en las cuerdas mas graves. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScoreFingering = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const OPENS = [64, 59, 55, 50, 45, 40]; // E4 B3 G3 D3 A2 E2, de la 1a a la 6a cuerda
  const MAX_FRET = 12;
  const MAX_SPAN = 4;
  const MAX_OPTIONS = 40;
  const SAME_STRING = 8;
  const REPEAT_MOVED = 3;
  const HIGH_FRET = 0.4; // por traste sobre el cuarto
  const HAND_MOVE = 0.6; // por traste de desplazamiento de la mano

  const hand = (option) => {
    const fretted = option.filter((cell) => cell[1] > 0).map((cell) => cell[1]);
    return fretted.length ? Math.min(...fretted) : null;
  };

  const own = (option) => {
    const h = hand(option);
    return h ? HIGH_FRET * Math.max(0, h - 4) : 0;
  };

  // Todas las formas de tocar estas notas a la vez: cada una en su cuerda, las graves abajo, en una posicion.
  function shapes(midis) {
    const notes = midis.slice().sort((a, b) => b - a);
    const found = [];
    (function place(i, from, cells) {
      if (i === notes.length) {
        const fretted = cells.filter((cell) => cell[1] > 0).map((cell) => cell[1]);
        if (!fretted.length || Math.max(...fretted) - Math.min(...fretted) <= MAX_SPAN) found.push(cells);
        return;
      }
      for (let s = from; s < OPENS.length; s += 1) {
        const fret = notes[i] - OPENS[s];
        if (fret >= 0 && fret <= MAX_FRET) place(i + 1, s + 1, cells.concat([[s, fret]]));
      }
    })(0, 0, []);
    return found.sort((a, b) => own(a) - own(b)).slice(0, MAX_OPTIONS);
  }

  const single = (option) => (option.length === 1 ? option[0] : null);
  const pitch = (cell) => OPENS[cell[0]] + cell[1];

  // `columns`: por columna, los MIDI que suenan juntos. Devuelve por columna las celdas elegidas ([] si no hay forma).
  function assign(columns) {
    const layers = columns.map((midis) => {
      const options = midis.length ? shapes(midis) : [];
      return options.length ? options : [[]];
    });
    if (!layers.length) return [];
    let states = layers[0].map((option) => ({ option, hand: hand(option), cost: own(option), back: null }));
    const history = [states];
    for (let i = 1; i < layers.length; i += 1) {
      states = layers[i].map((option) => {
        const h = hand(option);
        let best = null;
        history[i - 1].forEach((prev, j) => {
          let cost = prev.cost + own(option);
          if (h !== null && prev.hand !== null) cost += HAND_MOVE * Math.abs(h - prev.hand);
          const now = single(option);
          const was = single(prev.option);
          if (now && was) {
            const same = pitch(now) === pitch(was);
            if (same && now[0] !== was[0]) cost += REPEAT_MOVED;
            else if (!same && now[0] === was[0]) cost += SAME_STRING;
          }
          if (!best || cost < best.cost) best = { cost, back: j, hand: h !== null ? h : prev.hand };
        });
        return { option, hand: best.hand, cost: best.cost, back: best.back };
      });
      history.push(states);
    }
    let k = history[history.length - 1].reduce((m, state, j, all) => (state.cost < all[m].cost ? j : m), 0);
    const chosen = new Array(layers.length);
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      chosen[i] = history[i][k].option;
      k = history[i][k].back;
    }
    return chosen;
  }

  // Celdas -> columna de 6 trastes (cuerda 1 primero), null donde no suena nada.
  function toColumn(cells) {
    const column = new Array(OPENS.length).fill(null);
    cells.forEach(([string, fret]) => { column[string] = fret; });
    return column;
  }

  return { OPENS, assign, toColumn };
});
