import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Stripe calls this endpoint directly (no Supabase JWT) — verify_jwt must be false.
// Idempotency is guaranteed by the unique index on orders.stripe_session_id.

const RETENTION_DAYS_BASE = 7

type OrganizerMailPayload = {
  email: string | null | undefined
  slug: string
  shareUrl: string
  manageUrl: string
}

/**
 * Placeholder for Phase email (Resend etc.).
 * No-ops until RESEND_API_KEY (or equivalent) is configured.
 */
async function maybeSendOrganizerLinks(payload: OrganizerMailPayload): Promise<void> {
  const email = payload.email?.trim()
  if (!email) {
    console.log('organizer email skipped: no customer email on session')
    return
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    // Hook is ready; real send lands in a follow-up once Resend + domain are set.
    console.log('organizer email stub (RESEND_API_KEY unset)', {
      email,
      slug: payload.slug,
    })
    return
  }

  // TODO(Phase email): call Resend with shareUrl + manageUrl.
  // Warn that manageUrl is a secret ("誰でも設定を変更できます").
  console.log('organizer email not implemented yet', { email, slug: payload.slug })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('stripe-webhook misconfigured')
    return new Response('Server misconfigured', { status: 500 })
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  const payload = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    )
  } catch (e) {
    console.error('webhook signature verification failed', e)
    return new Response('Invalid signature', { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    // Acknowledge other events so Stripe stops retrying.
    return new Response('ignored', { status: 200 })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const tripId = session.metadata?.trip_id
  const orderType = session.metadata?.type ?? 'base'

  if (!tripId) {
    console.error('checkout.session.completed without trip_id')
    return new Response('ok', { status: 200 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Record the order (idempotent via unique stripe_session_id).
  const { error: orderError } = await supabase.from('orders').insert({
    trip_id: tripId,
    stripe_session_id: session.id,
    amount: session.amount_total ?? 0,
    currency: session.currency ?? 'jpy',
    type: orderType,
  })

  if (orderError && (orderError as { code?: string }).code !== '23505') {
    console.error('order insert error', orderError)
    return new Response('Failed to record order', { status: 500 })
  }

  // Mark the trip paid and set its retention window (base = 7 days).
  const expiresAt = new Date(Date.now() + RETENTION_DAYS_BASE * 24 * 60 * 60 * 1000)
  const { data: trip, error: updateError } = await supabase
    .from('trips')
    .update({ payment_status: 'paid', expires_at: expiresAt.toISOString() })
    .eq('id', tripId)
    .select('slug, organizer_token')
    .maybeSingle()

  if (updateError) {
    console.error('trip paid update error', updateError)
    return new Response('Failed to update trip', { status: 500 })
  }

  const appOrigin = (Deno.env.get('APP_ORIGIN') ?? 'https://shiori.ikg-systems.com').replace(
    /\/$/,
    '',
  )
  const slug = trip?.slug ?? session.metadata?.slug ?? ''
  const token = trip?.organizer_token ?? ''
  if (slug) {
    await maybeSendOrganizerLinks({
      email: session.customer_details?.email ?? session.customer_email,
      slug,
      shareUrl: `${appOrigin}/t/${slug}`,
      manageUrl: token ? `${appOrigin}/manage/${slug}?token=${token}` : '',
    })
  }

  return new Response('ok', { status: 200 })
})
