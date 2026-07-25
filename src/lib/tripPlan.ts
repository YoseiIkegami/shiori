import { currencyForLocale, getLocale, type CheckoutCurrency } from '@/i18n'
import { i18n } from '@/i18n'

export type PlanId = 'free' | 'standard' | 'plus'

export type PlanDef = {
  id: PlanId
  maxPhotos: number
  /** null = unlimited (expires_at NULL). free uses short TTL hours. */
  retentionDays: number | null
  freeTtlHours?: number
  amounts: Record<CheckoutCurrency, number>
}

/** Server + client shared plan catalog. Amounts: JPY zero-decimal, USD cents. */
export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: 'free',
    maxPhotos: 3,
    retentionDays: null,
    freeTtlHours: 2,
    amounts: { jpy: 0, usd: 0 },
  },
  standard: {
    id: 'standard',
    maxPhotos: 50,
    retentionDays: 7,
    amounts: { jpy: 150, usd: 100 },
  },
  plus: {
    id: 'plus',
    maxPhotos: 500,
    retentionDays: null,
    amounts: { jpy: 750, usd: 500 },
  },
}

export const DEFAULT_PLAN_ID: PlanId = 'standard'
export const DEFAULT_MAX_PHOTOS = PLANS.standard.maxPhotos
export const RETENTION_DAYS = PLANS.standard.retentionDays ?? 7
export const FILM_COUNT_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const

export function isPlanId(v: unknown): v is PlanId {
  return v === 'free' || v === 'standard' || v === 'plus'
}

export function getPlan(id: PlanId): PlanDef {
  return PLANS[id]
}

export function formatPlanPrice(
  planId: PlanId,
  currency: CheckoutCurrency = currencyForLocale(),
): string {
  const amount = PLANS[planId].amounts[currency]
  if (amount <= 0) return i18n.global.t('plan.free.name')
  const major = currency === 'jpy' ? amount : amount / 100
  return i18n.global.n(major, 'currency', currency === 'jpy' ? 'ja' : 'en')
}

export function tripPlanPriceLine(
  planId: PlanId = 'standard',
  currency: CheckoutCurrency = currencyForLocale(),
): string {
  const plan = PLANS[planId]
  const price = formatPlanPrice(planId, currency)
  if (planId === 'free') return price
  const days = plan.retentionDays ?? 0
  return i18n.global.t('home.priceLine', {
    photos: plan.maxPhotos,
    days: days || '∞',
    price,
  })
}

export function tripPriceButtonLabel(
  planId: PlanId,
  currency: CheckoutCurrency = currencyForLocale(),
): string {
  if (planId === 'free') return i18n.global.t('create.submitFree')
  return i18n.global.t('create.submitPaid', { price: formatPlanPrice(planId, currency) })
}

/** @deprecated Prefer plan-based pricing. */
export function tripIncludesLine(maxPhotos = DEFAULT_MAX_PHOTOS, days = RETENTION_DAYS): string {
  return `フィルム${maxPhotos}枚・${days}日保存`
}

export function filmCountSelectOptions(current?: number, planId?: PlanId): number[] {
  const cap = planId ? PLANS[planId].maxPhotos : 500
  const base: number[] = [...FILM_COUNT_OPTIONS].filter((n) => n <= cap)
  if (current != null && current > 0 && !base.includes(current)) {
    base.push(Math.min(current, cap))
    base.sort((a, b) => a - b)
  }
  if (!base.length) base.push(cap)
  return base
}

export function checkoutCurrency(): CheckoutCurrency {
  return currencyForLocale(getLocale())
}
