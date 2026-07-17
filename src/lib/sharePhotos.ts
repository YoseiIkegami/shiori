/**
 * Save photos to the camera roll via the native share sheet (Web Share API).
 * ZIP download is intentionally out of scope.
 */

const SHARE_CHUNK_SIZE = 5

export function sanitizeTripName(tripName: string): string {
  const trimmed = tripName.trim() || 'shiori'
  return trimmed.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40)
}

export function photoFilename(tripName: string, index: number): string {
  return `${sanitizeTripName(tripName)}_${String(index + 1).padStart(2, '0')}.jpg`
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
): Promise<File> {
  const blob = await blobFromUrl(imageUrl)
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

/** Share one file (PhotoSwipe save). Prefer share sheet → <a download> fallback. */
export async function saveSinglePhoto(
  imageUrl: string,
  filename: string,
): Promise<ShareResult> {
  try {
    const file = await fileFromUrl(imageUrl, filename)
    if (canShareFiles([file])) {
      try {
        await navigator.share({ files: [file] })
        return { status: 'shared' }
      } catch (error) {
        if (isUserAbort(error)) return { status: 'aborted' }
        if (isGestureLost(error)) return { status: 'needs_retap', files: [file] }
        console.warn('share failed, falling back to download', error)
      }
    }
    downloadFallback(file)
    return { status: 'downloaded' }
  } catch (error) {
    console.error('保存に失敗しました', error)
    throw error
  }
}

/** Share an already-prepared File list (second tap after gesture was lost). */
export async function sharePreparedFiles(files: File[]): Promise<ShareResult> {
  if (!files.length) return { status: 'unsupported' }
  if (!canShareFiles(files.length === 1 ? files : files.slice(0, SHARE_CHUNK_SIZE))) {
    for (const file of files) downloadFallback(file)
    return { status: 'downloaded' }
  }

  try {
    if (canShareFiles(files)) {
      await navigator.share({ files })
      return { status: 'shared' }
    }
  } catch (error) {
    if (isUserAbort(error)) return { status: 'aborted' }
    console.warn('一括共有に失敗、分割共有にフォールバックします', error)
  }

  for (let i = 0; i < files.length; i += SHARE_CHUNK_SIZE) {
    const chunk = files.slice(i, i + SHARE_CHUNK_SIZE)
    if (!canShareFiles(chunk)) {
      for (const file of chunk) downloadFallback(file)
      continue
    }
    try {
      await navigator.share({ files: chunk })
    } catch (error) {
      if (isUserAbort(error)) return { status: 'aborted' }
      if (isGestureLost(error)) return { status: 'needs_retap', files }
      console.warn('chunk share failed', error)
      for (const file of chunk) downloadFallback(file)
    }
  }
  return { status: 'shared' }
}

export async function buildPhotoFiles(
  photos: Array<{ url: string }>,
  tripName: string,
): Promise<File[]> {
  return Promise.all(
    photos.map((photo, index) =>
      fileFromUrl(photo.url, photoFilename(tripName, index)),
    ),
  )
}

/**
 * Prepare then share all photos. If the browser drops the user-gesture after
 * the long fetch, returns `needs_retap` with prepared files for an immediate
 * second tap (no extra network).
 */
export async function saveAllPhotos(
  photos: Array<{ url: string }>,
  tripName: string,
): Promise<ShareResult> {
  if (!photos.length) return { status: 'unsupported' }
  const files = await buildPhotoFiles(photos, tripName)
  return sharePreparedFiles(files)
}
