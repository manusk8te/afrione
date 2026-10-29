import {NextRequest,NextResponse} from 'next/server'
import {authenticate} from '@/lib/mission-auth'
import {supabaseAdmin} from '@/lib/supabase'
export async function GET(req:NextRequest){const user=await authenticate(req);if(!user)return NextResponse.json({error:'Connexion requise'},{status:401})
 const {data,error}=await supabaseAdmin.from('missions').select('id,category,status,created_at,total_price,diagnostics(ai_summary),quote_requests(status)').eq('client_id',user.userId).order('created_at',{ascending:false}).limit(40)
 return NextResponse.json(error?{error:'Demandes indisponibles'}:{missions:data??[]},{status:error?503:200,headers:{'Cache-Control':'private, no-store'}})
}
