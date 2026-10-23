# six10nine.elliottwave.studio

Docs site for six10nine (6(78)9), an elliottwave.studio lab project from Elliott Wave LLC. Static [Astro](https://astro.build) site with no client-side JavaScript, served at `six10nine.elliottwave.studio` from the `six10nine` prefix of the sites bucket (`project_hosts` in `moqom/deploy/envs/web`).

## Develop

Requires Node 22.12+ and pnpm 10+.

```sh
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # static output in dist/, then the CSP/SRI check
```

Publish with `moqom/deploy/tools/publish-sites.sh six10nine`. The script's default run doesn't include this site.

## Layout

```
src/
  data/six10nine.ts   Links, install commands, release flag, docs navigation
  layouts/Base.astro  <head>, header, docs sidebar (docs prop), footer
  pages/              /, /getting-started, /chords, /ai, /mcp, /privacy, /licence, /contribute, /security, /changelog, 404
  styles/global.css   Studio tokens (amber accent) plus docs styles
public/
  robots.txt, favicon.svg, .well-known/security.txt
```

## Content rules

- Outcome level only for the game side: at most "it's playful" and "there are surprises". Never describe what changes over time, when, in what order or why, or what idle computing does beyond its limits.
- Don't mention patents or legal analysis.
- Install commands and the GitHub link are marked "Available at release" until `RELEASED` in `data/six10nine.ts` is true. Flip it, and fill in the changelog, when the first notarized release and the public repository are live.
- Footer copy is fixed: "© 2026 Elliott Wave LLC. six10nine and 6(78)9 are trademarks of Elliott Wave LLC."
- No analytics and no cookies: the privacy page says so.
- `security.txt` expires 2027-10-06; renew it before then.
