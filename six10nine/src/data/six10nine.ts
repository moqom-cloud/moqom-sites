/**
 * Outcome-level facts only. Describe what six10nine does for people, never how its game side works
 * (what changes over time, when, or why). See README.md.
 */
export const RELEASED = false;

export const LINKS = {
  repo: 'https://github.com/elliott-wave-labs/six10nine',
  releases: 'https://github.com/elliott-wave-labs/six10nine/releases',
  installer: 'https://elliottwave.dev/six10nine/install.sh',
  studio: 'https://elliottwave.studio',
  work: 'https://elliottwave.studio/work',
  licence: 'https://polyformproject.org/licenses/noncommercial/1.0.0/',
  einstein: 'https://einsteinathome.org',
  boinc: 'https://github.com/BOINC/boinc',
  mcp: 'https://modelcontextprotocol.io',
};

export const EMAIL = {
  licensing: 'licensing@elliottwave.studio',
  security: 'security@elliottwave.studio',
};

/** Shown wherever a link only works once the first public release is out. */
export const AT_RELEASE = 'Available at release';

export const INSTALL = {
  brew: 'brew install --cask elliott-wave-labs/tap/six10nine',
  script: `curl -fsSL ${LINKS.installer} | bash`,
  uninstallScript: `curl -fsSL ${LINKS.installer} | bash -s -- --uninstall`,
  uninstallBrew: 'brew uninstall --cask --zap six10nine',
};

export const MCP_PATH = '/Applications/Six10Nine.app/Contents/MacOS/six10nine-mcp';

export const DOCS = [
  { href: '/getting-started', label: 'Getting started' },
  { href: '/chords', label: 'Chords & actions' },
  { href: '/ai', label: 'AI menu matching' },
  { href: '/mcp', label: 'MCP server' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/licence', label: 'Licence' },
  { href: '/contribute', label: 'Contribute' },
  { href: '/security', label: 'Security' },
  { href: '/changelog', label: 'Changelog' },
];
