'use strict';
/* editor-favorites.js — Partituras marcadas como «favoritas del editor» (las del autor del sitio).
   Su tarjeta lleva una estrella negra a la izquierda del titulo, sin texto visible. Para marcar otra, agregar
   su numero a la lista de su coleccion (ver AGENTS.md). */

const FAVORITES = {
  sagreras: [36],
};

const STAR_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>';

function isFavorite(collection, number) {
  return (FAVORITES[collection] || []).includes(number);
}

/* Estrella para el h2 del titulo; vacia si la pieza no es favorita. */
function favoriteStar(collection, number, label) {
  return isFavorite(collection, number)
    ? '<span class="editor-favorite" role="img" aria-label="' + label.replace(/"/g, '&quot;') + '">' + STAR_ICON + '</span>'
    : '';
}

module.exports = { FAVORITES, isFavorite, favoriteStar };
