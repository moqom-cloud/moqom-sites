// ñü.ŵævẽš player: the original 2008 stereo file and its separated instruments play in step, and a toggle
// crossfades between them. Every sound (instrument, clone, stair creak, tuning fork) runs through its own HRTF panner,
// placed where it sits in the orb, then through the room. Everything renders in the browser; nothing is sent anywhere.
import { createOrb, type Orb, type Pos } from './orb';

type Venue = { rt: number; wet: number; pre: number; pos: Record<string, Pos> };

const VENUES: Record<string, Venue> = {
  room: {
    rt: 0.45, wet: 0.12, pre: 0.004,
    pos: { drums: { x: 0, y: 1.3, z: 0 }, piano: { x: -1, y: 0.9, z: 0 }, synths: { x: 1.1, y: 0.5, z: 0.4 }, guitar: { x: 0.8, y: 1.1, z: 0.2 }, bass: { x: -0.3, y: 0.7, z: -0.4 } },
  },
  club: {
    rt: 0.9, wet: 0.2, pre: 0.012,
    pos: { drums: { x: 0, y: 2.6, z: 0.7 }, piano: { x: -1.9, y: 1.4, z: 0 }, synths: { x: 1.1, y: 0.5, z: 1.7 }, guitar: { x: 2.3, y: 1.6, z: -0.3 }, bass: { x: -0.9, y: 1, z: -0.8 } },
  },
  hall: {
    rt: 2.1, wet: 0.32, pre: 0.025,
    pos: { drums: { x: 0, y: 3.4, z: 0.9 }, piano: { x: -2.3, y: 2.6, z: 0.3 }, synths: { x: 1.4, y: 2.2, z: 1.8 }, guitar: { x: 2.6, y: 3, z: -0.1 }, bass: { x: -1.1, y: 3.2, z: -0.7 } },
  },
  stadium: {
    rt: 3.2, wet: 0.38, pre: 0.06,
    pos: { drums: { x: 0, y: 3.4, z: 1.6 }, piano: { x: -3, y: 2, z: 0.8 }, synths: { x: 2.6, y: -1.6, z: 2 }, guitar: { x: 2.4, y: 2.2, z: 1 }, bass: { x: 0, y: 2.8, z: 0.4 } },
  },
  festival: {
    rt: 1.4, wet: 0.24, pre: 0.03,
    pos: { drums: { x: 0, y: 2.6, z: 0.4 }, piano: { x: -2.4, y: -1.4, z: 1 }, synths: { x: 2.2, y: -1.4, z: 2 }, guitar: { x: 2.2, y: 1.8, z: 0.6 }, bass: { x: 0, y: 1, z: -0.5 } },
  },
};
type TrackKind = 'song' | 'creek' | 'scream' | 'fork';
type Track = {
  id: string;
  title: string;
  by: string;
  spec: string;
  dur: number;
  kind: TrackKind;
  hz?: number;
  label?: string;
  pos?: Pos;
  mark: string;
  hzLine?: string;
};
const fork = (id: string, title: string, label: string, hz: number, planet: string, pos: Pos, mark: string): Track => ({
  id,
  title,
  by: `khėnsu.ñü · ${planet}`,
  spec: `${hz.toFixed(2)} Hz · ${planet}`,
  dur: 8,
  kind: 'fork',
  hz,
  label,
  pos,
  mark,
  hzLine: planet,
});
// Planetary chakra forks, bottom to top. Third eye stays at 221.23 Hz, the figure already on this page.
const TRACKS: Record<string, Track> = {
  attempt: {
    id: 'attempt',
    title: 'First Attempt (Demo)',
    by: 'khėnsu.ñü · More Of The Same · 2008',
    spec: '5 instruments in 3D · 48 kHz · 9.1 MB · 6:40',
    dur: 400,
    kind: 'song',
    mark: '',
  },
  creek: {
    id: 'creek',
    title: 'Stair Creek',
    by: 'khėnsu.ñü · ñü.ŵævẽš · healing',
    spec: 'One sound beside you · rendered in the browser · loops',
    dur: 48,
    kind: 'creek',
    label: 'Stair Creek',
    pos: { x: -1.5, y: -1.6, z: -0.6 },
    mark: '#3d8f8a',
    hzLine: 'a creek',
  },
  scream: {
    id: 'scream',
    title: 'Wilhelm Scream',
    by: 'khėnsu.ñü · Wikimedia Commons · CC0',
    spec: 'The 1951 Wilhelm scream · 1.6 s',
    dur: 1.62,
    kind: 'scream',
    label: 'Wilhelm',
    pos: { x: -0.7, y: 1.8, z: 0.15 },
    mark: '#c8c2b8',
    hzLine: 'a yell',
  },
  root: fork('root', 'Muladhara', 'Muladhara', 194.18, 'Root', { x: 0, y: 0.4, z: -1.2 }, '#ff4b4b'),
  sacral: fork('sacral', 'Svadhisthana', 'Svadhisthana', 210.42, 'Sacral', { x: 0.15, y: 0.4, z: -0.75 }, '#ff8a3c'),
  solar: fork('solar', 'Manipura', 'Manipura', 126.22, 'Solar plexus', { x: -0.1, y: 0.45, z: -0.4 }, '#ffd23c'),
  heart: fork('heart', 'Anahata', 'Anahata', 136.1, 'Heart', { x: 0, y: 0.5, z: -0.12 }, '#3ccf7a'),
  throat: fork('throat', 'Vishuddha', 'Vishuddha', 141.27, 'Throat', { x: 0, y: 0.42, z: 0.08 }, '#38a8ff'),
  eye: fork('eye', 'Ajna', 'Ajna', 221.23, 'Third eye', { x: 0, y: 0.45, z: 0.22 }, '#6c6cff'),
  crown: fork('crown', 'Sahasrara', 'Sahasrara', 172.06, 'Crown', { x: 0, y: 0.2, z: 0.55 }, '#b07cff'),
};
const CHAKRA_ORDER = ['root', 'sacral', 'solar', 'heart', 'throat', 'eye', 'crown'];
const ORIG_SPEC = 'AAC-LC · stereo · 44.1 kHz · 9.6 MB · 6:40';
const OPUS_SPEC = 'Opus · 5.1 · 48 kHz · 17.6 MB · 6:40';
const MEDIA_SPEC = '5 instruments in 3D · 48 kHz · 9.1 MB · 6:40';
type SongMode = 'orig' | 'opus' | 'media' | 'wave';
const MAX_R = 4; // metres to the edge of the orb
const MAX_CLONES = 12;
const FADE_S = 2; // a cloned or removed sound fades in or out over this long, so there is no tick
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** ñü.ÊQ, on top of the clean instruments. "Match original" is tuned by ear to the 2008 file's room, with no extra bounces. */
type Fx = { gain: number; wet: number; rt: number; pre: number; bounces: number }; // dB, 0–100 %, seconds, milliseconds, count
const PRESETS: Record<string, Fx> = {
  original: { gain: 0, wet: 45, rt: 1.8, pre: 25, bounces: 0 },
  clean: { gain: 0, wet: 0, rt: 1.8, pre: 0, bounces: 0 },
};
const ECHO_TAPS = 8;

