// Copied from the viewer repo (packages/core/src/styles.ts) by scripts/sync-docs.mjs. Edit it there.
// Shadow-root styles, adopted as a constructed stylesheet so strict CSPs need no 'unsafe-inline'.
// The look follows the owner's original model-6 export: white pill AR button with icon, slim
// progress bar in the middle, animated hand prompt during WebXR sessions.

export const CSS = /* css */ `
:host {
  display: block;
  position: relative;
  width: 100%;
  height: var(--ew-viewer-height, 480px);
  contain: layout;
}
:host([hidden]) { display: none; }

model-viewer {
  width: 100%;
  height: 100%;
  background-color: var(--ew-viewer-background, transparent);
  --poster-color: var(--ew-viewer-background, transparent);
}

.progress-bar {
  display: block;
  width: 33%;
  height: 4px;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate3d(-50%, -50%, 0);
  border-radius: 25px;
  box-shadow: 0 3px 10px 3px rgba(0, 0, 0, 0.5), 0 0 5px 1px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.9);
  background-color: rgba(0, 0, 0, 0.5);
}
.progress-bar.hide {
  visibility: hidden;
  transition: visibility 0.3s;
}
.update-bar {
  background-color: rgba(255, 255, 255, 0.9);
  width: 0%;
  height: 100%;
  border-radius: 25px;
  float: left;
  transition: width 0.3s;
}

.ar-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background-color: #fff;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  bottom: 16px;
  padding: 0 16px 0 12px;
  font: 14px/36px var(--ew-viewer-font, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif);
  color: var(--ew-viewer-accent, #1a73e8);
  height: 36px;
  border-radius: 18px;
  border: 1px solid #dadce0;
  cursor: pointer;
}
.ar-button[hidden] { display: none; }
.ar-button svg { width: 20px; height: 20px; flex: none; }
.ar-button:active { background-color: #e8eaed; }
.ar-button:focus { outline: none; }
.ar-button:focus-visible { outline: 2px solid var(--ew-viewer-accent, #1a73e8); outline-offset: 2px; }

.load-button {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  padding: 0 18px;
  height: 40px;
  border-radius: 20px;
  border: 1px solid #dadce0;
  background: #fff;
  color: #202124;
  font: 14px/40px var(--ew-viewer-font, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);
  cursor: pointer;
}
.load-button:focus-visible { outline: 2px solid var(--ew-viewer-accent, #1a73e8); outline-offset: 2px; }
.load-button[hidden] { display: none; }

.licence-badge {
  position: absolute;
  left: 8px;
  top: 8px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(32, 33, 36, 0.6);
  color: #fff;
  font: 11px/16px var(--ew-viewer-font, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);
  text-decoration: none;
  opacity: 0.8;
}
.licence-badge:hover, .licence-badge:focus-visible { opacity: 1; text-decoration: underline; }
.licence-badge[hidden] { display: none; }

@keyframes ew-circle {
  from { transform: translateX(-50%) rotate(0deg) translateX(50px) rotate(0deg); }
  to { transform: translateX(-50%) rotate(360deg) translateX(50px) rotate(-360deg); }
}
@keyframes ew-elongate {
  from { transform: translateX(100px); }
  to { transform: translateX(-100px); }
}
.ar-prompt {
  position: absolute;
  left: 50%;
  bottom: 60px;
  animation: ew-elongate 2s infinite ease-in-out alternate;
  display: none;
  color: #fff;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
}
.ar-prompt svg { width: 56px; height: 56px; animation: ew-circle 4s linear infinite; }
model-viewer[ar-status='session-started'] > .ar-prompt { display: block; }

@media (prefers-reduced-motion: reduce) {
  .ar-prompt, .ar-prompt svg { animation: none; }
  .update-bar, .progress-bar.hide { transition: none; }
}
`;
