import { createClient } from '@supabase/supabase-js'

/**
 * Purge trips past expires_at.
 *
 * - Always skips expires_at IS NULL (protects summer-boardgames / test)
 * - Deletes Storage objects under trip-photos/{trip_id}/ then DB via RPC
 * - dry_run=true only lists candidates
 *
 * Schedule daily via Supabase Dashboard → Edge Functions → Cron,
 * or call manually with service role. Optional CRON_SECRET header guard.
 */

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
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })

async function removeTripStorage(
  supabase: ReturnType<typeof createClient>,
  tripId: string,
): Promise<number> {
  const bucket = 'trip-photos'
  let removed = 0
  const { data: entries, error } = await supabase.storage.from(bucket).list(tripId, {
    limit: 1000,
  })
  if (error) {
    console.error('storage list error', tripId, error)
    return 0
  }
  const paths = (entries ?? [])
    .filter((e) => e.name && !e.name.endsWith('/'))
    .map((e) => `${tripId}/${e.name}`)
  if (!paths.length) return 0
  const { error: removeError } = await supabase.storage.from(bucket).remove(paths)
  if (removeError) {
    console.error('storage remove error', tripId, removeError)
    return 0
  }
  removed = paths.length
  return removed
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const provided = req.headers.get('x-cron-secret') ?? ''
    if (provided !== cronSecret) return json({ error: 'Unauthorized' }, 401, headers)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server misconfigured' }, 500, headers)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // empty body ok
  }
  const dryRun = body.dry_run === true

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Preview candidates (same filter as RPC).
  const { data: candidates, error: listError } = await supabase
    .from('trips')
    .select('id, slug, expires_at')
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date().toISOString())

  if (listError) {
    console.error('list expired trips error', listError)
    return json({ error: 'Failed to list expired trips' }, 500, headers)
  }

  const trips = candidates ?? []
  console.log(
    JSON.stringify({
      event: 'purge_expired_trips',
      dry_run: dryRun,
      count: trips.length,
      slugs: trips.map((t) => t.slug),
    }),
  )

  if (dryRun) {
    return json({ dry_run: true, trips }, 200, headers)
  }

  const results: Array<{ id: string; slug: string; storage_removed: number }> = []
  for (const trip of trips) {
    const storageRemoved = await removeTripStorage(supabase, trip.id)
    results.push({ id: trip.id, slug: trip.slug, storage_removed: storageRemoved })
  }

  const { data: purged, error: purgeError } = await supabase.rpc('purge_expired_trips', {
    p_dry_run: false,
  })

  if (purgeError) {
    console.error('purge rpc error', purgeError)
    return json({ error: 'Failed to purge trips', storage: results }, 500, headers)
  }

  return json({ dry_run: false, storage: results, purged: purged ?? [] }, 200, headers)
})
