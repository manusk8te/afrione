import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveMissionViewer } from '@/lib/mission-auth'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'
const schema = z.object({
  mission_id: z.string().uuid(), version: z.number().int().min(0),
  action: z.enum(['confirm','propose','accept','reject','counter','accept_counter','add_adjustment','approve_adjustment','reject_adjustment','propose_adjusted']),
  payload: z.object({ scope: z.string().trim().min(10).max(4000).optional(), reason: z.string().trim().min(10).max(2000).optional(),
    amount: z.number().int().min(0).max(100000000).optional(), supplies: z.enum(['included','excluded']).optional(), discussion: z.boolean().optional(),
    kind: z.enum(['diagnostic','material','time']).optional(), label: z.string().trim().min(3).max(120).optional(),
    quantity: z.number().int().min(1).max(100).optional(), minutes: z.number().int().min(0).max(1440).optional(),
    adjustment_id: z.string().uuid().optional(), base_amount: z.number().int().min(1).max(2000000).optional(),
    expected_total: z.number().int().min(1).max(2000000).optional() }).strict(),
}).strict()
export async function GET(req: NextRequest) {
  const resolved = await resolveMissionViewer(req, req.nextUrl.searchParams.get('mission_id'))
  if (!resolved.ok) return resolved.res
  const mid = resolved.viewer.mission.id
  const [agreement, adjustments, mission, quote] = await Promise.all([
    supabaseAdmin.from('discussion_agreements').select('*').eq('mission_id',mid).maybeSingle(),
    supabaseAdmin.from('mission_quote_adjustments').select('id,kind,label,reason,quantity,minutes,amount,status,created_at').eq('mission_id',mid).order('created_at').order('id'),
    supabaseAdmin.from('missions').select('total_price').eq('id',mid).single(),
    supabaseAdmin.rpc('get_client_quote',{p_mission_id:mid,p_client_id:resolved.viewer.mission.client_id}),
  ])
  if (agreement.error || adjustments.error || mission.error) return NextResponse.json({error:'Accord indisponible'}, {status:503})
  return NextResponse.json({agreement:agreement.data,adjustments:adjustments.data,base:mission.data.total_price,materials:quote.data?.materials_total??0}, {headers:{'Cache-Control':'private, no-store'}})
}
export async function POST(req: NextRequest) {
  const parsed=schema.safeParse(await req.json().catch(()=>null))
  if (!parsed.success) return NextResponse.json({error:'Vérifiez le périmètre, la justification et le montant.'},{status:400})
  const body=parsed.data
  const resolved=await resolveMissionViewer(req,body.mission_id)
  if (!resolved.ok) return resolved.res
  if (!(['propose','accept_counter','add_adjustment','propose_adjusted'].includes(body.action)?['artisan']:body.action==='reject'?['client','artisan']:['client']).includes(resolved.viewer.role)) return NextResponse.json({error:'Action réservée à l’autre participant.'},{status:403})
  const p=body.payload
  if ((body.action==='confirm'&&(!p.scope||p.discussion===undefined)) || (['propose','counter'].includes(body.action)&&(!p.scope||!p.reason||!p.amount||!p.supplies))) return NextResponse.json({error:'Informations obligatoires manquantes.'},{status:400})
  if (body.action==='add_adjustment' && (!p.kind || !p.label || !p.reason || p.reason.length>600)) return NextResponse.json({error:'Décrivez et justifiez l’ajustement.'},{status:400})
  if (['approve_adjustment','reject_adjustment'].includes(body.action) && !p.adjustment_id) return NextResponse.json({error:'Ajustement requis.'},{status:400})
  if (body.action==='propose_adjusted' && (!p.expected_total || !p.reason)) return NextResponse.json({error:'Vérifiez le total et la note du devis.'},{status:400})
  const {data,error}=await supabaseAdmin.rpc('change_mission_quote',{mid:body.mission_id,actor:resolved.viewer.userId,operation:body.action,expected:body.version,payload:p})
  if(error) return NextResponse.json({error:error.message},{status:409})
  return NextResponse.json({agreement:data})
}
