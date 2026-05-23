import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'


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

  if (!diag) return NextResponse.json({ diag: null, participants })

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
  })
}
