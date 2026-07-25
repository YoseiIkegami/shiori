import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Keep in sync with src/lib/reservedSlugs.ts and src/lib/tripPlan.ts
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

type PlanId = 'free' | 'standard' | 'plus'
type Currency = 'jpy' | 'usd'

const PLANS: Record<
  PlanId,
  { maxPhotos: number; retentionDays: number | null; freeTtlHours?: number; amounts: Record<Currency, number> }
> = {
  free: { maxPhotos: 3, retentionDays: null, freeTtlHours: 2, amounts: { jpy: 0, usd: 0 } },
  standard: { maxPhotos: 50, retentionDays: 7, amounts: { jpy: 150, usd: 100 } },
  plus: { maxPhotos: 500, retentionDays: null, amounts: { jpy: 750, usd: 500 } },
}

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

function normalizeSlug(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase()
}

function slugError(slug: string): string | null {
  if (!SLUG_RE.test(slug)) return '英数字とハイフンで 3〜30文字'
  if (RESERVED_SLUGS.has(slug)) return 'この名前は使えません'
  return null
}

function parsePlanId(raw: unknown): PlanId {
  return raw === 'free' || raw === 'plus' ? raw : 'standard'
}

function parseCurrency(raw: unknown): Currency {
  return String(raw ?? '').toLowerCase() === 'usd' ? 'usd' : 'jpy'
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server misconfigured' }, 500, headers)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400, headers)
  }

  const action = (body.action as string) ?? 'create'

  if (action === 'result') {
    if (!stripeKey) return json({ error: 'Server misconfigured' }, 500, headers)
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })
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

    if (session.payment_status === 'paid') {
      const planId = parsePlanId(session.metadata?.plan_id)
      const plan = PLANS[planId]
      const patch: Record<string, unknown> = { payment_status: 'paid' }
      if (plan.retentionDays == null) patch.expires_at = null
      else {
        patch.expires_at = new Date(
          Date.now() + plan.retentionDays * 24 * 60 * 60 * 1000,
        ).toISOString()
      }
      await supabase.from('trips').update(patch).eq('id', tripId).neq('payment_status', 'paid')
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

  // delete free demo (organizer token)
  if (action === 'delete_free') {
    const slug = normalizeSlug(body.slug)
    const token = String(body.token ?? '')
    if (!slug || !token) return json({ error: 'slug and token are required' }, 400, headers)
    const { data: trip, error } = await supabase
      .from('trips')
      .select('id, plan_id, organizer_token')
      .eq('slug', slug)
      .maybeSingle()
    if (error || !trip) return json({ error: 'Trip not found' }, 404, headers)
    if (trip.organizer_token !== token) return json({ error: 'Invalid token' }, 403, headers)
    if (trip.plan_id !== 'free') return json({ error: 'Not a free trip' }, 400, headers)
    await supabase.from('trips').delete().eq('id', trip.id)
    return json({ ok: true }, 200, headers)
  }

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

  const planId = parsePlanId(body.plan_id)
  const currency = parseCurrency(body.currency)
  const plan = PLANS[planId]
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : slug
  const commentRequired = body.comment_required !== false
  const showNicknames = body.show_nicknames === true
  const dateFormat = DATE_FORMATS.has(String(body.date_format))
    ? String(body.date_format)
    : 'YY.M.D'

  if (planId === 'free') {
    const ttlHours = plan.freeTtlHours ?? 2
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()
    const { data: trip, error: insertError } = await supabase
      .from('trips')
      .insert({
        slug,
        name,
        max_photos: plan.maxPhotos,
        plan_id: planId,
        reveal_at: null,
        comment_required: commentRequired,
        show_nicknames: showNicknames,
        date_format: dateFormat,
        payment_status: 'paid',
        expires_at: expiresAt,
      })
      .select('id, slug, organizer_token')
      .single()

    if (insertError) {
      if ((insertError as { code?: string }).code === '23505') {
        return json({ error: 'この名前はすでに使われています', field: 'slug' }, 409, headers)
      }
      console.error('trip insert error', insertError)
      return json({ error: 'Failed to create trip' }, 500, headers)
    }

    const origin = (body.origin as string) || req.headers.get('Origin') || Deno.env.get('APP_ORIGIN') || ''
    const successUrl = `${origin.replace(/\/$/, '')}/create/success?free=1&slug=${encodeURIComponent(trip.slug)}&token=${encodeURIComponent(trip.organizer_token)}`
    return json(
      {
        url: successUrl,
        trip_id: trip.id,
        slug: trip.slug,
        organizer_token: trip.organizer_token,
        plan_id: planId,
        free: true,
      },
      200,
      headers,
    )
  }

  if (!stripeKey) return json({ error: 'Server misconfigured' }, 500, headers)
  const stripe = new Stripe(stripeKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const insertPayload = {
    slug,
    name,
    max_photos: plan.maxPhotos,
    plan_id: planId,
    reveal_at: null,
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
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: plan.amounts[currency],
            product_data: { name: `SHIORI ${planId}: ${name}` },
          },
        },
      ],
      metadata: {
        trip_id: trip.id,
        slug: trip.slug,
        type: planId,
        plan_id: planId,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    return json({ url: session.url, trip_id: trip.id, slug: trip.slug, plan_id: planId }, 200, headers)
  } catch (e) {
    console.error('checkout session error', e)
    return json({ error: 'Failed to start checkout' }, 500, headers)
  }
})
