import type { RevealedPhoto, Trip } from '@/types'
import { supabase, STORAGE_BUCKET } from '@/lib/supabase'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function fetchTrip(tripKey: string): Promise<Trip | null> {
  const select =
    'id, slug, name, reveal_at, is_revealed, photos_count, max_photos, created_at'

  // Prefer short slug URLs: /t/test
  const bySlug = await supabase.from('trips').select(select).eq('slug', tripKey).maybeSingle()
  if (bySlug.error) throw bySlug.error
  if (bySlug.data) return bySlug.data as Trip

  // Backward compatible: UUID still works if pasted (skip non-UUID to avoid 22P02).
  if (!UUID_RE.test(tripKey)) return null

  const byId = await supabase.from('trips').select(select).eq('id', tripKey).maybeSingle()
  if (byId.error) throw byId.error
  return byId.data as Trip | null
}

export function isTripRevealed(trip: Trip): boolean {
  return trip.is_revealed === true
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

export async function fetchRevealedPhotos(
  tripId: string,
  options: { preview?: boolean } = {},
): Promise<RevealResponse> {
  const { data, error } = await supabase.functions.invoke('reveal-photos', {
    body: {
      trip_id: tripId,
      preview: options.preview === true,
    },
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
