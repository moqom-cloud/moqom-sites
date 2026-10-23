// Copied from the viewer repo (packages/core/src/escape.ts) by scripts/sync-docs.mjs. Edit it there.
const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

/** Escapes text for use inside a double-quoted HTML attribute or as element text. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"'`]/g, (c) => ENTITIES[c] ?? c);
}
