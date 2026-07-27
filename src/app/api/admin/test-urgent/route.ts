/**
 * POST /api/admin/test-urgent
 * Crée une mission urgente de test au nom de test.client@afrione.ci,
 * simule le paiement escrow, puis broadcast le dispatch.
 * Comme le client est un compte @afrione.ci, findAllCandidates cible
 * uniquement les artisans test (test.plombier / test.elec / test.peintre).
 *
 * Body : { category?: string, amount?: number }
 * Auth : Bearer token Supabase — rôle admin requis
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import { startUrgentDispatch } from '@/lib/dispatch'

export const dynamic = 'force-dynamic'

const TEST_CLIENT_EMAIL = 'test.client@afrione.ci'
const URGENT_FEE_PCT = 0.15

const TEST_EMAILS = [
  'test.client@afrione.ci',
  'test.plombier@afrione.ci',
  'test.elec@afrione.ci',
  'test.peintre@afrione.ci',
  'test.admin@afrione.ci',
]

async function requireAdmin(req: NextRequest): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return { ok: false, res: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user } } = await userClient.auth.getUser(token)
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Token invalide' }, { status: 401 }) }

  const { data: caller } = await supabaseAdmin
    .from('users').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin') {
    return { ok: false, res: NextResponse.json({ error: 'Réservé aux admins' }, { status: 403 }) }
  }
  return { ok: true }
}

// GET — statut des comptes de test (existence, push, disponibilité) via service role
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.res

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .in('email', TEST_EMAILS)

  const ids = (users || []).map(u => u.id)
  const [{ data: subs }, { data: artisans }] = await Promise.all([
    ids.length
      ? supabaseAdmin.from('push_subscriptions').select('user_id').in('user_id', ids)
      : Promise.resolve({ data: [] as any[] }),
    ids.length
      ? supabaseAdmin.from('artisan_pros').select('user_id, is_available').in('user_id', ids)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const subSet = new Set((subs || []).map((s: any) => s.user_id))
  const availMap = new Map((artisans || []).map((a: any) => [a.user_id, a.is_available]))

  return NextResponse.json({
    accounts: TEST_EMAILS.map(email => {
      const u = (users || []).find(x => x.email === email)
      return {
        email,
        exists:         !!u,
        userId:         u?.id ?? null,
        pushSubscribed: u ? subSet.has(u.id) : false,
        isAvailable:    u ? (availMap.has(u.id) ? !!availMap.get(u.id) : null) : null,
      }
    }),
  })
}

export async function POST(req: NextRequest) {
  const { category = 'Plomberie', amount = 15000 } = await req.json().catch(() => ({}))

  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.res

  // ── Client de test ─────────────────────────────────────────────────────────
  const { data: testClient } = await supabaseAdmin
    .from('users').select('id, name').eq('email', TEST_CLIENT_EMAIL).maybeSingle()

  if (!testClient) {
    return NextResponse.json(
      { error: `Compte ${TEST_CLIENT_EMAIL} introuvable — lancez d'abord "npm run seed:auth"` },
      { status: 404 },
    )
  }

  // ── Mission urgente ────────────────────────────────────────────────────────
  const totalAmount = Number(amount) || 15000
  const { data: mission, error: mErr } = await supabaseAdmin
    .from('missions')
    .insert({
      client_id:   testClient.id,
      mode:        'urgent',
      category,
      quartier:    'Cocody',
      status:      'payment',
      total_price: totalAmount,
    })
    .select('id')
    .single()

  if (mErr || !mission) {
    return NextResponse.json({ error: `Création mission échouée : ${mErr?.message}` }, { status: 500 })
  }

  // ── Escrow simulé (fee urgent 15%) ─────────────────────────────────────────
  const platformFee = Math.round(totalAmount * URGENT_FEE_PCT)
  await supabaseAdmin.from('transactions').insert({
    mission_id:          mission.id,
    wave_transaction_id: `admin_test_${Date.now()}`,
    amount:              totalAmount,
    platform_fee:        platformFee,
    artisan_amount:      totalAmount - platformFee,
    status:              'escrow',
    payment_method:      'wave_simulation',
  })

  await supabaseAdmin.from('chat_history').insert({
    mission_id:  mission.id,
    sender_id:   testClient.id,
    sender_role: 'system',
    sender_type: 'afrione_system',
    text:        `🧪 Mission urgente TEST (admin) — ${totalAmount.toLocaleString('fr-FR')} FCFA en escrow simulé. Broadcast en cours…`,
    type:        'system',
  })

  // ── Broadcast aux artisans test ────────────────────────────────────────────
  const result = await startUrgentDispatch(mission.id, testClient.id, category)

  // Détails des tentatives pour le retour admin (qui a été notifié)
  const { data: attempts } = await supabaseAdmin
    .from('dispatch_attempts')
    .select('artisan_id, expires_at, artisan_pros(metier, users!artisan_pros_user_id_fkey(name, email))')
    .eq('mission_id', mission.id)

  const targets = (attempts || []).map((a: any) => ({
    name:   a.artisan_pros?.users?.name   || '—',
    email:  a.artisan_pros?.users?.email  || '—',
    metier: a.artisan_pros?.metier        || '—',
  }))

  return NextResponse.json({
    ok:          result.dispatched,
    mission_id:  mission.id,
    dispatched:  result.dispatched,
    count:       (result as any).count ?? 0,
    expires_at:  (result as any).expires_at ?? null,
    reason:      (result as any).reason ?? null,
    targets,
  })
}
