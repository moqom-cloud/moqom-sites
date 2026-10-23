// <ew-viewer> doesn't forward these to its inner <model-viewer>: without them the wheel zooms the model and a
// vertical swipe turns it, so the page can't scroll past a 3D view. Horizontal drags still turn the model.
const fix = () => {
  let pending = 0;
  for (const ew of document.querySelectorAll('ew-viewer')) {
    const mv = ew.querySelector('model-viewer') ?? ew.shadowRoot?.querySelector('model-viewer');
    if (!mv) {
      pending++;
      continue;
    }
    if (!mv.hasAttribute('disable-zoom')) {
      mv.setAttribute('disable-zoom', '');
      mv.setAttribute('disable-pan', '');
      mv.setAttribute('touch-action', 'pan-y');
    }
  }
  return pending;
};

let tries = 0;
const loop = () => {
  if (fix() > 0 && tries++ < 100) setTimeout(loop, 200);
};
loop();
new MutationObserver(() => fix()).observe(document.body, { childList: true, subtree: true });
