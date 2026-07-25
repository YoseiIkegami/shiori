import { createClient } from '@supabase/supabase-js'

// Organizer settings page backend. Auth is the secret organizer_token in the URL,
// verified here with service_role (anon has no UPDATE on trips).

const DATE_FORMATS = new Set(['YY.M.D', 'YYYY.M.D', 'YY.M.D HH:mm', 'none'])

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
  'id, slug, name, reveal_at, is_revealed, photos_count, max_photos, plan_id, ' +
  'show_nicknames, comment_required, date_format, expires_at, payment_status, organizer_token'

function publicTrip(trip: Record<string, unknown>) {
  // Never leak organizer_token back through get/update responses.
  const { organizer_token: _omit, ...rest } = trip
  return rest
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server misconfigured' }, 500, headers)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400, headers)
  }

  const slug = String(body.slug ?? '').trim().toLowerCase()
  const token = String(body.token ?? '')
  const action = (body.action as string) ?? 'get'

  if (!slug || !token) return json({ error: 'slug and token are required' }, 400, headers)

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: trip, error } = await supabase
    .from('trips')
    .select(TRIP_FIELDS)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('manage-trip lookup error', error)
    return json({ error: 'Failed to load trip' }, 500, headers)
  }
  if (!trip) return json({ error: 'Trip not found' }, 404, headers)

  // Constant-ish check; token is a high-entropy secret so direct compare is fine here.
  if (trip.organizer_token !== token) {
    return json({ error: 'Invalid token' }, 403, headers)
  }

  if (action === 'get') {
    return json({ trip: publicTrip(trip) }, 200, headers)
  }

  if (action === 'end') {
    const { data: updated, error: endError } = await supabase
      .from('trips')
      .update({ is_revealed: true })
      .eq('id', trip.id)
      .select(TRIP_FIELDS)
      .single()
    if (endError) {
      console.error('manage-trip end error', endError)
      return json({ error: 'Failed to end trip' }, 500, headers)
    }
    return json({ trip: publicTrip(updated) }, 200, headers)
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
    if (typeof patch.date_format === 'string' && DATE_FORMATS.has(patch.date_format)) {
      update.date_format = patch.date_format
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
      return json({ error: 'Failed to update trip' }, 500, headers)
    }
    return json({ trip: publicTrip(updated) }, 200, headers)
  }

  return json({ error: 'Unknown action' }, 400, headers)
})
