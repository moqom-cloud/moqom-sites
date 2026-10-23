// Content-Security-Policy and Subresource Integrity for the four static sites.
// Imported directly by each site's astro.config.mjs; it uses only Node built-ins, so it needs no
// node_modules of its own.
//
// The policy reaches the browser as a <meta http-equiv> that Astro writes into the <head> of every
// page (security.csp), with a SHA-256 hash for each inline script and <style> it renders,
// including is:inline and define:vars scripts. A meta policy cannot carry frame-ancestors, so the
// load balancer also sends `frame-ancestors 'none'; object-src 'none'; base-uri 'self'` as a
// response header (deploy/modules/sites). Browsers enforce both policies.
//
// Google Analytics is allowed by origin because gtag.js changes without notice and so cannot be
// pinned with SRI. It only loads when PUBLIC_GA_ID is set at build time.

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const GA_SCRIPT = ["https://www.googletagmanager.com"];
const GA_CONNECT = ["https://*.google-analytics.com", "https://*.analytics.google.com", "https://www.googletagmanager.com"];
const GA_IMG = ["https://*.google-analytics.com", "https://www.googletagmanager.com"];

/**
 * The security.csp block for astro.config.mjs.
 * connect: extra origins the page fetches from (the billing API on moqom.cloud).
 * inlineStyleElements: allow <style> elements injected at runtime (Mermaid renders its own). When
 * false, <style> elements must match a build-time hash and only style="" attributes are inline.
 * wasm: allow WebAssembly compilation ('wasm-unsafe-eval', not 'unsafe-eval'); Pagefind search
 * needs it.
 */
export function csp({ connect = [], inlineStyleElements = false, wasm = false } = {}) {
  return {
    algorithm: "SHA-256",
    directives: [
      "default-src 'self'",
      `connect-src 'self' ${[...connect, ...GA_CONNECT].join(" ")}`,
      `img-src 'self' data: ${GA_IMG.join(" ")}`,
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-src 'none'",
      "upgrade-insecure-requests",
    ],
    scriptDirective: { resources: ["'self'", ...(wasm ? ["'wasm-unsafe-eval'"] : []), ...GA_SCRIPT] },
    styleDirective: {
      resources: inlineStyleElements
        ? ["'self'", "'unsafe-inline'"]
        : ["'self'", { resource: "'unsafe-inline'", kind: "attribute" }],
    },
  };
}

const sha = (alg, data) => `${alg}-${createHash(alg).update(data).digest("base64")}`;
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(2).find((v) => v !== undefined);
const isLocal = (url) => typeof url === "string" && url.startsWith("/") && !url.startsWith("//");
const EXECUTABLE = new Set(["", "module", "text/javascript", "application/javascript"]);

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith(".html")) yield path;
  }
}

const decode = (content) => content.replaceAll("&#39;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");

function sources(policy, directive) {
  const match = policy.match(new RegExp(`(?:^|;)\\s*${directive}\\s+([^;]*)`));
  return match ? match[1].trim().split(/\s+/) : null;
}

const inlineScripts = (html) =>
  [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, open]) => !attr(open, "src") && EXECUTABLE.has((attr(open, "type") ?? "").toLowerCase()))
    .map((m) => ({ index: m.index, body: m[2] }));

/**
 * Runs after the build, on every page:
 * 1. Adds SHA-384 integrity to every same-origin <script src> and stylesheet/modulepreload <link>.
 * 2. Adds to the page's script-src the SHA-256 of each inline script Astro does not hash itself
 *    (is:inline and define:vars). These are build output, so hashing them here is as strict as
 *    hashing at render time, and no script needs 'unsafe-inline'.
 * 3. Checks the CSP meta is present and precedes the first executable script, every inline script
 *    and <style> is covered, and every integrity value matches its file. Any failure fails the
 *    build.
 * Chunks a module script imports at runtime are not covered by SRI; browsers only check the entry.
 */
