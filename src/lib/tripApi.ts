import { FunctionsHttpError } from '@supabase/supabase-js'
import type { RevealedPhoto, Trip } from '@/types'
import { supabase, STORAGE_BUCKET } from '@/lib/supabase'
import { i18n } from '@/i18n'

/**
 * supabase-js は非 2xx を「Edge Function returned a non-2xx status code」に
 * 潰すため、レスポンス本文の {error} を取り出してユーザーに見せる。
 * Edge は機械可読コードを返し、ここで i18n キーにマップする。
 */
const EDGE_ERROR_KEYS: Record<string, string> = {
  slug_taken: 'slug.taken',
  slug_reserved: 'slug.reserved',
  slug_format: 'slug.format',
  name_required: 'create.nameRequired',
  create_failed: 'create.createFailed',
  checkout_failed: 'create.createFailed',
  allocate_failed: 'create.createFailed',
  slug_token_required: 'manage.tokenRequired',
  load_failed: 'manage.loadFailed',
  trip_not_found: 'manage.loadFailed',
  invalid_token: 'manage.tokenRequired',
  not_free_trip: 'create.createFailed',
  delete_failed: 'create.createFailed',
  session_required: 'success.noSession',
  session_not_found: 'success.resultFailed',
  session_unlinked: 'success.resultFailed',
  misconfigured: 'create.createFailed',
  invalid_json: 'create.createFailed',
  method_not_allowed: 'create.createFailed',
  end_failed: 'manage.endFailed',
  update_failed: 'manage.saveFailed',
  unknown_action: 'manage.opFailed',
  trip_id_required: 'trip.loadFailed',
  trip_not_paid: 'trip.loadFailed',
  trip_not_revealed: 'trip.pending',
  photos_load_failed: 'trip.photosLoadFailed',
  internal_error: 'trip.loadFailed',
  photo_id_required: 'board.reportFailed',
  hide_failed: 'board.reportFailed',
  photo_not_found: 'board.reportFailed',
}

function translateEdgeError(code: string, fallback: string): string {
  const key = EDGE_ERROR_KEYS[code]
  if (key) return i18n.global.t(key)
  return fallback
}

async function functionError(error: unknown, fallback: string): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (typeof body?.error === 'string' && body.error) {
        return new Error(translateEdgeError(body.error, fallback))
      }
    } catch {
      /* body is not JSON */
    }
    return new Error(fallback)
  }
  return error instanceof Error ? error : new Error(fallback)
}

