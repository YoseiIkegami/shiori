/**
 * Filter presets — Instagram-style horizontal picker in PhotoPreview.
 * Tone params feed the ImageData pipeline in polaroidTone.ts
 * (additive channel shifts + fade; saturation / contrast / grayscale on top).
 */

export type FilterMode =
  | 'none'
  | 'orange'
  | 'cream'
  | 'retro'
  | 'blue'
  | 'fade'
  | 'mono'

export type ToneParams = {
  blackLift: number
  redShift: number
  greenShift: number
  blueShift: number
  /** 1 = unchanged. <1 desaturates toward luma. */
  saturation?: number
  /** 1 = unchanged. Pivot 128. */
  contrast?: number
  grayscale?: boolean
}

export type FilterDef = {
  id: FilterMode
  tone: ToneParams | null
}

/** Picker order. `none` first, brand default (orange) second — like Instagram's Normal. */
export const FILTERS: FilterDef[] = [
  { id: 'none', tone: null },
  { id: 'orange', tone: { blackLift: 20, redShift: 4, greenShift: 0, blueShift: -3 } },
  {
    id: 'cream',
    tone: { blackLift: 26, redShift: 6, greenShift: 3, blueShift: -1, saturation: 0.85 },
  },
  {
    id: 'retro',
    tone: {
      blackLift: 34,
      redShift: 7,
      greenShift: 2,
      blueShift: -7,
      saturation: 0.76,
      contrast: 0.94,
    },
  },
  { id: 'blue', tone: { blackLift: 20, redShift: -4, greenShift: 0, blueShift: 6 } },
  {
    id: 'fade',
    tone: { blackLift: 42, redShift: 1, greenShift: 1, blueShift: 3, saturation: 0.68 },
  },
  {
    id: 'mono',
    tone: { blackLift: 14, redShift: 0, greenShift: 0, blueShift: 0, grayscale: true, contrast: 1.06 },
  },
]

export const FILTER_IDS: FilterMode[] = FILTERS.map((f) => f.id)

export function getFilterDef(id: FilterMode): FilterDef {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0]!
}
