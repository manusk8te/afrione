import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {authenticate,resolveMissionViewer} from '@/lib/mission-auth'
import {supabaseAdmin} from '@/lib/supabase'
export const dynamic='force-dynamic'
const input=z.object({mission_id:z.string().uuid().optional(),action:z.enum(['request_provider','accept_assignment','reject_assignment','pay_test','schedule','start_now','start_tracking','arrived','confirm_arrival','done','dispute','validate','cancel']),artisan_id:z.string().uuid().optional(),request_id:z.string().uuid().optional(),quartier:z.string().trim().max(100).optional(),scheduled_at:z.string().datetime({offset:true}).optional(),reason:z.string().trim().min(10).max(2000).optional(),quote_revision:z.string().regex(/^[a-f0-9]{32}$/).optional()}).strict()
export async function GET(req:NextRequest){
 const access=await resolveMissionViewer(req,req.nextUrl.searchParams.get('mission_id'));if(!access.ok)return access.res
 const [mission,events]=await Promise.all([supabaseAdmin.from('missions').select('id,status,artisan_id,total_price,scheduled_at,started_at,completed_at,logic_version,is_test,provider_accepted_at,artisan_arrived_at,client_arrival_confirmed_at,price_confirmed_version,workflow_revision').eq('id',access.viewer.mission.id).single(),supabaseAdmin.from('mission_events').select('id,action,previous_status,next_status,details,created_at').eq('mission_id',access.viewer.mission.id).order('created_at',{ascending:true}).limit(100)])
 if(mission.error||events.error)return NextResponse.json({error:'Suivi indisponible'},{status:503})
 return NextResponse.json({mission:mission.data,events:events.data},{headers:{'Cache-Control':'private, no-store'}})
}
export async function POST(req:NextRequest){
 const p=input.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:'Action ou informations invalides'},{status:400})
 const identity=await authenticate(req);if(!identity)return NextResponse.json({error:'Non authentifié'},{status:401})
 const b=p.data;if(!b.mission_id&&b.action!=='request_provider')return NextResponse.json({error:'Mission requise'},{status:400})
 if(b.action==='request_provider'&&!b.artisan_id)return NextResponse.json({error:'Prestataire requis'},{status:400})
 const {data,error}=await supabaseAdmin.rpc('mission_workflow_action',{mid:b.mission_id??null,actor:identity.userId,operation:b.action,payload:{artisan_id:b.artisan_id,request_id:b.request_id,quartier:b.quartier,scheduled_at:b.scheduled_at,reason:b.reason,quote_revision:b.quote_revision}})
 if(error)return NextResponse.json({error:error.message},{status:409})
 return NextResponse.json({ok:true,mission:data,status:data.status,simulation:!!data.is_test,payment_notice:['validate','cancel'].includes(b.action)?'La validation de la mission ne constitue pas une confirmation de versement ou de remboursement bancaire.':undefined})
}