function throwDataError(data: { error?: unknown } | null, fallback: string): void {
  if (!data?.error) return
  const code = typeof data.error === 'string' ? data.error : ''
  throw new Error(code ? translateEdgeError(code, fallback) : fallback)
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const TRIP_SELECT =
  'id, slug, name, share_token, reveal_at, is_revealed, photos_count, max_photos, plan_id, ' +
  'show_nicknames, comment_required, date_format, expires_at, payment_status, theme_id, created_at'

/** Resolve trip by share_token, legacy slug, or UUID. */
export async function fetchTrip(tripKey: string): Promise<Trip | null> {
  const byShare = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .eq('share_token', tripKey)
    .maybeSingle()
  if (byShare.error) throw byShare.error
  if (byShare.data) {
    const trip = byShare.data as unknown as Trip
    await maybeRevealTrip(trip.id)
    return (await refetchTripById(trip.id)) ?? trip
  }

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

/** Public path key for share / manage URLs. */
export function tripPublicKey(trip: Pick<Trip, 'share_token' | 'slug'>): string {
  return trip.share_token || trip.slug
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

export type RevealResponse = {
  trip: Trip
  photos: RevealedPhoto[]
}

export async function isSlugTaken(slug: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('create-trip-checkout', {
    body: { action: 'check_slug', slug },
  })
  if (data?.error && typeof data.error === 'string' && data.taken !== true) {
    throw new Error(translateEdgeError(data.error, i18n.global.t('create.createFailed')))
  }
  if (error) throw await functionError(error, i18n.global.t('create.createFailed'))
  return Boolean(data?.taken)
}

export async function fetchRevealedPhotos(tripId: string): Promise<RevealResponse> {
  const { data, error } = await supabase.functions.invoke('reveal-photos', {
    body: { trip_id: tripId },
  })

  if (data?.error) {
    throwDataError(data, i18n.global.t('trip.photosLoadFailed'))
  }

  if (error) {
    throw await functionError(error, i18n.global.t('trip.photosLoadFailed'))
  }

  return data as RevealResponse
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
  /** Filter-only photo without the polaroid frame. Enables frameless saves. */
  rawBlob?: Blob | null
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

  let rawPath: string | null = null
  if (params.rawBlob) {
    rawPath = `${params.tripId}/${fileId}_raw.jpg`
    const { error: rawError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(rawPath, params.rawBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      })
    if (rawError) {
      // Frameless variant is best-effort — the composed photo is the product.
      console.error('raw upload failed', rawError)
      rawPath = null
    }
  }

  const row: Record<string, unknown> = {
    trip_id: params.tripId,
    storage_path: storagePath,
    comment: params.comment.slice(0, 30),
    rotation: params.rotation,
  }
  if (rawPath) row.raw_path = rawPath
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
  if (!trimmed) throw new Error(i18n.global.t('member.nameRequired'))
  const { data, error } = await supabase.rpc('create_member', {
    p_trip_id: tripId,
    p_nickname: trimmed,
  })
  if (error) throw error
  if (!data) throw new Error(i18n.global.t('member.createFailed'))
  const id = data as string
  storeMemberId(tripId, id)
  return id
}

export async function updateMemberNickname(memberId: string, nickname: string): Promise<void> {
  const trimmed = nickname.trim().slice(0, 12)
  if (!trimmed) throw new Error(i18n.global.t('member.nameRequired'))
  const { error } = await supabase.rpc('update_member_nickname', {
    p_id: memberId,
    p_nickname: trimmed,
  })
  if (error) throw error
}

export type CreateTripCheckoutInput = {
  name: string
  plan_id: 'free' | 'standard' | 'plus'
  max_photos?: number
  currency: 'jpy' | 'usd'
  locale?: 'ja' | 'en'
  reveal_at: string | null
  comment_required: boolean
  show_nicknames: boolean
  date_format: string
  /** FREE → 有料の回収用（内部 slug） */
  free_slug?: string
  free_token?: string
}

export async function createTripCheckout(
  input: CreateTripCheckoutInput,
): Promise<{ url: string; free?: boolean; slug?: string; share_token?: string; organizer_token?: string }> {
  const { data, error } = await supabase.functions.invoke('create-trip-checkout', {
    body: {
      ...input,
      origin: window.location.origin,
    },
  })
  if (data?.error) {
    throwDataError(data, i18n.global.t('create.createFailed'))
  }
  if (error) throw await functionError(error, i18n.global.t('create.createFailed'))
  if (!data?.url) throw new Error(i18n.global.t('create.noCheckoutUrl'))
  return {
    url: data.url as string,
    free: Boolean(data.free),
    slug: data.slug as string | undefined,
    share_token: data.share_token as string | undefined,
    organizer_token: data.organizer_token as string | undefined,
  }
}

export async function deleteFreeTrip(slug: string, token: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('create-trip-checkout', {
    body: { action: 'delete_free', slug, token },
  })
  if (data?.error) {
    const code = typeof data.error === 'string' ? data.error : ''
    // 既に無い場合はアップグレード続行可（サーバは ok:true。古い経路の互換）
    if (code === 'trip_not_found' || code === 'Trip not found') return
    throwDataError(data, i18n.global.t('create.createFailed'))
  }
  if (error) throw await functionError(error, i18n.global.t('create.createFailed'))
}

export function freeOrganizerTokenKey(slug: string) {
  return `shiori.free.${slug}`
}

export function storeFreeOrganizerToken(slug: string, token: string) {
  try {
    sessionStorage.setItem(freeOrganizerTokenKey(slug), token)
  } catch {
    /* ignore */
  }
}

export function readFreeOrganizerToken(slug: string): string {
  try {
    return sessionStorage.getItem(freeOrganizerTokenKey(slug)) ?? ''
  } catch {
    return ''
  }
}

export function clearFreeOrganizerToken(slug: string) {
  try {
    sessionStorage.removeItem(freeOrganizerTokenKey(slug))
  } catch {
    /* ignore */
  }
}

export async function fetchCheckoutResult(sessionId: string): Promise<{
  slug: string
  name: string
  share_token: string
  organizer_token: string
  payment_status: string
}> {
  const { data, error } = await supabase.functions.invoke('create-trip-checkout', {
    body: { action: 'result', session_id: sessionId },
  })
  if (data?.error) {
    throwDataError(data, i18n.global.t('success.resultFailed'))
  }
  if (error) throw await functionError(error, i18n.global.t('success.resultFailed'))
  return data
}

export type ManageTrip = Trip & { payment_status: string }

async function manageTripInvoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('manage-trip', { body })
  if (data?.error) {
    throwDataError(data, i18n.global.t('manage.opFailed'))
  }
  if (error) throw await functionError(error, i18n.global.t('manage.opFailed'))
  return data
}

/** `tripKey` = share_token (preferred) or legacy slug. */
export async function manageTripGet(tripKey: string, token: string): Promise<ManageTrip> {
  const data = await manageTripInvoke({ action: 'get', share_token: tripKey, slug: tripKey, token })
  return data.trip as ManageTrip
}

export async function manageTripUpdate(
  tripKey: string,
  token: string,
  patch: Record<string, unknown>,
): Promise<ManageTrip> {
  const data = await manageTripInvoke({
    action: 'update',
    share_token: tripKey,
    slug: tripKey,
    token,
    patch,
  })
  return data.trip as ManageTrip
}

export async function manageTripEnd(tripKey: string, token: string): Promise<ManageTrip> {
  const data = await manageTripInvoke({ action: 'end', share_token: tripKey, slug: tripKey, token })
  return data.trip as ManageTrip
}

export async function reportPhoto(photoId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('report-photo', {
    body: { photo_id: photoId },
  })
  if (data?.error) {
    throwDataError(data, i18n.global.t('board.reportFailed'))
  }
  if (error) throw await functionError(error, i18n.global.t('board.reportFailed'))
}
