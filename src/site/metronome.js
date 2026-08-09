(function () {
  'use strict';

  var MIN_BPM = 30;
  var MAX_BPM = 260;
  var PITCHES = [
    { value: 'C', label: 'C', frequency: 523.25 },
    { value: 'C#', label: 'C#', frequency: 554.37 },
    { value: 'D', label: 'D', frequency: 587.33 },
    { value: 'D#', label: 'D#', frequency: 622.25 },
    { value: 'E', label: 'E', frequency: 659.25 },
    { value: 'F', label: 'F', frequency: 698.46 },
    { value: 'F#', label: 'F#', frequency: 739.99 },
    { value: 'G', label: 'G', frequency: 783.99 },
    { value: 'G#', label: 'G#', frequency: 830.61 },
    { value: 'A', label: 'A', frequency: 880.0 },
    { value: 'A#', label: 'A#', frequency: 932.33 },
    { value: 'B', label: 'B', frequency: 987.77 },
  ];
  var SUBDIVISIONS = [
    { value: 1, label: '1', titleKey: 'quarter' },
    { value: 2, label: '2', titleKey: 'eighth' },
    { value: 3, label: '3', titleKey: 'triplet' },
    { value: 4, label: '4', titleKey: 'sixteenth' },
  ];

  function tempoName(bpm, labels) {
    if (bpm < 60) return labels.largo;
    if (bpm < 76) return labels.adagio;
    if (bpm < 108) return labels.andante;
    if (bpm < 120) return labels.moderato;
    if (bpm < 156) return labels.allegro;
    if (bpm < 200) return labels.vivace;
    return labels.presto;
  }

  function clampBpm(value) {
    return Math.min(MAX_BPM, Math.max(MIN_BPM, value));
  }

  function setupMetronome(root) {
    var labels = {
      largo: root.dataset.titleLargo,
      adagio: root.dataset.titleAdagio,
      andante: root.dataset.titleAndante,
      moderato: root.dataset.titleModerato,
      allegro: root.dataset.titleAllegro,
      vivace: root.dataset.titleVivace,
      presto: root.dataset.titlePresto,
      start: root.dataset.startLabel,
      stop: root.dataset.stopLabel,
      mute: root.dataset.muteLabel,
      unmute: root.dataset.unmuteLabel,
      volumeOn: root.dataset.volumeOnIcon,
      volumeOff: root.dataset.volumeOffIcon,
      quarter: root.dataset.subdivisionQuarter,
      eighth: root.dataset.subdivisionEighth,
      triplet: root.dataset.subdivisionTriplet,
      sixteenth: root.dataset.subdivisionSixteenth,
    };

    var state = {
      bpm: 100,
      beatsPerMeasure: 4,
      subdivision: 1,
      volume: 0.8,
      pitch: 'E',
      muted: false,
      isPlaying: false,
      activeBeat: -1,
      swing: 1,
    };

    var audioCtx = null;
    var nextNoteTime = 0;
    var currentTick = 0;
    var timerId = null;
    var rafId = null;
    var queue = [];

    var bpmValue = root.querySelector('.metronome-bpm-value');
    var tempoNameEl = root.querySelector('.metronome-tempo-name');
    var bpmSlider = root.querySelector('[data-role="bpm-slider"]');
    var volumeSlider = root.querySelector('[data-role="volume-slider"]');
    var beatsWrap = root.querySelector('[data-role="beats-options"]');
    var subdivisionWrap = root.querySelector('[data-role="subdivision-options"]');
    var pitchSelect = root.querySelector('[data-role="pitch-select"]');
    var beatsDots = root.querySelector('.metronome-beats');
    var startBtn = root.querySelector('[data-action="toggle-play"]');
    var muteBtn = root.querySelector('[data-action="toggle-mute"]');
    var pendulumArm = root.querySelector('.metronome-pendulum-arm');

    function secondsPerBeat() {
      return 60 / state.bpm;
    }

    function ensureAudioContext() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      return audioCtx;
    }

    function currentPitchFrequency() {
      var match = PITCHES.find(function (pitch) {
        return pitch.value === state.pitch;
      });
      return match ? match.frequency : 659.25;
    }

    function scheduleTick(tick, time) {
      var ctx = audioCtx;
      if (!ctx) return;

      var ticksPerMeasure = state.beatsPerMeasure * state.subdivision;
      var tickInMeasure = tick % ticksPerMeasure;
      var isMeasureStart = tickInMeasure === 0;
      var isBeatStart = tickInMeasure % state.subdivision === 0;

      queue.push({
        tickInMeasure: tickInMeasure,
        time: time,
        subdivision: state.subdivision,
      });

      if (state.muted || state.volume <= 0) return;

      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var baseFrequency = currentPitchFrequency();
      var freq = baseFrequency / 2;
      var peak = state.volume * 0.4;

      if (isMeasureStart) {
        freq = baseFrequency * 2;
        peak = state.volume;
      } else if (isBeatStart) {
        freq = baseFrequency;
        peak = state.volume * 0.7;
      }

      osc.frequency.value = freq;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(peak, time + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.06);
    }

    function scheduler() {
      var ctx = audioCtx;
      if (!ctx) return;

      while (nextNoteTime < ctx.currentTime + 0.1) {
        scheduleTick(currentTick, nextNoteTime);
        nextNoteTime += secondsPerBeat() / state.subdivision;
        currentTick += 1;
      }
      timerId = window.setTimeout(scheduler, 25);
    }

    function draw() {
      var ctx = audioCtx;
      if (ctx) {
        while (queue.length && queue[0].time <= ctx.currentTime) {
          var note = queue.shift();
          var isBeatStart = note.tickInMeasure % note.subdivision === 0;
          if (isBeatStart) {
            state.activeBeat = Math.floor(note.tickInMeasure / note.subdivision);
            state.swing = state.swing === 1 ? -1 : 1;
            render();
          }
        }
      }
      rafId = window.requestAnimationFrame(draw);
    }

    function stop() {
      if (timerId) window.clearTimeout(timerId);
      if (rafId) window.cancelAnimationFrame(rafId);
      timerId = null;
      rafId = null;
      queue = [];
      state.isPlaying = false;
      state.activeBeat = -1;
      render();
    }

    function start() {
      var ctx = ensureAudioContext();
      var resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
      resume.then(function () {
        currentTick = 0;
        queue = [];
        nextNoteTime = ctx.currentTime + 0.05;
        state.isPlaying = true;
        scheduler();
        rafId = window.requestAnimationFrame(draw);
        render();
      });
    }

    function toggle() {
      if (state.isPlaying) stop();
      else start();
    }

    function renderBeatDots() {
      beatsDots.innerHTML = '';
      for (var i = 0; i < state.beatsPerMeasure; i += 1) {
        var dot = document.createElement('span');
        dot.className = 'metronome-beat-dot';
        if (i === 0) dot.classList.add('is-accent');
        if (i === state.activeBeat) dot.classList.add('is-active');
        beatsDots.appendChild(dot);
      }
    }

    function renderMeasureOptions() {
      beatsWrap.innerHTML = '';
      [2, 3, 4, 5, 6, 7].forEach(function (value) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'metronome-option-btn';
        if (state.beatsPerMeasure === value) button.classList.add('is-selected');
        button.textContent = String(value);
        button.setAttribute('aria-pressed', state.beatsPerMeasure === value ? 'true' : 'false');
        button.addEventListener('click', function () {
          state.beatsPerMeasure = value;
          state.activeBeat = -1;
          render();
        });
        beatsWrap.appendChild(button);
      });
    }

    function renderSubdivisionOptions() {
      subdivisionWrap.innerHTML = '';
      SUBDIVISIONS.forEach(function (item) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'metronome-option-btn metronome-option-btn-wide';
        if (state.subdivision === item.value) button.classList.add('is-selected');
        button.textContent = item.label;
        button.title = labels[item.titleKey];
        button.setAttribute('aria-label', labels[item.titleKey]);
        button.setAttribute('aria-pressed', state.subdivision === item.value ? 'true' : 'false');
        button.addEventListener('click', function () {
          state.subdivision = item.value;
          state.activeBeat = -1;
          render();
        });
        subdivisionWrap.appendChild(button);
      });
    }

    function renderPitchOptions() {
      pitchSelect.innerHTML = '';
      PITCHES.forEach(function (pitch) {
        var option = document.createElement('option');
        option.value = pitch.value;
        option.textContent = pitch.label;
        option.selected = pitch.value === state.pitch;
        pitchSelect.appendChild(option);
      });
      pitchSelect.value = state.pitch;
    }

    function render() {
      bpmValue.textContent = String(state.bpm);
      bpmSlider.value = String(state.bpm);
      volumeSlider.value = String(state.muted ? 0 : state.volume);
      tempoNameEl.textContent = tempoName(state.bpm, labels);
      startBtn.textContent = state.isPlaying ? labels.stop : labels.start;
      startBtn.setAttribute('aria-label', state.isPlaying ? labels.stop : labels.start);
      muteBtn.textContent = state.muted || state.volume === 0 ? labels.volumeOff : labels.volumeOn;
      muteBtn.setAttribute('aria-label', state.muted ? labels.unmute : labels.mute);
      pendulumArm.style.transform = 'translateX(-50%) rotate(' + (state.isPlaying ? state.swing * 26 : 0) + 'deg)';
      pendulumArm.style.transition = state.isPlaying
        ? 'transform ' + secondsPerBeat() + 's cubic-bezier(0.5,0,0.5,1)'
        : 'transform 0.3s ease';

      renderBeatDots();
      renderMeasureOptions();
      renderSubdivisionOptions();
      renderPitchOptions();
    }

    root.querySelector('[data-action="decrease-bpm"]').addEventListener('click', function () {
      state.bpm = clampBpm(state.bpm - 1);
      render();
    });
    root.querySelector('[data-action="increase-bpm"]').addEventListener('click', function () {
      state.bpm = clampBpm(state.bpm + 1);
      render();
    });
    bpmSlider.addEventListener('input', function (event) {
      state.bpm = clampBpm(Number(event.target.value));
      render();
    });
    volumeSlider.addEventListener('input', function (event) {
      state.volume = Number(event.target.value);
      state.muted = false;
      render();
    });
    pitchSelect.addEventListener('change', function (event) {
      state.pitch = event.target.value;
      render();
    });
    startBtn.addEventListener('click', toggle);
    muteBtn.addEventListener('click', function () {
      state.muted = !state.muted;
      render();
    });

    window.addEventListener('keydown', function (event) {
      if (event.code === 'Space' && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        toggle();
      }
    });

    window.addEventListener('pagehide', function () {
      stop();
      if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
      }
    });

    render();
  }

  document.querySelectorAll('.metronome-widget').forEach(setupMetronome);
})();
