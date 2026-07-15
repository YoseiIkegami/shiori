import loadImage from 'blueimp-load-image'
import heic2any from 'heic2any'
import { PHOTO_SIZE } from '@/lib/composePolaroid'

const JPEG_QUALITY = 0.85

function isHeic(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  const name = file.name.toLowerCase()
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  )
}

async function ensureJpegBlob(file: File): Promise<Blob> {
  if (!isHeic(file)) {
    return file
  }

  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: JPEG_QUALITY,
  })

  return Array.isArray(converted) ? converted[0] : converted
}

/**
 * HEIC → JPEG, EXIF orientation fix, then center-crop to a square PHOTO_SIZE canvas.
 * Do NOT draw the File directly onto canvas — Android photos would be sideways.
 * Output is always upright square JPEG (no frame / no comment yet).
 */
export async function processCapture(file: File): Promise<Blob> {
  const sourceBlob = await ensureJpegBlob(file)

  const canvas = await new Promise<HTMLCanvasElement>((resolve, reject) => {
    loadImage(
      sourceBlob,
      (result) => {
        if (result instanceof HTMLCanvasElement) {
          resolve(result)
          return
        }
        if (result instanceof HTMLImageElement) {
          const c = document.createElement('canvas')
          c.width = result.naturalWidth || result.width
          c.height = result.naturalHeight || result.height
          const ctx = c.getContext('2d')
          if (!ctx) {
            reject(new Error('Canvas 2D context unavailable'))
            return
          }
          ctx.drawImage(result, 0, 0)
          resolve(c)
          return
        }
        reject(new Error('画像の読み込みに失敗しました'))
      },
      {
        canvas: true,
        orientation: true,
        meta: true,
      },
    )
  })

  const square = centerCropSquare(canvas, PHOTO_SIZE)

  return new Promise<Blob>((resolve, reject) => {
    square.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('JPEG への変換に失敗しました'))
      },
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

/** Center-crop to square, then scale to `size`×`size`. */
function centerCropSquare(source: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const { width, height } = source
  const side = Math.min(width, height)
  const sx = Math.floor((width - side) / 2)
  const sy = Math.floor((height - side) / 2)

  const out = document.createElement('canvas')
  out.width = size
  out.height = size
  const ctx = out.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable')
  }
  ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size)
  return out
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}
