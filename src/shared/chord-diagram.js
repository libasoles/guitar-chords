(function () {
  'use strict';

  const SVG_WIDTH = 400;
  const DEFAULT_SIDE_PADDING = 0.2;
  const DEFAULT_EMPTY_STRING_INDICATOR_SIZE = 0.6;
  const DEFAULT_NUT_WIDTH = 10;

  const CONFIGS = {
    finder: {
      strings: 6,
      frets: 5,
      fingerSize: 0.75,
      fingerTextSize: 28,
      color: '#1a1a1a',
      backgroundColor: 'transparent',
    },
    tooltip: {
      strings: 6,
      frets: 4,
      fingerSize: 0.82,
      fingerTextSize: 22,
      color: '#1a1a1a',
      backgroundColor: 'transparent',
    },
  };

  function hasHeaderOnlyOpenStrings(chord) {
    let hasOpen = false;
    let hasSilent = false;

    chord.fingers.forEach(([, fret]) => {
      if (fret === 'o') hasOpen = true;
      if (fret === 'x') hasSilent = true;
    });

    return hasOpen && !hasSilent;
  }

  function headerSpacingDelta(config) {
    const strings = config.strings || 6;
    const sidePadding = DEFAULT_SIDE_PADDING;
    const stringSpacing = (SVG_WIDTH - 2 * SVG_WIDTH * sidePadding) / (strings - 1);
    const markerSize = DEFAULT_EMPTY_STRING_INDICATOR_SIZE * stringSpacing;
    const markerPadding = markerSize / 3;

    return markerSize + markerPadding;
  }

  function headerMarkerSize(config) {
    const strings = config.strings || 6;
    const sidePadding = DEFAULT_SIDE_PADDING;
    const stringSpacing = (SVG_WIDTH - 2 * SVG_WIDTH * sidePadding) / (strings - 1);

    return DEFAULT_EMPTY_STRING_INDICATOR_SIZE * stringSpacing;
  }

  function normalizeHeaderSpacing(svg, chord, config) {
    if (!svg || !hasHeaderOnlyOpenStrings(chord)) return;

    const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
    if (viewBox.length !== 4 || viewBox.some(Number.isNaN)) return;

    const delta = headerSpacingDelta(config);
    const [minX, minY, width, height] = viewBox;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    while (svg.firstChild) {
      group.appendChild(svg.firstChild);
    }

    group.setAttribute('transform', `translate(0 ${delta})`);
    svg.appendChild(group);
    svg.setAttribute('viewBox', `${minX} ${minY} ${width} ${height + delta}`);
  }

  function alignOpenStringMarkers(svg, config) {
    if (!svg) return;

    const root = svg.querySelector('g') || svg;
    const nut = Array.from(root.querySelectorAll('line')).find(
      (line) => line.getAttribute('stroke-width') === String(DEFAULT_NUT_WIDTH)
    );
    if (!nut) return;

    const nutY = Number(nut.getAttribute('y1'));
    if (Number.isNaN(nutY)) return;

    const markerSize = headerMarkerSize(config);
    const markerPadding = markerSize / 3;
    const targetCy = nutY - markerSize / 2 - markerPadding - DEFAULT_NUT_WIDTH / 2;
    const targetR = markerSize / 2;

    root.querySelectorAll('circle.finger-circle[class*="fret-NaN"]').forEach((circle) => {
      circle.setAttribute('cy', String(targetCy));
      circle.setAttribute('r', String(targetR));
    });
  }

  // svguitar dibuja cada dedo en su traste ABSOLUTO dentro de la ventana de
  // `frets` trastes; `position` sólo cambia la etiqueta "Xfr", no corre la
  // ventana. Nuestra base (chords-db) numera los trastes desde la cejuela, así
  // que en las formas subidas (position > 1) los dedos caían por debajo del
  // diapasón y el diagrama los recortaba. Traducimos los trastes a relativos a
  // la ventana (restando position - 1) para que todo entre y se vea completo.
  function toWindowFrets(chord) {
    const offset = (chord.position || 1) - 1;
    if (offset === 0) return { fingers: chord.fingers, barres: chord.barres || [] };

    const fingers = chord.fingers.map((finger) =>
      typeof finger[1] === 'number'
        ? [finger[0], finger[1] - offset, finger[2]]
        : finger.slice()
    );
    const barres = (chord.barres || []).map((barre) => ({
      fromString: barre.fromString,
      toString: barre.toString,
      fret: barre.fret - offset,
    }));

    return { fingers, barres };
  }

  function render(target, chord, variant) {
    const config = CONFIGS[variant] || CONFIGS.finder;
    const { fingers, barres } = toWindowFrets(chord);
    new svguitar.SVGuitarChord(target)
      .configure(config)
      .chord({
        fingers: fingers,
        barres: barres,
        position: chord.position,
      })
      .draw();

    const svg = target.querySelector('svg');
    normalizeHeaderSpacing(svg, chord, config);
    alignOpenStringMarkers(svg, config);
  }

  window.ChordDiagram = {
    render,
  };
})();
