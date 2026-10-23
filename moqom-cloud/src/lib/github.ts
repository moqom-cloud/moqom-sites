// Copied from sites/_shared/stats/github.ts — the canonical copy lives in sites/_shared. Edit there, then re-copy.
/**
 * Build-time GitHub repository stats for the static sites.
 *
 * Runs in Node during `astro build`, never in the browser. A repository that is
 * private, missing, renamed or rate-limited resolves to `null` so the page
 * hides it instead of showing a zero, and the build never fails because
 * GitHub is unreachable.
 *
 * Set GITHUB_TOKEN to lift the anonymous limit (60 requests an hour per IP;
 * each repository costs three). Any token works: public data needs no scopes.
 */

export interface RepoStats {
  /** `owner/name`, as GitHub reports it (follows renames). */
  repo: string;
  url: string;
  stars: number;
  forks: number;
  /** GitHub's `open_issues_count`, which counts open pull requests too. */
  openIssuesAndPulls: number;
  /** Contributors including anonymous ones; null if GitHub did not say. */
  contributors: number | null;
  /** Tag of the latest published release; null if there is none. */
  latestRelease: string | null;
  latestReleaseUrl: string | null;
}

export interface FetchOptions {
  token?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  apiBase?: string;
}

const API = 'https://api.github.com';
const REPO_PATTERN = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

const memo = new Map<string, Promise<RepoStats | null>>();

/** Stats for each `owner/name`, in the order given; null for any that cannot be read. */
export async function fetchRepoStats(repos: string[], options: FetchOptions = {}): Promise<(RepoStats | null)[]> {
  return Promise.all(repos.map((repo) => statsFor(repo, options)));
}

function statsFor(repo: string, options: FetchOptions): Promise<RepoStats | null> {
  // One build renders many pages; ask GitHub once per repository per build.
  const key = `${options.apiBase ?? API}|${repo}`;
  let pending = memo.get(key);
  if (!pending) {
    pending = load(repo, options).catch((error) => {
      warn(repo, error instanceof Error ? error.message : String(error));
      return null;
    });
    memo.set(key, pending);
  }
  return pending;
}

async function load(repo: string, options: FetchOptions): Promise<RepoStats | null> {
  if (!REPO_PATTERN.test(repo)) {
    warn(repo, 'not an owner/name');
    return null;
  }
  const get = client(options);

  const main = await get(`/repos/${repo}`);
  if (!main.ok) {
    warn(repo, `HTTP ${main.status}${rateLimited(main) ? ' (rate limited; set GITHUB_TOKEN)' : ''}`);
    return null;
  }
  const body = (await main.json()) as {
    full_name: string;
    html_url: string;
    private: boolean;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
  };
  if (body.private) {
    // A token with access can see a private repository; the public page must not.
    return null;
  }

  const [contributors, release] = await Promise.all([
    countContributors(get, body.full_name),
    latestRelease(get, body.full_name),
  ]);

  return {
    repo: body.full_name,
    url: body.html_url,
    stars: body.stargazers_count,
    forks: body.forks_count,
    openIssuesAndPulls: body.open_issues_count,
    contributors,
    latestRelease: release?.tag ?? null,
    latestReleaseUrl: release?.url ?? null,
  };
}

type Get = (path: string) => Promise<Response>;

function client(options: FetchOptions): Get {
  const doFetch = options.fetch ?? fetch;
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const base = options.apiBase ?? API;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'elliottwave-sites-build',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return (path) => doFetch(base + path, { headers, signal: AbortSignal.timeout(options.timeoutMs ?? 10_000) });
}

/**
 * One contributor per page, so the `last` page number in the Link header is
 * the count without paging through the list.
 */
async function countContributors(get: Get, repo: string): Promise<number | null> {
  const response = await get(`/repos/${repo}/contributors?per_page=1&anon=1`);
  if (response.status === 204) return 0;
  if (!response.ok) return null;
  const last = lastPage(response.headers.get('link'));
  if (last !== null) return last;
  const list = (await response.json()) as unknown[];
  return Array.isArray(list) ? list.length : null;
}

export function lastPage(link: string | null): number | null {
  if (!link) return null;
  for (const part of link.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="last"/);
    if (match) {
      const page = Number(new URL(match[1]).searchParams.get('page'));
      return Number.isInteger(page) && page > 0 ? page : null;
    }
  }
  return null;
}

async function latestRelease(get: Get, repo: string): Promise<{ tag: string; url: string } | null> {
  const response = await get(`/repos/${repo}/releases/latest`);
  if (!response.ok) return null;
  const body = (await response.json()) as { tag_name?: string; html_url?: string };
  return body.tag_name ? { tag: body.tag_name, url: body.html_url ?? '' } : null;
}

function rateLimited(response: Response): boolean {
  return (response.status === 403 || response.status === 429) && response.headers.get('x-ratelimit-remaining') === '0';
}

function warn(repo: string, reason: string) {
  console.warn(`[stats] ${repo}: hidden (${reason})`);
}
