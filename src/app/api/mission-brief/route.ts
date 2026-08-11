import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Rôle du visiteur DANS cette mission, décidé ici et pas dans le navigateur.
 *
 * Le client déduisait ce rôle d'une jointure `artisan_pros` soumise à RLS :
 * quand la jointure revenait vide — mission sans artisan attribué, ou lecture
 * refusée — il retombait sur 'client'. L'artisan héritait alors de l'écran
 * client (message d'ouverture préécrit, nom du client en en-tête, actions de
 * mission absentes). Trois bugs distincts, une seule cause.
 *
 * Ici supabaseAdmin ignore RLS : la réponse est un fait, pas une déduction.
 */
async function resolveViewerRole(
  req: NextRequest,
  mission: { client_id: string | null; artisan_pros?: { user_id?: string } | null } | null,
): Promise<{ viewer_id: string | null; viewer_role: 'client' | 'artisan' | 'admin' | 'guest' }> {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token || !mission) return { viewer_id: null, viewer_role: 'guest' }

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user } } = await userClient.auth.getUser(token)
  if (!user) return { viewer_id: null, viewer_role: 'guest' }

  // Le client de la mission l'emporte : un compte à la fois client et artisan
  // reste client sur SA propre demande.
  if (mission.client_id === user.id) return { viewer_id: user.id, viewer_role: 'client' }
  if ((mission.artisan_pros as any)?.user_id === user.id) return { viewer_id: user.id, viewer_role: 'artisan' }

  const { data: profil } = await supabaseAdmin
    .from('users').select('role').eq('id', user.id).maybeSingle()

  if (profil?.role === 'admin') return { viewer_id: user.id, viewer_role: 'admin' }

  // Un artisan qui consulte une mission pas encore attribuée : il n'en est pas
  // le client pour autant.
  if (profil?.role === 'artisan') return { viewer_id: user.id, viewer_role: 'artisan' }

  return { viewer_id: user.id, viewer_role: 'guest' }
}


// GET — récupère les données du diagnostic pour affichage dans la warroom
export async function GET(req: NextRequest) {
  const mission_id = req.nextUrl.searchParams.get('mission_id')
  if (!mission_id) return NextResponse.json({ diag: null })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[mission-brief] SUPABASE_SERVICE_ROLE_KEY manquant — RLS bloquera les lectures')
  }

  // Récupérer le diagnostic + les participants de la mission (supabaseAdmin bypass RLS)
  const [{ data: diag }, { data: mission }] = await Promise.all([
    supabaseAdmin.from('diagnostics').select('*').eq('mission_id', mission_id).maybeSingle(),
    supabaseAdmin
      .from('missions')
      .select('client_id, artisan_id, artisan_pros(user_id, metier), users!missions_client_id_fkey(name, avatar_url)')
      .eq('id', mission_id)
      .maybeSingle(),
  ])

  // Nom + avatar artisan via user_id (bypass RLS)
  let artisanUser: { name: string | null; avatar_url: string | null } = { name: null, avatar_url: null }
  const artisanUserId = (mission?.artisan_pros as any)?.user_id
  if (artisanUserId) {
    const { data: au } = await supabaseAdmin.from('users').select('name, avatar_url').eq('id', artisanUserId).maybeSingle()
    if (au) artisanUser = au
  }

  const clientUser = (mission as any)?.users as { name: string | null; avatar_url: string | null } | null

  const participants = {
    client:  { name: clientUser?.name  || null, avatar_url: clientUser?.avatar_url  || null },
    artisan: { name: artisanUser.name  || null, avatar_url: artisanUser.avatar_url  || null, metier: (mission?.artisan_pros as any)?.metier || null },
  }

  const viewer = await resolveViewerRole(req, mission as any)

  if (!diag) return NextResponse.json({ diag: null, participants, ...viewer })

  let rawCtx: any = {}
  try { rawCtx = JSON.parse(diag.raw_text || '{}') } catch {}

  return NextResponse.json({
    diag: {
      ai_summary:        diag.ai_summary,
      technical_notes:   rawCtx.technical_notes || diag.ai_summary || '',
      category:          diag.category_detected,
      urgency:           diag.urgency_level,
      price_min:         diag.estimated_price_min,
      price_max:         diag.estimated_price_max,
      items_needed:      diag.items_needed || [],
      duration_estimate: rawCtx.duration_estimate || '',
      photos:            rawCtx.photos || [],
      afrione_pricing:   rawCtx.afrione_pricing || null,
    },
    participants,
    ...viewer,
  })
}
