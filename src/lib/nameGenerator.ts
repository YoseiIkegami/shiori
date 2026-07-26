import { i18n, type AppLocale } from '@/i18n'

export const NAME_MAX = 60

function asWordList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((w): w is string => typeof w === 'string' && w.length > 0)
}

type NameBank = {
  prefixes: string[]
  suffixes: string[]
  adjectives: string[]
}

function wordBank(locale: AppLocale): NameBank {
  const msg = i18n.global.getLocaleMessage(locale) as {
    nameSuggest?: { prefixes?: unknown; suffixes?: unknown; adjectives?: unknown }
  }
  const prefixes = asWordList(msg.nameSuggest?.prefixes)
  const suffixes = asWordList(msg.nameSuggest?.suffixes)
  const adjectives = asWordList(msg.nameSuggest?.adjectives)
  if (prefixes.length && suffixes.length) {
    return { prefixes, suffixes, adjectives }
  }

  const fallback = i18n.global.getLocaleMessage('ja') as {
    nameSuggest?: { prefixes?: unknown; suffixes?: unknown; adjectives?: unknown }
  }
  return {
    prefixes: asWordList(fallback.nameSuggest?.prefixes),
    suffixes: asWordList(fallback.nameSuggest?.suffixes),
    adjectives: asWordList(fallback.nameSuggest?.adjectives),
  }
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!
}

function pickDistinct(aList: string[], bList: string[]): [string, string] {
  const a = pick(aList)
  let b = pick(bList)
  for (let i = 0; i < 6 && b === a; i++) b = pick(bList)
  return [a, b]
}

/** Trim + collapse whitespace, clamp to NAME_MAX. */
export function normalizeDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX)
}

type PairPattern = (a: string, b: string) => string

const JA_PATTERNS: PairPattern[] = [
  (a, b) => `${a}の${b}`,
  (a, b) => `${a}と${b}`,
  (a, b) => `${a}${b}`,
  (a, b) => `${a}・${b}`,
  (a, b) => `${b}の${a}`,
  (a, b) => `${a}と${b}の旅`,
  (a, _b) => `${a}のしおり`,
  (a, _b) => `${a}日和`,
  (a, _b) => `${a}ものがたり`,
  (a, b) => `${a}から${b}へ`,
]

const EN_PATTERNS: PairPattern[] = [
  (a, b) => `${a} ${b}`,
  (a, b) => `${a} & ${b}`,
  (a, b) => `${a}'s ${b}`,
  (a, b) => `${a}-${b}`,
  (a, b) => `${b} of ${a}`,
  (a, _b) => `${a} days`,
  (a, _b) => `${a} notes`,
]

/** Roughly half the time, put a mood adjective in front. */
function withAdjective(core: string, adjectives: string[], locale: AppLocale): string {
  if (!adjectives.length || Math.random() >= 0.5) return core
  const adj = pick(adjectives)
  return locale === 'en' ? `${adj} ${core}` : `${adj}${core}`
}

/** Locale-aware display name candidate (no uniqueness). */
export function generateNameCandidate(locale: AppLocale = 'ja'): string {
  const { prefixes, suffixes, adjectives } = wordBank(locale)
  if (!prefixes.length || !suffixes.length) {
    return locale === 'en' ? 'Summer trip' : '夏の旅'
  }
  const [a, b] = pickDistinct(prefixes, suffixes)
  const patterns = locale === 'en' ? EN_PATTERNS : JA_PATTERNS
  const core = pick(patterns)(a, b)
  return normalizeDisplayName(withAdjective(core, adjectives, locale))
}
