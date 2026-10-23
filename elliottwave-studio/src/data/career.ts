/**
 * Elliott's career, from his LinkedIn profile (Oct 2026 export) plus roles he supplied directly
 * (Favorited, Varasa, the lab). Past work only: none of these companies used MOQOM, so never imply they did.
 * Dates are 'YYYY-MM'; end null means current.
 */

export type Field = 'web' | 'film' | 'xr' | 'apps' | 'fintech' | 'live';

export const FIELDS: Record<Field, { label: string; color: string }> = {
  web: { label: 'Web design and development', color: '#94a3b8' },
  film: { label: 'Secure film media', color: '#f59e0b' },
  xr: { label: 'AR, VR and 3D', color: '#22d3ee' },
  apps: { label: 'Consumer and social apps', color: '#a78bfa' },
  fintech: { label: 'Fintech and enterprise', color: '#34d399' },
  live: { label: 'Live video and AI', color: '#f472b6' },
};

export interface Role {
  title: string;
  start: string;
  end: string | null;
}

export interface Company {
  name: string;
  field: Field;
  roles: Role[];
  founder?: boolean;
  cto?: boolean;
  url?: string;
  note: string;
}

export const NOW = '2026-10';

export const CAREER: Company[] = [
  {
    name: 'Freelance web',
    field: 'web',
    roles: [{ title: 'Web design and development', start: '2006-01', end: '2008-08' }],
    note: 'Websites, designed and built for clients. Where the shipping started.',
  },
  {
    name: 'MESoft',
    field: 'film',
    roles: [{ title: 'Design Engineer', start: '2008-08', end: '2009-05' }],
    note: 'Media player, asset management and multi-camera sync software.',
  },
  {
    name: 'Vici Post Solutions',
    field: 'film',
    roles: [{ title: 'VP Software Development', start: '2009-06', end: '2014-10' }],
    note: 'Secure viewing and collaboration for Warner Bros., The Weinstein Company, Relativity, Summit and Annapurna.',
  },
  {
    name: 'Covalent Media Systems',
    field: 'film',
    founder: true,
    roles: [{ title: 'Founder · VP Development', start: '2014-10', end: '2015-11' }],
    note: 'Digital asset management cloud under contract with every major studio, plus mini-majors and independents. Pen-tested, best in class, never breached or leaked.',
  },
  {
    name: 'Freelance security',
    field: 'film',
    roles: [{ title: 'Software UX and development', start: '2016-01', end: '2016-10' }],
    note: 'Client-side file encryption: chunked, keys never leave the client, the server can’t decrypt.',
  },
  {
    name: 'Genius Inc.',
    field: 'apps',
    roles: [{ title: 'Senior Software Engineer', start: '2016-10', end: '2017-09' }],
    note: 'Full stack for a mobile education platform; managed about 10 developers overseas.',
  },
  {
    name: 'Kalopsia',
    field: 'xr',
    cto: true,
    roles: [{ title: 'CTO', start: '2017-09', end: '2018-09' }],
    note: 'Curated virtual reality experiences, in stealth. Now a lab project.',
  },
  {
    name: 'Renge',
    field: 'apps',
    founder: true,
    cto: true,
    roles: [{ title: 'CTO & Co-Founder', start: '2018-09', end: '2020-07' }],
    note: 'Location-based social app on a graph network, for meeting people wherever you are. Sponsored a Grammy Week party at the Roxy, where Larry King received a lifetime achievement award. Then the marketing fell through and COVID took its users and funding. Sending members real toilet paper never got past Apple.',
  },
  {
    name: 'Unify',
    field: 'apps',
    founder: true,
    url: 'https://weunify.app',
    roles: [{ title: 'Developer & Founder', start: '2019-09', end: null }],
    note: 'One-tap group photos. Featured by Apple at release, in 30 languages.',
  },
  {
    name: 'InnerJam',
    field: 'apps',
    founder: true,
    cto: true,
    roles: [{ title: 'CTO & Co-Founder', start: '2019-10', end: '2020-12' }],
    note: 'Affirmations mixed under your own music, adjusted wave by wave so you don’t hear them. Completed, then stopped during COVID when the co-founder whose idea it was passed away.',
  },
  {
    name: 'Lot Club',
    field: 'apps',
    founder: true,
    url: '/archive/lot-club',
    roles: [{ title: 'CEO, Co-Founder & sole creator', start: '2020-07', end: '2020-12' }],
    note: 'Private community for entertainment professionals: one cold email to 45,000 people, 11% applied, 6,000 signups in the first month. Self-funded; paused when a partner dispute used up the budget. 6,000 applicants still accepted across tiers; resuming in due time.',
  },
  {
    name: 'LavaMap',
    field: 'xr',
    roles: [
      { title: 'Lead iOS Developer', start: '2021-02', end: '2021-05' },
      { title: 'Lead Architect & Lead iOS Developer', start: '2021-05', end: '2021-11' },
    ],
    note: 'AR for property technology.',
  },
  {
    name: 'MPAC Crypto',
    field: 'fintech',
    founder: true,
    cto: true,
    roles: [
      { title: 'Technical Consultant', start: '2021-11', end: '2023-11' },
      { title: 'CTO & Co-Founder', start: '2023-11', end: '2024-05' },
    ],
    note: 'Crypto platform, New York.',
  },
  {
    name: 'Banter Media',
    field: 'live',
    roles: [{ title: 'Senior Software Engineer', start: '2022-08', end: '2023-12' }],
    note: 'Lead iOS. Async video, audio, text and documents, transcribed and translated automatically, with groups, AI summaries and AI functions. Built from Morocco.',
  },
  {
    name: 'Logic One',
    field: 'fintech',
    roles: [
      { title: 'Technical Consultant', start: '2022-12', end: '2024-01' },
      { title: 'Lead Developer', start: '2024-01', end: '2024-09' },
    ],
    note: 'Product and strategy.',
  },
  {
    name: 'Varasa',
    field: 'live',
    founder: true,
    url: 'https://getvarasa.com',
    roles: [{ title: 'Founder & sole creator', start: '2024-01', end: null }],
    note: 'Human-centred AI, started with Sonia Talati. Patents on private AI workflows.',
  },
  {
    name: 'LIVEr / Aioli',
    field: 'live',
    cto: true,
    roles: [
      { title: 'iOS Team Lead', start: '2024-09', end: '2024-10' },
      { title: 'CTO', start: '2024-10', end: '2025-04' },
    ],
    note: 'Food discovery: a team of 10, RAG over 50,000 restaurants, live shopping and ordering agents.',
  },
  {
    name: 'Favorited',
    field: 'live',
    url: 'https://apps.apple.com/us/app/favorited/id1638796139',
    roles: [{ title: 'Member of Technical Staff', start: '2025-04', end: null }],
    note: 'Live captions and translations across languages. Native apps launched for Spooky Season.',
  },
  {
    name: 'Elliott Wave LLC',
    field: 'live',
    founder: true,
    url: '/work',
    roles: [{ title: 'Founder, elliottwave.studio lab', start: '2026-01', end: null }],
    note: 'MOQOM, six10nine, Unify and Kalopsia.',
  },
];

