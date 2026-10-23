import type { APIRoute } from 'astro';
import { SITE, SUMMARY, docSections, pageUrl } from '../lib/llms';

export const GET: APIRoute = async () => {
	const lines = ['# MOQOM', '', `> ${SUMMARY}`, ''];
	lines.push(
		`Full text of every page: [llms-full.txt](${SITE}/llms-full.txt). Sign up and manage keys at [moqom.cloud](https://moqom.cloud).`,
		'',
	);
	for (const section of await docSections()) {
		lines.push(`## ${section.label}`, '');
		for (const doc of section.docs) {
			const desc = doc.data.description ? `: ${doc.data.description}` : '';
			lines.push(`- [${doc.data.title}](${pageUrl(doc)})${desc}`);
		}
		lines.push('');
	}
	return new Response(lines.join('\n'), {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
