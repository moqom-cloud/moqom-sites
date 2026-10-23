import { getCollection, type CollectionEntry } from 'astro:content';
import { sidebar } from '../sidebar.mjs';

export const SITE = 'https://moqom.dev';

export const SUMMARY =
	'MOQOM is real-time media over QUIC: interactive video, audio and broadcast rooms with ' +
	'moderation, a Swift SDK for Apple platforms, Go and Rust backend SDKs, self-hostable relays, ' +
	'and prepaid billing at 85% of Agora\'s price at every tier and volume, at least one cent per 1,000 minutes under.';

type Doc = CollectionEntry<'docs'>;
type SidebarLink = { label: string; slug: string };
type SidebarGroup = { label: string; items: SidebarLink[] };
type Section = { label: string; docs: Doc[] };

export function pageUrl(doc: Doc): string {
	return doc.id === 'index' ? `${SITE}/` : `${SITE}/${doc.id}/`;
}

/** Docs grouped and ordered as in the sidebar; pages missing from the sidebar go to "Other". */
export async function docSections(): Promise<Section[]> {
	const docs = await getCollection('docs');
	const byId = new Map(docs.map((d) => [d.id, d]));
	const used = new Set<string>();
	const take = (slug: string) => {
		const doc = byId.get(slug);
		if (doc && !used.has(slug)) {
			used.add(slug);
			return [doc];
		}
		return [];
	};

	const sections: Section[] = [{ label: 'Home', docs: take('index') }];
	for (const entry of sidebar as (SidebarGroup | SidebarLink)[]) {
		const docs = 'items' in entry ? entry.items.flatMap((i) => take(i.slug)) : take(entry.slug);
		sections.push({ label: entry.label, docs });
	}
	const rest = docs.filter((d) => !used.has(d.id)).sort((a, b) => a.id.localeCompare(b.id));
	sections.push({ label: 'Other', docs: rest });
	return sections.filter((s) => s.docs.length);
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];

/** MDX/Starlight source to plain Markdown: drops imports, comments and components, keeps prose. */
export function toPlainMarkdown(body: string): string {
	let fence: string | null = null;
	return body
		.replace(/<!--[\s\S]*?-->\n?/g, '')
		.replace(/\{\/\*[\s\S]*?\*\/\}\n?/g, '')
		.split('\n')
		.map((line) => {
			const trimmed = line.trim();
			const marker = trimmed.match(/^(`{3,}|~{3,})/)?.[1];
			if (fence) {
				if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
				return line;
			}
			if (marker) {
				fence = marker;
				return line;
			}
			if (/^(import|export)\s/.test(line)) return null;
			const indent = line.slice(0, line.length - line.trimStart().length);
			if (/^<LinkCard\b/.test(trimmed)) {
				const desc = attr(trimmed, 'description');
				return `${indent}- [${attr(trimmed, 'title')}](${attr(trimmed, 'href')})${desc ? `: ${desc}` : ''}`;
			}
			if (/^<(Card|Aside|TabItem)\b/.test(trimmed)) {
				const title = attr(trimmed, 'title') ?? attr(trimmed, 'label');
				return title ? `${indent}**${title}**` : null;
			}
			if (/^<\/?[A-Z][\w.]*[^>]*>$/.test(trimmed)) return null;
			const directive = trimmed.match(/^:::(\w+)(?:\[(.*)\])?$/);
			if (directive) return `${indent}**${directive[2] ?? directive[1][0].toUpperCase() + directive[1].slice(1)}**`;
			if (trimmed === ':::') return null;
			return line;
		})
		.filter((line): line is string => line !== null)
		.join('\n')
		.replace(/\]\((\/[^)\s]*)\)/g, `](${SITE}$1)`)
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