export const FIRST_YEAR = 2006;

const months = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + (m - 1);
};

/** Position of a 'YYYY-MM' on the timeline, 0 to 1. */
export function at(ym: string): number {
  const span = months(NOW) - FIRST_YEAR * 12;
  return Math.min(1, Math.max(0, (months(ym) - FIRST_YEAR * 12) / span));
}

/** Years spent in each field, counting overlapping roles once. */
export function yearsByField(): Array<{ field: Field; years: number }> {
  return (Object.keys(FIELDS) as Field[]).map((field) => {
    const covered = new Set<number>();
    for (const c of CAREER.filter((c) => c.field === field)) {
      for (const r of c.roles) {
        for (let m = months(r.start); m < months(r.end ?? NOW); m++) covered.add(m);
      }
    }
    return { field, years: covered.size / 12 };
  });
}

export const STATS = [
  { value: `${Number(NOW.slice(0, 4)) - FIRST_YEAR}`, label: `years shipping software and design, since ${FIRST_YEAR}` },
  { value: '700+', label: 'films handled securely, from final cuts that replaced DVDs to full archives' },
  { value: '35+', label: 'Academy Award–winning projects among them' },
  { value: '0', label: 'breaches or leaks at Covalent: pen-tested, best in class every quarter' },
  { value: `${CAREER.filter((c) => c.founder).length}`, label: 'companies founded or co-founded' },
  { value: `${CAREER.filter((c) => c.cto).length}`, label: 'times CTO' },
  { value: '50,000', label: 'restaurants in a live RAG engine' },
  { value: '50', label: 'developers led on one team, every new one code-reviewed and mentored by him' },
];

export const LINKS = [
  { href: 'https://www.linkedin.com/in/elliottio/', label: 'LinkedIn', detail: 'Full history' },
  { href: 'https://beacons.ai/khensu.nu', label: 'Portfolio', detail: 'beacons.ai/khensu.nu' },
  { href: 'https://weunify.app', label: 'Unify', detail: 'Featured by Apple' },
  { href: 'https://getvarasa.com', label: 'Varasa', detail: 'Human-centred AI' },
  { href: 'https://apps.apple.com/us/app/favorited/id1638796139?eventid=6817410870', label: 'Favorited', detail: 'Spooky Season 2026' },
  { href: 'https://github.com/elliott-io', label: 'GitHub', detail: 'elliott-io' },
];
