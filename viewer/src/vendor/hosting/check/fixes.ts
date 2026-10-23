// Copied from the viewer repo (packages/hosting/src/check/fixes.ts) by scripts/sync-docs.mjs. Edit it there.
// Server configuration that makes model files load in <model-viewer>: correct Content-Type, CORS
// for the embedding site, and caching. One snippet per server; the checker shows the detected
// server's first.
import { DEFAULT_CACHE_CONTROL, MODEL_CONTENT_TYPES } from '../content-types.js';

export type Server = 'apache' | 'nginx' | 'netlify' | 'vercel' | 'cloudflare' | 's3' | 'gcs' | 'firebase-hosting' | 'unknown';

export interface Fix {
  server: Exclude<Server, 'unknown'>;
  label: string;
  file: string;
  language: 'apache' | 'nginx' | 'toml' | 'json' | 'text' | 'shell';
  code: string;
  note: string;
}

export interface FixParams {
  /** Allowed site, e.g. https://www.example.com, or "*". */
  origin?: string;
  cacheControl?: string;
  /** Folder the models live in on the server. */
  folder?: string;
  bucket?: string;
}

const GLB = MODEL_CONTENT_TYPES.glb;
const GLTF = MODEL_CONTENT_TYPES.gltf;
const USDZ = MODEL_CONTENT_TYPES.usdz;

function safe(value: string, pattern: RegExp, fallback: string): string {
  return pattern.test(value) ? value : fallback;
}

