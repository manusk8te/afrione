export const dynamic = 'force-dynamic'

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


const WAVE_BASE = process.env.WAVE_ENV === 'sandbox'
  ? 'https://api.wave.com/v1'   // Wave uses same base; sandbox via test keys
  : 'https://api.wave.com/v1'

export async function POST(request: Request) {
  const body = await request.json()
  const { mission_id, amount, description, client_phone } = body

  const apiKey = process.env.WAVE_API_KEY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://afrione-sepia.vercel.app'

  // ── MODE DÉMO ──────────────────────────────────────────────────────────────
  // Aucune clé Wave : on ne peut pas encaisser. Le parcours continue en mode
  // démo, mais la réponse le dit explicitement pour que l'interface l'affiche
  // au client — jamais un écran qui imite un vrai paiement.
  if (!apiKey) {
    console.warn('[Wave] MODE DÉMO — WAVE_API_KEY absente, aucun paiement réel possible')
    return Response.json({
      simulation:        true,
      demo_mode:         true,
      demo_notice:       'MODE DÉMO — aucun paiement réel n\'est effectué.',
      simulation_reason: 'WAVE_API_KEY absente',
      id:                `sim_${Date.now()}`,
      checkout_status:   'pending',
      wave_launch_url:   null,
      client_reference:  mission_id,
      amount,
      currency:          'XOF',
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
    // Une clé Wave EST configurée : le client a donc engagé un vrai paiement.
    // Retomber en simulation ici présentait un échec de paiement comme un
    // succès — la mission partait en dispatch sans qu'un franc ait été encaissé.
    // Un échec Wave doit rester un échec.
    return Response.json(
      {
        error:  'Le paiement Wave a échoué. Aucun montant n\'a été débité.',
        code:   'wave_error',
        status: res.status,
      },
      { status: 502 },
    )
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

  // Sans clé Wave on ne peut rien vérifier : répondre 'complete' revenait à
  // certifier un encaissement qui n'a jamais eu lieu.
  if (!apiKey) {
    return Response.json({
      simulation:      true,
      demo_mode:       true,
      demo_notice:     'MODE DÉMO — statut non vérifiable, aucun paiement réel.',
      checkout_status: 'demo',
    })
  }

  if (!sessionId) {
    return Response.json({ error: 'session_id requis' }, { status: 400 })
  }

  const res = await fetch(`${WAVE_BASE}/checkout/sessions/${sessionId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })

  if (!res.ok) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(await res.json())
}
