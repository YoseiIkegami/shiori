import type { RevealedPhoto, Trip } from '@/types'
import { supabase, STORAGE_BUCKET } from '@/lib/supabase'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const TRIP_SELECT =
  'id, slug, name, reveal_at, is_revealed, photos_count, max_photos, plan_id, ' +
  'show_nicknames, comment_required, date_format, expires_at, payment_status, theme_id, created_at'

export async function fetchTrip(tripKey: string): Promise<Trip | null> {
  const bySlug = await supabase.from('trips').select(TRIP_SELECT).eq('slug', tripKey).maybeSingle()
  if (bySlug.error) throw bySlug.error
  if (bySlug.data) {
    const trip = bySlug.data as unknown as Trip
    await maybeRevealTrip(trip.id)
    return (await refetchTripById(trip.id)) ?? trip
  }

  if (!UUID_RE.test(tripKey)) return null

  const byId = await supabase.from('trips').select(TRIP_SELECT).eq('id', tripKey).maybeSingle()
  if (byId.error) throw byId.error
  if (!byId.data) return null
  const trip = byId.data as unknown as Trip
  await maybeRevealTrip(trip.id)
  return (await refetchTripById(trip.id)) ?? trip
}

async function refetchTripById(id: string): Promise<Trip | null> {
  const { data, error } = await supabase.from('trips').select(TRIP_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return (data as unknown as Trip) ?? null
}

/** Lazy time-based reveal (security definer RPC). */
export async function maybeRevealTrip(tripId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('maybe_reveal_trip', { p_trip_id: tripId })
  if (error) {
    console.error('maybe_reveal_trip', error)
    return false
  }
  return data === true
}

export function isTripRevealed(trip: Trip): boolean {
  return trip.is_revealed === true
}

export function isTripPaid(trip: Trip): boolean {
  // Legacy rows without the column are treated as paid (pre-Phase-2).
  return trip.payment_status == null || trip.payment_status === 'paid'
}

export async function isSlugTaken(slug: string): Promise<boolean> {
  const { data, error } = await supabase.from('trips').select('id').eq('slug', slug).maybeSingle()
  if (error) throw error
  return Boolean(data)
}

// Wide scatter (-22deg .. 22deg) for the "dropped on the floor" look.
export function randomRotation(): number {
  return Math.round((Math.random() * 44 - 22) * 10) / 10
}

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
  memberId?: string | null
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

  const row: Record<string, unknown> = {
    trip_id: params.tripId,
    storage_path: storagePath,
    comment: params.comment.slice(0, 30),
    rotation: params.rotation,
  }
  if (params.memberId) row.member_id = params.memberId

  const { error: insertError } = await supabase.from('photos').insert(row)

  if (insertError) {
    throw insertError
  }
}

export function memberStorageKey(tripId: string): string {
  return `member_${tripId}`
}

export function loadStoredMemberId(tripId: string): string | null {
  try {
    return localStorage.getItem(memberStorageKey(tripId))
  } catch {
    return null
  }
}

export function storeMemberId(tripId: string, memberId: string): void {
  try {
    localStorage.setItem(memberStorageKey(tripId), memberId)
  } catch {
    // ignore quota / private mode
  }
}

export async function createMember(tripId: string, nickname: string): Promise<string> {
  const trimmed = nickname.trim().slice(0, 12)
  if (!trimmed) throw new Error('名前を入力してください')
  const { data, error } = await supabase.rpc('create_member', {
    p_trip_id: tripId,
    p_nickname: trimmed,
  })
  if (error) throw error
  if (!data) throw new Error('メンバーの作成に失敗しました')
  const id = data as string
  storeMemberId(tripId, id)
  return id
}

export async function updateMemberNickname(memberId: string, nickname: string): Promise<void> {
  const trimmed = nickname.trim().slice(0, 12)
  if (!trimmed) throw new Error('名前を入力してください')
  const { error } = await supabase.rpc('update_member_nickname', {
    p_id: memberId,
    p_nickname: trimmed,
  })
  if (error) throw error
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

  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : '写真の取得に失敗しました')
  }

  if (error) {
    throw error
  }

  return data as RevealResponse
}

export type CreateTripCheckoutInput = {
  slug: string
  name?: string
  plan_id: 'free' | 'standard' | 'plus'
  currency: 'jpy' | 'usd'
  reveal_at: string | null
  comment_required: boolean
  show_nicknames: boolean
  date_format: string
}

export async function createTripCheckout(
  input: CreateTripCheckoutInput,
): Promise<{ url: string; free?: boolean; slug?: string; organizer_token?: string }> {
  const { data, error } = await supabase.functions.invoke('create-trip-checkout', {
    body: {
      ...input,
      origin: window.location.origin,
    },
  })
  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : '発行に失敗しました')
  }
  if (error) throw error
  if (!data?.url) throw new Error('Checkout URL が取得できませんでした')
  return {
    url: data.url as string,
    free: Boolean(data.free),
    slug: data.slug as string | undefined,
    organizer_token: data.organizer_token as string | undefined,
  }
}

export async function deleteFreeTrip(slug: string, token: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('create-trip-checkout', {
    body: { action: 'delete_free', slug, token },
  })
  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : '削除に失敗しました')
  }
  if (error) throw error
}

export async function fetchCheckoutResult(sessionId: string): Promise<{
  slug: string
  name: string
  organizer_token: string
  payment_status: string
}> {
  const { data, error } = await supabase.functions.invoke('create-trip-checkout', {
    body: { action: 'result', session_id: sessionId },
  })
  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : '結果の取得に失敗しました')
  }
  if (error) throw error
  return data
}

export type ManageTrip = Trip & { payment_status: string }

async function manageTripInvoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('manage-trip', { body })
  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : '操作に失敗しました')
  }
  if (error) throw error
  return data
}

export async function manageTripGet(slug: string, token: string): Promise<ManageTrip> {
  const data = await manageTripInvoke({ action: 'get', slug, token })
  return data.trip as ManageTrip
}

export async function manageTripUpdate(
  slug: string,
  token: string,
  patch: Record<string, unknown>,
): Promise<ManageTrip> {
  const data = await manageTripInvoke({ action: 'update', slug, token, patch })
  return data.trip as ManageTrip
}

export async function manageTripEnd(slug: string, token: string): Promise<ManageTrip> {
  const data = await manageTripInvoke({ action: 'end', slug, token })
  return data.trip as ManageTrip
}

export async function reportPhoto(photoId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('report-photo', {
    body: { photo_id: photoId },
  })
  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : '通報に失敗しました')
  }
  if (error) throw error
}
