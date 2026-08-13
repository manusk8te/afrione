import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveMissionViewer } from '@/lib/mission-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/mission-brief?mission_id=…
 *
 * Diagnostic + participants + rôle du visiteur DANS cette mission.
 *
 * Deux corrections majeures par rapport à la version précédente :
 *
 * 1. La route composait sa réponse — diagnostic complet, notes techniques,
 *    fourchette de prix, photos du client, noms et avatars des deux parties —
 *    AVANT tout contrôle, et la renvoyait même sans token. Un UUID de mission
 *    suffisait à tout lire. Le contrôle vient maintenant en premier.
 *
 * 2. Le rôle renvoyé retombait sur `artisan` dès que le profil du demandeur
 *    portait `users.role = 'artisan'`, sans vérifier qu'il était l'artisan de
 *    CETTE mission. N'importe quel compte artisan héritait donc de l'écran
 *    prestataire — « Démarrer le suivi GPS » compris — sur les missions des
 *    autres. Le rôle vient maintenant de `resolveMissionRole`, qui n'a plus
 *    de repli sur le profil global.
 */
export async function GET(req: NextRequest) {
  const mission_id = req.nextUrl.searchParams.get('mission_id')

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[mission-brief] SUPABASE_SERVICE_ROLE_KEY manquant — RLS bloquera les lectures')
  }

  const resolved = await resolveMissionViewer(req, mission_id)
  if (!resolved.ok) return resolved.res
  const { viewer } = resolved

  const [{ data: diag }, { data: clientUser }, { data: artisanUser }, { data: artisanPro }] = await Promise.all([
    supabaseAdmin.from('diagnostics').select('*').eq('mission_id', viewer.mission.id).maybeSingle(),
    viewer.mission.client_id
      ? supabaseAdmin.from('users').select('name, avatar_url').eq('id', viewer.mission.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    viewer.mission.artisan_user_id
      ? supabaseAdmin.from('users').select('name, avatar_url').eq('id', viewer.mission.artisan_user_id).maybeSingle()
      : Promise.resolve({ data: null }),
    viewer.mission.artisan_id
      ? supabaseAdmin.from('artisan_pros').select('metier').eq('id', viewer.mission.artisan_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const participants = {
    client:  { name: clientUser?.name  ?? null, avatar_url: clientUser?.avatar_url  ?? null },
    artisan: { name: artisanUser?.name ?? null, avatar_url: artisanUser?.avatar_url ?? null, metier: artisanPro?.metier ?? null },
  }

  const viewerPayload = {
    viewer_id:   viewer.userId,
    viewer_role: viewer.role,
    status:      viewer.mission.status,
  }

  if (!diag) return NextResponse.json({ diag: null, participants, ...viewerPayload })

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
    ...viewerPayload,
  })
}
