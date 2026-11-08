// Dispatch fictif réservé aux administrateurs. Aucun escrow réel.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { startUrgentDispatch } from '@/lib/dispatch'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const TEST_EMAILS = [
  'test.client@afrione.ci',
  'test.plombier@afrione.ci',
  'test.elec@afrione.ci',
  'test.peintre@afrione.ci',
  'test.admin@afrione.ci',
]

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
  const { category = 'Plomberie', amount = 15000, timeout_seconds = 120, client_id } = await req.json().catch(() => ({}))

  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.res

  // Timeout élargi par défaut (120s) : laisse le temps de basculer sur un
  // compte artisan test dans le même navigateur avant l'expiration.
  const timeoutSec = Math.min(300, Math.max(30, Number(timeout_seconds) || 120))

  const clients = supabaseAdmin.from('users').select('id').eq('role', 'client')
  const { data: testClient } = await (client_id
    ? clients.eq('id', client_id)
    : clients.like('email', 'qa-%@afrione.test').order('created_at').limit(1)
  ).maybeSingle()
  const identity = testClient ? await supabaseAdmin.auth.admin.getUserById(testClient.id) : null
  if (!testClient || identity?.data.user?.app_metadata.afrione_test !== true) {
    return NextResponse.json({ error: 'Compte client de test introuvable' }, { status: 404 })
  }

  // ── Mission urgente ────────────────────────────────────────────────────────
  const totalAmount = Number(amount)
  if (!Number.isSafeInteger(totalAmount) || totalAmount < 1 || totalAmount > 2147483647) {
    return NextResponse.json({ error: 'Montant de test invalide' }, { status: 400 })
  }
  const { data: mission, error: mErr } = await supabaseAdmin
    .from('missions')
    .insert({
      client_id:   testClient.id,
      mode:        'urgent',
      category,
      quartier:    'Cocody',
      status:      'payment',
      is_test:     true,
      logic_version: 1,
      total_price: totalAmount,
    })
    .select('id')
    .single()

  if (mErr || !mission) {
    return NextResponse.json({ error: `Création mission échouée : ${mErr?.message}` }, { status: 500 })
  }

  // ── Broadcast aux artisans test ────────────────────────────────────────────
  const result = await startUrgentDispatch(mission.id, testClient.id, category, timeoutSec)

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
    push_sent:   (result as any).push_sent ?? 0,
    timeout_seconds: timeoutSec,
    reason:      (result as any).reason ?? null,
    targets,
  })
}
