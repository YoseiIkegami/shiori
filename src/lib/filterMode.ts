export type FilterMode = 'orange' | 'blue' | 'none'

export const FILTER_CYCLE: FilterMode[] = ['orange', 'blue', 'none']

export function nextFilterMode(current: FilterMode): FilterMode {
  const index = FILTER_CYCLE.indexOf(current)
  return FILTER_CYCLE[(index + 1) % FILTER_CYCLE.length]!
}
