import { normalizeSlug, SLUG_MAX, validateSlugFormat } from '@/lib/reservedSlugs'

const PREFIXES = [
  'kaze',
  'nami',
  'hoshi',
  'yozora',
  'natsu',
  'tabi',
  'sora',
  'umi',
  'yuu',
  'asa',
  'haru',
  'aki',
  'mori',
  'hana',
  'tsuki',
]

const SUFFIXES = [
  'tabi',
  'michi',
  'kioku',
  'tabidachi',
  'kaidou',
  'tsuki',
  'hikari',
  'iro',
  'oto',
  'hane',
  'kage',
  'ashiato',
  'yume',
  'ibuki',
]

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!
}

function twoDigits(): string {
  return String(Math.floor(Math.random() * 100)).padStart(2, '0')
}

/** Generate a romanized hyphenated slug candidate (may still collide). */
export function generateSlugCandidate(): string {
  let candidate = normalizeSlug(`${pick(PREFIXES)}-${pick(SUFFIXES)}`)
  if (candidate.length > SLUG_MAX) {
    candidate = candidate.slice(0, SLUG_MAX).replace(/-$/, '')
  }
  return candidate
}

/** Append -NN within SLUG_MAX, or regenerate a fresh pair. */
export function withCollisionSuffix(base: string): string {
  const suffix = `-${twoDigits()}`
  const room = SLUG_MAX - suffix.length
  if (room < 3) return generateSlugCandidate()
  const trimmed = base.slice(0, room).replace(/-$/, '')
  return normalizeSlug(`${trimmed}${suffix}`)
}

/** Pick available slug candidates, skipping taken / reserved / avoid list. */
export async function pickAvailableSlugs(
  count: number,
  isTaken: (slug: string) => Promise<boolean>,
  avoid: Iterable<string> = [],
): Promise<string[]> {
  const blocked = new Set(
    [...avoid].map((s) => normalizeSlug(s)).filter(Boolean),
  )
  const out: string[] = []
  const seen = new Set<string>()
  const seed = [...blocked][0]

  for (let i = 0; i < 24 && out.length < count; i++) {
    let candidate =
      seed && i % 2 === 0 ? withCollisionSuffix(seed) : generateSlugCandidate()
    if (seen.has(candidate) || blocked.has(candidate)) continue
    seen.add(candidate)
    if (validateSlugFormat(candidate)) continue
    if (await isTaken(candidate)) continue
    out.push(candidate)
  }
  return out
}
