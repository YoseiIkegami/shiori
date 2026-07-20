import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Keep in sync with src/lib/reservedSlugs.ts (client-side list).
const RESERVED_SLUGS = new Set([
  'create',
  'manage',
  'test',
  'admin',
  'api',
  'success',
  'cancel',
  't',
  'assets',
  'static',
  'favicon',
])

const SLUG_RE = /^[a-z0-9-]{3,30}$/
const DATE_FORMATS = new Set(['YY.M.D', 'YYYY.M.D', 'YY.M.D HH:mm', 'none'])
// Base price. Localization (per-country currency) is a follow-up; JPY default for now.
const BASE_CURRENCY = (Deno.env.get('STRIPE_BASE_CURRENCY') ?? 'jpy').toLowerCase()
const BASE_AMOUNT = Number(Deno.env.get('STRIPE_BASE_AMOUNT') ?? '150')
const RETENTION_DAYS_BASE = 7

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

const json = (
  body: unknown,
  status: number,
  headers: Record<string, string>,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })

function normalizeSlug(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase()
}

function slugError(slug: string): string | null {
  if (!SLUG_RE.test(slug)) return '英数字とハイフンで 3〜30文字'
  if (RESERVED_SLUGS.has(slug)) return '英数字とハイフンで 3〜30文字'
  return null
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!supabaseUrl || !serviceRoleKey || !stripeKey) {
    return json({ error: 'Server misconfigured' }, 500, headers)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const stripe = new Stripe(stripeKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400, headers)
  }

  const action = (body.action as string) ?? 'create'

  // -------------------------------------------------------------------------
  // result: success page looks up its trip by Stripe session id.
  // -------------------------------------------------------------------------
  if (action === 'result') {
    const sessionId = body.session_id as string | undefined
    if (!sessionId) return json({ error: 'session_id is required' }, 400, headers)

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId)
    } catch (e) {
      console.error('session retrieve error', e)
      return json({ error: 'Session not found' }, 404, headers)
    }

    const tripId = session.metadata?.trip_id
    if (!tripId) return json({ error: 'Session not linked to a trip' }, 404, headers)

    // Fallback promote in case the webhook is delayed.
    if (session.payment_status === 'paid') {
      await supabase
        .from('trips')
        .update({ payment_status: 'paid' })
        .eq('id', tripId)
        .neq('payment_status', 'paid')
    }

    const { data: trip, error } = await supabase
      .from('trips')
      .select('slug, name, organizer_token, payment_status')
      .eq('id', tripId)
      .maybeSingle()

    if (error || !trip) return json({ error: 'Trip not found' }, 404, headers)

    return json(
      {
        slug: trip.slug,
        name: trip.name,
        organizer_token: trip.organizer_token,
        payment_status: trip.payment_status,
      },
      200,
      headers,
    )
  }

  // -------------------------------------------------------------------------
  // create: validate slug, insert pending trip, open a Checkout Session.
  // -------------------------------------------------------------------------
  const slug = normalizeSlug(body.slug ?? body.title)
  const slugErr = slugError(slug)
  if (slugErr) return json({ error: slugErr, field: 'slug' }, 400, headers)

  const { data: existing, error: existErr } = await supabase
    .from('trips')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (existErr) {
    console.error('slug check error', existErr)
    return json({ error: 'Failed to validate name' }, 500, headers)
  }
  if (existing) return json({ error: 'この名前はすでに使われています', field: 'slug' }, 409, headers)

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : slug
  const maxPhotos = Number.isFinite(Number(body.max_photos))
    ? Math.max(1, Math.min(500, Math.floor(Number(body.max_photos))))
    : 50
  const revealAt =
    typeof body.reveal_at === 'string' && body.reveal_at ? body.reveal_at : null
  const commentRequired = body.comment_required !== false
  const showNicknames = body.show_nicknames === true
  const dateFormat = DATE_FORMATS.has(String(body.date_format))
    ? String(body.date_format)
    : 'YY.M.D'

  const insertPayload = {
    slug,
    name,
    max_photos: maxPhotos,
    reveal_at: revealAt,
    comment_required: commentRequired,
    show_nicknames: showNicknames,
    date_format: dateFormat,
    payment_status: 'pending',
  }

  const { data: trip, error: insertError } = await supabase
    .from('trips')
    .insert(insertPayload)
    .select('id, slug')
    .single()

  if (insertError) {
    // Unique violation → slug was taken between the check and the insert (race).
    if ((insertError as { code?: string }).code === '23505') {
      return json({ error: 'この名前はすでに使われています', field: 'slug' }, 409, headers)
    }
    console.error('trip insert error', insertError)
    return json({ error: 'Failed to create trip' }, 500, headers)
  }

  const origin = req.headers.get('Origin') ?? Deno.env.get('APP_ORIGIN') ?? ''
  const successBase = (body.origin as string) || origin
  const successUrl = `${successBase}/create/success?session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${successBase}/create`

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Wallet methods (Apple Pay / Google Pay) surface automatically under 'card'.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: BASE_CURRENCY,
            unit_amount: BASE_AMOUNT,
            product_data: { name: `SHIORI: ${name}` },
          },
        },
      ],
      metadata: { trip_id: trip.id, slug: trip.slug, type: 'base' },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    return json({ url: session.url, trip_id: trip.id, slug: trip.slug }, 200, headers)
  } catch (e) {
    console.error('checkout session error', e)
    // The pending trip is left in place; it simply never becomes paid.
    return json({ error: 'Failed to start checkout' }, 500, headers)
  }
})
