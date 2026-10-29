import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveMissionViewer } from '@/lib/mission-auth'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'
const schema = z.object({
  mission_id: z.string().uuid(), version: z.number().int().min(0),
  action: z.enum(['confirm','propose','accept','reject']),
  payload: z.object({ scope: z.string().trim().min(10).max(4000).optional(), reason: z.string().trim().min(10).max(2000).optional(),
    amount: z.number().int().min(1).max(100000000).optional(), supplies: z.enum(['included','excluded']).optional(), discussion: z.boolean().optional() }).strict(),
}).strict()
export async function GET(req: NextRequest) {
  const resolved = await resolveMissionViewer(req, req.nextUrl.searchParams.get('mission_id'))
  if (!resolved.ok) return resolved.res
  const { data, error } = await supabaseAdmin.from('discussion_agreements').select('*').eq('mission_id',resolved.viewer.mission.id).maybeSingle()
  if (error) return NextResponse.json({error:'Accord indisponible'}, {status:503})
  return NextResponse.json({agreement:data}, {headers:{'Cache-Control':'private, no-store'}})
}
export async function POST(req: NextRequest) {
  const parsed=schema.safeParse(await req.json().catch(()=>null))
  if (!parsed.success) return NextResponse.json({error:'Vérifiez le périmètre, la justification et le montant.'},{status:400})
  const body=parsed.data
  const resolved=await resolveMissionViewer(req,body.mission_id)
  if (!resolved.ok) return resolved.res
  if (resolved.viewer.role!==(body.action==='propose'?'artisan':'client')) return NextResponse.json({error:'Action réservée à l’autre participant.'},{status:403})
  const p=body.payload
  if ((body.action==='confirm'&&(!p.scope||p.discussion===undefined)) || (body.action==='propose'&&(!p.scope||!p.reason||!p.amount||!p.supplies))) return NextResponse.json({error:'Informations obligatoires manquantes.'},{status:400})
  const {data,error}=await supabaseAdmin.rpc('update_discussion_agreement',{mid:body.mission_id,actor:resolved.viewer.userId,operation:body.action,expected:body.version,payload:p})
  if(error) return NextResponse.json({error:error.message},{status:409})
  return NextResponse.json({agreement:data})
}
