// Plucked-string synthesis (Karplus-Strong) rendered into an AudioBuffer per
// note. Self-contained: no samples are downloaded.
const OPEN = [64, 59, 55, 50, 45, 40];
const SIXTEENTH = 0.15;
const cache = new Map();
let context;

function pluck(midi, seconds) {
  const rate = context.sampleRate;
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const period = Math.max(2, Math.round(rate / frequency));
  const buffer = context.createBuffer(1, Math.round(rate * seconds), rate);
  const data = buffer.getChannelData(0);
  const ring = Float32Array.from({ length: period }, () => Math.random() * 2 - 1);
  for (let i = 0; i < data.length; i++) {
    const j = i % period;
    data[i] = ring[j];
    ring[j] = (ring[j] + ring[(j + 1) % period]) * .4975;
  }
  return buffer;
}

function sound(midi) {
  if (!cache.has(midi)) cache.set(midi, pluck(midi, 2.5));
  return cache.get(midi);
}

function sixteenthsPerBar(meter) {
  const [beats, unit] = meter.split('/').map(Number);
  return beats * 16 / unit;
}

// Schedules the snapshots in order. onItem(index) fires as each bar starts and
// onItem(-1) when playback ends. Returns { stop, finished }.
export function playSnapshots(snapshots, onItem) {
  context ??= new AudioContext();
  context.resume();
  const master = context.createGain();
  master.gain.value = .6;
  master.connect(context.destination);
  const start = context.currentTime + .1;
  const timers = [];
  const voices = new Map();
  let offset = 0;
  snapshots.forEach((snapshot, index) => {
    const origin = start + offset * SIXTEENTH;
    timers.push(setTimeout(() => onItem(index), (origin - context.currentTime) * 1000));
    [...snapshot.notes].filter(note => note.active !== false).sort((a, b) => a.at - b.at).forEach(note => {
      const at = origin + note.at * SIXTEENTH;
      const source = context.createBufferSource();
      // A string rings until it is plucked again.
      voices.get(note.string)?.stop(at);
      voices.set(note.string, source);
      source.buffer = sound(OPEN[note.string - 1] + note.fret);
      source.connect(master);
      source.start(at);
    });
    offset += sixteenthsPerBar(snapshot.meter);
  });
  let done;
  const finished = new Promise(resolve => { done = resolve; });
  const end = start + offset * SIXTEENTH + 1.5;
  timers.push(setTimeout(() => { onItem(-1); done(); }, (end - context.currentTime) * 1000));
  function stop() {
    timers.forEach(clearTimeout);
    master.gain.setTargetAtTime(0, context.currentTime, .03);
    setTimeout(() => master.disconnect(), 400);
    onItem(-1);
    done();
  }
  return { stop, finished };
}
