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

  window.ChordCard = { render: render, renderAll: renderAll };
})();
