import {NextRequest,NextResponse} from 'next/server'
import {resolveMissionViewer} from '@/lib/mission-auth'
import {supabaseAdmin} from '@/lib/supabase'
import {describeSupplies} from '@/lib/supplies'
export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
 const id=req.nextUrl.searchParams.get('mission_id');const resolved=await resolveMissionViewer(req,id)
 if(!resolved.ok)return resolved.res
 if(resolved.viewer.mission.client_id!==resolved.viewer.userId)return NextResponse.json({error:'Devis réservé au client de cette mission'},{status:403})
 const [{data:mission,error:mError},{data:diag,error:dError}]=await Promise.all([supabaseAdmin.from('missions').select('total_price').eq('id',id).maybeSingle(),supabaseAdmin.from('diagnostics').select('raw_text').eq('mission_id',id).maybeSingle()])
 if(mError||dError)return NextResponse.json({error:'Devis indisponible'},{status:503})
 if(!mission?.total_price||!diag)return NextResponse.json({error:'Revenez au diagnostic pour confirmer le prix de votre demande.'},{status:409})
 let raw:any={};try{raw=JSON.parse(diag.raw_text||'{}')}catch{}
 const sources=raw.afrione_pricing?.price_context?.sources??[]
 const {data:products,error:productError}=await supabaseAdmin.from('diagnostic_product_selections').select('id,item,quantity,offer,selected_at').eq('mission_id',id)
 if(productError)return NextResponse.json({error:'Choix de fournitures indisponibles'},{status:503})
 return NextResponse.json({selected_products:products??[],total:mission.total_price,sources,supplies:describeSupplies(sources),indicative:true})
}
