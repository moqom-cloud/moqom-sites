// Copied from sites/_shared/pricing/price-cards.ts — the canonical copy lives in sites/_shared. Edit there, then re-copy.
/**
 * Real-world price comparisons, MOQOM Cloud vs Agora list, per participant-hour.
 *
 * Computed with the billing formula in moqom/go/internal/billing (RatePer1000: 85% of Agora's list
 * price after Agora's automatic volume discount, rounded down to a cent, never above Agora less 1¢;
 * $0.05/GiB self-hosted, never above the hosted price), on Agora's tier boundaries: the total pixels
 * a participant receives at once. Agora: Interactive Live Streaming list prices and volume discounts,
 * retrieved October 2026. Regenerate if any of those inputs change; the numbers are not live.
 */
export interface PriceCard {
  title: string;
  scenario: string;
  agora: string;
  moqom: string;
  saving: string;
  note?: string;
  highlight?: boolean;
}

export const PRICE_CARDS: PriceCard[] = [
  {
    title: '4K viewer',
    scenario: 'One viewer watching 4K for an hour',
    agora: '$1.08',
    moqom: '$0.92',
    saving: '15% savings',
    highlight: true,
  },
  {
    title: 'Co-host at 540p',
    scenario: 'A co-host seeing two others in 540p tiles, one hour',
    agora: '$0.54',
    moqom: '$0.46',
    saving: '15% savings',
  },
  {
    title: '9-person grid at 180p',
    scenario: 'Nine people in a 3×3 grid, each seeing eight 180p tiles, per person-hour',
    agora: '$0.24',
    moqom: '$0.20',
    saving: '15% savings',
    note: 'A third of a phone screen is about 180p wide, so smaller tiles stay in the HD tier and lose little you can see.',
  },
  {
    title: 'At volume',
    scenario: 'An HD host past 1,000,000 participant-minutes in a month, per hour',
    agora: '$0.24',
    moqom: '$0.18',
    saving: '24% under Agora’s list',
    note: 'Agora’s own volume discount brings its price to $0.22. MOQOM applies the same discount and stays 15% under it, with no contract.',
    highlight: true,
  },
  {
    title: 'Self-hosted relays',
    scenario: '1,000 viewers at 720p for an hour, relays on your own servers',
    agora: '$119.40',
    moqom: '$37.72',
    saving: '69% savings self-hosted',
    note: 'You run the relays and pay your own cloud costs. MOQOM meters bandwidth only, at $0.05/GiB, and never charges more than the same minutes would cost hosted. Agora’s cheapest rate works out to about $0.16/GiB (720p–1080p to a broadcast audience), so the fee is about 69% under it, about 90% under at 360p and 97% for audio. No extra fee for recording or other features.',
    highlight: true,
  },
];

export const KEY_POINTS = [
  { title: '15% under Agora, always', body: 'Every rate is 85% of Agora’s list price, and at least 1¢ under it per 1,000 minutes, enforced in code.' },
  { title: 'Volume pricing, automatic', body: 'Past 100,000, 500,000 and 1,000,000 minutes a month, rates drop with Agora’s own volume discounts and stay 15% under.' },
  { title: 'Prepaid, by the second', body: 'Buy credit, use it, top up automatically if you like. No invoices, no surprise bills.' },
  { title: 'Self-host for the fee', body: 'Run relays anywhere and pay only $0.05 per GiB to MOQOM, about 69% under Agora’s cheapest rate.' },
];

export const PRICE_FOOTNOTE =
  'Per participant-hour at first-band rates unless noted, launch pricing, subject to change before general availability. Agora: Interactive Live Streaming list prices and automatic volume discounts, October 2026. Tiers follow Agora’s: the total pixels a participant receives at once. Actual charges are metered by the second.';
