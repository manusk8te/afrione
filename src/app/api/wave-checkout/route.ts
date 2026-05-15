/**
 * Wave Business Checkout API
 * ─────────────────────────────────────────────────────────────────────────────
 * Production docs  : https://docs.wave.com/business/checkout
 * Dashboard        : https://business.wave.com
 * Sandbox env      : set WAVE_ENV=sandbox  (base URL changes)
 *
 * ENV VARS required to go live:
 *   WAVE_API_KEY          → Bearer token from Wave Business dashboard
 *   WAVE_WEBHOOK_SECRET   → Secret to verify webhook signatures
 *   NEXT_PUBLIC_APP_URL   → e.g. https://afrione-sepia.vercel.app
 *
 * Current mode: SIMULATION (no API key → returns mock data)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const dynamic = 'force-dynamic'

const WAVE_BASE = process.env.WAVE_ENV === 'sandbox'
  ? 'https://api.wave.com/v1'   // Wave uses same base; sandbox via test keys
  : 'https://api.wave.com/v1'

export async function POST(request: Request) {
  const body = await request.json()
  const { mission_id, amount, description, client_phone } = body

  const apiKey = process.env.WAVE_API_KEY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://afrione-sepia.vercel.app'

  // ── SIMULATION MODE ────────────────────────────────────────────────────────
  if (!apiKey) {
    console.log('[Wave] Simulation mode — no WAVE_API_KEY configured')
    return Response.json({
      simulation: true,
      id: `sim_${Date.now()}`,
      checkout_status: 'pending',
      wave_launch_url: null,          // In prod: deep link to Wave app
      client_reference: mission_id,
      amount,
      currency: 'XOF',
    })
  }

  // ── LIVE WAVE CHECKOUT SESSION ────────────────────────────────────────────
  // POST /v1/checkout/sessions
  // Response: { id, wave_launch_url, checkout_status, client_reference, ... }
  const res = await fetch(`${WAVE_BASE}/checkout/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `mission-${mission_id}-${Date.now()}`,
    },
    body: JSON.stringify({
      amount: String(amount),        // Wave expects string
      currency: 'XOF',
      client_reference: mission_id,  // Your internal ID — echoed in webhooks
      success_url: `${appUrl}/payment/success?mission=${mission_id}`,
      error_url: `${appUrl}/payment/error?mission=${mission_id}`,
      // Optional: restrict to one phone number
      ...(client_phone ? { restricted_payment_method: { type: 'wave_ci', phone_number: `+225${client_phone.replace(/\s/g, '')}` } } : {}),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('[Wave] Checkout session error:', err)
    return Response.json({ error: 'Wave API error', details: err }, { status: res.status })
  }

  const data = await res.json()
  // data.wave_launch_url  → redirect user here (opens Wave app on mobile)
  // data.id               → session ID to poll status or match webhook
  return Response.json(data)
}

// ── POLL SESSION STATUS ───────────────────────────────────────────────────────
// GET /api/wave-checkout?session_id=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const apiKey = process.env.WAVE_API_KEY

  if (!apiKey || !sessionId) {
    return Response.json({ simulation: true, checkout_status: 'complete' })
  }

  const res = await fetch(`${WAVE_BASE}/checkout/sessions/${sessionId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })

  if (!res.ok) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(await res.json())
}