/** A room impulse: a few early reflections, then decaying noise, slightly different in each ear. Pre-delay is a separate node. */
function impulse(ctx: BaseAudioContext, rt: number) {
  const len = Math.ceil(rt * ctx.sampleRate);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const n = (Math.random() * 2 - 1) * Math.exp((-6.9 * i) / ctx.sampleRate / rt);
      lp += 0.04 * (n - lp);
      d[i] = lp;
    }
    for (let k = 1; k <= 6; k++) {
      const i = Math.floor(ctx.sampleRate * 0.007 * k * (1 + 0.13 * c));
      if (i < len) d[i] += (c ? -0.18 : 0.18) / k;
    }
  }
  return buf;
}

/** A short loop of a creek: low water, a slow swell, and a few bubbles. */
function creek(ctx: BaseAudioContext) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 4);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < len; i++) {
    brown = brown * 0.985 + (Math.random() * 2 - 1) * 0.015;
    const swell = 0.62 + 0.38 * Math.sin((2 * Math.PI * i) / sr / 1.7);
    d[i] = brown * swell;
  }
  for (let n = 0; n < 14; n++) {
    const at = Math.floor(Math.random() * (len - sr * 0.04));
    const f = 500 + Math.random() * 700;
    for (let k = 0; k < sr * 0.03; k++) d[at + k] += 0.55 * Math.sin((2 * Math.PI * f * k) / sr) * Math.exp(-k / (sr * 0.007));
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
  const g = peak > 0 ? 0.4 / peak : 1;
  for (let i = 0; i < len; i++) d[i] *= g;
  return buf;
}

/** Hold, then fade. The attack stretches to the crossfade when a chakra hands off to the next. */
function strike(ctx: AudioContext, out: AudioNode, t: number, f: number, hold: number, fade: number, attack: number) {
  const voice = (freq: number, amp: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    const end = t + hold + fade;
    const rise = t + Math.max(0.02, Math.min(attack, hold));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, rise);
    g.gain.setValueAtTime(amp, t + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, Math.max(rise + 0.02, end));
    o.connect(g).connect(out);
    o.start(t);
    o.stop(end + 0.05);
  };
  voice(f, 0.2);
  voice(f + 0.6, 0.035);
  const clang = ctx.createOscillator();
  const cg = ctx.createGain();
  clang.frequency.value = f * 6.27;
  cg.gain.setValueAtTime(0.04, t);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  clang.connect(cg).connect(out);
  clang.start(t);
  clang.stop(t + 0.35);
}

type Kind = 'stem' | 'creek' | 'scream' | 'fork';
type Obj = {
  key: string;
  kind: Kind;
  stem?: string; // which instrument a stem or its clone plays
  label: string;
  bubble: HTMLElement;
  node: HTMLButtonElement;
  pos: Pos;
  hz?: number;
  el?: HTMLAudioElement;
  panner?: PannerNode;
  meter?: AnalyserNode;
  out?: GainNode; // synth sounds feed this
  fade?: GainNode; // stems and clones pass through this; clone and remove ramp it over FADE_S so nothing clicks
  src?: AudioBufferSourceNode;
  timer?: number;
  clone: boolean;
  gone?: boolean;
};

