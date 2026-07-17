/**
 * Photo grade via Canvas ImageData (no CSS filter / no LUT libs).
 * Orange = warm film; blue = cool grade; none = untouched.
 *
 * Channel curves are additive (i + shift), never multiplicative.
 * Callers must draw the ungraded source first, then apply once —
 * switching presets must not stack grades on already-toned pixels.
 */

import type { FilterMode } from '@/lib/filterMode'

export type ToneKind = 'orange' | 'blue'

const GRAIN_INTENSITY = 5
const PREVIEW_JPEG_QUALITY = 0.88

type ToneParams = {
  blackLift: number
  redShift: number
  greenShift: number
  blueShift: number
}

const TONES: Record<ToneKind, ToneParams> = {
  // Subtle warm tilt — comparable strength to blue.
  orange: { blackLift: 20, redShift: 4, greenShift: 0, blueShift: -3 },
  // Subtle cool tilt (was too strong when CSS used hue-rotate ~168deg).
  blue: { blackLift: 20, redShift: -4, greenShift: 0, blueShift: 6 },
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

const toneLuts = {
  orange: {
    fade: buildFadeCurve(TONES.orange.blackLift),
    red: buildChannelCurve(TONES.orange.redShift),
    green: buildChannelCurve(TONES.orange.greenShift),
    blue: buildChannelCurve(TONES.orange.blueShift),
  },
  blue: {
    fade: buildFadeCurve(TONES.blue.blackLift),
    red: buildChannelCurve(TONES.blue.redShift),
    green: buildChannelCurve(TONES.blue.greenShift),
    blue: buildChannelCurve(TONES.blue.blueShift),
  },
}

/** Apply orange or blue grade on the photo rect only (expects ungraded pixels). */
export function applyPolaroidTone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  kind: ToneKind = 'orange',
): void {
  const luts = toneLuts[kind]
  const imageData = ctx.getImageData(x, y, width, height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    data[i] = luts.red[luts.fade[data[i]!]]!
    data[i + 1] = luts.green[luts.fade[data[i + 1]!]]!
    data[i + 2] = luts.blue[luts.fade[data[i + 2]!]]!
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
  if (mode !== 'orange' && mode !== 'blue') return source

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
