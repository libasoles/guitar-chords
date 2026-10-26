'use strict';
/* editor-marks.js — Marcas del editor (el autor del sitio) sobre las partituras. Cada una es un icono Lucide sin
   texto visible a la izquierda del titulo de la tarjeta y, en el modal, sobre la partitura:
     favorite   — estrella negra rellena («favorita del editor»)
     insightful — cuadrado con estrella («insightful»)
     effort     — cuadrado con pulso («effort»)
     pending    — hoja con signo de exclamacion («revision pendiente»): la transcripcion no paso el control automatico
   Para marcar otra pieza, agregar su numero a la lista de su coleccion (ver AGENTS.md). */

const MARKS = {
  favorite: {
    labelKey: 'artEditorFavorite',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>',
  },
  insightful: {
    labelKey: 'artEditorInsightful',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.035 7.69a1 1 0 0 1 1.909.024l.737 1.452a1 1 0 0 0 .737.535l1.634.256a1 1 0 0 1 .588 1.806l-1.172 1.168a1 1 0 0 0-.282.866l.259 1.613a1 1 0 0 1-1.541 1.134l-1.465-.75a1 1 0 0 0-.912 0l-1.465.75a1 1 0 0 1-1.539-1.133l.258-1.613a1 1 0 0 0-.282-.866l-1.156-1.153a1 1 0 0 1 .572-1.822l1.633-.256a1 1 0 0 0 .737-.535z"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
  },
  effort: {
    labelKey: 'artEditorEffort',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M17 12h-2l-2 5-2-10-2 5H7"/></svg>',
  },
  pending: {
    labelKey: 'artEditorPending',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  },
};

const PIECES = {
  sor: { favorite: [5], effort: [1] },
  'carcassi-preludios': { favorite: [2, 4], insightful: [9] },
  'carcassi-progresivas': { favorite: [1] },
  'carcassi-valses': { favorite: [10] },
  'santisteban-preludios': { favorite: [2, 3, 4] },
  sagreras: { favorite: [36, 40, 42, 59, 62, 75], insightful: [16, 61], effort: [38, 43], pending: [76, 78, 81, 84] },
  aguado: { pending: Object.keys(require('../aguado/pieces.json')).map(Number) },
  barrios: { pending: Array.from({ length: 18 }, (_, i) => i + 1) },
};

/* Iconos de las marcas de la pieza dentro de un <span class="editor-marks">; vacio si no tiene ninguna. */
function editorMarks(collection, number, strings) {
  const marks = Object.keys(MARKS).filter((mark) => ((PIECES[collection] || {})[mark] || []).includes(number));
  return marks.length
    ? '<span class="editor-marks">' + marks.map((mark) =>
      '<span class="editor-mark editor-mark-' + mark + ' tooltip" role="img" tabindex="0" aria-label="' + strings[MARKS[mark].labelKey].replace(/"/g, '&quot;') + '" ' +
      'data-tooltip="' + strings[MARKS[mark].labelKey].replace(/"/g, '&quot;') + '">' + MARKS[mark].icon + '</span>').join('') + '</span>'
    : '';
}

module.exports = { MARKS, PIECES, editorMarks };
