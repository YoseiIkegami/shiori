/**
 * Compose photo + polaroid frame + comment into a single upright JPEG.
 * Board rotation is applied later via CSS — never baked into this image.
 *
 * Film look: ImageData tone curve + channel shift + mono grain (photo area only).
 */

import { addMonochromeGrain, applyPolaroidTone } from '@/lib/polaroidTone'

export const POLAROID_WIDTH = 1200
export const POLAROID_HEIGHT = 1440
export const PHOTO_SIZE = 1080
export const FRAME_MARGIN = 60
/** Bottom caption band: 1440 - 60 - 1080 = 300 */
export const CAPTION_BAND = POLAROID_HEIGHT - FRAME_MARGIN - PHOTO_SIZE

const FRAME_COLOR = '#F5EFE0'
const INK_COLOR = '#4A3B2A'
const FONT_FAMILY = '"Klee One", "Yomogi", cursive'
const BASE_FONT_SIZE = 48
const MIN_FONT_SIZE = 28
const TEXT_PAD_X = 72
const JPEG_QUALITY = 0.9

async function ensureFontsReady(sizePx: number): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  await document.fonts.load(`${sizePx}px ${FONT_FAMILY}`)
  await document.fonts.ready
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
      reject(new Error('合成用画像の読み込みに失敗しました'))
    }
    img.src = url
  })
}

/** Greedy character wrap for CJK / mixed text. */
function wrapToLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const chars = [...text]
  const lines: string[] = []
  let start = 0

  while (start < chars.length && lines.length < maxLines) {
    const isLastLine = lines.length === maxLines - 1
    let end = start
    let line = ''

    while (end < chars.length) {
      const trial = line + chars[end]
      if (ctx.measureText(trial).width <= maxWidth) {
        line = trial
        end++
      } else {
        break
      }
    }

    if (end === start) {
      line = chars[start]
      end = start + 1
    }

    if (isLastLine && end < chars.length) {
      while (line.length > 0 && ctx.measureText(`${line}…`).width > maxWidth) {
        line = [...line].slice(0, -1).join('')
        end--
      }
      lines.push(`${line}…`)
      break
    }

    lines.push(line)
    start = end
  }

  return lines
}

function fitComment(
  ctx: CanvasRenderingContext2D,
  comment: string,
  maxWidth: number,
): { fontSize: number; lines: string[] } {
  const trimmed = comment.trim().slice(0, 30)
  if (!trimmed) {
    return { fontSize: BASE_FONT_SIZE, lines: [] }
  }

  for (let size = BASE_FONT_SIZE; size >= MIN_FONT_SIZE; size -= 2) {
    ctx.font = `${size}px ${FONT_FAMILY}`
    if (ctx.measureText(trimmed).width <= maxWidth) {
      return { fontSize: size, lines: [trimmed] }
    }

    const lines = wrapToLines(ctx, trimmed, maxWidth, 2)
    const covered = lines.join('').replace(/…$/, '')
    if (covered.length >= trimmed.length) {
      return { fontSize: size, lines }
    }
  }

  ctx.font = `${MIN_FONT_SIZE}px ${FONT_FAMILY}`
  return {
    fontSize: MIN_FONT_SIZE,
    lines: wrapToLines(ctx, trimmed, maxWidth, 2),
  }
}

/**
 * Bake square photo + cream frame + comment into a fixed 1200×1440 JPEG.
 * `sourceBlob` should already be center-cropped square (from processCapture).
 */
export async function composePolaroid(
  sourceBlob: Blob,
  commentText: string,
): Promise<Blob> {
  await ensureFontsReady(BASE_FONT_SIZE)

  const img = await loadImageFromBlob(sourceBlob)
  const canvas = document.createElement('canvas')
  canvas.width = POLAROID_WIDTH
  canvas.height = POLAROID_HEIGHT
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable')
  }

  // 1) Cream frame (full canvas)
  ctx.fillStyle = FRAME_COLOR
  ctx.fillRect(0, 0, POLAROID_WIDTH, POLAROID_HEIGHT)

  // 2) Photo into square well (no CSS filter)
  ctx.drawImage(img, FRAME_MARGIN, FRAME_MARGIN, PHOTO_SIZE, PHOTO_SIZE)

  // 3–4) Tone + mono grain — photo rect only (not frame / caption)
  applyPolaroidTone(ctx, FRAME_MARGIN, FRAME_MARGIN, PHOTO_SIZE, PHOTO_SIZE)
  addMonochromeGrain(ctx, FRAME_MARGIN, FRAME_MARGIN, PHOTO_SIZE, PHOTO_SIZE)

  // 5) Comment on the bottom band
  const maxTextWidth = POLAROID_WIDTH - TEXT_PAD_X * 2
  const { fontSize, lines } = fitComment(ctx, commentText, maxTextWidth)

  if (lines.length > 0) {
    ctx.fillStyle = INK_COLOR
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${fontSize}px ${FONT_FAMILY}`

    const captionCenterY = FRAME_MARGIN + PHOTO_SIZE + CAPTION_BAND / 2
    const lineHeight = fontSize * 1.35
    const blockHeight = lineHeight * lines.length
    const startY = captionCenterY - blockHeight / 2 + lineHeight / 2

    lines.forEach((line, i) => {
      ctx.fillText(line, POLAROID_WIDTH / 2, startY + i * lineHeight)
    })
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('ポラロイド合成 JPEG の生成に失敗しました'))
      },
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
