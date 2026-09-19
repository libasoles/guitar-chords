/* ----- chord-modal.js -----
   Al hacer click sobre un acorde (.c) o sobre la sílaba subrayada (.sobre) en
   cualquier <song-sheet>, muestra una
   modal con el diagrama de digitación (diapasón), usando la base de acordes
   de assets/chords-db.js y el renderer SVG de assets/vendor/svguitar.umd.js
   (ambos extraídos del proyecto hermano "guitar-chords").

   Requiere, en ese orden, cargados antes que este archivo:
     assets/vendor/svguitar.umd.js  (window.svguitar)
     assets/chords-db.js            (window.CHORDS)

   Los .c viven dentro del shadow root de <song-sheet> (ver song-sheet.js), así
   que el listener de click va en document y usa composedPath() para alcanzar
   el elemento real sin importar cuántos shadow roots atraviese. */

(function () {
  'use strict';

  if (!window.CHORDS || !window.svguitar) return;

  var DIAGRAM_CONFIG = {
    strings: 6,
    frets: 5,
    tuning: [],
    fixedDiagramPosition: true,
    fingerSize: 0.7,
    fingerTextSize: 28,
    color: '#1a1a1a',
    backgroundColor: 'transparent',
  };

  // ----- Búsqueda exacta en la base de acordes -----
  // A diferencia del buscador difuso de guitar-chords, acá el nombre ya viene
  // completo y bien formado desde el cifrado de la canción (ej. "Bb7",
  // "F#m"): alcanza con normalizar símbolos/mayúsculas y comparar exacto
  // contra el nombre o algún alias.
  function normalize(s) {
    return String(s == null ? '' : s)
      .replace(/♭/g, 'b')
      .replace(/♯/g, '#')
      .replace(/[△Δ]/g, 'maj')
      .replace(/ø/g, 'm7b5')
      .toLowerCase()
      .replace(/\s+/g, '');
  }

  function findChord(name) {
    var q = normalize(name);
    if (!q) return null;
    for (var i = 0; i < window.CHORDS.length; i++) {
      var chord = window.CHORDS[i];
      var candidates = [chord.name].concat(chord.aliases || []);
      for (var j = 0; j < candidates.length; j++) {
        if (normalize(candidates[j]) === q) return chord;
      }
    }
    return null;
  }

  // ----- Renderer (adaptado de guitar-chords/src/shared/chord-diagram.js) -----
  // svguitar dibuja cada dedo en su traste ABSOLUTO dentro de la ventana de
  // `frets` trastes; en formas subidas (position > 1) hay que restar el
  // offset para que los dedos entren en la ventana visible.
  // Nuestra base usa 'o' para cuerda al aire, pero svguitar reconoce OPEN = 0.
  function normalizeFingerValue(value) {
    return value === 'o' || value === 'O' || value === '0' ? window.svguitar.OPEN : value;
  }

  function toWindowFrets(chord) {
    var offset = (chord.position || 1) - 1;
    var fingers = chord.fingers.map(function (finger) {
      var normalizedValue = normalizeFingerValue(finger[1]);
      if (typeof normalizedValue === 'number' && normalizedValue !== window.svguitar.OPEN) {
        return [finger[0], normalizedValue - offset, finger[2]];
      }
      return [finger[0], normalizedValue, finger[2]];
    });
    if (offset === 0) return { fingers: fingers, barres: chord.barres || [] };
    var barres = (chord.barres || []).map(function (barre) {
      return { fromString: barre.fromString, toString: barre.toString, fret: barre.fret - offset };
    });
    return { fingers: fingers, barres: barres };
  }

  function renderDiagram(target, chord) {
    var windowed = toWindowFrets(chord);
    new window.svguitar.SVGuitarChord(target)
      .configure(DIAGRAM_CONFIG)
      .chord({ fingers: windowed.fingers, barres: windowed.barres, position: chord.position })
      .draw();
  }

  // ----- Modal -----
  var overlay = null;
  var lastFocused = null;

  function buildModal() {
    overlay = document.createElement('div');
    overlay.className = 'chord-modal-overlay';
    overlay.innerHTML =
      '<div class="chord-modal" role="dialog" aria-modal="true" aria-labelledby="chord-modal-name">' +
      '<button type="button" class="chord-modal-close" aria-label="Cerrar">&times;</button>' +
      '<h2 class="chord-modal-name" id="chord-modal-name"></h2>' +
      '<div class="chord-modal-diagram"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    overlay.querySelector('.chord-modal-close').addEventListener('click', closeModal);
  }

  function closeModal() {
    if (!overlay || !overlay.classList.contains('is-open')) return;
    overlay.classList.remove('is-open');
    document.removeEventListener('keydown', onKeydown);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }

  function openModal(chordName) {
    if (!overlay) buildModal();

    var chord = findChord(chordName);
    var diagramEl = overlay.querySelector('.chord-modal-diagram');
    diagramEl.innerHTML = '';
    overlay.querySelector('.chord-modal-name').textContent = chordName;

    if (chord) {
      try {
        renderDiagram(diagramEl, chord);
      } catch (err) {
        diagramEl.textContent = 'No se pudo dibujar el diagrama.';
      }
    } else {
      diagramEl.textContent = 'Diagrama no disponible para este acorde.';
    }

    lastFocused = document.activeElement;
    overlay.classList.add('is-open');
    overlay.querySelector('.chord-modal-close').focus();
    document.addEventListener('keydown', onKeydown);
  }

  document.addEventListener('click', function (e) {
    var path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
    var chordEl = null;
    for (var i = 0; i < path.length; i++) {
      var node = path[i];
      if (node.nodeType !== 1 || !node.classList) continue;
      if (node.classList.contains('c')) {
        chordEl = node;
        break;
      }
      if (node.classList.contains('sobre')) {
        chordEl = node.querySelector('.c');
        break;
      }
    }
    if (!chordEl) return;
    var text = chordEl.textContent.replace(/ /g, ' ').trim();
    if (!text) return;
    openModal(text);
  });
})();
