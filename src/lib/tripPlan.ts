import { formatTripPriceYen } from '@/lib/pricing'

/** Default film count on issue. Matches create-trip-checkout default. */
export const DEFAULT_MAX_PHOTOS = 50

/** Base retention after payment. Matches stripe-webhook RETENTION_DAYS_BASE. */
export const RETENTION_DAYS = 7

export function tripIncludesLine(
  maxPhotos = DEFAULT_MAX_PHOTOS,
  days = RETENTION_DAYS,
): string {
  return `フィルム${maxPhotos}枚・${days}日保存`
}

/** Home footer: includes + price without middle-dot clutter. */
export function tripPlanPriceLine(
  maxPhotos = DEFAULT_MAX_PHOTOS,
  days = RETENTION_DAYS,
  price = formatTripPriceYen(),
): string {
  return `${tripIncludesLine(maxPhotos, days)} ${price}`
}

export function tripPriceButtonLabel(price = formatTripPriceYen()): string {
  return `${price} で旅をはじめる`
}
