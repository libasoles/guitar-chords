/* ----- song-sheet.js -----
   Custom element <song-sheet>: cancionero con la letra y los acordes anclados
   sobre las sílabas (markup .letra / .sobre / .c), con TODO su estilado —pantalla
   e impresión— ENCAPSULADO en el Shadow DOM. Se puede soltar en cualquier página
   sin que el CSS del cancionero se filtre ni dependa de que otra hoja lo defina.

   Contrato de entrada (lo que el autor escribe adentro del elemento):
     <song-sheet>
       <div class="letra">
         <p class="estrofa">
           <span class="seccion">Copla I</span>
           <span class="sobre"><span class="c">Do7</span>&nbsp;&nbsp;&nbsp;</span>Vieja soled<span class="sobre"><span class="c">Fa</span>ad</span>,<br>
           ...
         </p>
       </div>
     </song-sheet>
   Ese markup ya resuelve casos que ChordPro no cubre: el acorde ANTES del verso
   (sobre espacios/&nbsp; iniciales) y el acorde A MITAD DE PALABRA. Cada .sobre
   subraya la sílaba y ancla su .c justo encima (position:absolute; left:0). Como
   ese anclaje es puramente CSS/layout, migrarlo al shadow root NO cambia dónde cae
   el acorde: sigue cayendo sobre el arranque de la sílaba subrayada.

   Mecanismo de adopción:
   - ::slotted() sólo llega al hijo directo slotteado, NO a los descendientes
     anidados (el .c dentro del .sobre), así que un <slot> + ::slotted no alcanza
     para estilar el cancionero encapsulado.
   - Por eso, al conectar MOVEMOS los child nodes del light DOM al shadow root
     (appendChild los reparenta). Quedan bajo el <style> encapsulado y el CSS
     aplica de verdad a toda la jerarquía. Movemos (no clonamos) para no duplicar
     nodos ni IDs; el elemento queda con su contenido en el shadow root.

   Limitación conocida (integración futura, fuera de alcance de esta slice):
   - El tooltip de diapasón (assets/chord-tooltip.js) busca los .c por el DOCUMENTO
     (document.querySelectorAll('.c')); no atraviesa shadow roots. Con el cifrado
     adentro del shadow root, el tooltip global NO alcanza estos .c. No rompe nada
     del resto de la lección (los .c fuera de <song-sheet> siguen funcionando).
     Integrarlo (que el componente cablee el tooltip a su propio shadow root) es
     una slice posterior. */

