/**
 * Compose photo + polaroid frame + comment into a single upright JPEG.
 * Board rotation is applied later via CSS — never baked into this image.
 *
 * Film look: ImageData tone curve + channel shift + mono grain (photo area only).
 */

import { addMonochromeGrain, applyPolaroidTone } from '@/lib/polaroidTone'
import { getFilterDef, type FilterMode } from '@/lib/filterMode'
import { classicTheme } from '@/themes/classic'
import type { DateFormat } from '@/types'

export const POLAROID_WIDTH = classicTheme.frame.width
export const POLAROID_HEIGHT = classicTheme.frame.height
export const PHOTO_WIDTH = classicTheme.frame.photoWidth
export const PHOTO_HEIGHT = classicTheme.frame.photoHeight
export const FRAME_MARGIN = classicTheme.frame.margin
/** Bottom caption band: 1800 - 60 - 1440 = 300 */
export const CAPTION_BAND = POLAROID_HEIGHT - FRAME_MARGIN - PHOTO_HEIGHT

const FRAME_COLOR = classicTheme.frame.color
const INK_COLOR = classicTheme.frame.ink
const FONT_FAMILY = '"Klee One", "Hiragino Maru Gothic ProN", cursive'
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

/** Instant-camera style local date stamp. Respects trip `date_format`. */
export function formatCaptureStamp(
  at: Date = new Date(),
  dateFormat: DateFormat = 'YY.M.D',
): string {
  if (dateFormat === 'none') return ''
  const y2 = String(at.getFullYear()).slice(-2)
  const y4 = String(at.getFullYear())
  const m = at.getMonth() + 1
  const d = at.getDate()
  if (dateFormat === 'YYYY.M.D') return `'${y4}.${m}.${d}`
  if (dateFormat === 'YY.M.D HH:mm') {
    const h = String(at.getHours()).padStart(2, '0')
    const min = String(at.getMinutes()).padStart(2, '0')
    return `'${y2}.${m}.${d} ${h}:${min}`
  }
  return `'${y2}.${m}.${d}`
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
  dateFormat: DateFormat = 'YY.M.D',
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
  if (getFilterDef(filterMode).tone) {
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

  // 6) Capture date — inside photo well (LED stamp look), not on the caption band.
  const stamp = formatCaptureStamp(capturedAt, dateFormat)
  if (stamp) {
    drawCaptureStamp(
      ctx,
      stamp,
      FRAME_MARGIN + PHOTO_WIDTH - DATE_MARGIN,
      FRAME_MARGIN + PHOTO_HEIGHT - DATE_MARGIN,
    )
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

/** Bake a nickname into the caption band (bottom-right) for Web Share only. */
export async function bakeNicknameOntoPolaroid(
  sourceBlob: Blob,
  nickname: string,
): Promise<Blob> {
  const name = nickname.trim().slice(0, 12)
  if (!name) return sourceBlob

  await ensureFontsReady(32)
  const img = await loadImageFromBlob(sourceBlob)
  const canvas = document.createElement('canvas')
  canvas.width = POLAROID_WIDTH
  canvas.height = POLAROID_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return sourceBlob

  ctx.drawImage(img, 0, 0)
  ctx.fillStyle = INK_COLOR
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.font = `28px ${FONT_FAMILY}`
  ctx.fillText(
    name,
    POLAROID_WIDTH - TEXT_PAD_X,
    POLAROID_HEIGHT - 36,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('ニックネーム焼き込みに失敗しました'))
      },
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
