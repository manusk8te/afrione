import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Persiste le résultat de l'agent de pricing dans raw_text du diagnostic.
// Appelé en fire-and-forget depuis le client après le calcul du prix au diagnostic.
export async function POST(req: NextRequest) {
  const { mission_id, pricing } = await req.json()
  if (!mission_id || !pricing) return NextResponse.json({ ok: false })

  const { data: diag } = await supabaseAdmin
    .from('diagnostics')
    .select('id, raw_text, estimated_price_min, estimated_price_max')
    .eq('mission_id', mission_id)
    .maybeSingle()

  if (!diag) return NextResponse.json({ ok: false, reason: 'no diagnostic' })

  let rawCtx: any = {}
  try { rawCtx = JSON.parse(diag.raw_text || '{}') } catch {}

  rawCtx.afrione_pricing = pricing

  await supabaseAdmin
    .from('diagnostics')
    .update({
      raw_text:            JSON.stringify(rawCtx),
      estimated_price_min: pricing.estimate,
      estimated_price_max: pricing.estimate,
    })
    .eq('id', diag.id)

  return NextResponse.json({ ok: true })
}
