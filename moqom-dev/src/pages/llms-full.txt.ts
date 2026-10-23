import type { APIRoute } from 'astro';
import { SUMMARY, docSections, pageUrl, toPlainMarkdown } from '../lib/llms';

export const GET: APIRoute = async () => {
	const parts = [`# MOQOM\n\n> ${SUMMARY}`];
	for (const section of await docSections()) {
		for (const doc of section.docs) {
			const desc = doc.data.description ? `\n\n> ${doc.data.description}` : '';
			parts.push(
				`# ${doc.data.title}\n\nSource: ${pageUrl(doc)}${desc}\n\n${toPlainMarkdown(doc.body ?? '')}`,
			);
		}
	}
	return new Response(parts.join('\n\n---\n\n') + '\n', {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