(function () {
  "use strict";

  // CSS del cancionero, migrado desde assets/lesson.css (sección "Letra estilo
  // cancionero"). Tematizado con var(--token, fallback): hereda los tokens de
  // lesson.css cuando la página los define, y se ve bien sin lesson.css gracias
  // a los fallbacks. Incluye el átomo .c (color de acorde) porque acá los .c
  // viven dentro del shadow root y no los alcanza la regla global.
  var STYLES = [
    ":host {",
    "  display: block;",
    "  animation: song-fade-in 480ms ease-out both 80ms;",
    "}",
    "*, *::before, *::after { box-sizing: border-box; }",
    "@keyframes song-fade-in {",
    "  from {",
    "    opacity: 0;",
    "  }",
    "  to {",
    "    opacity: 1;",
    "  }",
    "}",
    "@media (prefers-reduced-motion: reduce) {",
    "  :host { animation: none; }",
    "}",
    "",
    "/* Átomo de acorde: color + peso. Los nombres de acordes van siempre en sans. */",
    ".c {",
    "  color: var(--accent, #8b0000);",
    '  font-family: var(--sans, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif);',
    "  font-weight: 500;",
    "  cursor: pointer;",
    "}",
    ".c:hover, .c:focus-visible {",
    "  text-decoration: underline;",
    "}",
    "",
    "/* Bloque de letra: sólo aporta el interlineado para que el acorde tenga",
    "   aire arriba de cada línea. */",
    ".letra {",
    '  font-family: var(--serif, Georgia, "Times New Roman", serif);',
    "  font-size: var(--song-text-size, 1.35rem);",
    "  line-height: 3.1;",
    "  white-space: normal;",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 1.2rem;",
    "  margin: 0.55rem 0 1.1rem;",
    "}",
    ".letra .estrofa { margin: 0; }",
    ".letra .seccion {",
    "  display: block;",
    '  font-family: var(--sans, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif);',
    "  font-size: 0.7rem;",
    "  text-transform: uppercase;",
    "  letter-spacing: 0.08em;",
    "  color: var(--ink-soft, #555);",
    "  line-height: 1.6;",
    "  margin: 0 0 0.3rem;",
    "}",
    "/* .sobre: envoltorio que ancla y subraya la sílaba donde cae el acorde. */",
    ".letra .sobre {",
    "  position: relative;",
    "  display: inline-block;",
    "  line-height: 1.15;",
    "  vertical-align: baseline;",
    "  cursor: pointer;",
    "  text-decoration: underline;",
    "  text-decoration-thickness: 1px;",
    "  text-underline-offset: 3px;",
    "}",
    "/* El acorde se imprime justo encima del arranque de la sílaba (left:0). */",
    ".letra .sobre .c {",
    "  position: absolute;",
    "  left: 0;",
    "  bottom: 100%;",
    "  text-decoration: none;",
    "  font-size: 0.88em;",
    "  line-height: 1;",
    "  white-space: nowrap;",
    "  letter-spacing: 0.01em;",
    "}",
    ':host([data-chords-hidden="true"]) .letra {',
    "  line-height: 1.7;",
    "}",
    ':host([data-chords-hidden="true"]) .letra .seccion {',
    "  margin-bottom: 0.9rem;",
    "}",
    ':host([data-chords-hidden="true"]) .letra .sobre {',
    "  display: inline;",
    "  text-decoration: none;",
    "}",
    ':host([data-chords-hidden="true"]) .letra .sobre .c {',
    "  display: none;",
    "}",
    ':host([data-chords-hidden="true"]) .letra .sobre[data-chord-only="true"] {',
    "  display: none;",
    "}",
    ":host([data-vowel-focus]) .letra .vowel-focus__vowel {",
    "  color: var(--accent, #8b0000);",
    "  font-weight: 700;",
    "}",
    ":host([data-vowel-focus]) .letra .vowel-focus__consonant {",
    "  color: transparent;",
    "}",
    "",
    "/* ----- Impresión ----- */",
    "/* El cancionero se imprime como en pantalla; sólo neutralizamos el fondo",
    "   para no gastar tinta y forzamos color exacto en el borde de acento. */",
    "@media print {",
    "  .letra {",
    "    background: transparent;",
    "    -webkit-print-color-adjust: exact;",
    "    print-color-adjust: exact;",
    "  }",
    "}",
  ].join("\n");

  // ----- Transposición de acordes -----
  // Notas con sostenidos y con bemoles; se elige una de las dos grafías según
  // lo que ya use la canción (si el cifrado original trae bemoles, se
  // transpone en bemoles; si no, en sostenidos), para no cambiarle el "acento"
  // a una tonalidad que el usuario ya reconoce (ej. Bb en vez de A#).
  var SHARP_NAMES = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  var FLAT_NAMES = [
    "C",
    "Db",
    "D",
    "Eb",
    "E",
    "F",
    "Gb",
    "G",
    "Ab",
    "A",
    "Bb",
    "B",
  ];
  var NOTE_INDEX = {
    C: 0,
    "B#": 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    Fb: 4,
    F: 5,
    "E#": 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11,
    Cb: 11,
  };
  var ROOT_RE = /^([A-G])([#b]?)/;

  // Transpone la raíz de un fragmento de acorde (ej. "Am7" -> raíz "A" +
  // sufijo "m7"); deja el sufijo intacto porque no afecta la nota.
  function transposePart(part, semitones, useFlats) {
    var m = ROOT_RE.exec(part);
    if (!m) return part;
    var root = m[1] + m[2];
    var idx = NOTE_INDEX[root];
    if (idx === undefined) return part;
    var suffix = part.slice(m[0].length);
    var newIdx = (((idx + semitones) % 12) + 12) % 12;
    var names = useFlats ? FLAT_NAMES : SHARP_NAMES;
    return names[newIdx] + suffix;
  }

  // Un acorde puede traer bajo ("G/B"): se transponen ambos lados por
  // separado porque cada uno es una nota independiente.
  function transposeChord(text, semitones, useFlats) {
    return text
      .split("/")
      .map(function (part) {
        return transposePart(part, semitones, useFlats);
      })
      .join("/");
  }

  // La tonalidad (data-key="Re menor") se anota en solfeo español, distinto
  // de las letras (C, D, E...) que usan los .c. Se transpone por separado y
  // se muestra en el widget: el usuario reconoce "Mi menor", no un desplazo
  // en semitonos.
  var SHARP_NAMES_ES = [
    "Do",
    "Do#",
    "Re",
    "Re#",
    "Mi",
    "Fa",
    "Fa#",
    "Sol",
    "Sol#",
    "La",
    "La#",
    "Si",
  ];
  var FLAT_NAMES_ES = [
    "Do",
    "Reb",
    "Re",
    "Mib",
    "Mi",
    "Fa",
    "Solb",
    "Sol",
    "Lab",
    "La",
    "Sib",
    "Si",
  ];
  var NOTE_INDEX_ES = {
    Do: 0,
    "Do#": 1,
    Reb: 1,
    Re: 2,
    "Re#": 3,
    Mib: 3,
    Mi: 4,
    Fa: 5,
    "Fa#": 6,
    Solb: 6,
    Sol: 7,
    "Sol#": 8,
    Lab: 8,
    La: 9,
    "La#": 10,
    Sib: 10,
    Si: 11,
  };
  var KEY_RE = /^(Do|Re|Mi|Fa|Sol|La|Si)(#|b)?\s+(mayor|menor)$/i;

  function transposeKeyName(keyText, semitones, useFlats) {
    var m = KEY_RE.exec(keyText.trim());
    if (!m) return null;
    var root =
      m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() + (m[2] || "");
    var idx = NOTE_INDEX_ES[root];
    if (idx === undefined) return null;
    var newIdx = (((idx + semitones) % 12) + 12) % 12;
    var names = useFlats ? FLAT_NAMES_ES : SHARP_NAMES_ES;
    return names[newIdx] + " " + m[3].toLowerCase();
  }

  class SongSheet extends HTMLElement {}

  SongSheet.prototype.connectedCallback = function () {
    if (this._mounted) return;
    this._mounted = true;

    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    var root = this.shadowRoot;

    // Inyectamos el CSS encapsulado.
    var style = document.createElement("style");
    style.textContent = STYLES;
    root.appendChild(style);

    // Adoptamos el cifrado: movemos los child nodes del light DOM al shadow root.
    // appendChild reparenta (mueve, no copia), así que el CSS de arriba aplica a
    // toda la jerarquía .letra/.sobre/.c sin duplicar nodos. Si no hay contenido
    // (uso vacío), no pasa nada.
    while (this.firstChild) {
      root.appendChild(this.firstChild);
    }

    this._root = root;
    this._markChordOnlySpans(root);
    this._preventChordOverlap(root);
    this._mountTranspose(root);
    this._mountChordToggle();
    this._mountScrollRegion();
    this._mountTeleprompter();
    this._mountTextSize();
    this._mountVowelFocus();
  };

  SongSheet.prototype._markChordOnlySpans = function (root) {
    var spans = root.querySelectorAll(".sobre");
    for (var i = 0; i < spans.length; i++) {
      var text = spans[i].textContent.replace(/\u00a0/g, " ").trim();
      if (!text) spans[i].dataset.chordOnly = "true";
    }
  };

  // Regla general anti-solape: el acorde (.c) flota con position:absolute
  // sobre su .sobre, as\u00ed que su ancho real NO empuja al contenido siguiente.
  // Si el nombre del acorde es m\u00e1s ancho que la s\u00edlaba (o el hueco) que lo
  // sostiene \u2014t\u00edpicamente acordes de dos+ caracteres sobre una sola letra, o
  // varios acordes seguidos sin letra debajo, como en una introducci\u00f3n\u2014
  // termina superpuesto con el pr\u00f3ximo acorde o palabra. En vez de contar
  // &nbsp; a mano por canci\u00f3n (fr\u00e1gil: cualquier acorde nuevo puede volver a
  // romperlo), medimos el ancho real de cada acorde contra su .sobre despu\u00e9s
  // de cada render y agregamos el margin-right que haga falta para separarlos.
  // Corre en el mount inicial y cada vez que la transposici\u00f3n cambia el
  // texto de los acordes (un acorde transpuesto puede ser m\u00e1s ancho, ej. "A"
  // -> "A#").
  SongSheet.prototype._preventChordOverlap = function (root) {
    var GAP = 4;
    var sobres = (root || this._root).querySelectorAll(".letra .sobre");
    for (var i = 0; i < sobres.length; i++) {
      var sobre = sobres[i];
      var chord = sobre.querySelector(".c");
      if (!chord) continue;
      sobre.style.marginRight = "";
      var overflow = chord.offsetWidth - sobre.offsetWidth;
      if (overflow > 0) {
        sobre.style.marginRight = overflow + GAP + "px";
      }
    }
  };

  // Widget de transposición: vive en el header de la página (no en el shadow
  // root), al lado del logo, para no ocupar espacio propio arriba de la
  // letra. Sube o baja medio tono todos los .c del shadow root. Guardamos el
  // nombre original de cada acorde en un dataset para recalcular siempre
  // desde la fuente y evitar que redondeos se acumulen entre clics. El
  // indicador central tiene ancho fijo y muestra la tonalidad transpuesta
  // (ej. "Mi menor"); si no hay data-key (página vieja o valor no parseable)
  // cae a mostrar el desplazo en semitonos, para no dejar el widget vacío.
  SongSheet.prototype._mountTranspose = function (root) {
    var chords = root.querySelectorAll(".c");
    var header = document.querySelector(".site-header");
    if (!chords.length || !header || header.querySelector(".transpose")) return;

    var useFlats = false;
    var hasSharp = false;
    for (var i = 0; i < chords.length; i++) {
      var text = chords[i].textContent;
      chords[i].dataset.original = text;
      if (text.indexOf("b") !== -1 && ROOT_RE.test(text)) useFlats = true;
      if (text.indexOf("#") !== -1) hasSharp = true;
    }
    if (hasSharp) useFlats = false;

    var originalKey = this.dataset.key || "";

    var widget = document.createElement("div");
    widget.className = "transpose";
    widget.innerHTML =
      '<button type="button" class="t-down" aria-label="Bajar medio tono">−</button>' +
      '<button type="button" class="t-current" aria-label="Restablecer tono original" title="Restablecer tono original">' +
      (originalKey || "0") +
      "</button>" +
      '<button type="button" class="t-up" aria-label="Subir medio tono">+</button>';
    header.appendChild(widget);

    var current = widget.querySelector(".t-current");
    var semitones = 0;
    var host = this;
    var storageKey = "song-sheet:transpose:" + window.location.pathname;

    function readStoredSemitones() {
      try {
        var raw = window.localStorage.getItem(storageKey);
        if (raw == null) return 0;
        var parsed = parseInt(raw, 10);
        return isNaN(parsed) ? 0 : parsed;
      } catch (err) {
        return 0;
      }
    }

    function writeStoredSemitones(value) {
      try {
        if (value === 0) {
          window.localStorage.removeItem(storageKey);
        } else {
          window.localStorage.setItem(storageKey, String(value));
        }
      } catch (err) {}
    }

    function render() {
      for (var i = 0; i < chords.length; i++) {
        chords[i].textContent = transposeChord(
          chords[i].dataset.original,
          semitones,
          useFlats,
        );
      }
      var keyName = originalKey
        ? transposeKeyName(originalKey, semitones, useFlats)
        : null;
      current.textContent =
        keyName ||
        (semitones === 0
          ? "0"
          : semitones > 0
            ? "+" + semitones
            : String(semitones));
      current.classList.toggle("is-transposed", semitones !== 0);
      writeStoredSemitones(semitones);
      // Un acorde transpuesto puede cambiar de ancho (ej. "A" -> "A#"), así
      // que hay que recalcular la regla anti-solape en cada transposición.
      host._preventChordOverlap(root);
    }

    widget.querySelector(".t-down").addEventListener("click", function () {
      semitones -= 1;
      render();
    });
    widget.querySelector(".t-up").addEventListener("click", function () {
      semitones += 1;
      render();
    });
    current.addEventListener("click", function () {
      semitones = 0;
      render();
    });

    semitones = readStoredSemitones();
    render();
  };

  SongSheet.prototype._mountTeleprompter = function () {
    var bar = document.querySelector(".song-titlebar");
    if (!bar) return;
    var host = this;

    var controls = bar.querySelector(".song-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "song-controls";
      bar.appendChild(controls);
    }

    var chordToggle = bar.querySelector(".chord-toggle");
    if (chordToggle && chordToggle.parentNode !== controls) {
      controls.appendChild(chordToggle);
    }

    if (controls.querySelector(".teleprompter-toggle")) return;

    var slot = document.createElement("div");
    slot.className = "teleprompter-slot";
    controls.appendChild(slot);

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "teleprompter-toggle";
    toggle.setAttribute("aria-pressed", "false");
    slot.appendChild(toggle);

    var speedControl = document.createElement("label");
    speedControl.className = "teleprompter-speed";
    speedControl.hidden = true;
    speedControl.setAttribute("aria-label", "Velocidad del teleprompter");
    speedControl.innerHTML =
      '<span class="teleprompter-speed__rail" aria-hidden="true"></span>' +
      '<input class="teleprompter-speed__input" type="range" min="0" max="1.6" step="0.005" value="0.45" aria-label="Velocidad del teleprompter">';
    slot.appendChild(speedControl);

    var playIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M15.033 9.44a.647.647 0 0 1 0 1.12l-4.065 2.352a.645.645 0 0 1-.968-.56V7.648a.645.645 0 0 1 .967-.56z"/>' +
      '<path d="M7 21h10"/>' +
      '<rect width="20" height="14" x="2" y="3" rx="2"/>' +
      "</svg>";
    var pauseIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M10 13V7"/>' +
      '<path d="M14 13V7"/>' +
      '<rect width="20" height="14" x="2" y="3" rx="2"/>' +
      '<path d="M12 17v4"/>' +
      '<path d="M8 21h8"/>' +
      "</svg>";

    var storageKey = "song-sheet:teleprompter:" + window.location.pathname;
    var speedStorageKey =
      "song-sheet:teleprompter-speed:" + window.location.pathname;
    var isPlaying = false;
    var isCountingDown = false;
    var timerId = 0;
    var countdownTimerId = 0;
    var speedInput = speedControl.querySelector(".teleprompter-speed__input");
    var defaultSpeed = 0.4;
    var minSpeed = 0;
    var maxSpeed = 1.5;
    var speed = defaultSpeed;
    var wakeLock = null;
    var scrollPosition = 0;
    var countdownOverlay = document.createElement("div");
    countdownOverlay.className = "teleprompter-countdown";
    countdownOverlay.setAttribute("aria-hidden", "true");
    countdownOverlay.hidden = true;
    countdownOverlay.style.position = "fixed";
    countdownOverlay.style.inset = "0";
    countdownOverlay.style.display = "none";
    countdownOverlay.style.alignItems = "center";
    countdownOverlay.style.justifyContent = "center";
    countdownOverlay.style.fontFamily = "var(--sans)";
    countdownOverlay.style.fontSize = "clamp(5rem, 22vw, 12rem)";
    countdownOverlay.style.fontWeight = "700";
    countdownOverlay.style.lineHeight = "1";
    countdownOverlay.style.color = "color-mix(in srgb, var(--ink) 72%, white)";
    countdownOverlay.style.background = "rgba(253, 250, 245, 0.46)";
    countdownOverlay.style.zIndex = "999";
    countdownOverlay.style.pointerEvents = "none";
    document.body.appendChild(countdownOverlay);

    function pulseButton(button) {
      button.classList.remove("is-pulsing");
      void button.offsetWidth;
      button.classList.add("is-pulsing");
    }

    function readStoredState() {
      try {
        return window.localStorage.getItem(storageKey) === "true";
      } catch (err) {
        return false;
      }
    }

    function writeStoredState(value) {
      try {
        if (value) {
          window.localStorage.setItem(storageKey, "true");
        } else {
          window.localStorage.removeItem(storageKey);
        }
      } catch (err) {}
    }

    function clampSpeed(value) {
      return Math.min(
        maxSpeed,
        Math.max(minSpeed, Math.round(value * 100) / 100),
      );
    }

    function syncZeroState() {
      var isZero = speed === 0;
      slot.classList.toggle("is-zero", isZero);
      toggle.classList.toggle("is-zero", isZero);
      speedControl.classList.toggle("is-zero", isZero);
    }

    function vibrateAtZero() {
      if (!("vibrate" in navigator)) return;
      try {
        navigator.vibrate(18);
      } catch (err) {}
    }

    function releaseWakeLock() {
      if (!wakeLock) return Promise.resolve();
      var lock = wakeLock;
      wakeLock = null;
      return lock.release().catch(function () {});
    }

    function requestWakeLock() {
      if (!isPlaying) return Promise.resolve();
      if (!("wakeLock" in navigator) || !navigator.wakeLock) {
        return Promise.resolve();
      }
      return navigator.wakeLock
        .request("screen")
        .then(function (lock) {
          wakeLock = lock;
          lock.addEventListener("release", function () {
            if (wakeLock === lock) wakeLock = null;
          });
        })
        .catch(function () {});
    }

    function readStoredSpeed() {
      try {
        var raw = window.localStorage.getItem(speedStorageKey);
        if (raw == null) return defaultSpeed;
        var parsed = parseFloat(raw);
        return isNaN(parsed) ? defaultSpeed : clampSpeed(parsed);
      } catch (err) {
        return defaultSpeed;
      }
    }

    function writeStoredSpeed(value) {
      try {
        if (value === defaultSpeed) {
          window.localStorage.removeItem(speedStorageKey);
        } else {
          window.localStorage.setItem(speedStorageKey, String(value));
        }
      } catch (err) {}
    }

    function syncScrollPosition() {
      var scroller = host._scrollRegion;
      scrollPosition = scroller ? scroller.scrollTop : 0;
    }

    host._syncTeleprompterScrollPosition = syncScrollPosition;

    function syncFloatingPosition() {
      var rect = slot.getBoundingClientRect();
      document.body.style.setProperty(
        "--teleprompter-float-top",
        rect.top + "px",
      );
      document.body.style.setProperty(
        "--teleprompter-float-left",
        rect.left + "px",
      );
      document.body.style.setProperty(
        "--teleprompter-float-width",
        rect.width + "px",
      );
      document.body.style.setProperty(
        "--teleprompter-float-height",
        rect.height + "px",
      );
    }

    function syncTeleprompterOverlayOffset() {
      var scroller = host._scrollRegion;
      if (!scroller) return;
      document.body.style.setProperty(
        "--teleprompter-overlay-offset",
        scroller.getBoundingClientRect().top + "px",
      );
    }

    function syncTeleprompterEndPadding() {
      var scroller = host._scrollRegion;
      if (!scroller) return;
      var extraPadding = Math.max(96, Math.round(scroller.clientHeight * 0.42));
      document.body.style.setProperty(
        "--teleprompter-end-padding",
        extraPadding + "px",
      );
    }

    function renderCountdown(value) {
      countdownOverlay.textContent = value > 0 ? String(value) : "";
      countdownOverlay.hidden = value <= 0;
      countdownOverlay.style.display = value > 0 ? "flex" : "none";
      countdownOverlay.classList.toggle("is-visible", value > 0);
    }

    function render() {
      var isActive = isPlaying || isCountingDown;
      toggle.innerHTML = isActive ? pauseIcon : playIcon;
      toggle.setAttribute("aria-pressed", isActive ? "true" : "false");
      toggle.setAttribute(
        "aria-label",
        isActive ? "Pausar teleprompter" : "Activar teleprompter",
      );
      toggle.title = isActive ? "Pausar teleprompter" : "Activar teleprompter";
      speedInput.value = String(speed);
      syncZeroState();
      speedControl.hidden = !isActive;
      if (isActive) {
        syncFloatingPosition();
        syncTeleprompterOverlayOffset();
        syncTeleprompterEndPadding();
      } else {
        document.body.style.removeProperty("--teleprompter-overlay-offset");
        document.body.style.removeProperty("--teleprompter-end-padding");
      }
      document.body.classList.toggle("teleprompter-active", isActive);
      if (host._updateScrollRegionHeight) host._updateScrollRegionHeight();
      writeStoredState(isActive);
      pulseButton(toggle);
    }

    function stop(silent) {
      isPlaying = false;
      isCountingDown = false;
      if (timerId) {
        window.clearInterval(timerId);
        timerId = 0;
      }
      if (countdownTimerId) {
        window.clearTimeout(countdownTimerId);
        countdownTimerId = 0;
      }
      renderCountdown(0);
      releaseWakeLock();
      if (!silent) render();
    }

    function step() {
      var scroller = host._scrollRegion;
      if (!scroller) {
        stop();
        return;
      }

      var maxScroll = Math.max(
        0,
        scroller.scrollHeight - scroller.clientHeight,
      );
      if (scroller.scrollTop >= maxScroll - 1) {
        stop();
        return;
      }

      scrollPosition = Math.min(maxScroll, scrollPosition + speed);
      scroller.scrollTop = scrollPosition;
    }

    function beginPlayback() {
      if (isPlaying) return;
      isPlaying = true;
      isCountingDown = false;
      syncScrollPosition();
      render();
      requestWakeLock();
      step();
      timerId = window.setInterval(step, 16);
    }

    function start() {
      if (isPlaying || isCountingDown) return;
      isCountingDown = true;
      renderCountdown(3);
      render();

      var remaining = 3;
      function tick() {
        if (!isCountingDown) return;
        remaining -= 1;
        if (remaining <= 0) {
          countdownTimerId = 0;
          renderCountdown(0);
          beginPlayback();
          return;
        }
        renderCountdown(remaining);
        countdownTimerId = window.setTimeout(tick, 1000);
      }

      countdownTimerId = window.setTimeout(tick, 1000);
    }

    function togglePlayback() {
      if (isPlaying || isCountingDown) {
        stop();
      } else {
        start();
      }
    }

    toggle.addEventListener("click", function () {
      togglePlayback();
    });

    speedInput.addEventListener("input", function () {
      var wasZero = speed === 0;
      var nextSpeed = parseFloat(speedInput.value);
      speed = clampSpeed(isNaN(nextSpeed) ? defaultSpeed : nextSpeed);
      syncZeroState();
      if (!wasZero && speed === 0) vibrateAtZero();
      writeStoredSpeed(speed);
    });

    toggle.addEventListener("animationend", function (event) {
      if (event.animationName === "toggle-pulse")
        toggle.classList.remove("is-pulsing");
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden && isPlaying) stop();
    });

    document.addEventListener("keydown", function (event) {
      var target = event.target;
      if (event.key !== " ") return;
      if (
        target &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName))
      ) {
        return;
      }
      event.preventDefault();
      togglePlayback();
    });

    window.addEventListener("beforeunload", function () {
      if (timerId) window.clearInterval(timerId);
      if (countdownTimerId) window.clearTimeout(countdownTimerId);
      releaseWakeLock();
    });

    speed = readStoredSpeed();
    if (readStoredState()) start();
    else render();
  };

  SongSheet.prototype._mountTextSize = function () {
    var bar = document.querySelector(".song-titlebar");
    if (!bar) return;
    var host = this;

    var controls = bar.querySelector(".song-controls");
    if (!controls) return;
    if (controls.querySelector(".text-size-toggle")) return;

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "text-size-toggle";
    toggle.setAttribute("aria-haspopup", "dialog");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Cambiar tamaño del texto");
    toggle.title = "Cambiar tamaño del texto";
    toggle.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M12 4v16"></path>' +
      '<path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"></path>' +
      '<path d="M9 20h6"></path>' +
      "</svg>";
    controls.appendChild(toggle);

    var panel = document.createElement("div");
    panel.className = "text-size-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Tamaño del texto");
    panel.innerHTML =
      '<div class="text-size-panel__label">Tamaño del texto</div>' +
      '<div class="text-size-panel__controls">' +
      '<button type="button" class="text-size-down" aria-label="Achicar texto">−</button>' +
      '<button type="button" class="text-size-current" aria-label="Restablecer tamaño original" title="Restablecer tamaño original">100%</button>' +
      '<button type="button" class="text-size-up" aria-label="Agrandar texto">+</button>' +
      "</div>";
    controls.appendChild(panel);

    var current = panel.querySelector(".text-size-current");
    var storageKey = "song-sheet:text-size:" + window.location.pathname;
    var currentScale = 1;
    var minScale = 0.8;
    var maxScale = 1.45;
    var step = 0.05;

    function clampScale(value) {
      return Math.min(
        maxScale,
        Math.max(minScale, Math.round(value * 100) / 100),
      );
    }

    function pulseButton(button) {
      button.classList.remove("is-pulsing");
      void button.offsetWidth;
      button.classList.add("is-pulsing");
    }

    function readStoredScale() {
      try {
        var raw = window.localStorage.getItem(storageKey);
        if (raw == null) return 1;
        var parsed = parseFloat(raw);
        return isNaN(parsed) ? 1 : clampScale(parsed);
      } catch (err) {
        return 1;
      }
    }

    function writeStoredScale(value) {
      try {
        if (value === 1) {
          window.localStorage.removeItem(storageKey);
        } else {
          window.localStorage.setItem(storageKey, String(value));
        }
      } catch (err) {}
    }

    function render() {
      current.textContent = Math.round(currentScale * 100) + "%";
      current.classList.toggle("is-modified", currentScale !== 1);
      panel.querySelector(".text-size-down").disabled =
        currentScale <= minScale;
      panel.querySelector(".text-size-up").disabled = currentScale >= maxScale;
      host.style.setProperty("--song-text-size", 1.35 * currentScale + "rem");
      writeStoredScale(currentScale);
      if (host._preventChordOverlap) host._preventChordOverlap();
    }

    function openPanel() {
      panel.style.top = toggle.offsetTop + toggle.offsetHeight - 30 + "px";
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
    }

    function closePanel() {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function (event) {
      event.stopPropagation();
      if (panel.hidden) openPanel();
      else closePanel();
      pulseButton(toggle);
    });

    panel.addEventListener("click", function (event) {
      event.stopPropagation();
    });

    panel
      .querySelector(".text-size-down")
      .addEventListener("click", function () {
        currentScale = clampScale(currentScale - step);
        render();
      });

    panel.querySelector(".text-size-up").addEventListener("click", function () {
      currentScale = clampScale(currentScale + step);
      render();
    });

    current.addEventListener("click", function () {
      currentScale = 1;
      render();
    });

    document.addEventListener("click", function (event) {
      if (panel.hidden) return;
      if (controls.contains(event.target)) return;
      closePanel();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) closePanel();
    });

    toggle.addEventListener("animationend", function (event) {
      if (event.animationName === "toggle-pulse")
        toggle.classList.remove("is-pulsing");
    });

    currentScale = readStoredScale();
    render();
  };

  // Separamos sólo el texto de la letra: acordes y rótulos quedan intactos.
  SongSheet.prototype._prepareVowelFocus = function () {
    var letters = this._root.querySelector(".letra");
    if (!letters || letters.dataset.vowelFocusPrepared === "true") return;

    var walker = document.createTreeWalker(letters, NodeFilter.SHOW_TEXT);
    var textNodes = [];
    var node;
    while ((node = walker.nextNode())) {
      var parent = node.parentElement;
      if (parent && !parent.closest(".c, .seccion")) textNodes.push(node);
    }

    var vowels = /[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]/;
    var consonants = /[a-zñA-ZÑ]/;
    for (var i = 0; i < textNodes.length; i++) {
      var text = textNodes[i].nodeValue;
      if (!text || !/[a-zñáéíóúüA-ZÑÁÉÍÓÚÜ]/.test(text)) continue;

      var fragment = document.createDocumentFragment();
      var run = "";
      var type = "";
      function appendRun() {
        if (!run) return;
        if (!type) fragment.appendChild(document.createTextNode(run));
        else {
          var span = document.createElement("span");
          span.className = "vowel-focus__" + type;
          span.textContent = run;
          fragment.appendChild(span);
        }
        run = "";
      }

      for (var j = 0; j < text.length; j++) {
        var nextType = vowels.test(text.charAt(j))
          ? "vowel"
          : consonants.test(text.charAt(j))
            ? "consonant"
            : "";
        if (nextType !== type) {
          appendRun();
          type = nextType;
        }
        run += text.charAt(j);
      }
      appendRun();
      textNodes[i].parentNode.replaceChild(fragment, textNodes[i]);
    }
    letters.dataset.vowelFocusPrepared = "true";
  };

  SongSheet.prototype._mountVowelFocus = function () {
    var bar = document.querySelector(".song-titlebar");
    if (!bar) return;
    var controls = bar.querySelector(".song-controls");
    if (!controls || controls.querySelector(".vowel-focus-toggle")) return;

    this._prepareVowelFocus();
    var host = this;
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "vowel-focus-toggle";
    toggle.setAttribute("aria-pressed", "false");
    toggle.setAttribute("aria-label", "Resaltar vocales y atenuar consonantes");
    toggle.title = "Resaltar vocales";
    toggle.innerHTML = '<span aria-hidden="true">A<span>e</span></span>';
    controls.appendChild(toggle);

    var storageKey = "song-sheet:vowel-focus:" + window.location.pathname;
    function setEnabled(enabled) {
      host.toggleAttribute("data-vowel-focus", enabled);
      toggle.setAttribute("aria-pressed", String(enabled));
      toggle.setAttribute(
        "aria-label",
        enabled ? "Restaurar texto normal" : "Resaltar vocales y atenuar consonantes",
      );
      toggle.title = enabled ? "Restaurar texto normal" : "Resaltar vocales";
      try {
        if (enabled) window.localStorage.setItem(storageKey, "true");
        else window.localStorage.removeItem(storageKey);
      } catch (err) {}
    }

    toggle.addEventListener("click", function () {
      setEnabled(!host.hasAttribute("data-vowel-focus"));
      toggle.classList.remove("is-pulsing");
      void toggle.offsetWidth;
      toggle.classList.add("is-pulsing");
    });
    toggle.addEventListener("animationend", function (event) {
      if (event.animationName === "toggle-pulse")
        toggle.classList.remove("is-pulsing");
    });
    try {
      setEnabled(window.localStorage.getItem(storageKey) === "true");
    } catch (err) {
      setEnabled(false);
    }
  };

  SongSheet.prototype._mountScrollRegion = function () {
    if (this._scrollRegion) return;

    var wrapper = document.createElement("div");
    wrapper.className = "song-scroll-region";

    var parent = this.parentNode;
    if (!parent) return;

    parent.insertBefore(wrapper, this);
    wrapper.appendChild(this);

    var next = wrapper.nextElementSibling;
    if (next && next.classList && next.classList.contains("source-link")) {
      wrapper.appendChild(next);
    }

    document.body.classList.add("has-song-scroll-region");
    this._scrollRegion = wrapper;
    var manualScrollTimer = 0;
    var pointerScrolling = false;

    function showManualScrollbar() {
      if (!document.body.classList.contains("teleprompter-active")) return;
      document.body.classList.add("teleprompter-manual-scroll");
      if (manualScrollTimer) window.clearTimeout(manualScrollTimer);
      manualScrollTimer = window.setTimeout(function () {
        document.body.classList.remove("teleprompter-manual-scroll");
        manualScrollTimer = 0;
      }, 700);
    }

    function updateHeight() {
      var viewportHeight =
        window.innerHeight || document.documentElement.clientHeight || 0;
      var top = wrapper.getBoundingClientRect().top;
      var height = Math.max(180, viewportHeight - top - 16);
      wrapper.style.height = height + "px";
      if (document.body.classList.contains("teleprompter-active")) {
        document.body.style.setProperty(
          "--teleprompter-end-padding",
          Math.max(96, Math.round(height * 0.42)) + "px",
        );
      }
    }

    this._updateScrollRegionHeight = updateHeight;
    window.addEventListener("resize", updateHeight);
    wrapper.addEventListener("wheel", showManualScrollbar, { passive: true });
    wrapper.addEventListener("touchstart", showManualScrollbar, {
      passive: true,
    });
    wrapper.addEventListener("touchmove", showManualScrollbar, {
      passive: true,
    });
    wrapper.addEventListener("pointerdown", function () {
      pointerScrolling = true;
    });
    window.addEventListener("pointerup", function () {
      pointerScrolling = false;
    });
    window.addEventListener("pointercancel", function () {
      pointerScrolling = false;
    });
    wrapper.addEventListener(
      "scroll",
      function () {
        if (host._syncTeleprompterScrollPosition) {
          host._syncTeleprompterScrollPosition();
        }
        if (pointerScrolling) showManualScrollbar();
      },
      { passive: true },
    );
    document.addEventListener("keydown", function (event) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "PageDown" ||
        event.key === "PageUp" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === " "
      ) {
        showManualScrollbar();
      }
    });
    updateHeight();
  };

  SongSheet.prototype._mountChordToggle = function () {
    var title = document.querySelector("h1");
    if (!title) return;
    var lead = document.querySelector(".lead");

    var bar =
      title.parentNode &&
      title.parentNode.classList &&
      title.parentNode.classList.contains("song-titlebar")
        ? title.parentNode
        : null;

    if (!bar) {
      bar = document.createElement("div");
      bar.className = "song-titlebar";
      title.parentNode.insertBefore(bar, title);
    }

    var copy = bar.querySelector(".song-heading");
    if (!copy) {
      copy = document.createElement("div");
      copy.className = "song-heading";
      bar.insertBefore(copy, bar.firstChild);
    }

    if (title.parentNode !== copy) copy.appendChild(title);
    if (lead && lead.parentNode !== copy) copy.appendChild(lead);

    if (bar.querySelector(".chord-toggle")) return;

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "chord-toggle";
    toggle.setAttribute("aria-pressed", "true");
    toggle.setAttribute("aria-label", "Ocultar acordes");
    toggle.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="m11.9 12.1 4.514-4.514"></path>' +
      '<path d="M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 17.828 7h1.344a2 2 0 0 0 1.414-.586L21.7 5.3a1 1 0 0 0 0-1.4z"></path>' +
      '<path d="m6 16 2 2"></path>' +
      '<path d="M8.23 9.85A3 3 0 0 1 11 8a5 5 0 0 1 5 5 3 3 0 0 1-1.85 2.77l-.92.38A2 2 0 0 0 12 18a4 4 0 0 1-4 4 6 6 0 0 1-6-6 4 4 0 0 1 4-4 2 2 0 0 0 1.85-1.23z"></path>' +
      "</svg>";
    bar.appendChild(toggle);

    var host = this;

    function pulseButton(button) {
      button.classList.remove("is-pulsing");
      void button.offsetWidth;
      button.classList.add("is-pulsing");
    }

    toggle.addEventListener("click", function () {
      var hidden = host.getAttribute("data-chords-hidden") === "true";
      if (hidden) {
        host.removeAttribute("data-chords-hidden");
        toggle.setAttribute("aria-pressed", "true");
        toggle.setAttribute("aria-label", "Ocultar acordes");
        // Los acordes vuelven a mostrarse: recalcular la separación anti-solape.
        host._preventChordOverlap(host._root);
      } else {
        host.setAttribute("data-chords-hidden", "true");
        toggle.setAttribute("aria-pressed", "false");
        toggle.setAttribute("aria-label", "Mostrar acordes");
        // Con los acordes ocultos el margin-right sólo agregaría espacio
        // extra entre palabras sin motivo visible: lo limpiamos.
        var sobres = host._root.querySelectorAll(".letra .sobre");
        for (var i = 0; i < sobres.length; i++)
          sobres[i].style.marginRight = "";
      }
      pulseButton(toggle);
    });

    toggle.addEventListener("animationend", function (event) {
      if (event.animationName === "toggle-pulse")
        toggle.classList.remove("is-pulsing");
    });
  };

  // Registro. Idempotente por si el script se carga dos veces.
  if (
    typeof customElements !== "undefined" &&
    !customElements.get("song-sheet")
  ) {
    customElements.define("song-sheet", SongSheet);
  }
})();
