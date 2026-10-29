import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveMissionViewer } from './mission-auth'
import { supabaseAdmin } from './supabase'
const input = z.object({ mission_id: z.string().uuid(), amount: z.number().int().positive().max(2147483647).optional() }).strict()
export async function simulatePayment(req: NextRequest) {
 try {
  const parsed = input.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Mission et montant invalides' }, { status: 400 })
  const resolved = await resolveMissionViewer(req, parsed.data.mission_id)
  if (!resolved.ok) return resolved.res
  const { viewer } = resolved
  if (viewer.mission.client_id !== viewer.userId) return NextResponse.json({error:'Seul le client de cette mission peut simuler son paiement'},{status:403})
  const { data, error } = await supabaseAdmin.rpc('simulate_client_payment', {
   p_mission_id: parsed.data.mission_id, p_client_id: viewer.userId, p_expected_amount: parsed.data.amount ?? null,
  })
  if (error || !data) {
   const known = /quote_required|quote_changed|mission_not_payable|mission_not_owned/.test(error?.message ?? '')
   return NextResponse.json({error: known ? 'Le devis ou la mission a changé. Revenez au diagnostic pour confirmer le prix.' : 'La simulation n’a pas pu être enregistrée. Réessayez.'}, {status:known ? 409 : 500})
  }
  return NextResponse.json({ok:true,simulation:true,receipt:data})
 } catch { return NextResponse.json({error:'Demande de simulation invalide'},{status:400}) }
}
export async function getPaymentReceipt(req: NextRequest) {
 const id=req.nextUrl.searchParams.get('mission_id')
 const resolved=await resolveMissionViewer(req,id)
 if(!resolved.ok)return resolved.res
 if(resolved.viewer.mission.client_id!==resolved.viewer.userId)return NextResponse.json({error:'Accès réservé au client'},{status:403})
 const {data,error}=await supabaseAdmin.from('payment_simulations').select('id,mission_id,amount,created_at,quote_snapshot').eq('mission_id',id).maybeSingle()
 if(error)return NextResponse.json({error:'Reçu indisponible'},{status:500})
 if(!data)return NextResponse.json({error:'Aucune simulation enregistrée'},{status:404})
 return NextResponse.json({simulation:true,receipt:data})
}
