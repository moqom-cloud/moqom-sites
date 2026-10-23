// Copied from the viewer repo (packages/hosting/src/check/format.ts) by scripts/sync-docs.mjs. Edit it there.
import type { Level, Report } from './check.js';
import { fixesFor, type FixParams } from './fixes.js';

const MARK: Record<Level, string> = { pass: 'PASS', warn: 'WARN', fail: 'FAIL', info: 'INFO' };

/** Plain-text report for the terminal. */
export function formatReport(report: Report, params: FixParams = {}): string {
  const lines = [`Checked ${report.url}`];
  if (report.origin) lines.push(`For the site ${report.origin}`);
  if (report.server !== 'unknown') lines.push(`Server looks like: ${report.server}`);
  lines.push('');
  for (const f of report.findings) lines.push(`  ${MARK[f.level]}  ${f.title}\n        ${f.detail}`);
  const needsFix = report.findings.some((f) => (f.level === 'fail' || f.level === 'warn') && ['cors', 'content-type', 'cache'].includes(f.topic));
  if (needsFix) {
    const [first] = fixesFor(report.server, { ...params, ...(report.origin ? { origin: report.origin } : {}) });
    if (first) {
      lines.push('', `Fix for ${report.server === first.server ? first.label : `${first.label} (server not detected; other servers: --fixes all)`}`, `  File: ${first.file}`, '');
      lines.push(...first.code.split('\n').map((l) => `    ${l}`), '', `  ${first.note}`);
    }
  }
  lines.push('', report.ok ? 'Result: no blocking problems.' : 'Result: fix the FAIL items above.');
  return lines.join('\n');
}
