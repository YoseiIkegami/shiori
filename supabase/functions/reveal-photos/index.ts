import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

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

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const tripId = body?.trip_id as string | undefined

    if (!tripId || typeof tripId !== 'string') {
      return new Response(JSON.stringify({ error: 'trip_id is required' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // service_role bypasses RLS — used only after reveal check below
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, name, reveal_at, is_revealed')
      .eq('id', tripId)
      .maybeSingle()

    if (tripError) {
      console.error('trip lookup error', tripError)
      return new Response(JSON.stringify({ error: 'Failed to load trip' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    if (!trip) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Re-validate reveal on the server — do not trust the client clock alone
    const revealAt = new Date(trip.reveal_at)
    const now = new Date()
    const isRevealed = trip.is_revealed === true || revealAt.getTime() <= now.getTime()

    if (!isRevealed) {
      return new Response(JSON.stringify({ error: 'Trip is not revealed yet' }), {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('id, trip_id, storage_path, comment, rotation, created_at')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true })

    if (photosError) {
      console.error('photos lookup error', photosError)
      return new Response(JSON.stringify({ error: 'Failed to load photos' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const SIGNED_URL_EXPIRES_SEC = 60 * 60 * 4 // 4 hours

    const withUrls = await Promise.all(
      (photos ?? []).map(async (photo) => {
        const { data: signed, error: signError } = await supabase.storage
          .from('trip-photos')
          .createSignedUrl(photo.storage_path, SIGNED_URL_EXPIRES_SEC)

        if (signError) {
          console.error('signed url error', photo.storage_path, signError)
        }

        return {
          id: photo.id,
          trip_id: photo.trip_id,
          comment: photo.comment,
          rotation: photo.rotation,
          created_at: photo.created_at,
          url: signed?.signedUrl ?? null,
        }
      }),
    )

    return new Response(
      JSON.stringify({
        trip: {
          id: trip.id,
          name: trip.name,
          reveal_at: trip.reveal_at,
          is_revealed: true,
        },
        photos: withUrls.filter((p) => p.url),
      }),
      {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    console.error('reveal-photos error', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }
})
