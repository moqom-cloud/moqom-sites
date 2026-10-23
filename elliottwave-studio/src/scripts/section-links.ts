// A copy-link button on every section heading, so any section can be shared directly.
const ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>';

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

// Shareable links are always #name-section, e.g. #webe-section; the heading's own id (#webe-title) keeps working.
function anchorFor(h: HTMLElement) {
  const sec = h.closest<HTMLElement>('section, figure');
  if (sec?.id.endsWith('-section')) return sec.id;
  const base = (sec?.id || h.id.replace(/-title$/, '') || slug(h.textContent || '') || 'section').replace(/-section$/, '');
  let id = `${base}-section`;
  while (document.getElementById(id)) id = `${base}-${Math.random().toString(36).slice(2, 5)}-section`;
  if (sec && !sec.id) sec.id = id;
  else {
    const mark = document.createElement('span');
    mark.id = id;
    mark.className = 'sec-anchor';
    h.before(mark);
  }
  return id;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
}

document.querySelectorAll<HTMLElement>('main h2').forEach((h) => {
  if (h.querySelector('.sec-link')) return;
  const prev = h.previousElementSibling;
  const eyebrow = prev?.matches('.eyebrow, .kicker') ? prev : null;
  const id = anchorFor(h);
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sec-link';
  b.innerHTML = ICON + '<span class="sec-link-tip" role="status"></span>';
  b.setAttribute('aria-label', `Copy link to “${(h.textContent || '').trim()}”`);
  b.addEventListener('click', async (e) => {
    e.preventDefault();
    const url = `${location.origin}${location.pathname}#${id}`;
    await copy(url);
    history.replaceState(null, '', `#${id}`);
    const tip = b.querySelector('.sec-link-tip')!;
    tip.textContent = 'Link copied';
    b.classList.add('copied');
    setTimeout(() => {
      b.classList.remove('copied');
      tip.textContent = '';
    }, 1600);
  });
  // Beside the small eyebrow label above the heading when there is one, otherwise at the end of the heading's first line.
  const second = h.querySelector(':scope > em, :scope > .dim');
  if (eyebrow) {
    b.classList.add('in-eyebrow');
    eyebrow.append(b);
  } else if (second) h.insertBefore(b, second);
  else h.append(b);
});

if (location.hash.length > 1) {
  const want = decodeURIComponent(location.hash.slice(1));
  const base = want.replace(/-(title|section)$/, '');
  const target =
    document.getElementById(want) ?? document.getElementById(`${base}-section`) ?? document.getElementById(`${base}-title`);
  if (target) addEventListener('load', () => target.scrollIntoView({ behavior: 'instant' as ScrollBehavior }), { once: true });
}
