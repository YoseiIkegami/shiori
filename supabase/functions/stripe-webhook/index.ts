import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Stripe calls this endpoint directly (no Supabase JWT) — verify_jwt must be false.
// Idempotency is guaranteed by the unique index on orders.stripe_session_id.

const RETENTION_DAYS_BASE = 7

type OrganizerMailPayload = {
  email: string | null | undefined
  tripName: string
  shareUrl: string
  manageUrl: string
}

/**
 * Send organizer links via Resend after successful Checkout.
 * No-ops until RESEND_API_KEY is set. From: RESEND_FROM (optional).
 */
async function maybeSendOrganizerLinks(payload: OrganizerMailPayload): Promise<void> {
  const email = payload.email?.trim()
  if (!email) {
    console.log('organizer email skipped: no customer email on session')
    return
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.log('organizer email stub (RESEND_API_KEY unset)', {
      email,
      shareUrl: payload.shareUrl,
    })
    return
  }

  const from = Deno.env.get('RESEND_FROM') ?? 'SHIORI <onboarding@resend.dev>'
  const subject = `【SHIORI】${payload.tripName} — リンクをお送りします`
  const text = [
    `${payload.tripName} の発行が完了しました。`,
    '',
    '■ みんなに送るリンク（入場）',
    payload.shareUrl,
    '',
    '■ 幹事用リンク（設定・終了）',
    payload.manageUrl,
    '',
    '※ 幹事用リンクは秘密です。転送しないでください。',
    '※ 領収書は Stripe から別メールで届く場合があります。',
  ].join('\n')

  const html = `
    <p><strong>${escapeHtml(payload.tripName)}</strong> の発行が完了しました。</p>
    <p><strong>みんなに送るリンク（入場）</strong><br/>
    <a href="${escapeAttr(payload.shareUrl)}">${escapeHtml(payload.shareUrl)}</a></p>
    <p><strong>幹事用リンク（設定・終了）</strong><br/>
    <a href="${escapeAttr(payload.manageUrl)}">${escapeHtml(payload.manageUrl)}</a></p>
    <p style="color:#666;font-size:13px">幹事用リンクは秘密です。転送しないでください。<br/>
    領収書は Stripe から別メールで届く場合があります。</p>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      text,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('resend error', res.status, body)
    return
  }
  console.log('organizer email sent', { email })
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/'/g, '&#39;')
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

  const patch: Record<string, unknown> = { payment_status: 'paid' }
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
    .select('slug, name, share_token, organizer_token')
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
  if (shareKey) {
    await maybeSendOrganizerLinks({
      email: session.customer_details?.email ?? session.customer_email,
      tripName,
      shareUrl: `${appOrigin}/t/${shareKey}`,
      manageUrl: token ? `${appOrigin}/manage/${shareKey}?token=${encodeURIComponent(token)}` : '',
    })
  }

  return new Response('ok', { status: 200 })
})
