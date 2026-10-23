import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { csp, sri } from "../_shared/security/csp.mjs";

const unlisted = ["/legal/", "/404", "/account/", "/billing/"];
// Same defaults as src/data/site.ts: signup and the live stats fetch from the billing API.
const api = new URL(process.env.PUBLIC_BILLING_API || "https://api.moqom.cloud").origin;
const stats = process.env.PUBLIC_MOQOM_STATS_URL ? new URL(process.env.PUBLIC_MOQOM_STATS_URL).origin : api;

export default defineConfig({
  site: "https://moqom.cloud",
  output: "static",
  trailingSlash: "ignore",
  build: { format: "directory" },
  security: { csp: csp({ connect: [...new Set([api, stats])] }) },
  // Lightning CSS folds animation-timeline into the animation shorthand, which browsers reject,
  // so every scroll-driven effect in scroll.css would silently stop working.
  vite: { build: { cssMinify: "esbuild" } },
  integrations: [
    sitemap({
      filter: (page) => !unlisted.some((path) => new URL(page).pathname.startsWith(path)),
    }),
    sri(),
  ],
});
