import { i18n, type AppLocale } from '@/i18n'
import { normalizeSlug, SLUG_MAX, validateSlugFormat } from '@/lib/reservedSlugs'

type SlugWordBank = {
  prefixes: readonly string[]
  suffixes: readonly string[]
}

function asWordList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((w): w is string => typeof w === 'string' && w.length > 0)
}

/** Load ASCII slug word banks from locale JSON (`slug.prefixes` / `slug.suffixes`). */
export function slugWordsFor(locale: AppLocale): SlugWordBank {
  const msg = i18n.global.getLocaleMessage(locale) as {
    slug?: { prefixes?: unknown; suffixes?: unknown }
  }
  const prefixes = asWordList(msg.slug?.prefixes)
  const suffixes = asWordList(msg.slug?.suffixes)
  if (prefixes.length && suffixes.length) return { prefixes, suffixes }

  const fallback = i18n.global.getLocaleMessage('ja') as {
    slug?: { prefixes?: unknown; suffixes?: unknown }
  }
  return {
    prefixes: asWordList(fallback.slug?.prefixes),
    suffixes: asWordList(fallback.slug?.suffixes),
  }
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!
}

function twoDigits(): string {
  return String(Math.floor(Math.random() * 100)).padStart(2, '0')
}

/** Generate a romanized hyphenated slug candidate (may still collide). */
export function generateSlugCandidate(locale: AppLocale = 'ja'): string {
  const { prefixes, suffixes } = slugWordsFor(locale)
  if (!prefixes.length || !suffixes.length) return 'trip-memory'
  let candidate = normalizeSlug(`${pick(prefixes)}-${pick(suffixes)}`)
  if (candidate.length > SLUG_MAX) {
    candidate = candidate.slice(0, SLUG_MAX).replace(/-$/, '')
  }
  return candidate
}

/** Append -NN within SLUG_MAX, or regenerate a fresh pair. */
export function withCollisionSuffix(base: string, locale: AppLocale = 'ja'): string {
  const suffix = `-${twoDigits()}`
  const room = SLUG_MAX - suffix.length
  if (room < 3) return generateSlugCandidate(locale)
  const trimmed = base.slice(0, room).replace(/-$/, '')
  return normalizeSlug(`${trimmed}${suffix}`)
}

/** Pick available slug candidates, skipping taken / reserved / avoid list. */
export async function pickAvailableSlugs(
  count: number,
  isTaken: (slug: string) => Promise<boolean>,
  avoid: Iterable<string> = [],
  locale: AppLocale = 'ja',
): Promise<string[]> {
  const blocked = new Set(
    [...avoid].map((s) => normalizeSlug(s)).filter(Boolean),
  )
  const out: string[] = []
  const seen = new Set<string>()
  const seed = [...blocked][0]

  for (let i = 0; i < 24 && out.length < count; i++) {
    const candidate =
      seed && i % 2 === 0
        ? withCollisionSuffix(seed, locale)
        : generateSlugCandidate(locale)
    if (seen.has(candidate) || blocked.has(candidate)) continue
    seen.add(candidate)
    if (validateSlugFormat(candidate)) continue
    if (await isTaken(candidate)) continue
    out.push(candidate)
  }
  return out
}
