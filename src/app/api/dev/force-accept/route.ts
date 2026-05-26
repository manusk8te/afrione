import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Route dev uniquement — force l'acceptation d'une mission par le premier artisan disponible
// Accessible uniquement aux comptes admin
export async function POST(req: NextRequest) {
  // Vérifier que c'est un admin
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Token invalide' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin requis' }, { status: 403 })
  }

  const { mission_id } = await req.json()
  if (!mission_id) return NextResponse.json({ error: 'mission_id requis' }, { status: 400 })

  // Récupérer la mission
  const { data: mission } = await supabaseAdmin
    .from('missions')
    .select('status, client_id, category')
    .eq('id', mission_id)
    .single()

  if (!mission) return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 })
  if (mission.status === 'en_route') return NextResponse.json({ error: 'Mission déjà assignée' }, { status: 409 })

  // Trouver le premier artisan disponible dans les dispatch_attempts, ou dans artisan_pros
  let artisanId: string | null = null

  const { data: attempts } = await supabaseAdmin
    .from('dispatch_attempts')
    .select('artisan_id')
    .eq('mission_id', mission_id)
    .order('created_at', { ascending: true })
    .limit(1)

  if (attempts?.[0]?.artisan_id) {
    artisanId = attempts[0].artisan_id
  } else {
    // Pas encore de tentative — chercher n'importe quel artisan disponible
    const { data: artisan } = await supabaseAdmin
      .from('artisan_pros')
      .select('id')
      .eq('kyc_status', 'approved')
      .eq('is_available', true)
      .limit(1)
      .single()
    artisanId = artisan?.id ?? null
  }

  if (!artisanId) return NextResponse.json({ error: 'Aucun artisan disponible' }, { status: 404 })

  // Annuler toutes les tentatives en attente
  await supabaseAdmin
    .from('dispatch_attempts')
    .update({ response: 'cancelled', responded_at: new Date().toISOString() })
    .eq('mission_id', mission_id)
    .is('response', null)

  // S'assurer qu'il y a au moins une tentative "accepted" pour cet artisan
  await supabaseAdmin
    .from('dispatch_attempts')
    .upsert({
      mission_id,
      artisan_id: artisanId,
      attempt_number: 1,
      response: 'accepted',
      responded_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    }, { onConflict: 'mission_id,artisan_id' })

  // Mission → en_route
  await supabaseAdmin
    .from('missions')
    .update({ status: 'en_route', artisan_id: artisanId })
    .eq('id', mission_id)

  // Message système dans le chat
  await supabaseAdmin.from('chat_history').insert({
    mission_id,
    sender_id:   mission.client_id,
    sender_role: 'system',
    sender_type: 'afrione_system',
    text:        '✅ [DEV] Artisan simulé accepté. Mission en route !',
    type:        'system',
  })

  return NextResponse.json({ accepted: true, artisan_id: artisanId })
}
