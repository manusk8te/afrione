import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {resolveMissionViewer} from '@/lib/mission-auth'
import {supabaseAdmin} from '@/lib/supabase'
export const dynamic='force-dynamic'
const input=z.object({mission_id:z.string().uuid(),photos:z.array(z.string().url()).min(1).max(10),notes:z.string().trim().min(10).max(4000)}).strict()
export async function POST(req:NextRequest){
 const parsed=input.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Photo de fin et compte rendu détaillé requis'},{status:400})
 const b=parsed.data,access=await resolveMissionViewer(req,b.mission_id);if(!access.ok)return access.res
 if(access.viewer.role!=='artisan'||access.viewer.mission.status!=='en_cours')return NextResponse.json({error:'Preuves réservées au prestataire pendant les travaux'},{status:403})
 const prefix=`/storage/v1/object/public/portfolio/proof/${b.mission_id}/`,host=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host
 const names:string[]=[]
 for(const photo of b.photos){const u=new URL(photo);if(u.protocol!=='https:'||u.host!==host||!u.pathname.startsWith(prefix)||u.search||u.hash||u.pathname.slice(prefix.length).includes('/'))return NextResponse.json({error:'Utilisez les photos téléversées pour cette mission'},{status:400});names.push(decodeURIComponent(u.pathname.slice(prefix.length)))}
 const objects=await supabaseAdmin.storage.from('portfolio').list(`proof/${b.mission_id}`,{limit:100})
 if(objects.error||names.some(name=>!objects.data?.some(object=>object.name===name&&object.id)))return NextResponse.json({error:'Une photo n’a pas été enregistrée. Téléversez-la à nouveau.'},{status:409})
 const {data,error}=await supabaseAdmin.rpc('mission_workflow_action',{mid:b.mission_id,actor:access.viewer.userId,operation:'submit_proof',payload:{photos:b.photos,notes:b.notes}})
 if(error)return NextResponse.json({error:error.message},{status:409})
 return NextResponse.json({ok:true,mission:data})
}
