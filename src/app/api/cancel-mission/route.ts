import {NextRequest} from 'next/server'
import {POST as workflow} from '../mission/workflow/route'
export const dynamic='force-dynamic'
export async function POST(req:NextRequest){const b=await req.json().catch(()=>({}));return workflow(new NextRequest(req.url,{method:'POST',headers:req.headers,body:JSON.stringify({mission_id:b.mission_id,action:'cancel'})}))}
