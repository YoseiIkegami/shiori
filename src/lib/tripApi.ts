import type { RevealedPhoto, Trip } from '@/types'
import { supabase, STORAGE_BUCKET } from '@/lib/supabase'

export async function fetchTrip(tripId: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from('trips')
    .select('id, name, reveal_at, is_revealed, created_at')
    .eq('id', tripId)
    .maybeSingle()

  if (error) {
    throw error
  }
  return data as Trip | null
}

/**
 * reveal_at is stored as timestamptz (UTC). Parsing with `new Date(iso)` yields
 * a Date whose getTime() is absolute; comparing to Date.now() is timezone-safe.
 * Display strings should use local getters (getHours etc.) when needed.
 */
export function isTripRevealed(trip: Trip, nowMs: number = Date.now()): boolean {
  if (trip.is_revealed === true) return true
  const revealAt = new Date(trip.reveal_at)
  return revealAt.getTime() <= nowMs
}

export function formatCountdown(revealAtIso: string, nowMs: number = Date.now()): string {
  const remaining = new Date(revealAtIso).getTime() - nowMs
  if (remaining <= 0) return 'まもなく解禁'

  const totalSec = Math.floor(remaining / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remHours = hours % 24
    return `あと ${days}日 ${remHours}時間`
  }
  if (hours > 0) {
    return `あと ${hours}時間 ${minutes}分`
  }
  return `あと ${minutes}分 ${seconds}秒`
}

export type CountdownSegment = { num: string; unit: string }

// Split the countdown into numeric + unit segments so the UI can render the
// numbers in a legible sans-serif and the units in the handwriting face.
export function formatCountdownSegments(
  revealAtIso: string,
  nowMs: number = Date.now(),
): CountdownSegment[] {
  const remaining = new Date(revealAtIso).getTime() - nowMs
  if (remaining <= 0) return [{ num: '', unit: 'まもなく解禁' }]

  const totalSec = Math.floor(remaining / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remHours = hours % 24
    return [
      { num: String(days), unit: '日' },
      { num: String(remHours), unit: '時間' },
    ]
  }
  if (hours > 0) {
    return [
      { num: String(hours), unit: '時間' },
      { num: String(minutes), unit: '分' },
    ]
  }
  return [
    { num: String(minutes), unit: '分' },
    { num: String(seconds), unit: '秒' },
  ]
}

// Wide scatter (-22deg .. 22deg) for the "dropped on the floor" look.
export function randomRotation(): number {
  return Math.round((Math.random() * 44 - 22) * 10) / 10
}

// crypto.randomUUID() is only available in secure contexts (HTTPS / localhost).
// Over plain-HTTP LAN access (e.g. http://192.168.x.x on iOS Safari) it is undefined,
// so fall back to a Math.random-based UUID (uniqueness is sufficient for file names).
function generateUuid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export async function uploadPhoto(params: {
  tripId: string
  blob: Blob
  comment: string
  rotation: number
}): Promise<void> {
  const fileId = generateUuid()
  const storagePath = `${params.tripId}/${fileId}.jpg`

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, params.blob, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (uploadError) {
    throw uploadError
  }

  // comment is also baked into the JPEG; stored here for alt text / future use.
  // rotation is CSS-only at display time — never baked into the image.
  const { error: insertError } = await supabase.from('photos').insert({
    trip_id: params.tripId,
    storage_path: storagePath,
    comment: params.comment.slice(0, 30),
    rotation: params.rotation,
  })

  if (insertError) {
    throw insertError
  }
}

export type RevealResponse = {
  trip: Trip
  photos: RevealedPhoto[]
}

export async function fetchRevealedPhotos(tripId: string): Promise<RevealResponse> {
  const { data, error } = await supabase.functions.invoke('reveal-photos', {
    body: { trip_id: tripId },
  })

  // functions.invoke may surface non-2xx as error while still returning JSON body
  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : '写真の取得に失敗しました')
  }

  if (error) {
    throw error
  }

  return data as RevealResponse
}
