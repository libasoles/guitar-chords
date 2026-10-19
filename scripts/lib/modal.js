'use strict';
/* modal.js — Ventana modal reutilizable para los articulos: un <div popover> nativo (sin JS para abrir, cerrar con
   Esc o con la X) y su boton de cerrar. Se abre con un boton que lleve popovertarget="<id>". `className` da la
   variante: `chord-popover` (tarjeta chica con fondo) o `modal-full` (pantalla completa). Los estilos estan en
   11-articles.css. */

function escapeAttr(text) {
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/* La X del modal a pantalla completa: la misma del preview de Partitura y tablatura. */
const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

function modal({ id, label, closeLabel, className, content, closeContent = '×' }) {
  return '<div id="' + id + '" class="modal ' + className + '" popover role="dialog" aria-label="' + escapeAttr(label) + '">' +
    '<button type="button" class="modal-close" popovertarget="' + id + '" popovertargetaction="hide" aria-label="' + escapeAttr(closeLabel) + '">' + closeContent + '</button>' +
    content + '</div>';
}

module.exports = { modal, CLOSE_ICON };
