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
    retentionDays: 30,
    amounts: { jpy: 99, usd: 100 },
  },
  plus: {
    id: 'plus',
    maxPhotos: 500,
    retentionDays: null,
    amounts: { jpy: 499, usd: 500 },
  },
}

export const DEFAULT_PLAN_ID: PlanId = 'free'
export const DEFAULT_MAX_PHOTOS = PLANS.standard.maxPhotos
export const RETENTION_DAYS = PLANS.standard.retentionDays ?? 30
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
  if (amount <= 0) return i18n.global.t('plan.free.price')
  const major = currency === 'jpy' ? amount : amount / 100
  return i18n.global.n(major, 'currency', currency === 'jpy' ? 'ja' : 'en')
}

export function tripPriceButtonLabel(
  planId: PlanId,
  currency: CheckoutCurrency = currencyForLocale(),
): string {
  if (planId === 'free') return i18n.global.t('create.submitFree')
  return i18n.global.t('create.submitPaid', { price: formatPlanPrice(planId, currency) })
}

export function filmCountOptionsForMax(max: number): number[] {
  const cap = Math.max(1, Math.floor(max))
  // 上限が小さい（FREE など）は 1 枚刻み。50 / 500 は 10 枚刻み
  if (cap <= 10) {
    return Array.from({ length: cap }, (_, i) => i + 1)
  }
  const opts: number[] = []
  for (let n = 10; n <= cap; n += 10) opts.push(n)
  if (opts[opts.length - 1] !== cap) opts.push(cap)
  return opts
}

export function filmCountSelectOptions(current?: number, planId?: PlanId): number[] {
  const cap = planId ? PLANS[planId].maxPhotos : 500
  const base = filmCountOptionsForMax(cap)
  if (current != null && current > 0 && current <= cap && !base.includes(current)) {
    base.push(current)
    base.sort((a, b) => a - b)
  }
  return base
}

export function clampFilmCount(n: number, planId: PlanId): number {
  const opts = filmCountOptionsForMax(PLANS[planId].maxPhotos)
  const fallback = opts[opts.length - 1] ?? 1
  if (!Number.isFinite(n)) return fallback
  const v = Math.floor(n)
  if (opts.includes(v)) return v
  const floored = [...opts].reverse().find((o) => o <= v)
  return floored ?? opts[0] ?? fallback
}

export function checkoutCurrency(): CheckoutCurrency {
  return currencyForLocale(getLocale())
}
