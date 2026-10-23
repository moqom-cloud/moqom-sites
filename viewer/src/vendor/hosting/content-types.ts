// Copied from the viewer repo (packages/hosting/src/content-types.ts) by scripts/sync-docs.mjs. Edit it there.
/** Content-Type for every file the upload CLI accepts, by extension. */
export const CONTENT_TYPES: Readonly<Record<string, string>> = {
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  usdz: 'model/vnd.usdz+zip',
  bin: 'application/octet-stream',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ktx2: 'image/ktx2',
};

export type ModelKind = 'glb' | 'gltf' | 'usdz';

export const MODEL_CONTENT_TYPES: Readonly<Record<ModelKind, string>> = {
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  usdz: 'model/vnd.usdz+zip',
};

/** Cached for a day: replacing a file under the same name shows up within a day. */
export const DEFAULT_CACHE_CONTROL = 'public, max-age=86400';
/** For files whose name changes whenever their content does (e.g. chair-v2.glb). */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export function extension(name: string): string {
  const base = name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

export function modelKind(name: string): ModelKind | null {
  const ext = extension(name);
  return ext === 'glb' || ext === 'gltf' || ext === 'usdz' ? ext : null;
}
