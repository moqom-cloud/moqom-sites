import { getCollection } from 'astro:content';

/**
 * Drafts are visible in `pnpm dev` (with a DRAFT label) and excluded from
 * `pnpm build`, so they never reach the deployed site or its sitemap.
 */
export async function getPosts() {
  const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}
