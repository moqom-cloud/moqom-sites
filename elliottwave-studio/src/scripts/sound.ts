// One sound at a time: of the videos with sound, only the one most on screen is heard, and moving between them
// cross-fades. Browsers block sound until a tap, so a Sound button turns it on; until then every video is muted.
// A group (a figure with several takes of one clip) chooses which of its videos speaks with `claim`.

const FADE = 0.6;
const groups = new Map<Element, { ratio: number; video: HTMLVideoElement }>();
const gains = new Map<HTMLVideoElement, GainNode>();
let ctx: AudioContext | null = null;
let on = false;
let button: HTMLButtonElement | null = null;

const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const g = groups.get(e.target);
      if (g) g.ratio = e.isIntersecting ? e.intersectionRatio * Math.min(1, e.boundingClientRect.height / innerHeight + 0.5) : 0;
    }
    mix();
  },
  { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
);

function route(v: HTMLVideoElement) {
  if (!ctx || gains.has(v)) return gains.get(v);
  const g = ctx.createGain();
  g.gain.value = 0;
  ctx.createMediaElementSource(v).connect(g).connect(ctx.destination);
  v.muted = false;
  gains.set(v, g);
  return g;
}

function mix() {
  let best: { ratio: number; video: HTMLVideoElement } | null = null;
  for (const g of groups.values()) if (g.ratio > 0.3 && (!best || g.ratio > best.ratio)) best = g;
  button?.classList.toggle('shown', !!best);
  if (!ctx || !on) return;
  const now = ctx.currentTime;
  for (const v of document.querySelectorAll<HTMLVideoElement>('video[data-sound]')) {
    const g = route(v)!;
    const target = best && v === best.video ? 1 : 0;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(target, now + FADE);
  }
}

function toggle() {
  on = !on;
  if (on && !ctx) ctx = new AudioContext();
  if (ctx?.state === 'suspended') ctx.resume();
  button?.setAttribute('aria-pressed', String(on));
  if (button) button.querySelector('span')!.textContent = on ? 'Sound on' : 'Sound off';
  if (on) mix();
  else if (ctx) {
    const now = ctx.currentTime;
    for (const g of gains.values()) {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + FADE);
    }
  }
}

function ensureButton() {
  if (button) return;
  button = document.createElement('button');
  button.type = 'button';
  button.className = 'sound-toggle';
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = '<i aria-hidden="true"></i><span>Sound off</span>';
  button.addEventListener('click', toggle);
  document.body.append(button);
}

/** Make `video` the one that speaks for `group` (cross-fading if sound is on). */
export function claim(group: Element, video: HTMLVideoElement) {
  ensureButton();
  const g = groups.get(group);
  if (g) g.video = video;
  else {
    groups.set(group, { ratio: 0, video });
    io.observe(group);
  }
  mix();
}
