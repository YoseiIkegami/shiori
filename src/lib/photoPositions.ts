export type PhotoPosition = { x: number; y: number }
export type PhotoPositionMap = Record<string, PhotoPosition>

function storageKey(tripId: string): string {
  return `photo_positions_${tripId}`
}

export function loadPhotoPositions(tripId: string): PhotoPositionMap {
  try {
    const raw = localStorage.getItem(storageKey(tripId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PhotoPositionMap
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

export function savePhotoPosition(
  tripId: string,
  photoId: string,
  position: PhotoPosition,
): void {
  const next = loadPhotoPositions(tripId)
  next[photoId] = { x: position.x, y: position.y }
  try {
    localStorage.setItem(storageKey(tripId), JSON.stringify(next))
  } catch (error) {
    console.warn('photo position save failed', error)
  }
}
