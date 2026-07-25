/**
 * Photo grade via Canvas ImageData (no CSS filter / no LUT libs).
 * Presets live in filterMode.ts — this file only executes ToneParams.
 *
 * Channel curves are additive (i + shift), never multiplicative.
 * Callers must draw the ungraded source first, then apply once —
 * switching presets must not stack grades on already-toned pixels.
 */

import { getFilterDef, type FilterMode, type ToneParams } from '@/lib/filterMode'

const GRAIN_INTENSITY = 5
const PREVIEW_JPEG_QUALITY = 0.88

type ToneLuts = {
  fade: Uint8ClampedArray
  red: Uint8ClampedArray
  green: Uint8ClampedArray
  blue: Uint8ClampedArray
}

function buildFadeCurve(blackLift: number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(blackLift + (i / 255) * (255 - blackLift))
  }
  return lut
}

/** Additive per-channel shift: out = clamp(i + shift). Not multiply. */
function buildChannelCurve(shift: number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.max(0, Math.min(255, i + shift))
  }
  return lut
}

const lutCache = new Map<FilterMode, ToneLuts>()

function lutsFor(mode: FilterMode, tone: ToneParams): ToneLuts {
  let luts = lutCache.get(mode)
  if (!luts) {
    luts = {
      fade: buildFadeCurve(tone.blackLift),
      red: buildChannelCurve(tone.redShift),
      green: buildChannelCurve(tone.greenShift),
      blue: buildChannelCurve(tone.blueShift),
    }
    lutCache.set(mode, luts)
  }
  return luts
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

/** Apply the preset grade on the photo rect only (expects ungraded pixels). */
export function applyPolaroidTone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  mode: FilterMode = 'orange',
): void {
  const tone = getFilterDef(mode).tone
  if (!tone) return

  const luts = lutsFor(mode, tone)
  const saturation = tone.saturation ?? 1
  const contrast = tone.contrast ?? 1
  const grayscale = tone.grayscale === true
  const imageData = ctx.getImageData(x, y, width, height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    let r: number = luts.red[luts.fade[data[i]!]!]!
    let g: number = luts.green[luts.fade[data[i + 1]!]!]!
    let b: number = luts.blue[luts.fade[data[i + 2]!]!]!

    if (grayscale) {
      const luma = 0.299 * r + 0.587 * g + 0.114 * b
      r = luma
      g = luma
      b = luma
    } else if (saturation !== 1) {
      const luma = 0.299 * r + 0.587 * g + 0.114 * b
      r = luma + (r - luma) * saturation
      g = luma + (g - luma) * saturation
      b = luma + (b - luma) * saturation
    }

    if (contrast !== 1) {
      r = 128 + (r - 128) * contrast
      g = 128 + (g - 128) * contrast
      b = 128 + (b - 128) * contrast
    }

    data[i] = clamp255(r)
    data[i + 1] = clamp255(g)
    data[i + 2] = clamp255(b)
  }

  ctx.putImageData(imageData, x, y)
}

/** Same noise on R/G/B — film grain, not color noise. Photo rect only. */
export function addMonochromeGrain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  intensity: number = GRAIN_INTENSITY,
): void {
  const imageData = ctx.getImageData(x, y, width, height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * intensity * 2
    data[i] = Math.max(0, Math.min(255, data[i]! + noise))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1]! + noise))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2]! + noise))
  }

  ctx.putImageData(imageData, x, y)
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('画像の読み込みに失敗しました'))
    }
    img.src = url
  })
}

/**
 * Same canvas grade as composePolaroid (tone + grain).
 * PhotoPreview uses this so 仕上がり matches 送信確認 (no CSS filter drift).
 */
export async function gradePhotoBlob(
  source: Blob,
  mode: FilterMode,
  options: { grain?: boolean } = {},
): Promise<Blob> {
  if (!getFilterDef(mode).tone) return source

  const img = await loadImageFromBlob(source)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  ctx.drawImage(img, 0, 0)
  applyPolaroidTone(ctx, 0, 0, canvas.width, canvas.height, mode)
  if (options.grain !== false) {
    addMonochromeGrain(ctx, 0, 0, canvas.width, canvas.height)
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('フィルター適用に失敗しました'))),
      'image/jpeg',
      PREVIEW_JPEG_QUALITY,
    )
  })
}

/**
 * Instagram-style picker thumbnails: one downscale, then each preset applied
 * to a copy. Returns data URLs keyed by filter id (small enough to inline).
 */
export async function buildFilterThumbnails(
  source: Blob,
  filters: FilterMode[],
  width = 120,
): Promise<Partial<Record<FilterMode, string>>> {
  const img = await loadImageFromBlob(source)
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  const height = Math.round((width * srcH) / srcW)

  const base = document.createElement('canvas')
  base.width = width
  base.height = height
  const baseCtx = base.getContext('2d', { willReadFrequently: true })
  if (!baseCtx) throw new Error('Canvas 2D context unavailable')
  baseCtx.drawImage(img, 0, 0, width, height)

  const result: Partial<Record<FilterMode, string>> = {}
  for (const mode of filters) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) continue
    ctx.drawImage(base, 0, 0)
    applyPolaroidTone(ctx, 0, 0, width, height, mode)
    result[mode] = canvas.toDataURL('image/jpeg', 0.7)
  }
  return result
}
