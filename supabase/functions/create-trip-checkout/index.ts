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

/** Display names. plan_id `plus` is kept internally; the label is Premium. */
const PLAN_LABELS: Record<PlanId, string> = {
  free: 'FREE',
  standard: 'Standard',
  plus: 'Premium',
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

/** Machine-readable codes; client maps via i18n (`slug.*`). */
function slugError(slug: string): string | null {
  if (!SLUG_RE.test(slug)) return 'slug_format'
  if (RESERVED_SLUGS.has(slug)) return 'slug_reserved'
  return null
}

function parsePlanId(raw: unknown): PlanId {
  return raw === 'free' || raw === 'plus' ? raw : 'standard'
}

function parseCurrency(raw: unknown): Currency {
  return String(raw ?? '').toLowerCase() === 'usd' ? 'usd' : 'jpy'
}

const NAME_MAX = 60

function normalizeDisplayName(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, NAME_MAX)
}

function randomInternalSlug(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  let out = 't'
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i]! % alphabet.length]
  }
  return out
}

async function allocateSlug(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<string | null> {
  for (let i = 0; i < 10; i++) {
    const candidate = randomInternalSlug()
    if (RESERVED_SLUGS.has(candidate) || slugError(candidate)) continue
    const { data } = await supabase.from('trips').select('id').eq('slug', candidate).maybeSingle()
    if (!data) return candidate
  }
  return null
}

type FreePurgeResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

async function purgeFreeTrip(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  slug: string,
  token: string,
): Promise<FreePurgeResult> {
  if (!slug || !token) return { ok: false, status: 400, error: 'slug_token_required' }
  let { data: trip, error } = await supabase
    .from('trips')
    .select('id, plan_id, organizer_token')
    .eq('slug', slug)
    .maybeSingle()
  if (!trip && !error) {
    const byShare = await supabase
      .from('trips')
      .select('id, plan_id, organizer_token')
      .eq('share_token', slug)
      .maybeSingle()
    trip = byShare.data
    error = byShare.error
  }
  if (error) return { ok: false, status: 500, error: 'load_failed' }
  if (!trip) return { ok: true }
  if (trip.organizer_token !== token) return { ok: false, status: 403, error: 'invalid_token' }
  if (trip.plan_id !== 'free') return { ok: false, status: 400, error: 'not_free_trip' }

  const bucket = 'trip-photos'
  const { data: entries, error: listError } = await supabase.storage
    .from(bucket)
    .list(trip.id, { limit: 1000 })
  if (listError) {
    console.error('delete_free storage list error', trip.id, listError)
  }
  const paths = (entries ?? [])
    .filter((e: { name?: string }) => e.name && !e.name.endsWith('/'))
    .map((e: { name: string }) => `${trip.id}/${e.name}`)
  if (paths.length) {
    const { error: removeError } = await supabase.storage.from(bucket).remove(paths)
    if (removeError) console.error('delete_free storage remove error', trip.id, removeError)
  }

  const { error: photosError } = await supabase.from('photos').delete().eq('trip_id', trip.id)
  if (photosError) {
    console.error('delete_free photos error', trip.id, photosError)
    return { ok: false, status: 500, error: 'delete_failed' }
  }
  const { error: membersError } = await supabase.from('members').delete().eq('trip_id', trip.id)
  if (membersError) {
    console.error('delete_free members error', trip.id, membersError)
    return { ok: false, status: 500, error: 'delete_failed' }
  }
  const { error: deleteError } = await supabase.from('trips').delete().eq('id', trip.id)
  if (deleteError) {
    console.error('delete_free trip error', trip.id, deleteError)
    return { ok: false, status: 500, error: 'delete_failed' }
  }
  return { ok: true }
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'misconfigured' }, 500, headers)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400, headers)
  }

  const action = (body.action as string) ?? 'create'

  if (action === 'check_slug') {
    const started = Date.now()
    const slug = normalizeSlug(body.slug)
    const formatErr = slugError(slug)
    let taken = false
    if (!formatErr) {
      const { data } = await supabase
        .from('trips')
        .select('id, payment_status')
        .eq('slug', slug)
        .maybeSingle()
      // pending = abandoned Checkout; create will reclaim the slug.
      taken = Boolean(data && data.payment_status !== 'pending')
    }
    // Uniform minimum latency — raises cost of slug enumeration.
    const wait = 280 - (Date.now() - started)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    if (formatErr) return json({ taken: true, error: formatErr }, 200, headers)
    return json({ taken }, 200, headers)
  }

  if (action === 'result') {
    if (!stripeKey) return json({ error: 'misconfigured' }, 500, headers)
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })
    const sessionId = body.session_id as string | undefined
    if (!sessionId) return json({ error: 'session_required' }, 400, headers)

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId)
    } catch (e) {
      console.error('session retrieve error', e)
      return json({ error: 'session_not_found' }, 404, headers)
    }

    const tripId = session.metadata?.trip_id
    if (!tripId) return json({ error: 'session_unlinked' }, 404, headers)

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
      .select('slug, name, share_token, organizer_token, payment_status')
      .eq('id', tripId)
      .maybeSingle()

    if (error || !trip) return json({ error: 'trip_not_found' }, 404, headers)

    return json(
      {
        slug: trip.slug,
        name: trip.name,
        share_token: trip.share_token,
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
    const purged = await purgeFreeTrip(supabase, slug, token)
    if (!purged.ok) return json({ error: purged.error }, purged.status, headers)
    return json({ ok: true }, 200, headers)
  }

  const planId = parsePlanId(body.plan_id)
  const freeToken = String(body.free_token ?? '')
  const freeSlug = normalizeSlug(body.free_slug ?? body.slug)

  // 有料化時: FREE を token 付きで回収してから進む
  if (planId !== 'free' && freeToken && freeSlug) {
    const purged = await purgeFreeTrip(supabase, freeSlug, freeToken)
    if (!purged.ok && purged.status !== 400) {
      return json({ error: purged.error }, purged.status, headers)
    }
  }

  const name = normalizeDisplayName(body.name ?? body.title)
  if (!name) return json({ error: 'name_required', field: 'name' }, 400, headers)

  const slug = await allocateSlug(supabase)
  if (!slug) return json({ error: 'allocate_failed' }, 500, headers)

  const currency = parseCurrency(body.currency)
  const plan = PLANS[planId]
  const maxPhotosRaw = Number(body.max_photos)
  const maxPhotos = Number.isFinite(maxPhotosRaw)
    ? Math.min(plan.maxPhotos, Math.max(1, Math.floor(maxPhotosRaw)))
    : plan.maxPhotos
  const commentRequired = body.comment_required !== false
  const showNicknames = body.show_nicknames === true
  const dateFormat = 'none'

  if (planId === 'free') {
    const ttlHours = plan.freeTtlHours ?? 2
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()
    const { data: trip, error: insertError } = await supabase
      .from('trips')
      .insert({
        slug,
        name,
        max_photos: maxPhotos,
        plan_id: planId,
        reveal_at: null,
        comment_required: commentRequired,
        show_nicknames: showNicknames,
        date_format: dateFormat,
        payment_status: 'paid',
        expires_at: expiresAt,
      })
      .select('id, slug, share_token, organizer_token')
      .single()

    if (insertError) {
      if ((insertError as { code?: string }).code === '23505') {
        return json({ error: 'slug_taken', field: 'slug' }, 409, headers)
      }
      console.error('trip insert error', insertError)
      return json({ error: 'create_failed' }, 500, headers)
    }

    const origin = (body.origin as string) || req.headers.get('Origin') || Deno.env.get('APP_ORIGIN') || ''
    const successUrl = `${origin.replace(/\/$/, '')}/create/success?free=1&share=${encodeURIComponent(trip.share_token)}&slug=${encodeURIComponent(trip.slug)}&token=${encodeURIComponent(trip.organizer_token)}`
    return json(
      {
        url: successUrl,
        trip_id: trip.id,
        slug: trip.slug,
        share_token: trip.share_token,
        organizer_token: trip.organizer_token,
        plan_id: planId,
        free: true,
      },
      200,
      headers,
    )
  }

  if (!stripeKey) return json({ error: 'misconfigured' }, 500, headers)
  const stripe = new Stripe(stripeKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const insertPayload = {
    slug,
    name,
    max_photos: maxPhotos,
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
    .select('id, slug, share_token')
    .single()

  if (insertError) {
    if ((insertError as { code?: string }).code === '23505') {
      return json({ error: 'slug_taken', field: 'slug' }, 409, headers)
    }
    console.error('trip insert error', insertError)
    return json({ error: 'create_failed' }, 500, headers)
  }

  const origin = req.headers.get('Origin') ?? Deno.env.get('APP_ORIGIN') ?? ''
  const successBase = (body.origin as string) || origin
  const successUrl = `${successBase}/create/success?session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${successBase}/create`
  const localeRaw = String(body.locale ?? '').toLowerCase()
  const checkoutLocale = localeRaw === 'en' || currency === 'usd' ? 'en' : 'ja'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: checkoutLocale,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: plan.amounts[currency],
            product_data: { name: `SHIORI ${PLAN_LABELS[planId]}: ${name}` },
          },
        },
      ],
      metadata: {
        trip_id: trip.id,
        slug: trip.slug,
        share_token: trip.share_token,
        type: planId,
        plan_id: planId,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    return json(
      { url: session.url, trip_id: trip.id, slug: trip.slug, share_token: trip.share_token, plan_id: planId },
      200,
      headers,
    )
  } catch (e) {
    console.error('checkout session error', e)
    return json({ error: 'checkout_failed' }, 500, headers)
  }
})
