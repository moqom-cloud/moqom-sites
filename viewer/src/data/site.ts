// Product identity for the docs site. Renaming the product starts here (and in the viewer repo's
// RENAMING.md list). Version and SRI come from src/vendor/release.json, written by sync-docs.
import release from '../vendor/release.json';
import { PLATFORM_LIST, hrefOf } from './platforms';

export const SITE = {
  displayName: '3D Viewer',
  slug: 'viewer',
  tagName: 'ew-viewer',
  url: 'https://viewer.elliottwave.studio',
  repoUrl: 'https://github.com/elliottwave/viewer',
  releasesUrl: 'https://github.com/elliottwave/viewer/releases',
  packageName: '@elliottwave/viewer',
  hostingPackageName: '@elliottwave/viewer-hosting',
  wordpressSlug: 'elliottwave-viewer',
  shortcode: 'viewer',
  vendor: 'elliottwave.studio lab',
  legalEntity: 'Elliott Wave LLC',
  studioUrl: 'https://elliottwave.studio',
  donateUrl: 'https://elliottwave.dev/donate/',
  licensingEmail: 'licensing@elliottwave.studio',
  securityEmail: 'security@elliottwave.studio',
  modelViewerVersion: release.modelViewer,
  threeVersion: release.three,
  release,
} as const;

export const NAV = [
  {
    title: 'Start',
    items: [
      { href: '/', label: 'Overview' },
      { href: '/quick-start/', label: 'Quick start' },
    ],
  },
  {
    title: 'Platforms',
    items: [
      { href: '/platforms/', label: 'All platforms' },
      ...PLATFORM_LIST.filter((p) => p.nav).map((p) => ({ href: hrefOf(p), label: p.name })),
    ],
  },
  {
    title: 'Hosting',
    items: [
      { href: '/hosting/firebase/', label: 'Firebase' },
      { href: '/hosting/own-server/', label: 'Your own server + checker' },
    ],
  },
  {
    title: 'Guides',
    items: [
      { href: '/ar/', label: 'AR on iOS and Android' },
      { href: '/accessibility-performance/', label: 'Accessibility and performance' },
    ],
  },
  {
    title: 'Project',
    items: [
      { href: '/pricing/', label: 'Pricing' },
      { href: '/licence/', label: 'Licence' },
      { href: '/licence/manage/', label: 'Manage a licence' },
      { href: '/contribute/', label: 'Contribute' },
      { href: '/security/', label: 'Security' },
    ],
  },
] as const;
