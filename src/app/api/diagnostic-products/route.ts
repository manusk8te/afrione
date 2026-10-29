import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {resolveMissionViewer} from '@/lib/mission-auth'
import {supabaseAdmin} from '@/lib/supabase'
import {lookupMaterialOffers} from '@/lib/material-sourcing/lookup'
import {productMatches} from '@/lib/material-sourcing/on-demand.mjs'
export const dynamic='force-dynamic'
export const maxDuration=30
const identity=z.object({mission_id:z.string().uuid(),item:z.string().trim().min(2).max(150)})
const input=z.discriminatedUnion('action',[
 identity.extend({action:z.literal('select'),query:z.string().trim().min(2).max(120),offer_url:z.string().url(),quantity:z.number().int().min(1).max(100000).default(1)}).strict(),
 identity.extend({action:z.literal('remove')}).strict(),
])
export async function GET(req:NextRequest){
 const id=req.nextUrl.searchParams.get('mission_id');const access=await resolveMissionViewer(req,id);if(!access.ok)return access.res
 const {data,error}=await supabaseAdmin.from('diagnostic_product_selections').select('*').eq('mission_id',id).order('selected_at')
 return NextResponse.json(error?{error:'Choix de fournitures indisponibles'}:{products:data??[]},{status:error?503:200,headers:{'Cache-Control':'private, no-store'}})
}
export async function POST(req:NextRequest){try{
 const parsed=input.safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:'Sélection invalide'},{status:400})
 const body=parsed.data;const access=await resolveMissionViewer(req,body.mission_id);if(!access.ok)return access.res
 if(access.viewer.userId!==access.viewer.mission.client_id)return NextResponse.json({error:'Seul le client choisit les fournitures de sa demande.'},{status:403})
 if(!['diagnostic','matching','negotiation'].includes(access.viewer.mission.status))return NextResponse.json({error:'Cette mission ne peut plus être modifiée.'},{status:409})
 if(body.action==='remove'){
  const {error}=await supabaseAdmin.from('diagnostic_product_selections').delete().eq('mission_id',body.mission_id).eq('item',body.item)
  if(error)throw error;return NextResponse.json({ok:true})
 }
 const {data:diag,error:diagError}=await supabaseAdmin.from('diagnostics').select('items_needed').eq('mission_id',body.mission_id).maybeSingle()
 if(diagError||!diag)return NextResponse.json({error:'Diagnostic introuvable'},{status:404})
 if(!Array.isArray(diag.items_needed)||!diag.items_needed.includes(body.item)||!productMatches(body.item,body.query))return NextResponse.json({error:'Cette recherche ne correspond pas à une fourniture du diagnostic.'},{status:400})
 const result=await lookupMaterialOffers(body.query)
 const offer=result.offers.find(p=>p.source_url===body.offer_url)
 if(!offer)return NextResponse.json({error:'Offre non retrouvée ou périmée. Relancez la recherche.'},{status:409})
 const {data,error}=await supabaseAdmin.from('diagnostic_product_selections').upsert({mission_id:body.mission_id,item:body.item,query:body.query,quantity:body.quantity,offer:{...offer,compatibility_status:'to_confirm',included_in_service_price:false},selected_by:access.viewer.userId,selected_at:new Date().toISOString()},{onConflict:'mission_id,item'}).select().single()
 if(error)throw error
 return NextResponse.json({ok:true,product:data,note:'Référence ajoutée au diagnostic, sans achat ni ajout au prix de prestation.'})
}catch{return NextResponse.json({error:'Le choix n’a pas pu être enregistré. Réessayez.'},{status:503})}}
