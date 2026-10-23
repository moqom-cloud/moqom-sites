// Standards named in the copy, and where each is published.

const RFC = (n: string) => `https://www.rfc-editor.org/rfc/rfc${n}`;
const FIPS = (n: string) => `https://csrc.nist.gov/pubs/fips/${n}/final`;
const DRAFT = (name: string) =>
  /-\d{2}$/.test(name) ? `https://datatracker.ietf.org/doc/html/${name}` : `https://datatracker.ietf.org/doc/${name}/`;

const NAMED: Record<string, string> = {
  X25519MLKEM768: "draft-ietf-tls-ecdhe-mlkem",
  SecP384r1MLKEM1024: "draft-ietf-tls-ecdhe-mlkem",
  MLKEM1024: "draft-ietf-tls-mlkem",
  "TLS 1.3": "RFC8446",
  DPoP: "RFC9449",
  SFrame: "RFC9605",
  MLS: "RFC9420",
  HPKE: "RFC9180",
  "ML-DSA-87": "FIPS204",
  "ML-KEM-1024": "FIPS203",
  "ML-KEM-768": "FIPS203",
  "ML-DSA": "FIPS204",
  "ML-KEM": "FIPS203",
  QUIC: "RFC9000",
  "MoQ Transport": "draft-ietf-moq-transport",
  "Media over QUIC Transport": "draft-ietf-moq-transport",
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const named = Object.keys(NAMED).sort((a, b) => b.length - a.length).map(escape).join("|");
const PATTERN = new RegExp(
  `(?<![\\w/#.-])(?:RFC ?(\\d{4})|FIPS ?(20[345])|(draft-(?:ietf|irtf)-[a-z0-9-]*[a-z0-9])|(${named}))(?![\\w-])`,
  "g",
);

/** Versioned and unversioned drafts are one standard. */
const family = (key: string) => key.replace(/-\d{2}$/, "");

function url(key: string): string {
  if (key.startsWith("RFC")) return RFC(key.slice(3));
  if (key.startsWith("FIPS")) return FIPS(key.slice(4));
  return DRAFT(key);
}

export type Part = string | { text: string; href: string };

/**
 * Splits text so each standard it names becomes a link, unless `seen` already
 * holds it. A name followed by its own number ("SFrame (RFC 9605)") links once.
 */
export function linkStandards(text: string, seen: Set<string> = new Set()): Part[] {
  const matches = [...text.matchAll(PATTERN)].map((m) => {
    const key = m[1] ? `RFC${m[1]}` : m[2] ? `FIPS${m[2]}` : m[3] ? m[3] : NAMED[m[4]];
    return { start: m.index!, end: m.index! + m[0].length, key, isName: Boolean(m[4]) };
  });
  const numbered = new Set(matches.filter((m) => !m.isName).map((m) => family(m.key)));
  const parts: Part[] = [];
  let pos = 0;
  for (const m of matches) {
    const f = family(m.key);
    if (seen.has(f) || (m.isName && numbered.has(f))) continue;
    if (m.start > pos) parts.push(text.slice(pos, m.start));
    parts.push({ text: text.slice(m.start, m.end), href: url(m.key) });
    seen.add(f);
    pos = m.end;
  }
  if (pos < text.length) parts.push(text.slice(pos));
  return parts;
}
