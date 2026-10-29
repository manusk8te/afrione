import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {requireAdmin} from '@/lib/admin-auth'
import {authenticate} from '@/lib/mission-auth'
import {supabaseAdmin} from '@/lib/supabase'
import {CATALOGUES,collectCatalogue} from '@/lib/material-sourcing/public-catalogues.mjs'
import {saveCatalogueReview} from '@/lib/material-sourcing/save-review'
export const dynamic='force-dynamic'
export const maxDuration=120
export async function POST(req:NextRequest){
 const allowed=await requireAdmin(req);if(!allowed.ok)return allowed.res
 const actor=await authenticate(req);if(!actor)return NextResponse.json({error:'Connexion requise'},{status:401})
 try{
 const parsed=z.object({source_id:z.string().uuid()}).strict().safeParse(await req.json())
 if(!parsed.success)return NextResponse.json({error:'Source invalide'},{status:400})
 const {data:source,error}=await supabaseAdmin.from('price_sources').select('id,name,url').eq('id',parsed.data.source_id).maybeSingle()
 if(error||!source)return NextResponse.json({error:'Source introuvable'},{status:404})
 const host=new URL(source.url??'').hostname
 if(!Object.hasOwn(CATALOGUES,host))return NextResponse.json({error:'Cette source nécessite un relevé manuel.'},{status:400})
 const report=await collectCatalogue(host)
 const result=await saveCatalogueReview(supabaseAdmin,source,actor.userId,report)
 return NextResponse.json({ok:true,...result,failed:report.failures.length,failures:report.failures,review_status:'pending_review',summary:`${result.saved} relevé(s) réel(s) ajouté(s) à contrôler · ${result.unchanged} inchangé(s) · ${report.failures.length} fiche(s) non exploitable(s).`})
 }catch{return NextResponse.json({error:'La collecte n’a pas abouti. Aucun prix de remplacement n’est inventé.'},{status:503})}
}
