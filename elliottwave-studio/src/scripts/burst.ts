// Particle burst: a cloud gathers into each big number, then explodes into the next as the scene scrolls. Used on
// creators, ñüFi and ñü.bi. Without this script, or with reduced motion, the numbers show as a plain grid.
const AURA_GLOW = ['#22f59a', '#1e8fff', '#8b5cff'];
const AURA_CORE = ['#6dffbf', '#4fb0ff', '#a98bff'];
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
if (!reduce.matches) document.documentElement.classList.add('burst-motion');

// Burst: particles form each big number, then explode and re-form into the next as the scene scrolls.
for (const scene of document.querySelectorAll<HTMLElement>('[data-burst]:not([data-burst-on])')) {
  scene.dataset.burstOn = '';
  const canvas = scene.querySelector('canvas')!;
  const ctx = canvas.getContext('2d');
  const items = [...scene.querySelectorAll<HTMLElement>('[data-glyph]')];
  if (!ctx || !items.length) continue;
  const glyphs = items.map((li) => li.dataset.glyph!);
  type P = { tx: Float32Array; ty: Float32Array; bx: number; by: number; hue: number; r: number };
  let parts: P[] = [];
  let W = 0;
  let H = 0;
  let dpr = 1;

  // Glyphs fill the band between the heading and the label. On short viewports, keep a tall centred band so the numbers still read.
  const band = (h: number) => {
    const top = scene.querySelector('.burst-head')!.getBoundingClientRect().bottom - canvas.getBoundingClientRect().top;
    const bottom = scene.querySelector('.burst-list')!.getBoundingClientRect().top - canvas.getBoundingClientRect().top;
    let t = top;
    let b = bottom;
    if (b - t > 40) {
      const pad = Math.min(36, Math.max(10, (b - t) * 0.12));
      t += pad;
      b -= pad;
    } else {
      t = h * 0.28;
      b = h * 0.72;
    }
    const minH = Math.max(160, h * 0.34);
    if (b - t < minH) {
      const mid = h * 0.48;
      t = Math.max(h * 0.2, mid - minH / 2);
      b = Math.min(h * 0.8, t + minH);
      if (b - t < minH) {
        t = h * 0.24;
        b = h * 0.76;
      }
    }
    return { top: t, bottom: b };
  };

  const sample = (text: string, w: number, h: number, step: number) => {
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const o = off.getContext('2d')!;
    const b = band(h);
    let size = Math.min((b.bottom - b.top) / 0.76, (w * 0.86) / Math.max(1.6, text.length * 0.62));
    o.font = `700 ${size}px Inter, system-ui, sans-serif`;
    let m = o.measureText(text);
    if (m.width > w * 0.84) {
      size *= (w * 0.84) / m.width;
      o.font = `700 ${size}px Inter, system-ui, sans-serif`;
      m = o.measureText(text);
    }
    o.textAlign = 'center';
    o.textBaseline = 'alphabetic';
    o.fillStyle = '#fff';
    const asc = m.actualBoundingBoxAscent;
    const desc = m.actualBoundingBoxDescent;
    o.fillText(text, w / 2, (b.top + b.bottom) / 2 + (asc - desc) / 2);
    const data = o.getImageData(0, 0, w, h).data;
    const pts: [number, number][] = [];
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3] > 128) pts.push([x, y]);
    return pts;
  };

  const build = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const step = W < 600 ? 4 : 6;
    const shapes = glyphs.map((g) => sample(g, W, H, step));
    const n = Math.min(3200, Math.max(...shapes.map((s) => s.length)));
    parts = Array.from({ length: n }, (_, i) => {
      const tx = new Float32Array(shapes.length + 1);
      const ty = new Float32Array(shapes.length + 1);
      // Shape 0 is a loose cloud; 1..n are the glyphs.
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * Math.max(W, H) * 0.7;
      tx[0] = W / 2 + Math.cos(a) * d;
      ty[0] = H * 0.54 + Math.sin(a) * d * 0.6;
      shapes.forEach((s, k) => {
        const [x, y] = s[(i * 7919) % s.length] ?? [W / 2, H / 2];
        tx[k + 1] = x;
        ty[k + 1] = y;
      });
      const ba = Math.random() * Math.PI * 2;
      const bd = (0.25 + Math.random() * 0.75) * Math.max(W, H) * 0.55;
      return { tx, ty, bx: Math.cos(ba) * bd, by: Math.sin(ba) * bd, hue: Math.random(), r: 0.8 + Math.random() * 1.1 };
    });
  };

  const draw = (s: number) => {
    // g runs 0..N: a cloud gathers into glyph 1, then each whole number is an explosion into the next glyph.
    const N = glyphs.length;
    const g = s * N;
    let a = 1;
    let b = 1;
    let k = 0;
    let blast = 0;
    let active: number;
    if (g < 0.45) {
      a = 0;
      k = smooth(g / 0.45);
      active = k > 0.4 ? 0 : -1;
    } else {
      const j = Math.round(g);
      if (j >= 1 && j <= N - 1 && Math.abs(g - j) < 0.25) {
        a = j;
        b = j + 1;
        k = smooth((g - j + 0.25) / 0.5);
        blast = Math.sin(Math.PI * k);
        active = k < 0.5 ? j - 1 : j;
      } else {
        a = b = Math.min(N, Math.floor(g - 0.25) + 1);
        active = a - 1;
      }
    }
    if (a === 0) b = 1;
    items.forEach((li, j) => li.classList.toggle('on', j === active));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const t = performance.now() / 1000;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      let x = p.tx[a] + (p.tx[b] - p.tx[a]) * k + p.bx * blast;
      let y = p.ty[a] + (p.ty[b] - p.ty[a]) * k + p.by * blast;
      x += Math.sin(t * 1.3 + p.hue * 40) * 0.6;
      y += Math.cos(t * 1.1 + p.hue * 30) * 0.6;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.6 + p.hue * 60);
      const rad = p.r * (W < 600 ? 0.8 : 1) * (0.75 + pulse * 0.6);
      // ñü.aura: each particle drifts through green, electric blue and purple.
      const c = Math.floor(p.hue * 3 + t * 0.12) % 3;
      ctx.globalAlpha = 0.18 + pulse * 0.22;
      ctx.fillStyle = AURA_GLOW[c];
      ctx.beginPath();
      ctx.arc(x, y, rad * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.75 + pulse * 0.25;
      ctx.fillStyle = AURA_CORE[c];
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  const progress = () => clamp(-scene.getBoundingClientRect().top / Math.max(1, scene.offsetHeight - innerHeight));
  let running = false;
  const loop = () => {
    if (!running) return;
    draw(progress());
    requestAnimationFrame(loop);
  };
  const vis = new IntersectionObserver(([e]) => {
    running = e.isIntersecting && !reduce.matches;
    if (running) requestAnimationFrame(loop);
  });
  const openAt = (frac: number) => {
    const span = Math.max(1, scene.offsetHeight - innerHeight);
    scrollTo({ top: scene.offsetTop + span * frac, behavior: 'auto' });
    running = !reduce.matches;
    if (running) requestAnimationFrame(loop);
  };
  const goHash = () => {
    if (location.hash !== `#${scene.id}`) return;
    // After the browser's own hash jump, land where the first glyph has formed.
    const place = () => openAt(0.22);
    place();
    requestAnimationFrame(() => requestAnimationFrame(place));
    setTimeout(place, 80);
  };
  const start = () => {
    if (reduce.matches) return;
    build();
    draw(progress());
    vis.observe(scene);
    let rt = 0;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = window.setTimeout(() => {
        if (Math.round(canvas.getBoundingClientRect().width) !== W) build();
      }, 150);
    });
    addEventListener('hashchange', goHash);
    goHash();
  };
  document.fonts.ready.then(start, start);
}
