/**
 * Compose photo + polaroid frame + comment into a single upright JPEG.
 * Board rotation is applied later via CSS — never baked into this image.
 *
 * Film look: ImageData tone curve + channel shift + mono grain (photo area only).
 */

import { addMonochromeGrain, applyPolaroidTone } from '@/lib/polaroidTone'
import type { FilterMode } from '@/lib/filterMode'

export const POLAROID_WIDTH = 1200
export const POLAROID_HEIGHT = 1800
export const PHOTO_WIDTH = 1080
export const PHOTO_HEIGHT = 1440
export const FRAME_MARGIN = 60
/** Bottom caption band: 1800 - 60 - 1440 = 300 */
export const CAPTION_BAND = POLAROID_HEIGHT - FRAME_MARGIN - PHOTO_HEIGHT

const FRAME_COLOR = '#F5EFE0'
const INK_COLOR = '#4A3B2A'
const FONT_FAMILY = '"Klee One", "Yomogi", cursive'
const BASE_FONT_SIZE = 48
const MIN_FONT_SIZE = 28
const TEXT_PAD_X = 72
const DATE_FONT_SIZE = 34
/** Film-camera LED orange — drawn with alpha so it sits in the photo. */
const DATE_COLOR = 'rgba(255, 107, 53, 0.78)'
const DATE_MARGIN = 22
/** 7-segment LCD italic (self-hosted DSEG7 Classic Italic — regular weight). */
const DATE_FONT_FAMILY = '"DSEG7 Classic", monospace'
const JPEG_QUALITY = 0.9

/** Instant-camera style local date: `'26.7.17` (2-digit year, no zero-pad, no time). */
export function formatCaptureStamp(at: Date = new Date()): string {
  const y = String(at.getFullYear()).slice(-2)
  const m = at.getMonth() + 1
  const d = at.getDate()
  return `'${y}.${m}.${d}`
}

async function ensureFontsReady(sizePx: number): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  await Promise.all([
    document.fonts.load(`${sizePx}px ${FONT_FAMILY}`),
    document.fonts.load(`italic ${DATE_FONT_SIZE}px "DSEG7 Classic"`),
  ])
  await document.fonts.ready
}

function clearTextShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

/**
 * Film LED stamp: smaller italic 7-seg, soft bloom, slight translucency.
 * Tuned to feel burned into the exposure (not a neon UI overlay).
 */
function drawCaptureStamp(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
) {
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.font = `italic ${DATE_FONT_SIZE}px ${DATE_FONT_FAMILY}`

  // Very soft light bloom (halation) — keep tight so it doesn’t shout.
  ctx.shadowColor = 'rgba(255, 100, 45, 0.35)'
  ctx.shadowBlur = 2
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.fillStyle = DATE_COLOR
  ctx.fillText(text, x, y)

  // Thin dark whisper for bright backgrounds only — almost invisible.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)'
  ctx.shadowBlur = 1
  ctx.shadowOffsetY = 0.5
  ctx.fillText(text, x, y)

  clearTextShadow(ctx)
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
 * Bake 3:4 photo + cream frame + comment/date into a fixed 1200×1800 JPEG.
 * `sourceBlob` should already be center-cropped 1080×1440.
 */
export async function composePolaroid(
  sourceBlob: Blob,
  commentText: string,
  filterMode: FilterMode = 'orange',
  capturedAt: Date = new Date(),
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

  // 2) Photo into the 3:4 well.
  ctx.drawImage(img, FRAME_MARGIN, FRAME_MARGIN, PHOTO_WIDTH, PHOTO_HEIGHT)

  // 3–4) Optional light film treatment — photo rect only.
  if (filterMode === 'orange' || filterMode === 'blue') {
    applyPolaroidTone(ctx, FRAME_MARGIN, FRAME_MARGIN, PHOTO_WIDTH, PHOTO_HEIGHT, filterMode)
    addMonochromeGrain(ctx, FRAME_MARGIN, FRAME_MARGIN, PHOTO_WIDTH, PHOTO_HEIGHT)
  }

  // 5) Comment on the bottom band
  const maxTextWidth = POLAROID_WIDTH - TEXT_PAD_X * 2
  const { fontSize, lines } = fitComment(ctx, commentText, maxTextWidth)

  if (lines.length > 0) {
    ctx.fillStyle = INK_COLOR
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${fontSize}px ${FONT_FAMILY}`

    const captionCenterY = FRAME_MARGIN + PHOTO_HEIGHT + CAPTION_BAND / 2
    const lineHeight = fontSize * 1.35
    const blockHeight = lineHeight * lines.length
    const startY = captionCenterY - blockHeight / 2 + lineHeight / 2

    lines.forEach((line, i) => {
      ctx.fillText(line, POLAROID_WIDTH / 2, startY + i * lineHeight)
    })
  }

  // 6) Capture date+time — inside photo well (LED stamp look), not on the caption band.
  drawCaptureStamp(
    ctx,
    formatCaptureStamp(capturedAt),
    FRAME_MARGIN + PHOTO_WIDTH - DATE_MARGIN,
    FRAME_MARGIN + PHOTO_HEIGHT - DATE_MARGIN,
  )

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
