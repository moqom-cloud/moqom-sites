// Creators page motion: parallax (--v), scroll-scrubbed counters, videos that play only while visible, the
// particle burst into the big numbers, the H.264 / ñü.media wipe and the Sounds phone. Without this script, or with
// reduced motion, every scene shows its final state and videos show their posters.

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
if (!reduce.matches) root.classList.add('cr-motion');

// Parallax: --v runs from about -1 (element below the viewport centre) to 1 (above it).
const par = [...document.querySelectorAll<HTMLElement>('[data-par]')];
// Counters: data-to, data-dec, data-pre, data-suf; counted up as the number crosses the lower part of the screen.
const counts = [...document.querySelectorAll<HTMLElement>('[data-count]')];
const fmt = (el: HTMLElement, v: number) => {
  const dec = Number(el.dataset.dec ?? 0);
  return (el.dataset.pre ?? '') + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (el.dataset.suf ?? '');
};
// Pinned scenes get --s, 0 to 1 through their scroll length.
const pins = [...document.querySelectorAll<HTMLElement>('[data-pin]')];
const hooks: ((vh: number) => void)[] = [];

function frame() {
  const vh = innerHeight;
  const still = reduce.matches;
  for (const el of par) {
    const r = el.getBoundingClientRect();
    const v = still ? 0 : clamp((vh / 2 - (r.top + r.height / 2)) / vh, -1.2, 1.2);
    el.style.setProperty('--v', v.toFixed(4));
  }
  for (const el of counts) {
    const r = el.getBoundingClientRect();
    const p = still ? 1 : smooth((vh * 0.98 - r.top) / (vh * 0.3));
    const to = Number(el.dataset.to);
    const text = fmt(el, to * p);
    if (el.textContent !== text) el.textContent = text;
  }
  for (const el of pins) {
    const r = el.getBoundingClientRect();
    const s = still ? 1 : clamp(-r.top / Math.max(1, r.height - vh));
    el.style.setProperty('--s', s.toFixed(4));
  }
  for (const h of hooks) h(vh);
}

let queued = false;
const schedule = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    frame();
  });
};
addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', schedule);
reduce.addEventListener('change', () => {
  root.classList.toggle('cr-motion', !reduce.matches);
  schedule();
});

// Videos: muted loops that play only while on screen, and never under reduced motion.
const vids = [...document.querySelectorAll<HTMLVideoElement>('video[data-loop]')];
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const v = e.target as HTMLVideoElement;
      if (e.isIntersecting && !reduce.matches) {
        if (v.preload === 'none') v.preload = 'auto';
        v.play().catch(() => {});
      } else v.pause();
    }
  },
  { threshold: 0.2 },
);
for (const v of vids) {
  v.muted = true;
  if (reduce.matches) v.removeAttribute('autoplay');
  io.observe(v);
}

// Sound: one reel at a time, only after a tap. The tracks are 5.1, so Safari spatialises them on AirPods.
const sounds = [...document.querySelectorAll<HTMLButtonElement>('[data-sound]')];
const loud = (v: HTMLVideoElement | null) => {
  for (const b of sounds) {
    const own = b.parentElement!.querySelector<HTMLVideoElement>('video[data-audio]')!;
    own.muted = own !== v;
    b.setAttribute('aria-pressed', String(own === v));
  }
};
for (const b of sounds) {
  b.addEventListener('click', () => {
    const v = b.parentElement!.querySelector<HTMLVideoElement>('video[data-audio]')!;
    if (!v.muted) return loud(null);
    loud(v);
    if (v.preload === 'none') v.preload = 'auto';
    v.play().catch(() => {});
  });
}

// Wipe: ñü.media over H.264 at the same bitrate. The divider eases in with scroll until someone drags it.
for (const wipe of document.querySelectorAll<HTMLElement>('[data-wipe]')) {
  const input = wipe.querySelector<HTMLInputElement>('input[type=range]')!;
  const [a, b] = [...wipe.querySelectorAll<HTMLVideoElement>('video')];
  let touched = false;
  const set = (x: number) => wipe.style.setProperty('--x', `${x}%`);
  input.addEventListener('input', () => {
    touched = true;
    set(Number(input.value));
  });
  hooks.push((vh) => {
    if (touched || reduce.matches) return;
    const r = wipe.getBoundingClientRect();
    const p = smooth((vh - r.top) / (vh * 0.9));
    const x = 88 - 38 * p;
    input.value = String(Math.round(x));
    set(x);
  });
  // Keep the two loops on the same frame.
  if (a && b) {
    const sync = () => {
      if (!a.paused && Math.abs(a.currentTime - b.currentTime) > 0.08) b.currentTime = a.currentTime;
    };
    a.addEventListener('timeupdate', sync);
    a.addEventListener('play', () => b.play().catch(() => {}));
    a.addEventListener('pause', () => b.pause());
  }
}

import './burst';


// Sounds phone: Music and Healing tabs, and tapping a tile puts it in the now-playing bar. Nothing here scrolls.
for (const app of document.querySelectorAll<HTMLElement>('[data-sounds]')) {
  const segs = [...app.querySelectorAll<HTMLButtonElement>('[data-seg]')];
  const panes = [...app.querySelectorAll<HTMLElement>('[data-pane]')];
  const np = app.querySelector<HTMLElement>('[data-np]')!;
  const npTitle = np.querySelector<HTMLElement>('[data-np-title]')!;
  const npSub = np.querySelector<HTMLElement>('[data-np-sub]')!;
  const npArt = np.querySelector<HTMLElement>('[data-np-art]')!;
  const toggle = np.querySelector<HTMLButtonElement>('[data-np-toggle]')!;
  for (const b of segs) {
    b.addEventListener('click', () => {
      for (const o of segs) o.setAttribute('aria-pressed', String(o === b));
      for (const p of panes) p.hidden = p.dataset.pane !== b.dataset.seg;
    });
  }
  const setPlaying = (on: boolean) => {
    np.classList.toggle('playing', on);
    toggle.setAttribute('aria-pressed', String(on));
    toggle.setAttribute('aria-label', on ? 'Pause' : 'Play');
  };
  toggle.addEventListener('click', () => setPlaying(!np.classList.contains('playing')));
  for (const t of app.querySelectorAll<HTMLButtonElement>('[data-track]')) {
    t.addEventListener('click', () => {
      npTitle.textContent = t.dataset.track!;
      npSub.textContent = t.dataset.by!;
      npArt.className = `art np-art ${t.dataset.art}`;
      setPlaying(true);
    });
  }
}

frame();
