/**
 * Organizer confirmation mail (Resend). Shared by stripe-webhook and manage-trip.
 */

export type OrganizerMailPayload = {
  email: string
  tripName: string
  shareUrl: string
  manageUrl: string
}

/** BP: 60s between resends (Resend / transactional email guidance). */
export const ORGANIZER_MAIL_COOLDOWN_SEC = 60

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

async function shareQrPngBase64(shareUrl: string): Promise<string | null> {
  try {
    const { default: QRCode } = await import('npm:qrcode@1.5.4')
    const dataUrl = await QRCode.toDataURL(shareUrl, {
      type: 'image/png',
      width: 280,
      margin: 2,
      color: { dark: '#3D3026', light: '#F8F7F4' },
      errorCorrectionLevel: 'M',
    })
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    return base64 || null
  } catch (e) {
    console.error('qr generate failed', e)
    return null
  }
}

export async function sendOrganizerLinks(
  payload: OrganizerMailPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = payload.email.trim()
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'email_invalid' }
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.log('organizer email stub (RESEND_API_KEY unset)', { email })
    return { ok: false, error: 'misconfigured' }
  }

  const from = Deno.env.get('RESEND_FROM') ?? 'SHIORI <onboarding@resend.dev>'
  const appOrigin = (Deno.env.get('APP_ORIGIN') ?? 'https://shiori.ikg-systems.com').replace(
    /\/$/,
    '',
  )
  const heroUrl = `${appOrigin}/illustrations/depart.webp`
  const subject = `【SHIORI】ご購入ありがとうございます / Thank you — ${payload.tripName}`
  const qrBase64 = payload.shareUrl ? await shareQrPngBase64(payload.shareUrl) : null

  const text = [
    'ご購入ありがとうございます',
    'Thank you for your purchase.',
    '',
    'SHIORI',
    payload.tripName,
    '',
    '共有',
    'Share',
    payload.shareUrl,
    '',
    '設定',
    'Settings',
    payload.manageUrl,
    '',
    ...(qrBase64
      ? [
          '共有用QRコードを添付しています。',
          'A share QR code is attached.',
          '',
        ]
      : []),
    '共有リンクはみんなに渡せます。',
    'Share the link with your group.',
    '',
    '設定リンクは大切に保管してください。',
    'Please keep your settings link private.',
    '',
    '領収書は Stripe から別メールで届きます。',
    'Your receipt will arrive separately from Stripe.',
  ].join('\n')

  const muted = 'margin:0 0 2px;font-size:12px;letter-spacing:0.06em;color:#63696C;line-height:1.5;'
  const label = 'margin:0 0 2px;font-size:12px;letter-spacing:0.08em;color:#63696C;'
  const linkBlock = 'margin:0 0 24px;font-size:14px;line-height:1.6;word-break:break-all;'

  const qrHtml = qrBase64
    ? `<p style="${label}">共有 QR</p>
    <p style="${muted}">Share QR</p>
    <p style="margin:0 0 24px;text-align:left;">
      <img src="cid:share-qr" width="160" height="160" alt="Share QR" style="display:block;width:160px;height:160px;border:0;border-radius:8px;" />
    </p>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#F8F7F4;color:#2E3437;font-family:'Hiragino Mincho ProN','Yu Mincho',Georgia,serif;">
  <div style="max-width:440px;margin:0 auto;padding:32px 24px 48px;">
    <p style="margin:0 0 2px;font-size:15px;line-height:1.6;color:#3D3026;">ご購入ありがとうございます</p>
    <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#63696C;">Thank you for your purchase.</p>
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.18em;color:#63696C;text-transform:uppercase;">SHIORI</p>
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:500;line-height:1.4;color:#3D3026;">${escapeHtml(payload.tripName)}</h1>
    <img src="${escapeAttr(heroUrl)}" width="392" alt="" style="display:block;width:100%;max-width:392px;height:auto;margin:0 0 28px;border:0;border-radius:2px;" />
    <p style="${label}">共有</p>
    <p style="${muted}">Share</p>
    <p style="${linkBlock}">
      <a href="${escapeAttr(payload.shareUrl)}" style="color:#BD5825;text-decoration:none;">${escapeHtml(payload.shareUrl)}</a>
    </p>
    <p style="${label}">設定</p>
    <p style="${muted}">Settings</p>
    <p style="${linkBlock}">
      <a href="${escapeAttr(payload.manageUrl)}" style="color:#BD5825;text-decoration:none;">${escapeHtml(payload.manageUrl)}</a>
    </p>
    ${qrHtml}
    <p style="margin:0 0 2px;font-size:12px;line-height:1.6;color:#63696C;">共有リンクはみんなに渡せます。</p>
    <p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:#63696C;">Share the link with your group.</p>
    <p style="margin:0 0 2px;font-size:12px;line-height:1.6;color:#63696C;">設定リンクは大切に保管してください。</p>
    <p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:#63696C;">Please keep your settings link private.</p>
    <p style="margin:0 0 2px;font-size:12px;line-height:1.6;color:#63696C;">領収書は Stripe から別メールで届きます。</p>
    <p style="margin:0;font-size:12px;line-height:1.6;color:#63696C;">Your receipt will arrive separately from Stripe.</p>
  </div>
</body>
</html>`

  const body: Record<string, unknown> = {
    from,
    to: [email],
    subject,
    text,
    html,
  }
  if (qrBase64) {
    body.attachments = [
      {
        filename: 'shiori-share-qr.png',
        content: qrBase64,
        content_id: 'share-qr',
      },
    ]
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.text()
    console.error('resend error', res.status, errBody)
    return { ok: false, error: 'send_failed' }
  }
  console.log('organizer email sent', { email, qr: Boolean(qrBase64) })
  return { ok: true }
}
