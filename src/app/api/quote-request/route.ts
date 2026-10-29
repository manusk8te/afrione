import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {resolveMissionViewer} from '@/lib/mission-auth'
import {supabaseAdmin} from '@/lib/supabase'
export async function POST(req:NextRequest){try{
 const parsed=z.object({mission_id:z.string().uuid(),notes:z.string().trim().max(1500).default('')}).strict().safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:'Demande invalide'},{status:400})
 const a=await resolveMissionViewer(req,parsed.data.mission_id);if(!a.ok)return a.res
 if(a.viewer.userId!==a.viewer.mission.client_id)return NextResponse.json({error:'Demande réservée au client'},{status:403})
 if(!['diagnostic','matching','negotiation'].includes(a.viewer.mission.status))return NextResponse.json({error:'Mission non modifiable'},{status:409})
 const {data,error}=await supabaseAdmin.from('quote_requests').upsert({...parsed.data,client_id:a.viewer.userId,status:'requested'},{onConflict:'mission_id'}).select().single()
 if(error)throw error;return NextResponse.json({ok:true,request:data,note:'Demande de devis enregistrée. Aucun prestataire n’a encore accepté ; aucun paiement demandé.'})
}catch{return NextResponse.json({error:'Demande non enregistrée, réessayez.'},{status:503})}}
