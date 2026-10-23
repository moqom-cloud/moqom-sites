// The example ñüFi Back campaign drawn on /nufi: a 30-day film campaign with a $40,000 goal. Every figure here is an
// illustrative example, never a measurement, and the page labels it so.
export const GOAL = 40_000;
export const DAYS = 30;
export const BACKERS = 1_204;

// Pledged per day when the goal is met: a strong launch, a quiet middle and a final push.
export const DAILY_MET = [
  6200, 3800, 2400, 1700, 1300, 1100, 1000, 900, 850, 800, 750, 700, 700, 750, 800, 700, 650, 700, 750, 800, 900, 1000,
  1100, 1300, 1500, 1700, 2000, 2600, 3400, 3350,
];

// The same campaign with a weaker run, which misses the goal and refunds.
export const DAILY_MISSED = DAILY_MET.map((v, i) => Math.round((v * (i > 20 ? 0.6 : 0.72)) / 10) * 10);

export const cumulative = (daily: number[]) => daily.reduce<number[]>((a, v) => [...a, (a.at(-1) ?? 0) + v], [0]);
export const total = (daily: number[]) => daily.reduce((a, v) => a + v, 0);
export const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

// The campaign as the phone shows it, six days before the deadline.
export const PHONE_DAY = 24;
export const phonePledged = total(DAILY_MET.slice(0, PHONE_DAY));
