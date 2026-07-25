import { i18n } from '@/i18n'

/** Route / product reserved words — blocked for NEW trip slugs only. */
export const RESERVED_SLUGS = [
  'create',
  'manage',
  'test',
  'admin',
  'api',
  'success',
  'cancel',
  't',
  'assets',
  'static',
  'favicon',
] as const

const RESERVED = new Set<string>(RESERVED_SLUGS)

export const SLUG_MIN = 3
export const SLUG_MAX = 30
export const SLUG_RE = /^[a-z0-9-]{3,30}$/

export function slugFormatMessage(): string {
  return i18n.global.t('slug.format')
}

export function slugTakenMessage(): string {
  return i18n.global.t('slug.taken')
}

export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug)
}

/** Returns null when format is valid; otherwise the format error string. */
export function validateSlugFormat(raw: string): string | null {
  const slug = normalizeSlug(raw)
  if (!slug) return null
  if (!SLUG_RE.test(slug)) return slugFormatMessage()
  if (isReservedSlug(slug)) return i18n.global.t('slug.reserved')
  return null
}
