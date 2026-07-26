/**
 * Save photos to the camera roll via the native share sheet (Web Share API).
 * ZIP download is intentionally out of scope.
 */

import { bakeNicknameOntoPolaroid } from '@/lib/composePolaroid'

const SHARE_CHUNK_SIZE = 5

export function sanitizeTripName(tripName: string): string {
  const trimmed = tripName.trim() || 'shiori'
  return trimmed.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40)
}

export function photoFilename(tripName: string, index: number, suffix = ''): string {
  return `${sanitizeTripName(tripName)}_${String(index + 1).padStart(2, '0')}${suffix}.jpg`
}

function isUserAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function isGestureLost(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'InvalidStateError')
  )
}

export async function blobFromUrl(imageUrl: string): Promise<Blob> {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`画像の取得に失敗しました (${response.status})`)
  }
  return response.blob()
}

export async function fileFromUrl(
  imageUrl: string,
  filename: string,
  nickname?: string | null,
): Promise<File> {
  let blob = await blobFromUrl(imageUrl)
  const name = nickname?.trim()
  if (name) {
    blob = await bakeNicknameOntoPolaroid(blob, name)
  }
  const type = blob.type || 'image/jpeg'
  return new File([blob], filename, { type })
}

function canShareFiles(files: File[]): boolean {
  return Boolean(
    typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files }),
  )
}

function downloadFallback(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export type ShareResult =
  | { status: 'shared' }
  | { status: 'aborted' }
  | { status: 'needs_retap'; files: File[] }
  | { status: 'downloaded' }
  | { status: 'unsupported' }

/** Share an already-prepared File list (second tap after gesture was lost). */
export async function sharePreparedFiles(files: File[]): Promise<ShareResult> {
  if (!files.length) return { status: 'unsupported' }

  let anyShared = false
  let anyDownloaded = false

  for (let i = 0; i < files.length; i += SHARE_CHUNK_SIZE) {
    const chunk = files.slice(i, i + SHARE_CHUNK_SIZE)
    if (!canShareFiles(chunk)) {
      for (const file of chunk) downloadFallback(file)
      anyDownloaded = true
      continue
    }
    try {
      await navigator.share({ files: chunk })
      anyShared = true
    } catch (error) {
      if (isUserAbort(error)) return { status: 'aborted' }
      if (isGestureLost(error)) return { status: 'needs_retap', files }
      console.warn('chunk share failed', error)
      for (const file of chunk) downloadFallback(file)
      anyDownloaded = true
    }
  }

  if (anyShared) return { status: 'shared' }
  if (anyDownloaded) return { status: 'downloaded' }
  return { status: 'unsupported' }
}

export type SaveItem = {
  url: string
  filename: string
  /** Baked onto the caption band — framed variant only. */
  nickname?: string | null
}

/**
 * Prepare then share photos. If the browser drops the user-gesture after the
 * long fetch, returns `needs_retap` with prepared files for an immediate
 * second tap (no extra network).
 */
export async function savePhotos(items: SaveItem[]): Promise<ShareResult> {
  if (!items.length) return { status: 'unsupported' }
  const files = await Promise.all(
    items.map((item) => fileFromUrl(item.url, item.filename, item.nickname)),
  )
  return sharePreparedFiles(files)
}
