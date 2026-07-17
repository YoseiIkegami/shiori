import loadImage from 'blueimp-load-image'
import heic2any from 'heic2any'
import { PHOTO_HEIGHT, PHOTO_WIDTH } from '@/lib/composePolaroid'

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
 * HEIC → JPEG, EXIF orientation fix, then center-crop to a 3:4 canvas.
 * Do NOT draw the File directly onto canvas — Android photos would be sideways.
 * Output is always an upright 1080×1440 JPEG (no frame / no comment yet).
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

  const cropped = centerCrop(canvas, PHOTO_WIDTH, PHOTO_HEIGHT)

  return new Promise<Blob>((resolve, reject) => {
    cropped.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('JPEG への変換に失敗しました'))
      },
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

/** Center-crop to the requested aspect ratio, then scale to output dimensions. */
function centerCrop(
  source: HTMLCanvasElement,
  outputWidth: number,
  outputHeight: number,
): HTMLCanvasElement {
  const { width, height } = source
  const targetRatio = outputWidth / outputHeight
  const sourceRatio = width / height
  const cropWidth = sourceRatio > targetRatio ? height * targetRatio : width
  const cropHeight = sourceRatio > targetRatio ? height : width / targetRatio
  const sx = Math.floor((width - cropWidth) / 2)
  const sy = Math.floor((height - cropHeight) / 2)

  const out = document.createElement('canvas')
  out.width = outputWidth
  out.height = outputHeight
  const ctx = out.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable')
  }
  ctx.drawImage(
    source,
    sx,
    sy,
    cropWidth,
    cropHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  )
  return out
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}
