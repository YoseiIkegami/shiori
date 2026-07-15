/**
 * Polaroid-like grade via Canvas ImageData (no CSS filter / no LUT libs).
 * Inspired by typical "fade curve + warm channel shift + mono grain" workflows.
 */

/** Lift blacks for a faded print look (higher = more washed-out shadows). */
const BLACK_LIFT = 35
/** Warmth: lift red, slight green, pull blue. */
const RED_SHIFT = 8
const GREEN_SHIFT = 2
const BLUE_SHIFT = -10
/** Monochrome grain amplitude (±intensity). */
const GRAIN_INTENSITY = 12

function buildFadeCurve(blackLift: number = BLACK_LIFT): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(blackLift + (i / 255) * (255 - blackLift))
  }
  return lut
}

function buildChannelCurve(shift: number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.max(0, Math.min(255, i + shift))
  }
  return lut
}

const fadeLut = buildFadeCurve()
const redLut = buildChannelCurve(RED_SHIFT)
const greenLut = buildChannelCurve(GREEN_SHIFT)
const blueLut = buildChannelCurve(BLUE_SHIFT)

/** Fade + warm channel remap. Call only on the photo rect. */
export function applyPolaroidTone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const imageData = ctx.getImageData(x, y, width, height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    data[i] = redLut[fadeLut[data[i]!]]!
    data[i + 1] = greenLut[fadeLut[data[i + 1]!]]!
    data[i + 2] = blueLut[fadeLut[data[i + 2]!]]!
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