const root = document.querySelector<HTMLElement>('[data-spatial]');
if (root) {
  const orig = root.querySelector<HTMLAudioElement>('[data-orig]')!;
  const opus = root.querySelector<HTMLAudioElement>('[data-opus]')!;
  const play = root.querySelector<HTMLButtonElement>('[data-play]')!;
  const seek = root.querySelector<HTMLInputElement>('[data-seek]')!;
  const loopBtn = root.querySelector<HTMLButtonElement>('[data-loop]')!;
  const cur = root.querySelector<HTMLElement>('[data-cur]')!;
  const dur = root.querySelector<HTMLElement>('[data-dur]')!;
  const label = root.querySelector<HTMLElement>('[data-label]')!;
  const titleEl = root.querySelector<HTMLElement>('[data-title]')!;
  const byEl = root.querySelector<HTMLElement>('[data-by]')!;
  const specEl = root.querySelector<HTMLElement>('[data-spec]')!;
  const art = root.querySelector<HTMLImageElement>('[data-art]')!;
  const markName = root.querySelector<HTMLElement>('[data-mark-name]')!;
  const markHz = root.querySelector<HTMLElement>('[data-mark-hz]')!;
  const bloom = root.querySelector<HTMLImageElement>('.sp-bloom')!;
  const card = root.querySelector<HTMLElement>('.sp-card')!;
  const modeBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-song-modes] [data-mode]')];
  const trackBtns = [...root.querySelectorAll<HTMLButtonElement>('.sp-tracks [data-track]')];
  const venueBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-venue]')];
  const ring = root.querySelector<HTMLElement>('[data-ring]')!;
  const canvas = ring.querySelector<HTMLCanvasElement>('[data-orb]')!;
  const template = ring.querySelector<HTMLTemplateElement>('[data-node-template]')!;
  const dirs = [...ring.querySelectorAll<HTMLElement>('[data-dir]')];
  const height = root.querySelector<HTMLInputElement>('[data-height]')!;
  const heightOut = root.querySelector<HTMLElement>('[data-height-out]')!;
  const picked = root.querySelector<HTMLElement>('[data-picked]')!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const fxBox = root.querySelector<HTMLElement>('[data-fx]')!;
  const fxIn = {
    gain: fxBox.querySelector<HTMLInputElement>('[data-fx-gain]')!,
    wet: fxBox.querySelector<HTMLInputElement>('[data-fx-wet]')!,
    rt: fxBox.querySelector<HTMLInputElement>('[data-fx-rt]')!,
    pre: fxBox.querySelector<HTMLInputElement>('[data-fx-pre]')!,
    bounces: fxBox.querySelector<HTMLInputElement>('[data-fx-bounces]')!,
  };
  const presetBtns = [...fxBox.querySelectorAll<HTMLButtonElement>('[data-preset]')];
  let venue = 'hall';
  const venueFx = (id: string) => {
    const v = VENUES[id];
    return { wet: Math.round((v.wet / 0.8) * 100), rt: v.rt, pre: Math.round(v.pre * 1000) };
  };
  const VENUE_WHY: Record<string, string> = {
    room: 'Private room. Close and dry, an arm’s length away.',
    club: 'Club. Drums a few steps away, keys either side.',
    hall: 'Concert hall. Strings, winds and piano, written as a film score.',
    stadium: 'Stadium. The band far ahead, the room all the way round.',
    festival: 'Festival. Kick and bass centred, the rest wrapping around.',
  };
  const fx: Fx = { gain: 0, bounces: 0, ...venueFx(venue) };

  let mode: SongMode = (root.dataset.mode as SongMode) || 'media';
  if (mode === 'wave') mode = 'media';
  let trackId = 'attempt';
  let started = false;
  let playing = false;
  let playhead = 0;
  let playStamp = 0;
  let serial = 0;
  let aimX = 0.34;
  let aimY = 0.42;
  let tiltX = 0.34;
  let tiltY = 0.42;
  let cardKick = 1;
  const cardT0 = performance.now();
  let creekBuf: AudioBuffer | null = null;
  let screamBuf: AudioBuffer | null = null;
  let cycling = false;
  const tone = { hold: 8, fade: 4, cross: 2 };
  const toneDur = () => tone.hold + tone.fade;
  const playDur = () => (track().kind === 'fork' ? toneDur() : track().dur);

  const STEM_MARK: Record<string, string> = { drums: '#e8e4dc', piano: '#f4f1ea', synths: '#7ec8ff', guitar: '#c8a2ff', bass: '#6dffbf' };
  const objs: Obj[] = [...ring.querySelectorAll<HTMLButtonElement>('.sp-node[data-node]')].map((node) => {
    const stem = node.dataset.node!;
    node.style.setProperty('--mark', STEM_MARK[stem] ?? '#7ee0ff');
    return {
      key: stem,
      kind: 'stem' as Kind,
      stem,
      label: node.dataset.label!,
      bubble: node.parentElement as HTMLElement,
      node,
      pos: { ...VENUES[venue].pos[stem] },
      el: root.querySelector<HTMLAudioElement>(`[data-stem="${stem}"]`)!,
      clone: false,
    };
  });
  let selected = objs[0];
  const looping = () => loopBtn.getAttribute('aria-pressed') === 'true';
  const shown = () => objs.filter((o) => !o.gone && !o.bubble.hidden);
  const track = () => TRACKS[trackId];

  let ctx: AudioContext | null = null;
  let origGain: GainNode, opusGain: GainNode, waveGain: GainNode, dry: GainNode, wet: GainNode, verb: ConvolverNode;
  let bus: GainNode, sum: GainNode, makeup: GainNode, user: GainNode, preDelay: DelayNode, extrasDry: GainNode, echoIn: GainNode;
  let echoDelays: DelayNode[], echoGains: GainNode[];
  let origMeter: AnalyserNode, waveMeter: AnalyserNode;
  let origPow = 0;
  let wavePow = 0;
  let builtRt = 0;
  const meterBuf = new Float32Array(1024);

  const panner = (c: AudioContext) =>
    new PannerNode(c, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 2, maxDistance: 12, rolloffFactor: 0.45 });

  /** Wires one sound into the graph: stems and their clones into the song's bus, synth sounds alongside it. */
  const wire = (o: Obj) => {
    if (!ctx || o.panner) return;
    o.panner = panner(ctx);
    o.meter = ctx.createAnalyser();
    o.meter.fftSize = 1024;
    if (o.kind === 'stem') {
      const src = ctx.createMediaElementSource(o.el!);
      let into: AudioNode = src;
      if (o.stem === 'piano') {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 6200;
        lp.Q.value = 0.6;
        const soft = ctx.createDynamicsCompressor();
        soft.threshold.value = -16;
        soft.knee.value = 10;
        soft.ratio.value = 2.5;
        soft.attack.value = 0.004;
        soft.release.value = 0.14;
        src.connect(lp).connect(soft);
        into = soft;
      }
      o.fade = ctx.createGain();
      into.connect(o.fade).connect(o.panner).connect(bus);
      o.fade.connect(o.meter);
    } else {
      o.out = ctx.createGain();
      o.out.connect(o.panner);
      o.out.connect(o.meter);
      // Extras sit in the same room, and stay audible when you switch to the original.
      o.panner.connect(extrasDry);
      o.panner.connect(preDelay);
      o.panner.connect(echoIn);
    }
    place(o);
  };

  const graph = () => {
    if (ctx) return ctx;
    ctx = new AudioContext({ latencyHint: 'playback' });
    origGain = ctx.createGain();
    opusGain = ctx.createGain();
    waveGain = ctx.createGain();
    dry = ctx.createGain();
    wet = ctx.createGain();
    verb = ctx.createConvolver();
    bus = ctx.createGain();
    bus.gain.value = 0.55;
    sum = ctx.createGain();
    makeup = ctx.createGain();
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3;
    lim.knee.value = 6;
    lim.ratio.value = 12;
    lim.attack.value = 0.002;
    lim.release.value = 0.08;
    user = ctx.createGain();
    extrasDry = ctx.createGain();
    preDelay = ctx.createDelay(0.5);
    echoIn = ctx.createGain();
    echoDelays = [];
    echoGains = [];
    for (let i = 0; i < ECHO_TAPS; i++) {
      const d = ctx.createDelay(4);
      const g = ctx.createGain();
      g.gain.value = 0;
      echoIn.connect(d).connect(g).connect(sum);
      echoDelays.push(d);
      echoGains.push(g);
    }
    origMeter = ctx.createAnalyser();
    waveMeter = ctx.createAnalyser();
    origMeter.fftSize = waveMeter.fftSize = 2048;
    const o = ctx.createMediaElementSource(orig);
    o.connect(origGain).connect(ctx.destination);
    o.connect(origMeter);
    const op = ctx.createMediaElementSource(opus);
    op.connect(opusGain).connect(ctx.destination);
    // Instruments → room (dry + pre-delay → reverb) → loudness match → your gain → mode crossfade.
    bus.connect(dry).connect(sum);
    bus.connect(preDelay).connect(verb).connect(wet).connect(sum);
    bus.connect(echoIn);
    sum.connect(waveMeter);
    sum.connect(makeup).connect(lim).connect(user).connect(waveGain).connect(ctx.destination);
    extrasDry.connect(ctx.destination);
    for (const x of objs) wire(x);
    room();
    mix(true);
    return ctx;
  };

  // MARK: Room and effects

  const fxText = () => {
    const out = (k: string, v: string) => (fxBox.querySelector<HTMLElement>(`[data-fx-out="${k}"]`)!.textContent = v);
    out('gain', `${fx.gain > 0 ? '+' : ''}${fx.gain} dB`);
    out('wet', `${Math.round(fx.wet)}%`);
    out('rt', `${fx.rt.toFixed(1)} s`);
    out('pre', `${Math.round(fx.pre)} ms`);
    out('bounces', String(Math.round(fx.bounces)));
    fxIn.gain.value = String(fx.gain);
    fxIn.wet.value = String(fx.wet);
    fxIn.rt.value = String(fx.rt);
    fxIn.pre.value = String(fx.pre);
    fxIn.bounces.value = String(fx.bounces);
  };

  let rtTimer = 0;
  const room = () => {
    fxText();
    if (!ctx) return;
    const t = ctx.currentTime;
    const w = (fx.wet / 100) * 0.8;
    wet.gain.setTargetAtTime(w, t, 0.08);
    dry.gain.setTargetAtTime(1 - w * 0.5, t, 0.08);
    extrasDry.gain.setTargetAtTime(1 - w * 0.5, t, 0.08);
    preDelay.delayTime.setTargetAtTime(Math.min(0.45, fx.pre / 1000), t, 0.03);
    user.gain.setTargetAtTime(10 ** (fx.gain / 20), t, 0.05);
    const n = Math.round(fx.bounces);
    const gap = fx.pre / 1000;
    for (let i = 0; i < ECHO_TAPS; i++) {
      const on = i < n && gap > 0.005;
      const at = gap * (i + 1);
      echoDelays[i].delayTime.setTargetAtTime(on ? Math.min(3.8, at) : 0.001, t, 0.03);
      const amp = on ? Math.exp((-3 * at) / Math.max(0.15, fx.rt)) * 0.4 : 0;
      echoGains[i].gain.setTargetAtTime(amp, t, 0.05);
    }
    if (fx.rt !== builtRt) {
      clearTimeout(rtTimer);
      rtTimer = window.setTimeout(() => {
        builtRt = fx.rt;
        verb.buffer = impulse(ctx!, fx.rt);
      }, builtRt ? 120 : 0);
    }
  };

  const preset = (name: string | null) => {
    for (const b of presetBtns) b.setAttribute('aria-pressed', String(b.dataset.preset === name));
  };

  const level = (a: AnalyserNode) => {
    a.getFloatTimeDomainData(meterBuf);
    let s = 0;
    for (let i = 0; i < meterBuf.length; i++) s += meterBuf[i] * meterBuf[i];
    return s / meterBuf.length;
  };
  /** Keeps ñü.ŵævẽš at the original's loudness: both play in step all the time, so their levels can be compared live. */
  const matchLoudness = () => {
    if (!ctx || orig.paused) return;
    const po = level(origMeter);
    const pw = level(waveMeter);
    if (po < 1e-6 || pw < 1e-6) return;
    origPow = origPow ? origPow * 0.98 + po * 0.02 : po;
    wavePow = wavePow ? wavePow * 0.98 + pw * 0.02 : pw;
    const k = Math.min(1.6, Math.max(0.5, Math.sqrt(origPow / wavePow)));
    makeup.gain.setTargetAtTime(k, ctx.currentTime, 0.4);
  };

  const mix = (now = false) => {
    if (!ctx) return;
    const t = ctx.currentTime;
    const k = now ? 0.001 : 0.12;
    const stemsOn = mode === 'media' || mode === 'wave';
    origGain.gain.setTargetAtTime(mode === 'orig' ? 1 : 0, t, k);
    opusGain.gain.setTargetAtTime(mode === 'opus' ? 1 : 0, t, k);
    waveGain.gain.setTargetAtTime(stemsOn ? 1 : 0, t, k);
  };

  // MARK: Placing sounds

  const clamp = (p: Pos) => {
    const d = Math.hypot(p.x, p.y, p.z);
    if (d > MAX_R) {
      p.x *= MAX_R / d;
      p.y *= MAX_R / d;
      p.z *= MAX_R / d;
    }
  };

  const place = (o: Obj) => {
    const p = o.pos;
    const r = Math.hypot(p.x, p.y);
    const deg = Math.round(((Math.atan2(p.x, p.y) * 180) / Math.PI + 360) % 360);
    o.node.setAttribute('aria-label', `${o.label}: ${r.toFixed(1)} m away, ${deg}° clockwise from ahead, ${p.z >= 0 ? '+' : ''}${p.z.toFixed(1)} m high`);
    if (o.panner && ctx) {
      const t = ctx.currentTime;
      o.panner.positionX.setTargetAtTime(p.x, t, 0.03);
      o.panner.positionY.setTargetAtTime(p.z, t, 0.03);
      o.panner.positionZ.setTargetAtTime(-p.y, t, 0.03);
    }
  };

  const canRemove = () => shown().length > 1;

  const select = (o: Obj) => {
    selected = o;
    for (const x of objs) {
      x.node.setAttribute('aria-pressed', String(x === o));
      const rm = x.bubble.querySelector<HTMLButtonElement>('[data-remove]');
      if (rm) rm.disabled = !canRemove();
    }
    height.value = String(o.pos.z);
    heightOut.textContent = `${o.label} · ${o.pos.z >= 0 ? '+' : ''}${o.pos.z.toFixed(1)} m`;
  };

  // MARK: Clones and synthesised tracks

  const makeNode = (labelText: string) => {
    const bubble = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    const node = bubble.querySelector<HTMLButtonElement>('.sp-node')!;
    node.querySelector('span')!.textContent = labelText;
    ring.append(bubble);
    return { bubble, node };
  };

  const stopSynth = (o: Obj) => {
    clearTimeout(o.timer);
    o.timer = undefined;
    try { o.src?.stop(); } catch { /* already stopped */ }
    o.src = undefined;
  };

  const loadScream = async (c: AudioContext) => {
    if (screamBuf) return screamBuf;
    const res = await fetch('/khensu/sounds/wilhelm-scream.ogg');
    screamBuf = await c.decodeAudioData(await res.arrayBuffer());
    TRACKS.scream.dur = screamBuf.duration;
    return screamBuf;
  };

  const scheduleCycle = (o: Obj, fromId: string) => {
    if (!cycling || o.kind !== 'fork' || !ctx) return;
    const elapsed = Math.max(0, ctx.currentTime - playStamp);
    const wait = Math.max(0.05, tone.hold + tone.fade - tone.cross - elapsed);
    o.timer = window.setTimeout(() => {
      if (!cycling || !playing || trackId !== fromId) return;
      const i = CHAKRA_ORDER.indexOf(fromId);
      if (i < 0) return;
      void loadTrack(CHAKRA_ORDER[(i + 1) % CHAKRA_ORDER.length], true);
    }, wait * 1000);
  };

  const trigger = async (o: Obj) => {
    if (!ctx || !o.out || !playing) return;
    if (o.kind === 'fork') {
      const attack = cycling ? Math.max(0.04, tone.cross) : 0.04;
      strike(ctx, o.out, ctx.currentTime + 0.02, o.hz ?? 136.1, tone.hold, tone.fade, attack);
      scheduleCycle(o, trackId);
      return;
    }
    if (o.kind === 'creek') {
      if (o.src) return;
      const s = ctx.createBufferSource();
      s.buffer = creekBuf ?? (creekBuf = creek(ctx));
      s.loop = true;
      s.connect(o.out);
      s.start();
      o.src = s;
      return;
    }
    if (o.kind === 'scream') {
      try { o.src?.stop(); } catch { /* already stopped */ }
      const s = ctx.createBufferSource();
      s.buffer = await loadScream(ctx);
      s.connect(o.out);
      s.start();
      o.src = s;
      if (trackId === 'scream') {
        seek.max = String(TRACKS.scream.dur);
        dur.textContent = mmss(TRACKS.scream.dur);
      }
    }
  };

  const addObj = (o: Obj) => {
    objs.push(o);
    bind(o);
    if (ctx) wire(o);
    select(o);
    return o;
  };

  const addSynth = (kind: Kind, labelText: string, hz: number | undefined, pos: Pos, clone: boolean) => {
    graph();
    const made = makeNode(labelText);
    const meta = Object.values(TRACKS).find((tr) => tr.kind === kind && tr.label === labelText);
    if (meta?.mark) made.node.style.setProperty('--mark', meta.mark);
    return addObj({
      key: `${kind}-${++serial}`,
      kind,
      label: labelText,
      bubble: made.bubble,
      node: made.node,
      pos: { ...pos },
      hz,
      clone,
    });
  };

  /** Ramps a sound's level to `to` over FADE_S from wherever it is now. Returns the time the ramp lands. */
  const rampTo = (g: GainNode | undefined, to: number) => {
    if (!ctx || !g) return 0;
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(to, t + FADE_S);
    return t + FADE_S;
  };

  /** Silences a sound (stem, clone or synth) with a FADE_S fade, then runs `done` to stop and unwire it. */
  const fadeOut = (o: Obj, done: () => void) => {
    const g = o.kind === 'stem' ? o.fade : o.out;
    const live = ctx && g && (o.kind === 'stem' ? !o.el?.paused : o.src || o.kind === 'fork');
    if (!live) return done();
    rampTo(g, 0);
    window.setTimeout(done, FADE_S * 1000 + 60);
  };

  const unwire = (o: Obj) => {
    stopSynth(o);
    o.el?.pause();
    o.panner?.disconnect();
    o.out?.disconnect();
    o.fade?.disconnect();
    if (o.clone && o.el) o.el.remove();
  };

  const dropObj = (o: Obj, fade = false) => {
    o.bubble.remove();
    if (objs.includes(o)) objs.splice(objs.indexOf(o), 1);
    if (fade) fadeOut(o, () => unwire(o));
    else unwire(o);
  };

  const removeObj = (o: Obj) => {
    if (!canRemove() || o.gone) return;
    if (!o.clone && o.kind === 'stem') {
      o.gone = true;
      o.bubble.hidden = true;
      fadeOut(o, () => {
        if (o.gone) o.el?.pause();
      });
    } else dropObj(o, true);
    const next = shown()[0];
    if (next) select(next);
  };

  const cloneSelected = async () => {
    if (objs.filter((x) => x.clone).length >= MAX_CLONES) return;
    const s = selected;
    const offset = { x: s.pos.x + 0.6, y: s.pos.y - 0.4, z: s.pos.z + 0.3 };
    clamp(offset);
    if (s.kind !== 'stem') {
      const n = objs.filter((x) => x.kind === s.kind).length;
      const base = s.label.replace(/ \d+$/, '');
      const o = addSynth(s.kind, `${base} ${n + 1}`, s.hz, offset, true);
      if (playing) {
        if (o.out && o.kind !== 'fork') {
          o.out.gain.value = 0;
          rampTo(o.out, 1);
        }
        void trigger(o);
      }
      return;
    }
    const src = s.el!;
    const el = src.cloneNode() as HTMLAudioElement;
    el.removeAttribute('data-stem');
    el.preload = 'auto';
    el.loop = orig.loop;
    root.append(el);
    const n = objs.filter((x) => x.stem === s.stem).length;
    const base = objs.find((x) => x.stem === s.stem && !x.clone)!.label;
    const made = makeNode(`${base} ${n + 1}`);
    const o = addObj({
      key: `${s.stem}-${++serial}`,
      kind: 'stem',
      stem: s.stem,
      label: `${base} ${n + 1}`,
      bubble: made.bubble,
      node: made.node,
      pos: offset,
      el,
      clone: true,
    });
    el.currentTime = orig.currentTime;
    if (!orig.paused) {
      graph();
      if (!o.fade) wire(o);
      // Joins mid-song, so it comes up from silence instead of landing with a tick.
      if (o.fade) {
        o.fade.gain.value = 0;
        rampTo(o.fade, 1);
      }
      el.play().catch(() => {});
    }
  };

  const paintCard = () => {
    const t = track();
    titleEl.textContent = t.title;
    byEl.textContent = t.by;
    if (t.kind === 'song') {
      specEl.textContent = mode === 'orig' ? ORIG_SPEC : mode === 'opus' ? OPUS_SPEC : MEDIA_SPEC;
    } else {
      specEl.textContent = t.spec;
    }
    root.dataset.track = t.id;
    root.style.setProperty('--mark', t.mark || '#7ee0c8');
    markName.textContent = t.title;
    markHz.textContent = t.hzLine ?? '';
    const photo = t.kind === 'song';
    art.hidden = !photo;
    bloom.hidden = !photo;
    if (t.kind === 'song') {
      const d = Number.isFinite(orig.duration) ? orig.duration : t.dur;
      seek.max = String(d);
      dur.textContent = mmss(d);
    } else {
      const d = t.kind === 'fork' ? toneDur() : t.dur;
      seek.max = String(d);
      dur.textContent = mmss(d);
      if (t.kind === 'fork') specEl.textContent = `${(t.hz ?? 0).toFixed(2)} Hz · ${t.hzLine ?? ''} · ${tone.hold.toFixed(1)} s hold · ${tone.fade.toFixed(1)} s fade`;
    }
    const chakraOpen = root.querySelector<HTMLButtonElement>('[data-chakra-open]');
    if (chakraOpen) chakraOpen.setAttribute('aria-pressed', String(t.kind === 'fork'));
    if (chakraOpen && t.kind === 'fork') chakraOpen.textContent = t.title;
    if (chakraOpen && t.kind !== 'fork' && !cycling) chakraOpen.textContent = 'Chakras';
  };

  const loadTrack = async (id: string, overlap = false, force = false) => {
    const t = TRACKS[id];
    if (!t) return;
    if (id === trackId && !overlap) {
      if (force && t.kind !== 'song' && !playing) {
        graph();
        await ctx!.resume();
        playing = true;
        started = true;
        playStamp = ctx!.currentTime;
        const o = objs.find((x) => x.kind === t.kind);
        if (o) void trigger(o);
        state();
      }
      return;
    }
    const was = force || (trackId === 'attempt' ? !orig.paused : playing);
    const fading = overlap ? objs.filter((o) => o.kind === 'fork') : [];
    if (!overlap) {
      for (const el of songEls()) el.pause();
      playing = false;
      for (const o of [...objs]) if (o.clone || o.kind !== 'stem') dropObj(o);
    }
    if (t.kind !== 'fork') {
      cycling = false;
      root.querySelector<HTMLButtonElement>('[data-cycle]')?.setAttribute('aria-pressed', 'false');
    }
    for (const o of objs) if (o.kind === 'stem') {
      o.gone = false;
      o.bubble.hidden = id !== 'attempt';
      if (ctx && o.fade) {
        o.fade.gain.cancelScheduledValues(ctx.currentTime);
        o.fade.gain.setValueAtTime(1, ctx.currentTime);
      }
    }
    trackId = id;
    const menu = root.querySelector<HTMLElement>('[data-chakra-menu]');
    if (menu) menu.hidden = true;
    root.querySelector('[data-chakra-open]')?.setAttribute('aria-expanded', 'false');
    cardKick = 1;
    playhead = 0;
    for (const b of trackBtns) b.setAttribute('aria-pressed', String(b.dataset.track === id));
    paintCard();
    bar(0);
    cur.textContent = '0:00';
    if (t.kind !== 'song' && t.pos && t.label) {
      graph();
      await ctx!.resume();
      const o = addSynth(t.kind, t.label, t.hz, t.pos, false);
      if (was || overlap) {
        playing = true;
        started = true;
        playStamp = ctx!.currentTime;
        void trigger(o);
      }
      if (fading.length) {
        const ms = Math.max(40, tone.cross * 1000);
        window.setTimeout(() => {
          for (const old of fading) if (objs.includes(old)) dropObj(old);
        }, ms);
      }
    } else {
      const first = shown()[0];
      if (first) select(first);
      if (was) {
        graph();
        await ctx!.resume();
        started = true;
        for (const el of songEls()) {
          el.preload = 'auto';
          el.play().catch(() => {});
        }
      }
    }
    state();
  };

  // MARK: Transport

  const songEls = () => [orig, opus, ...objs.filter((o) => o.kind === 'stem' && !o.gone && o.el).map((o) => o.el!)];

  const showLabel = () => {
    const live = trackId === 'attempt' ? !orig.paused : playing;
    const ended = trackId === 'attempt' ? orig.ended : !playing && started && playhead >= playDur() - 0.05;
    const t = !started ? 'Next up' : live ? 'Now playing' : ended ? 'Played' : 'Paused';
    if (label.textContent !== t) label.textContent = t;
  };

  const state = () => {
    const live = trackId === 'attempt' ? !orig.paused : playing;
    const ended = trackId === 'attempt' ? orig.ended : !playing && started && playhead >= playDur() - 0.05;
    const st = live ? 'pause' : ended ? 'replay' : 'play';
    play.dataset.state = st;
    play.setAttribute('aria-label', { play: 'Play', pause: 'Pause', replay: 'Play again' }[st]);
    showLabel();
    // refreshIdle is defined with the pointer handlers below; call through a stub until then.
    idleHook?.();
  };
  let idleHook: (() => void) | null = null;

  let dragging = false;
  let lastSync = 0;
  const bar = (t: number) => {
    seek.value = String(t);
    seek.style.setProperty('--p', `${(t / (Number(seek.max) || 1)) * 100}%`);
  };

  // MARK: Orb and render loop

  const orb: Orb | null = createOrb(canvas, MAX_R);
  if (!orb) canvas.remove();
  const DIRS: Record<string, Pos> = {
    ahead: { x: 0, y: MAX_R * 1.12, z: 0 },
    behind: { x: 0, y: -MAX_R * 1.12, z: 0 },
    above: { x: 0, y: 0, z: MAX_R * 1.1 },
    below: { x: 0, y: 0, z: -MAX_R * 1.1 },
  };
  const levels = new Map<Obj, number>();
  let swell = 0;
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(ring);

  const frame = (now: number) => {
    if (trackId === 'attempt') {
      if (!dragging) bar(orig.currentTime);
      cur.textContent = mmss(orig.currentTime || 0);
      if (now - lastSync > 500) {
        lastSync = now;
        for (const el of songEls()) if (el !== orig && !orig.paused && Math.abs(el.currentTime - orig.currentTime) > 0.05) el.currentTime = orig.currentTime;
      }
    } else if (!dragging) {
      let t = playhead;
      if (playing && ctx) t = playhead + (ctx.currentTime - playStamp);
      const end = playDur();
      if (t >= end && !(cycling && track().kind === 'fork')) {
        if (looping()) {
          playhead = 0;
          playStamp = ctx ? ctx.currentTime : 0;
          for (const o of shown()) if (o.kind === 'scream' || o.kind === 'fork') void trigger(o);
          t = 0;
        } else if (playing) {
          playing = false;
          playhead = end;
          for (const o of objs) stopSynth(o);
          t = end;
          state();
        }
      }
      bar(Math.min(t, end));
      cur.textContent = mmss(Math.min(t, end));
    }
    matchLoudness();
    let total = 0;
    for (const o of shown()) {
      let v = 0;
      const stemsOn = mode === 'media' || mode === 'wave';
      const live = o.kind === 'stem' ? stemsOn && !orig.paused : playing;
      if (o.meter && live) {
        const db = 10 * Math.log10(level(o.meter) + 1e-12);
        v = Math.max(0, Math.min(1, (db + 62) / 44));
      }
      const smooth = (levels.get(o) ?? 0) * 0.7 + v * 0.3;
      levels.set(o, smooth);
      total += smooth;
    }
    swell = swell * 0.85 + Math.min(1, total / 3) * 0.15;
    if (orb && visible) {
      const motion = !reduce.matches;
      const liveObjs = shown();
      orb.frame(motion ? now / 1000 : 0, liveObjs.map((o) => ({ pos: o.pos, level: motion ? levels.get(o) ?? 0 : 0 })), motion ? swell : 0);
      for (const o of liveObjs) {
        const p = orb.project(o.pos);
        o.bubble.style.left = `${p.x}px`;
        o.bubble.style.top = `${p.y}px`;
        o.bubble.style.zIndex = String((o === selected ? 30 : 1) + Math.round(p.near * 10));
        o.bubble.style.setProperty('--near', p.near.toFixed(3));
        const lvl = levels.get(o) ?? 0;
        o.bubble.style.setProperty('--lvl', reduce.matches ? '0' : lvl.toFixed(3));
        o.node.dataset.live = !reduce.matches && lvl > 0.08 ? '1' : '0';
      }
      for (const d of dirs) {
        const p = orb.project(DIRS[d.dataset.dir!]);
        d.style.left = `${p.x}px`;
        d.style.top = `${p.y}px`;
      }
    }
    showLabel();
    if (reduce.matches) card.style.transform = '';
    else {
      const t = (now - cardT0) / 1000;
      tiltX += (aimX - tiltX) * 0.08;
      tiltY += (aimY - tiltY) * 0.08;
      cardKick += (0 - cardKick) * 0.05;
      const intro = Math.min(1, t / 1.15);
      const ease = 1 - (1 - intro) ** 3;
      const idleX = Math.sin(t * 0.65) * 2.4;
      const idleY = Math.cos(t * 0.5) * 3.6;
      const idleZ = Math.sin(t * 0.38) * 1.4;
      const live = trackId === 'attempt' ? !orig.paused : playing;
      const rx = (1 - ease) * 14 + ease * (6 + idleX + (0.42 - tiltY) * 18);
      const ry = (1 - ease) * 34 + ease * (14 + idleY + (0.62 - tiltX) * 24) - cardKick * 22;
      const rz = (1 - ease) * 7 + ease * (-idleZ + (0.5 - tiltX) * 6);
      const sc = 0.88 + ease * 0.12 + Math.sin(t * 0.9) * 0.012 + cardKick * 0.07 + (live ? 0.045 : 0);
      const tz = (1 - ease) * -40 + cardKick * 36;
      card.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) translateZ(${tz.toFixed(1)}px) scale(${sc.toFixed(3)})`;
    }
    requestAnimationFrame(frame);
  };

  // MARK: Events

  play.addEventListener('click', async () => {
    if (trackId !== 'attempt') {
      graph();
      await ctx!.resume();
      if (playing) {
        playhead = Math.min(playDur(), playhead + (ctx!.currentTime - playStamp));
        playing = false;
        for (const o of objs) stopSynth(o);
      } else {
        if (playhead >= playDur() - 0.05) playhead = 0;
        playing = true;
        started = true;
        playStamp = ctx!.currentTime;
        for (const o of shown()) void trigger(o);
      }
      state();
      return;
    }
    if (orig.paused) {
      graph();
      await ctx!.resume();
      if (orig.ended) for (const el of songEls()) el.currentTime = 0;
      for (const el of songEls()) {
        el.preload = 'auto';
        el.currentTime = orig.currentTime;
      }
      started = true;
      await Promise.allSettled(songEls().map((el) => el.play()));
    } else {
      for (const el of songEls()) el.pause();
    }
  });
  for (const ev of ['play', 'pause', 'ended', 'waiting', 'playing'] as const) orig.addEventListener(ev, state);
  orig.addEventListener('ended', () => {
    if (orig.loop) return;
    for (const el of songEls()) el.pause();
  });
  orig.addEventListener('loadedmetadata', () => {
    seek.max = String(orig.duration);
    dur.textContent = mmss(orig.duration);
  });
  seek.addEventListener('input', () => {
    dragging = true;
    bar(Number(seek.value));
    cur.textContent = mmss(Number(seek.value));
  });
  seek.addEventListener('change', () => {
    dragging = false;
    if (trackId !== 'attempt') {
      playhead = Number(seek.value);
      if (playing && ctx) {
        playStamp = ctx.currentTime;
        for (const o of shown()) {
          if (o.kind !== 'creek') stopSynth(o);
          void trigger(o);
        }
      }
      return;
    }
    for (const el of songEls()) {
      if (el.readyState === 0) el.preload = 'auto';
      el.currentTime = Number(seek.value);
    }
  });
  loopBtn.addEventListener('click', () => {
    const on = !orig.loop;
    for (const el of songEls()) el.loop = on;
    loopBtn.setAttribute('aria-pressed', String(on));
  });

  for (const b of modeBtns)
    b.addEventListener('click', () => {
      mode = (b.dataset.mode as SongMode) || 'media';
      if (mode === 'wave') mode = 'media';
      for (const x of modeBtns) x.setAttribute('aria-pressed', String(x === b));
      root.dataset.mode = mode;
      paintCard();
      mix();
    });

  for (const b of trackBtns) b.addEventListener('click', () => void loadTrack(b.dataset.track!));

  const chakraOpen = root.querySelector<HTMLButtonElement>('[data-chakra-open]');
  const chakraMenu = root.querySelector<HTMLElement>('[data-chakra-menu]');
  chakraOpen?.addEventListener('click', () => {
    const open = chakraMenu?.hidden !== false;
    if (chakraMenu) chakraMenu.hidden = !open;
    chakraOpen.setAttribute('aria-expanded', String(open));
  });
  addEventListener('pointerdown', (e) => {
    if (!chakraMenu || chakraMenu.hidden) return;
    if ((e.target as HTMLElement).closest('.sp-chakra')) return;
    chakraMenu.hidden = true;
    chakraOpen?.setAttribute('aria-expanded', 'false');
  });
  root.querySelector<HTMLButtonElement>('[data-cycle]')?.addEventListener('click', () => {
    cycling = !cycling;
    const btn = root.querySelector<HTMLButtonElement>('[data-cycle]')!;
    btn.setAttribute('aria-pressed', String(cycling));
    if (chakraMenu) chakraMenu.hidden = true;
    chakraOpen?.setAttribute('aria-expanded', 'false');
    if (!cycling) return;
    if (track().kind === 'fork' && playing) {
      const o = objs.find((x) => x.kind === 'fork');
      if (o && o.timer == null) scheduleCycle(o, trackId);
      return;
    }
    void loadTrack(track().kind === 'fork' ? trackId : 'root', false, true);
  });
  const bindTone = (sel: string, key: 'hold' | 'fade' | 'cross') => {
    const input = root.querySelector<HTMLInputElement>(sel);
    const out = root.querySelector<HTMLOutputElement>(`[data-tone-out="${key}"]`);
    input?.addEventListener('input', () => {
      tone[key] = Number(input.value);
      if (out) out.textContent = `${tone[key].toFixed(1)} s`;
      if (track().kind === 'fork') paintCard();
    });
  };
  bindTone('[data-tone-hold]', 'hold');
  bindTone('[data-tone-fade]', 'fade');
  bindTone('[data-tone-cross]', 'cross');

  for (const b of venueBtns)
    b.addEventListener('click', () => {
      venue = b.dataset.venue!;
      for (const x of venueBtns) x.setAttribute('aria-pressed', String(x === b));
      for (const o of objs) {
        if (o.kind === 'stem' && !o.clone) {
          Object.assign(o.pos, VENUES[venue].pos[o.stem!]);
          place(o);
        }
      }
      select(selected);
      picked.hidden = false;
      picked.textContent = VENUE_WHY[venue] ?? '';
      Object.assign(fx, venueFx(venue));
      preset(null);
      room();
    });

  ring.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-clone]')) void cloneSelected();
    else if (el.closest('[data-remove]')) removeObj(selected);
  });

  // Drag a sound anywhere in the orb; drag the orb itself to look around.
  let held: Obj | null = null;
  let orbiting: { x: number; y: number } | null = null;
  // Drag / tap / swipe cues on the bubble while nothing is playing and the hand is free.
  let idleTimer = 0;
  const refreshIdle = () => {
    clearTimeout(idleTimer);
    const live = trackId === 'attempt' ? !orig.paused : playing;
    const busy = live || held != null || orbiting != null || reduce.matches;
    if (busy) {
      ring.dataset.idle = '0';
      return;
    }
    idleTimer = window.setTimeout(() => {
      ring.dataset.idle = '1';
    }, 700);
  };
  idleHook = refreshIdle;
  addEventListener('pointermove', (e) => {
    if (held && orb) {
      held.pos = orb.drag(e.clientX, e.clientY, held.pos);
      clamp(held.pos);
      place(held);
      select(held);
    } else if (orbiting && orb) {
      orb.orbit(e.clientX - orbiting.x, e.clientY - orbiting.y);
      orbiting = { x: e.clientX, y: e.clientY };
    }
  });
  const release = () => {
    held?.node.classList.remove('drag');
    held = null;
    orbiting = null;
    refreshIdle();
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    orbiting = { x: e.clientX, y: e.clientY };
    refreshIdle();
  });

  function bind(o: Obj) {
    o.node.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      select(o);
      held = o;
      o.node.classList.add('drag');
      refreshIdle();
    });
    o.node.addEventListener('keydown', (e) => {
      const p = o.pos;
      const step = e.shiftKey ? 0.5 : 0.1;
      const k: Record<string, () => void> = {
        ArrowLeft: () => (p.x -= step),
        ArrowRight: () => (p.x += step),
        ArrowUp: () => (p.y += step),
        ArrowDown: () => (p.y -= step),
        PageUp: () => (p.z = Math.min(3, p.z + step)),
        PageDown: () => (p.z = Math.max(-3, p.z - step)),
        Delete: () => removeObj(o),
        Backspace: () => removeObj(o),
      };
      if (!k[e.key]) return;
      e.preventDefault();
      k[e.key]();
      clamp(p);
      place(o);
      if (objs.includes(o)) select(o);
    });
    o.node.addEventListener('focus', () => select(o));
  }
  for (const o of objs) bind(o);

  height.addEventListener('input', () => {
    selected.pos.z = Number(height.value);
    clamp(selected.pos);
    place(selected);
    select(selected);
  });

  for (const b of presetBtns)
    b.addEventListener('click', () => {
      Object.assign(fx, PRESETS[b.dataset.preset!]);
      preset(b.dataset.preset!);
      room();
    });
  for (const [k, el] of Object.entries(fxIn))
    el.addEventListener('input', () => {
      fx[k as keyof Fx] = Number(el.value);
      preset(null);
      room();
    });

  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    aimX = (e.clientX - r.left) / Math.max(1, r.width);
    aimY = (e.clientY - r.top) / Math.max(1, r.height);
  });
  card.addEventListener('pointerleave', () => {
    aimX = 0.34;
    aimY = 0.42;
  });

  for (const o of objs) place(o);
  select(objs[0]);
  paintCard();
  fxText();
  state();
  refreshIdle();
  requestAnimationFrame(frame);
}
