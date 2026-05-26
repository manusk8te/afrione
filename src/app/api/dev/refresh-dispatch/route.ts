import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Rafraîchit ou crée une dispatch_attempt pour un artisan test
// avec 2 minutes de délai — le temps de switcher de compte et accepter
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Token invalide' }, { status: 401 })

  const { data: profile } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin requis' }, { status: 403 })

  const { mission_id, artisan_email } = await req.json()
  if (!mission_id || !artisan_email) return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })

  // Trouver l'artisan via son email auth
  const { data: authList } = await supabaseAdmin.auth.admin.listUsers()
  const artisanAuthUser = authList?.users?.find(u => u.email === artisan_email)
  if (!artisanAuthUser) return NextResponse.json({ error: `Artisan ${artisan_email} introuvable dans auth` }, { status: 404 })

  const { data: artisanPro } = await supabaseAdmin
    .from('artisan_pros')
    .select('id')
    .eq('user_id', artisanAuthUser.id)
    .single()
  if (!artisanPro) return NextResponse.json({ error: 'Profil artisan introuvable' }, { status: 404 })

  // 2 minutes de délai pour que l'utilisateur ait le temps de switcher
  const expiresAt = new Date(Date.now() + 120_000).toISOString()

  // Supprimer l'ancienne tentative expirée si elle existe
  await supabaseAdmin
    .from('dispatch_attempts')
    .delete()
    .eq('mission_id', mission_id)
    .eq('artisan_id', artisanPro.id)

  // Créer une nouvelle tentative fraîche
  await supabaseAdmin.from('dispatch_attempts').insert({
    mission_id,
    artisan_id: artisanPro.id,
    attempt_number: 99,
    expires_at: expiresAt,
  })

  // S'assurer que la mission est bien en dispatching
  await supabaseAdmin
    .from('missions')
    .update({ status: 'dispatching' })
    .eq('id', mission_id)
    .not('status', 'eq', 'en_route')

  return NextResponse.json({ ok: true, expires_at: expiresAt, artisan_id: artisanPro.id })
}
