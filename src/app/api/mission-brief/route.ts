import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET — récupère les données du diagnostic pour affichage dans la warroom
export async function GET(req: NextRequest) {
  const mission_id = req.nextUrl.searchParams.get('mission_id')
  if (!mission_id) return NextResponse.json({ diag: null })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[mission-brief] SUPABASE_SERVICE_ROLE_KEY manquant — RLS bloquera les lectures')
  }

  const { data: diag } = await supabaseAdmin
    .from('diagnostics')
    .select('*')
    .eq('mission_id', mission_id)
    .maybeSingle()

  if (!diag) return NextResponse.json({ diag: null })

  let rawCtx: any = {}
  try { rawCtx = JSON.parse(diag.raw_text || '{}') } catch {}

  return NextResponse.json({
    diag: {
      ai_summary:      diag.ai_summary,
      technical_notes: rawCtx.technical_notes || diag.ai_summary || '',
      category:        diag.category_detected,
      urgency:         diag.urgency_level,
      price_min:       diag.estimated_price_min,
      price_max:       diag.estimated_price_max,
      items_needed:    diag.items_needed || [],
      duration_estimate: rawCtx.duration_estimate || '',
      photos:          rawCtx.photos || [],
    },
  })
}
