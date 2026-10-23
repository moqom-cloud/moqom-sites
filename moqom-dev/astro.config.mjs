// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import { sidebar } from './src/sidebar.mjs';
import { csp, sri } from '../_shared/security/csp.mjs';

export default defineConfig({
	site: 'https://moqom.dev',
	// Mermaid injects <style> into each diagram it renders; Pagefind search runs WebAssembly.
	security: { csp: csp({ inlineStyleElements: true, wasm: true }) },
	// The SDK repositories' CONTRIBUTING files link to moqom.dev/security/.
	// moqom.cloud has /benchmarks, so people try the same path here.
	// /reference/join-endpoint/ described POST /join, which was removed in October 2026.
	redirects: {
		'/security': '/security/disclosure/',
		'/benchmarks': '/specs/benchmarks/',
		'/reference/join-endpoint': '/reference/device-tokens/',
	},
	// Mermaid's renderer is one large lazily-loaded chunk.
	vite: { build: { chunkSizeWarningLimit: 3000 } },
	integrations: [
		// Must precede Starlight so fenced ```mermaid blocks are claimed before
		// Expressive Code turns them into code listings. Mermaid is bundled from
		// node_modules and renders in the browser, so the build needs no network.
		mermaid({
			theme: 'dark',
			autoTheme: true,
			enableLog: false,
			mermaidConfig: {
				fontFamily: 'Inter, system-ui, sans-serif',
			},
		}),
		starlight({
			title: 'MOQOM Docs',
			description:
				'Technical documentation for MOQOM, end-to-end encrypted real-time media over QUIC: SDKs, APIs, billing, architecture, and benchmarks.',
			logo: { src: './src/assets/logo.svg', replacesTitle: false },
			favicon: '/favicon.svg',
			customCss: [
				'@fontsource/inter/400.css',
				'@fontsource/inter/500.css',
				'@fontsource/inter/600.css',
				'@fontsource/inter/700.css',
				'@fontsource/jetbrains-mono/400.css',
				'@fontsource/jetbrains-mono/600.css',
				'./src/styles/theme.css',
			],
			components: {
				Footer: './src/components/Footer.astro',
				ThemeProvider: './src/components/ThemeProvider.astro',
			},
			social: [
				{ icon: 'external', label: 'MOQOM Cloud', href: 'https://moqom.cloud' },
			],
			lastUpdated: false,
			credits: false,
			sidebar,
		}),
		sri(),
	],
});
