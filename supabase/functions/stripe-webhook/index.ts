import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { sendOrganizerLinks } from '../_shared/organizerMail.ts'

// Stripe calls this endpoint directly (no Supabase JWT) — verify_jwt must be false.
// Idempotency is guaranteed by the unique index on orders.stripe_session_id.

const RETENTION_DAYS_BASE = 7

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
    return new Response('ignored', { status: 200 })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const tripId = session.metadata?.trip_id
  const planId = session.metadata?.plan_id ?? 'standard'

  if (!tripId) {
    console.error('checkout.session.completed without trip_id')
    return new Response('ok', { status: 200 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { error: orderError } = await supabase.from('orders').insert({
    trip_id: tripId,
    stripe_session_id: session.id,
    amount: session.amount_total ?? 0,
    currency: session.currency ?? 'jpy',
    type: 'base',
  })

  if (orderError && (orderError as { code?: string }).code !== '23505') {
    console.error('order insert error', orderError)
    return new Response('Failed to record order', { status: 500 })
  }

  const organizerEmail = (
    session.customer_details?.email ??
    session.customer_email ??
    ''
  ).trim()

  const patch: Record<string, unknown> = { payment_status: 'paid' }
  if (organizerEmail) patch.organizer_email = organizerEmail
  if (planId === 'plus') {
    patch.expires_at = null
  } else {
    patch.expires_at = new Date(
      Date.now() + RETENTION_DAYS_BASE * 24 * 60 * 60 * 1000,
    ).toISOString()
  }

  const { data: trip, error: updateError } = await supabase
    .from('trips')
    .update(patch)
    .eq('id', tripId)
    .select('slug, name, share_token, organizer_token, organizer_email')
    .maybeSingle()

  if (updateError) {
    console.error('trip paid update error', updateError)
    return new Response('Failed to update trip', { status: 500 })
  }

  const appOrigin = (Deno.env.get('APP_ORIGIN') ?? 'https://shiori.ikg-systems.com').replace(
    /\/$/,
    '',
  )
  const shareKey = trip?.share_token || trip?.slug || session.metadata?.share_token || ''
  const token = trip?.organizer_token ?? ''
  const tripName = trip?.name || trip?.slug || 'SHIORI'
  const email = organizerEmail || String(trip?.organizer_email ?? '')
  if (shareKey && email) {
    const sent = await sendOrganizerLinks({
      email,
      tripName,
      shareUrl: `${appOrigin}/t/${shareKey}`,
      manageUrl: token ? `${appOrigin}/manage/${shareKey}?token=${encodeURIComponent(token)}` : '',
    })
    if (sent.ok) {
      const { error: sentAtError } = await supabase
        .from('trips')
        .update({ organizer_email_sent_at: new Date().toISOString() })
        .eq('id', tripId)
      if (sentAtError) console.error('organizer_email_sent_at update error', sentAtError)
    }
  } else if (!email) {
    console.log('organizer email skipped: no customer email on session')
  }

  return new Response('ok', { status: 200 })
})
