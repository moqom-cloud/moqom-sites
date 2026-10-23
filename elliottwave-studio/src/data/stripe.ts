// suñůlink.shield reservations through one Stripe Payment Link: $42 today (the activation) locks the pre-sale price;
// the shield at cost and shipping are charged when it ships. Apple Pay, cards and Link are offered on Stripe's hosted
// page; no card data touches khensu.nu. An empty link keeps the email reservation (pay later with ñü.wallet).
// The link's confirmation page redirects to https://khensu.nu/buy/thanks/.
export const SHIPS = 'Q1 2027';
export const RESERVATION = 42;
export const RESERVATION_LINK = '';

export type ShieldProduct = `shield-${string}-${string}`;

export const shieldProduct = (edition: string, model: string) => `shield-${edition}-${model}` as ShieldProduct;

export const ANY_PAYMENT_LINK = !!RESERVATION_LINK;

/** The reservation link, tagged with the configuration, with the buyer's email if they gave one. */
export function paymentLinkUrl(link: string, product: string, finish: string, email = '') {
  if (!link) return '';
  const u = new URL(link);
  // Stripe allows letters, digits, - and _ in client_reference_id.
  u.searchParams.set('client_reference_id', `${product}_${finish}`.replace(/[^\w-]/g, ''));
  if (email.trim()) u.searchParams.set('prefilled_email', email.trim());
  return u.href;
}
