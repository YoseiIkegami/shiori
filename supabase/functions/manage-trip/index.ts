import { createClient } from '@supabase/supabase-js'
import {
  ORGANIZER_MAIL_COOLDOWN_SEC,
  sendOrganizerLinks,
} from '../_shared/organizerMail.ts'

// Organizer settings page backend. Auth is the secret organizer_token in the URL,
// verified here with service_role (anon has no UPDATE on trips).

const corsHeaders = (origin: string | null) => {
  const allowed = Deno.env.get('ALLOWED_ORIGIN') ?? '*'
  const requestOrigin = origin ?? ''
  const allowOrigin =
    allowed === '*' || allowed.split(',').map((s) => s.trim()).includes(requestOrigin)
      ? allowed === '*'
        ? '*'
        : requestOrigin || allowed.split(',')[0].trim()
      : allowed.split(',')[0].trim()

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })

const TRIP_FIELDS =
  'id, slug, name, share_token, reveal_at, is_revealed, photos_count, max_photos, plan_id, ' +
  'show_nicknames, comment_required, date_format, expires_at, payment_status, share_locale, ' +
  'organizer_email, organizer_email_sent_at, organizer_token'

function publicTrip(trip: Record<string, unknown>) {
  // Never leak organizer_token back through get/update responses.
  const { organizer_token: _omit, ...rest } = trip
  return rest
}