export function fixes(params: FixParams = {}): Fix[] {
  const origin = safe(params.origin ?? '*', /^(\*|https?:\/\/[A-Za-z0-9.-]+(:\d+)?)$/, '*');
  const cache = safe(params.cacheControl ?? DEFAULT_CACHE_CONTROL, /^[A-Za-z0-9=,\s-]+$/, DEFAULT_CACHE_CONTROL);
  const folder = safe((params.folder ?? 'models').replace(/^\/+|\/+$/g, ''), /^[A-Za-z0-9._/-]+$/, 'models');
  const bucket = safe(params.bucket ?? 'YOUR-BUCKET', /^[a-z0-9._-]+$|^YOUR-BUCKET$/, 'YOUR-BUCKET');
  const origins = origin === '*' ? '"*"' : `"${origin}"`;

  return [
    {
      server: 'apache',
      label: 'Apache (.htaccess)',
      file: `${folder}/.htaccess`,
      language: 'apache',
      code: `# 3D models: file types, CORS and caching. Needs mod_mime and mod_headers.
AddType ${GLB} .glb
AddType ${GLTF} .gltf
AddType ${USDZ} .usdz
<IfModule mod_headers.c>
  <FilesMatch "\\.(glb|gltf|usdz|bin)$">
    Header set Access-Control-Allow-Origin "${origin}"
    Header set Cache-Control "${cache}"
  </FilesMatch>
</IfModule>`,
      note: 'Put the file in the folder that holds the models. Shared hosts usually allow .htaccess; if headers do not change, ask your host to enable mod_headers and AllowOverride FileInfo.',
    },
    {
      server: 'nginx',
      label: 'Nginx',
      file: 'server { … } block of your site config',
      language: 'nginx',
      code: `location ~* ^/${folder}/.+\\.glb$ {
    types { } default_type ${GLB};
    add_header Access-Control-Allow-Origin "${origin}" always;
    add_header Cache-Control "${cache}" always;
}
location ~* ^/${folder}/.+\\.gltf$ {
    types { } default_type ${GLTF};
    add_header Access-Control-Allow-Origin "${origin}" always;
    add_header Cache-Control "${cache}" always;
}
location ~* ^/${folder}/.+\\.usdz$ {
    types { } default_type ${USDZ};
    add_header Access-Control-Allow-Origin "${origin}" always;
    add_header Cache-Control "${cache}" always;
}`,
      note: 'Reload with: sudo nginx -t && sudo systemctl reload nginx. A location that sets add_header drops add_header lines inherited from outer blocks, so repeat any security headers you rely on.',
    },
    {
      server: 'netlify',
      label: 'Netlify (netlify.toml)',
      file: 'netlify.toml',
      language: 'toml',
      code: `[[headers]]
  for = "/${folder}/*"
  [headers.values]
    Access-Control-Allow-Origin = ${origins}
    Cache-Control = "${cache}"`,
      note: 'Netlify sets Content-Type from the file extension. Run the checker after deploying; if the type is wrong, add a [[headers]] block for that file with a Content-Type value.',
    },
    {
      server: 'vercel',
      label: 'Vercel (vercel.json)',
      file: 'vercel.json',
      language: 'json',
      code: JSON.stringify(
        {
          headers: [
            { source: `/${folder}/(.*)`, headers: [{ key: 'Access-Control-Allow-Origin', value: origin }, { key: 'Cache-Control', value: cache }] },
            { source: `/${folder}/(.*)\\.glb`, headers: [{ key: 'Content-Type', value: GLB }] },
            { source: `/${folder}/(.*)\\.gltf`, headers: [{ key: 'Content-Type', value: GLTF }] },
            { source: `/${folder}/(.*)\\.usdz`, headers: [{ key: 'Content-Type', value: USDZ }] },
          ],
        },
        null,
        2,
      ),
      note: 'Files go in public/' + folder + '/. Redeploy, then run the checker to confirm the headers.',
    },
    {
      server: 'cloudflare',
      label: 'Cloudflare (R2 bucket or Pages)',
      file: 'R2: bucket Settings → CORS policy. Pages: public/_headers',
      language: 'text',
      code: `# R2 CORS policy (bucket → Settings → CORS policy):
[
  { "AllowedOrigins": [${origins}], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600 }
]

# R2 upload with the right type and caching:
npx wrangler r2 object put ${bucket}/${folder}/chair.glb --file chair.glb --content-type ${GLB} --cache-control "${cache}"

# Pages: public/_headers
/${folder}/*
  Access-Control-Allow-Origin: ${origin}
  Cache-Control: ${cache}`,
      note: 'R2 needs a public bucket URL or custom domain. Pages sets Content-Type from the extension; confirm with the checker.',
    },
    {
      server: 's3',
      label: 'Amazon S3',
      file: 'Bucket → Permissions → Cross-origin resource sharing (CORS)',
      language: 'json',
      code: `[
  {
    "AllowedOrigins": [${origins}],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Range"],
    "MaxAgeSeconds": 3600
  }
]

# Upload with the right type and caching:
aws s3 cp chair.glb s3://${bucket}/${folder}/chair.glb --content-type ${GLB} --cache-control "${cache}"
aws s3 cp chair.usdz s3://${bucket}/${folder}/chair.usdz --content-type ${USDZ} --cache-control "${cache}"`,
      note: 'Behind CloudFront, attach the CORS-S3Origin origin request policy and a response headers policy that adds CORS, or the CORS headers will not reach browsers.',
    },
    {
      server: 'gcs',
      label: 'Google Cloud Storage / Firebase Storage',
      file: 'cors.json',
      language: 'shell',
      code: `cat > cors.json <<'EOF'
[{ "origin": [${origins}], "method": ["GET", "HEAD"], "responseHeader": ["Content-Type", "Content-Length", "Content-Range"], "maxAgeSeconds": 3600 }]
EOF
gcloud storage buckets update gs://${bucket} --cors-file=cors.json
gcloud storage objects update gs://${bucket}/${folder}/chair.glb --content-type=${GLB} --cache-control="${cache}"
gcloud storage objects update gs://${bucket}/${folder}/chair.usdz --content-type=${USDZ} --cache-control="${cache}"`,
      note: 'Or run: viewer-upload cors --bucket ' + bucket + (origin === '*' ? '' : ` --origin ${origin}`) + '. CORS changes can take a few minutes to apply.',
    },
    {
      server: 'firebase-hosting',
      label: 'Firebase Hosting (firebase.json)',
      file: 'firebase.json',
      language: 'json',
      code: JSON.stringify(
        {
          hosting: {
            headers: [
              { source: '**/*.glb', headers: [{ key: 'Content-Type', value: GLB }, { key: 'Access-Control-Allow-Origin', value: origin }, { key: 'Cache-Control', value: cache }] },
              { source: '**/*.gltf', headers: [{ key: 'Content-Type', value: GLTF }, { key: 'Access-Control-Allow-Origin', value: origin }, { key: 'Cache-Control', value: cache }] },
              { source: '**/*.usdz', headers: [{ key: 'Content-Type', value: USDZ }, { key: 'Access-Control-Allow-Origin', value: origin }, { key: 'Cache-Control', value: cache }] },
            ],
          },
        },
        null,
        2,
      ),
      note: 'Merge into your existing hosting block and run firebase deploy --only hosting. viewer-upload hosting writes this for you.',
    },
  ];
}

/** Fixes with the detected server first. */
export function fixesFor(server: Server, params: FixParams = {}): Fix[] {
  const all = fixes(params);
  return [...all.filter((f) => f.server === server), ...all.filter((f) => f.server !== server)];
}
