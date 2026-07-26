/**
 * Base trip price (JPY). Must match STRIPE_BASE_AMOUNT on create-trip-checkout.
 * Set VITE_STRIPE_BASE_AMOUNT in .env (see .env.example).
 */
export const BASE_PRICE_JPY = Number(import.meta.env.VITE_STRIPE_BASE_AMOUNT ?? 99)

export function formatTripPriceYen(amount = BASE_PRICE_JPY): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}
