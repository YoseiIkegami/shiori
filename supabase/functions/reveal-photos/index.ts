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
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const tripKey = (body?.trip_id ?? body?.share_token ?? body?.slug) as string | undefined

    if (!tripKey || typeof tripKey !== 'string') {
      return new Response(JSON.stringify({ error: 'trip_id_required' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'misconfigured' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // service_role bypasses RLS — used only after reveal check below
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    const tripSelect =
      'id, slug, name, share_token, reveal_at, is_revealed, photos_count, max_photos, payment_status, show_nicknames, date_format'

    let { data: trip, error: tripError } = await supabase
      .from('trips')
      .select(tripSelect)
      .eq('share_token', tripKey)
      .maybeSingle()

    if (!trip && !tripError) {
      const bySlug = await supabase.from('trips').select(tripSelect).eq('slug', tripKey).maybeSingle()
      trip = bySlug.data
      tripError = bySlug.error
    }

    // UUID fallback only when key looks like a UUID (avoids 22P02 on slugs like "test").
    if (!trip && !tripError && uuidRe.test(tripKey)) {
      const byId = await supabase
        .from('trips')
        .select(tripSelect)
        .eq('id', tripKey)
        .maybeSingle()
      trip = byId.data
      tripError = byId.error
    }

    if (tripError) {
      console.error('trip lookup error', tripError)
      return new Response(JSON.stringify({ error: 'load_failed' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    if (!trip) {
      return new Response(JSON.stringify({ error: 'trip_not_found' }), {
        status: 404,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Unpaid trips are not viewable (Phase 2 gate). Backfilled trips are 'paid'.
    if (trip.payment_status !== 'paid') {
      return new Response(JSON.stringify({ error: 'trip_not_paid' }), {
        status: 402,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Composite reveal: promote when the optional end time has passed.
    if (trip.is_revealed !== true && trip.reveal_at && Date.parse(trip.reveal_at) <= Date.now()) {
      const { error: promoteError } = await supabase.rpc('reveal_trip', { p_trip_id: trip.id })
      if (promoteError) console.error('time-based promote error', promoteError)
      else trip.is_revealed = true
    }

    // Count-based reveal is finalized by the database trigger; time-based handled above.
    if (trip.is_revealed !== true) {
      return new Response(JSON.stringify({ error: 'trip_not_revealed' }), {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const { data: photosRaw, error: photosError } = await supabase
      .from('photos')
      .select('id, trip_id, storage_path, raw_path, comment, rotation, created_at, member_id')
      .eq('trip_id', trip.id)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true })

    if (photosError) {
      console.error('photos lookup error', photosError)
      return new Response(JSON.stringify({ error: 'photos_load_failed' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const photos = (photosRaw ?? []) as Array<{
      id: string
      trip_id: string
      storage_path: string
      raw_path: string | null
      comment: string
      rotation: number | null
      created_at: string
      member_id?: string | null
    }>

    const memberIds = [
      ...new Set(
        photos
          .map((p: { member_id?: string | null }) => p.member_id)
          .filter((id: string | null | undefined): id is string => Boolean(id)),
      ),
    ]
    const nicknameById = new Map<string, string>()
    if (memberIds.length > 0) {
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select('id, nickname')
        .in('id', memberIds)
      if (membersError) console.error('members lookup error', membersError)
      for (const m of members ?? []) {
        nicknameById.set(m.id, m.nickname)
      }
    }

    const SIGNED_URL_EXPIRES_SEC = 60 * 60 * 4 // 4 hours

    const withUrls = await Promise.all(
      photos.map(async (photo: {
        id: string
        trip_id: string
        storage_path: string
        raw_path: string | null
        comment: string
        rotation: number | null
        created_at: string
        member_id?: string | null
      }) => {
        const { data: signed, error: signError } = await supabase.storage
          .from('trip-photos')
          .createSignedUrl(photo.storage_path, SIGNED_URL_EXPIRES_SEC)

        if (signError) {
          console.error('signed url error', photo.storage_path, signError)
        }

        let rawUrl: string | null = null
        if (photo.raw_path) {
          const { data: rawSigned, error: rawSignError } = await supabase.storage
            .from('trip-photos')
            .createSignedUrl(photo.raw_path, SIGNED_URL_EXPIRES_SEC)
          if (rawSignError) {
            console.error('raw signed url error', photo.raw_path, rawSignError)
          }
          rawUrl = rawSigned?.signedUrl ?? null
        }

        return {
          id: photo.id,
          trip_id: photo.trip_id,
          comment: photo.comment,
          rotation: photo.rotation,
          created_at: photo.created_at,
          member_id: photo.member_id ?? null,
          nickname: photo.member_id ? nicknameById.get(photo.member_id) ?? null : null,
          url: signed?.signedUrl ?? null,
          raw_url: rawUrl,
        }
      }),
    )

    return new Response(
      JSON.stringify({
        trip: {
          id: trip.id,
          slug: trip.slug,
          name: trip.name,
          share_token: trip.share_token,
          reveal_at: trip.reveal_at,
          is_revealed: trip.is_revealed === true,
          photos_count: trip.photos_count,
          max_photos: trip.max_photos,
          payment_status: trip.payment_status,
          show_nicknames: trip.show_nicknames === true,
          date_format: trip.date_format ?? 'none',
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
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }
})
