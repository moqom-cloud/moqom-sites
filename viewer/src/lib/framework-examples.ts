// Code examples for the React, Vue and Frameworks pages. Kept here so the .astro files don't need
// to escape braces.
import { SITE } from '../data/site';

const v = SITE.release.version;
const pkg = SITE.packageName;
const tag = SITE.tagName;
const model = 'https://your-models.web.app/models/chair.glb';

export const REACT = {
  install: `npm install ${pkg}-react@${v}`,
  usage: `import { Viewer3D } from '${pkg}-react';

export default function Product() {
  return (
    <Viewer3D
      src="${model}"
      iosSrc="https://your-models.web.app/models/chair.usdz"
      alt="Oak chair with a woven seat"
      autoRotate
      height="60vh"
      licenseKey="EWV-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
      onLoad={() => console.log('model loaded')}
    />
  );
}`,
  next: `// app/products/[id]/page.tsx: a Server Component can render <Viewer3D> directly.
// The package marks itself 'use client'; the server sends the <${tag}> element with its attributes,
// and the browser adds the script after hydration.
import { Viewer3D } from '${pkg}-react';

export default function Page() {
  return <Viewer3D src="${model}" alt="Oak chair with a woven seat" />;
}`,
  selfHost: `// Your own copy of ${SITE.release.file} (same origin: no integrity needed)
<Viewer3D src="/models/chair.glb" alt="Oak chair" script={{ url: '/js/${SITE.release.file}' }} />

// The page already loads the script, or you import '${pkg}' yourself
<Viewer3D src="/models/chair.glb" alt="Oak chair" script={false} />`,
};

export const VUE = {
  install: `npm install ${pkg}-vue@${v}`,
  usage: `<script setup lang="ts">
import { Viewer3D } from '${pkg}-vue';
</script>

<template>
  <Viewer3D
    src="${model}"
    ios-src="https://your-models.web.app/models/chair.usdz"
    alt="Oak chair with a woven seat"
    auto-rotate
    height="60vh"
    license-key="EWV-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
    class="product-model"
    @load="() => console.log('model loaded')"
  />
</template>`,
  nuxt: `<!-- Nuxt: works in server-rendered pages without <ClientOnly>. The server renders the
     <${tag}> element; the script is added after the component mounts. -->
<script setup lang="ts">
import { Viewer3D } from '${pkg}-vue';
</script>`,
};

export const FRAMEWORKS = {
  svelte: `<!-- Svelte / SvelteKit: import the element in onMount so server rendering never loads it. -->
<script>
  import { onMount } from 'svelte';
  onMount(() => import('${pkg}'));
  export let src;
  export let alt;
</script>

<${tag} {src} {alt} ar camera-controls></${tag}>`,
  angular: `// Angular: allow custom elements in the component, and add the script tag from the HTML
// guide to src/index.html (or import '${pkg}' in main.ts if you don't use server rendering).
import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';

@Component({
  selector: 'app-model',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: \`<${tag} [attr.src]="src" [attr.alt]="alt" ar camera-controls></${tag}>\`,
})
export class ModelComponent {
  @Input({ required: true }) src!: string;
  @Input({ required: true }) alt!: string;
}`,
  astro: `---
// src/components/Viewer.astro. Astro escapes attribute values and bundles the script once per page.
interface Props {
  src: string;
  alt: string;
  autoRotate?: boolean;
}
const { src, alt, autoRotate = false } = Astro.props;
if (!src.startsWith('https://') && !src.startsWith('/')) throw new Error('Viewer: src must be https:// or a site path');
---

<${tag} src={src} alt={alt} ar camera-controls auto-rotate={autoRotate ? '' : undefined}></${tag}>

<script>
  import '${pkg}';
</script>`,
  hugo: `{{/* layouts/shortcodes/viewer.html
     Use: {{< viewer src="${model}" alt="Oak chair" >}}
     Add the script tag from the HTML guide once, in your base template. Hugo's templates escape
     attribute values for you. */}}
{{- $src := .Get "src" -}}
{{- if not (hasPrefix $src "https://") -}}
  {{- errorf "viewer: src must start with https:// (%s)" .Position -}}
{{- end -}}
<${tag} src="{{ $src }}" alt="{{ .Get "alt" }}" ar camera-controls></${tag}>`,
  jekyll: `{%- comment -%}
  _includes/viewer.html
  Use: {% include viewer.html src="${model}" alt="Oak chair" %}
  Add the script tag from the HTML guide once, in your layout.
{%- endcomment -%}
{%- assign scheme = include.src | slice: 0, 8 -%}
{%- if scheme == "https://" -%}
<${tag} src="{{ include.src | escape }}" alt="{{ include.alt | escape }}" ar camera-controls></${tag}>
{%- endif -%}`,
  eleventy: `// eleventy.config.js: shortcodes built on the same generator as these docs, so every value is
// validated and escaped. Use {% viewerScript %} once in your layout and
// {% viewer "${model}", "Oak chair" %} where a model should appear.
import { cdnScript, generateSnippet, scriptTag } from '${pkg}/snippet';
import release from '${pkg}/release.json' with { type: 'json' };

const script = cdnScript(release);

export default function (eleventyConfig) {
  eleventyConfig.addShortcode('viewerScript', () => scriptTag(script));
  eleventyConfig.addShortcode('viewer', (src, alt) => generateSnippet({ src, alt }, script).element);
}`,
};
