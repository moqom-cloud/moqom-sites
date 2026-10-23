// Builds the operator console into dist/: one HTML page, one script, one stylesheet, each pinned
// with SRI and governed by a CSP that allows nothing but this origin and the operator API.
//
//   MOQOM_ADMIN_API               operator API origin (default https://api.moqom.cloud)
//   MOQOM_ADMIN_GOOGLE_CLIENT_ID  the OAuth client ID tokens are minted for; same value as the
//                                 control plane's MOQOM_OPERATOR_GOOGLE_CLIENT_ID
//   MOQOM_ADMIN_HOSTED_DOMAIN     Workspace domain offered at sign-in (default moqom.cloud)
//   MOQOM_ADMIN_DEV=1             local only: allows an http://localhost API and a pasted token
//
// The styles are the public site's tokens, glass and base styles, so the two look alike without
// sharing a build.

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");
const dev = process.env.MOQOM_ADMIN_DEV === "1";
const api = new URL(process.env.MOQOM_ADMIN_API || "https://api.moqom.cloud");
const clientId = (process.env.MOQOM_ADMIN_GOOGLE_CLIENT_ID || "").trim();
const hostedDomain = (process.env.MOQOM_ADMIN_HOSTED_DOMAIN ?? "moqom.cloud").trim();

const local = ["localhost", "127.0.0.1", "[::1]"].includes(api.hostname);
if (api.protocol !== "https:" && !(dev && local)) {
  throw new Error(`MOQOM_ADMIN_API must be https (got ${api.origin}); http is allowed only for localhost with MOQOM_ADMIN_DEV=1`);
}
if (!clientId && !dev) {
  throw new Error("MOQOM_ADMIN_GOOGLE_CLIENT_ID is required for a deployable build");
}

const sri = (data) => `sha384-${createHash("sha384").update(data).digest("base64")}`;
const escape = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const strip = (css) => css.replace(/^@import[^\n]*\n/gm, "");
const styles = [
  await readFile(join(here, "../moqom-cloud/src/styles/tokens.css"), "utf8"),
  await readFile(join(here, "../_shared/glass/glass.css"), "utf8"),
  strip(await readFile(join(here, "../moqom-cloud/src/styles/global.css"), "utf8")),
  await readFile(join(here, "src/app.css"), "utf8"),
].join("\n");
const script = await readFile(join(here, "src/app.js"), "utf8");

const csp = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src ${api.origin}`,
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

let html = await readFile(join(here, "src/index.html"), "utf8");
html = html
  .replace("%CSP%", escape(csp))
  .replace("%API%", escape(api.origin))
  .replace("%CLIENT_ID%", escape(clientId))
  .replace("%HOSTED_DOMAIN%", escape(hostedDomain))
  .replace("%DEV%", dev ? "true" : "false")
  .replace("%CSS_SRI%", sri(styles))
  .replace("%JS_SRI%", sri(script));

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await writeFile(join(dist, "index.html"), html);
await writeFile(join(dist, "app.css"), styles);
await writeFile(join(dist, "app.js"), script);
await writeFile(join(dist, "robots.txt"), "User-agent: *\nDisallow: /\n");
await writeFile(join(dist, "favicon.svg"), await readFile(join(here, "../moqom-cloud/public/favicon.svg")));

console.log(`moqom-admin built to dist/ for ${api.origin}${dev ? " (dev)" : ""}${clientId ? "" : " without a Google client ID"}`);