export function sri() {
  return {
    name: "moqom-security",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const digests = new Map();
        const digest = async (url) => {
          const path = join(root, decodeURIComponent(url.split(/[?#]/)[0]));
          if (!digests.has(path)) digests.set(path, sha("sha384", await readFile(path)));
          return digests.get(path);
        };
        const problems = [];
        let pages = 0;
        let pinned = 0;

        for await (const file of htmlFiles(root)) {
          let html = await readFile(file, "utf8");
          const page = file.slice(root.length);
          const tags = [...html.matchAll(/<(script|link)\b[^>]*>/gi)];
          for (const { 0: tag, 1: name, index } of tags.reverse()) {
            if (/\sintegrity\s*=/i.test(tag)) continue;
            const isScript = name.toLowerCase() === "script";
            const url = isScript ? attr(tag, "src") : attr(tag, "href");
            const rel = (attr(tag, "rel") ?? "").toLowerCase();
            if (!isLocal(url) || (!isScript && !/\b(stylesheet|modulepreload)\b/.test(rel))) continue;
            let value;
            try {
              value = await digest(url);
            } catch {
              problems.push(`${page}: ${url} is not in the build output`);
              continue;
            }
            const end = tag.endsWith("/>") ? tag.length - 2 : tag.length - 1;
            html = html.slice(0, index) + `${tag.slice(0, end).trimEnd()} integrity="${value}"${tag.slice(end)}` + html.slice(index + tag.length);
            pinned++;
          }

          const found = html.match(/<meta\s+http-equiv="content-security-policy"\s+content="([^"]*)"/i);
          if (!found) {
            const redirect = /<meta\s+http-equiv="refresh"/i.test(html) && !/<script\b/i.test(html);
            if (!redirect) problems.push(`${page}: no Content-Security-Policy meta`);
            else await writeFile(file, html);
            continue;
          }
          const missing = new Set(
            inlineScripts(html)
              .map(({ body }) => `'${sha("sha256", body)}'`)
              .filter((hash) => !(sources(decode(found[1]), "script-src") ?? []).includes(hash)),
          );
          let tag = html.slice(found.index, html.indexOf(">", found.index) + 1);
          if (missing.size) {
            const content = found[1].replace(/(script-src\s[^;]*)/, (directive) => `${directive} ${[...missing].join(" ")}`.replaceAll("'", found[1].includes("&#39;") ? "&#39;" : "'"));
            tag = tag.replace(found[1], content);
          }
          // A meta policy only governs markup after it, so it goes first in <head>.
          html = html.slice(0, found.index) + html.slice(found.index + html.slice(found.index).indexOf(">") + 1);
          const charset = html.match(/<meta\s+charset[^>]*>/i);
          const at = charset ? charset.index + charset[0].length : html.search(/<head\b[^>]*>/i) + html.match(/<head\b[^>]*>/i)[0].length;
          html = html.slice(0, at) + tag + html.slice(at);
          await writeFile(file, html);
          pages++;

          const meta = html.match(/<meta\s+http-equiv="content-security-policy"\s+content="([^"]*)"/i);
          const policy = decode(meta[1]);
          const firstScript = Math.min(inlineScripts(html)[0]?.index ?? Infinity, html.search(/<script\b[^>]*\ssrc=/i) >>> 0);
          if (firstScript < meta.index) problems.push(`${page}: a script precedes the CSP meta`);
          const scriptSrc = sources(policy, "script-src") ?? [];
          const styleSrc = sources(policy, "style-src-elem") ?? sources(policy, "style-src") ?? [];

          for (const { body } of inlineScripts(html)) {
            if (!scriptSrc.includes(`'${sha("sha256", body)}'`)) problems.push(`${page}: inline script not in script-src: ${body.trim().slice(0, 60)}`);
          }
          if (!styleSrc.includes("'unsafe-inline'")) {
            for (const [, body] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
              if (!styleSrc.includes(`'${sha("sha256", body)}'`)) problems.push(`${page}: inline <style> not in style-src: ${body.trim().slice(0, 60)}`);
            }
          }
          for (const [tag] of html.matchAll(/<(script|link)\b[^>]*\sintegrity="([^"]+)"[^>]*>/gi)) {
            const url = attr(tag, "src") ?? attr(tag, "href");
            if (isLocal(url) && attr(tag, "integrity") !== (await digest(url))) problems.push(`${page}: integrity mismatch for ${url}`);
          }
        }

        if (problems.length) {
          for (const problem of problems.slice(0, 20)) logger.error(problem);
          throw new Error(`CSP/SRI check failed: ${problems.length} problem(s)`);
        }
        logger.info(`CSP present on ${pages} page(s); ${pinned} same-origin script/stylesheet tag(s) pinned with SRI`);
      },
    },
  };
}
