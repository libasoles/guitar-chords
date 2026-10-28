/* chord-card.js — Tarjeta de acorde con el aspecto de los resultados del
   buscador: diagrama (svguitar, via ChordDiagram) y nombre. Dibuja cada
   elemento [data-chord-card] a partir de su atributo data-chord (JSON con
   name, fingers, barres, position). Las tarjetas dentro de un popover se
   dibujan al abrirlo, porque svguitar no mide bien un elemento oculto. */
(function () {
  'use strict';

  function render(el) {
    if (el.dataset.rendered) return;
    var chord = JSON.parse(el.dataset.chord);
    el.classList.add('finder-card');

    var diagram = document.createElement('div');
    diagram.className = 'diagram';
    el.appendChild(diagram);
    var name = document.createElement('div');
    name.className = 'name';
    name.textContent = chord.name;
    el.appendChild(name);

    try {
      window.ChordDiagram.render(diagram, chord, 'finder');
      el.dataset.rendered = '1';
    } catch (err) {
      if (window.console) console.error('chord card error for', chord.name, err);
    }
  }

  function renderAll(root) {
    root.querySelectorAll('[data-chord-card]').forEach(render);
  }

  document.addEventListener('toggle', function (event) {
    if (event.newState === 'open') renderAll(event.target);
  }, true);

  document.querySelectorAll('[data-chord-card]').forEach(function (el) {
    if (!el.closest('[popover]')) render(el);
  });

  // Both the editor and the arpeggio page use the same anchored card layout.
  function positionPopover(popup, trigger) {
    if (!trigger || !trigger.isConnected) return;
    var rect = trigger.getBoundingClientRect();
    var box = popup.getBoundingClientRect();
    var padding = 16;
    var gap = 10;
    var left = rect.left + (rect.width - box.width) / 2;
    var top = rect.bottom + gap;
    if (top + box.height > innerHeight - padding) top = rect.top - gap - box.height;
    popup.style.left = Math.max(padding, Math.min(left, innerWidth - box.width - padding)) + 'px';
    popup.style.top = Math.max(padding, Math.min(top, innerHeight - box.height - padding)) + 'px';
  }

  window.ChordCard = { render: render, renderAll: renderAll, positionPopover: positionPopover };
})();