function normalizeEmail(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

async function findTripByKey(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  key: string,
) {
  const byShare = await supabase.from('trips').select(TRIP_FIELDS).eq('share_token', key).maybeSingle()
  if (byShare.data || byShare.error) return byShare
  return await supabase.from('trips').select(TRIP_FIELDS).eq('slug', key).maybeSingle()
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'misconfigured' }, 500, headers)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400, headers)
  }

  const tripKey = String(body.share_token ?? body.slug ?? '').trim()
  const token = String(body.token ?? '')
  const action = (body.action as string) ?? 'get'

  if (!tripKey || !token) return json({ error: 'slug_token_required' }, 400, headers)

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: trip, error } = await findTripByKey(supabase, tripKey)

  if (error) {
    console.error('manage-trip lookup error', error)
    return json({ error: 'load_failed' }, 500, headers)
  }
  if (!trip) return json({ error: 'trip_not_found' }, 404, headers)

  // Constant-ish check; token is a high-entropy secret so direct compare is fine here.
  if (trip.organizer_token !== token) {
    return json({ error: 'invalid_token' }, 403, headers)
  }

  if (action === 'get') {
    return json({ trip: publicTrip(trip) }, 200, headers)
  }

  if (action === 'end') {
    const { data: revealed, error: endError } = await supabase.rpc('reveal_trip', {
      p_trip_id: trip.id,
    })
    if (endError) {
      console.error('manage-trip end error', endError)
      return json({ error: 'end_failed' }, 500, headers)
    }
    if (revealed !== true && trip.is_revealed !== true) {
      return json({ error: 'end_failed' }, 500, headers)
    }
    const { data: refreshed } = await supabase
      .from('trips')
      .select(TRIP_FIELDS)
      .eq('id', trip.id)
      .single()
    return json({ trip: publicTrip(refreshed ?? { ...trip, is_revealed: true }) }, 200, headers)
  }

  if (action === 'resend_email') {
    const emailFromBody = normalizeEmail(body.email)
    const email = emailFromBody || normalizeEmail(trip.organizer_email)
    if (!email || !email.includes('@')) {
      return json({ error: 'email_required' }, 400, headers)
    }

    const lastSentMs = trip.organizer_email_sent_at
      ? Date.parse(String(trip.organizer_email_sent_at))
      : NaN
    if (Number.isFinite(lastSentMs)) {
      const elapsedSec = Math.floor((Date.now() - lastSentMs) / 1000)
      const retryAfter = ORGANIZER_MAIL_COOLDOWN_SEC - elapsedSec
      if (retryAfter > 0) {
        return json({ error: 'rate_limited', retry_after: retryAfter }, 429, headers)
      }
    }

    if (email !== normalizeEmail(trip.organizer_email)) {
      const { error: emailError } = await supabase
        .from('trips')
        .update({ organizer_email: email })
        .eq('id', trip.id)
      if (emailError) {
        console.error('manage-trip email save error', emailError)
        return json({ error: 'update_failed' }, 500, headers)
      }
      trip.organizer_email = email
    }

    const appOrigin = (Deno.env.get('APP_ORIGIN') ?? 'https://shiori.ikg-systems.com').replace(
      /\/$/,
      '',
    )
    const shareKey = trip.share_token || trip.slug
    const sent = await sendOrganizerLinks({
      email,
      tripName: trip.name || trip.slug || 'SHIORI',
      shareUrl: `${appOrigin}/t/${shareKey}`,
      manageUrl: `${appOrigin}/manage/${shareKey}?token=${encodeURIComponent(token)}`,
    })
    if (!sent.ok) return json({ error: sent.error }, 500, headers)

    const sentAt = new Date().toISOString()
    const { data: refreshed, error: sentAtError } = await supabase
      .from('trips')
      .update({ organizer_email_sent_at: sentAt })
      .eq('id', trip.id)
      .select(TRIP_FIELDS)
      .single()
    if (sentAtError) {
      console.error('manage-trip sent_at update error', sentAtError)
      trip.organizer_email_sent_at = sentAt
      return json({ trip: publicTrip(trip), sent: true }, 200, headers)
    }
    return json({ trip: publicTrip(refreshed ?? trip), sent: true }, 200, headers)
  }

  if (action === 'update') {
    const patch = (body.patch ?? {}) as Record<string, unknown>
    const update: Record<string, unknown> = {}

    if (typeof patch.name === 'string' && patch.name.trim()) update.name = patch.name.trim()
    if (patch.max_photos !== undefined && Number.isFinite(Number(patch.max_photos))) {
      const planCap =
        trip.plan_id === 'free' ? 3 : trip.plan_id === 'plus' ? 500 : 50
      update.max_photos = Math.max(
        1,
        Math.min(planCap, Math.floor(Number(patch.max_photos))),
      )
    }
    if (patch.reveal_at === null) update.reveal_at = null
    else if (typeof patch.reveal_at === 'string' && patch.reveal_at) update.reveal_at = patch.reveal_at
    if (typeof patch.show_nicknames === 'boolean') update.show_nicknames = patch.show_nicknames
    if (typeof patch.comment_required === 'boolean') update.comment_required = patch.comment_required
    // 日付スタンプは常時OFF（互換のためカラムのみ更新可・値は none 固定）
    if ('date_format' in patch) update.date_format = 'none'
    if (typeof patch.share_locale === 'string') {
      const loc = patch.share_locale.trim().toLowerCase()
      if (loc === 'ja' || loc === 'en') update.share_locale = loc
      else return json({ error: 'invalid_json' }, 400, headers)
    }
    if (typeof patch.organizer_email === 'string') {
      const email = normalizeEmail(patch.organizer_email)
      if (email && !email.includes('@')) return json({ error: 'email_invalid' }, 400, headers)
      update.organizer_email = email || null
    }

    if (Object.keys(update).length === 0) {
      return json({ trip: publicTrip(trip) }, 200, headers)
    }

    const { data: updated, error: updateError } = await supabase
      .from('trips')
      .update(update)
      .eq('id', trip.id)
      .select(TRIP_FIELDS)
      .single()

    if (updateError) {
      console.error('manage-trip update error', updateError)
      return json({ error: 'update_failed' }, 500, headers)
    }
    return json({ trip: publicTrip(updated) }, 200, headers)
  }

  return json({ error: 'unknown_action' }, 400, headers)
})
