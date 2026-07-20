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

/** Format / reserved-word error. */
export const SLUG_FORMAT_MESSAGE = '英数字とハイフンで 3〜30文字'

/** Duplicate slug error. */
export const SLUG_TAKEN_MESSAGE = 'この名前はすでに使われています'

/** @deprecated Prefer SLUG_TAKEN_MESSAGE or SLUG_FORMAT_MESSAGE. */
export const SLUG_UNAVAILABLE_MESSAGE = SLUG_TAKEN_MESSAGE

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
  if (!SLUG_RE.test(slug) || isReservedSlug(slug)) return SLUG_FORMAT_MESSAGE
  return null
}
