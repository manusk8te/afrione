import {NextRequest,NextResponse} from 'next/server'
import {resolveMissionViewer} from '@/lib/mission-auth'
import {supabaseAdmin} from '@/lib/supabase'
import {describeSupplies} from '@/lib/supplies'
export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
 const id=req.nextUrl.searchParams.get('mission_id');const access=await resolveMissionViewer(req,id);if(!access.ok)return access.res
 if(access.viewer.userId!==access.viewer.mission.client_id)return NextResponse.json({error:'Devis réservé au client'},{status:403})
 const {data:quoteRequest}=await supabaseAdmin.from('quote_requests').select('id,status,created_at').eq('mission_id',id).maybeSingle()
 const {data:receipt}=await supabaseAdmin.from('payment_simulations').select('id,amount,quote_snapshot').eq('mission_id',id).maybeSingle()
 if(receipt){const saved=receipt.quote_snapshot?.quote;return NextResponse.json({quote_request:quoteRequest??null,...saved,total:receipt.amount,service_total:saved?.service_total??receipt.amount,materials_total:saved?.materials_total??0,selected_products:saved?.selected_products??[],sources:saved?.sources??receipt.quote_snapshot?.price_context?.sources??[],needs_quote:false,payment_simulation_id:receipt.id},{headers:{'Cache-Control':'private, no-store'}})}
 const {data,error}=await supabaseAdmin.rpc('get_client_quote',{p_mission_id:id,p_client_id:access.viewer.userId})
 if(error||!data)return NextResponse.json({error:'Devis indisponible'},{status:503})
 return NextResponse.json({...data,quote_request:quoteRequest??null,supplies:describeSupplies(data.sources)},{headers:{'Cache-Control':'private, no-store'}})
}
