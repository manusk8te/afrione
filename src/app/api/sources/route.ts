import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { authenticate } from '@/lib/mission-auth'
export const dynamic = 'force-dynamic'
const positive=z.number().positive().finite().max(2147483647)
const webUrl=z.string().url().refine(v=>v.startsWith('https://'),'Utilisez un lien HTTPS')
const observation=z.object({source_id:z.string().uuid(),name:z.string().trim().min(2).max(180),category:z.string().trim().min(2).max(80),unit:z.string().trim().min(1).max(40),price_observed:positive.int(),observed_quantity:positive.max(100000).default(1),observed_at:z.string().refine(v=>Number.isFinite(Date.parse(v)),'Date invalide'),evidence_url:webUrl.nullish(),source_url:webUrl.nullish(),stock_status:z.enum(['available','unavailable','unknown']).default('unknown')})
async function caller(req:NextRequest){const identity=await authenticate(req);if(!identity)return null;const {data}=await supabaseAdmin.from('users').select('role').eq('id',identity.userId).maybeSingle();return {...identity,admin:data?.role==='admin',artisan:data?.role==='artisan'}}
export async function GET(req:NextRequest){
 const user=await caller(req);if(!user)return NextResponse.json({error:'Connexion requise'},{status:401})
 const id=req.nextUrl.searchParams.get('source_id')
 if(id){
  if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:'Source invalide'},{status:400})
  const fields='id,name,category,unit,tier,price_market,price_min,price_max,web_price,brand,photo_url,source_url,added_by,confirmed_at,last_scraped_at,observed_at,observed_price_total,observed_quantity,stock_status,price_provenance'+(user.admin?',evidence_url':'')
  const {data,error}=await supabaseAdmin.from('price_materials').select(fields).eq('source_id',id).order('observed_at',{ascending:false,nullsFirst:false})
  return NextResponse.json(error?{error:'Catalogue indisponible'}:data??[],{status:error?500:200})
 }
 let query=supabaseAdmin.from('price_sources').select('id,name,type,url,quartier,verified,scraper_type,notes,created_at,is_partner,access_status,access_checked_at').is('archived_at',null).order('verified',{ascending:false}).order('created_at',{ascending:false})
 const type=req.nextUrl.searchParams.get('type');if(type && ['website','magasin'].includes(type))query=query.eq('type',type)
 const {data,error}=await query;return NextResponse.json(error?{error:'Sources indisponibles'}:data??[],{status:error?500:200})
}
export async function POST(req:NextRequest){
 try{
  const user=await caller(req);if(!user)return NextResponse.json({error:'Connexion requise'},{status:401})
  const body=await req.json();const action=body.action
  const moderation=['verify_source','delete_source','confirm_material','set_partner']
  if(moderation.includes(action)&&!user.admin)return NextResponse.json({error:'Validation réservée à AfriOne'},{status:403})
  if(!user.admin&&!user.artisan)return NextResponse.json({error:'Réservé aux artisans et à la modération'},{status:403})
  if(action==='add_source'){
   const parsed=z.object({name:z.string().trim().min(2).max(150),type:z.enum(['website','magasin']),url:webUrl.nullish(),quartier:z.string().max(100).nullish(),notes:z.string().max(1000).nullish()}).safeParse(body)
   if(!parsed.success)return NextResponse.json({error:'Renseignez le magasin et son adresse ou site'},{status:400})
   if(parsed.data.type==='website'&&(!user.admin||!parsed.data.url))return NextResponse.json({error:'Ajout de sites réservé à AfriOne'},{status:403})
   const {data,error}=await supabaseAdmin.from('price_sources').insert({...parsed.data,added_by:user.userId,verified:false,is_partner:false,scraper_type:'manual'}).select().single()
   if(error)throw error;return NextResponse.json({ok:true,source:data})
  }
  if(action==='add_material'){
   const parsed=observation.safeParse(body);if(!parsed.success)return NextResponse.json({error:'Renseignez un prix positif, une unité, la quantité couverte et la date du relevé.'},{status:400})
   const value=parsed.data;const date=Date.parse(value.observed_at)
   if(date>Date.now()+86400000)return NextResponse.json({error:'La date du relevé ne peut pas être future'},{status:400})
   const {data:source}=await supabaseAdmin.from('price_sources').select('id,name,is_partner,type,quartier').eq('id',value.source_id).maybeSingle()
   if(!source)return NextResponse.json({error:'Magasin introuvable'},{status:404})
   const provenance=user.admin&&body.price_provenance==='partner_catalogue'&&source.is_partner?'partner_catalogue':user.admin&&value.source_url?'web_observation':user.admin?'internal_declaration':'artisan_declaration'
   const unitPrice=Math.round(value.price_observed/value.observed_quantity)
   if(unitPrice<1)return NextResponse.json({error:'Prix unitaire trop faible'},{status:400})
   // Un relevé crée une nouvelle observation et ne remplace jamais un prix déjà contrôlé.
   const {data,error}=await supabaseAdmin.from('price_materials').insert({name:value.name,category:value.category,unit:value.unit,tier:'standard',price_market:unitPrice,price_min:unitPrice,price_max:unitPrice,observed_price_total:value.price_observed,observed_quantity:value.observed_quantity,observed_at:new Date(date).toISOString(),evidence_url:value.evidence_url??null,source_url:value.source_url??null,stock_status:value.stock_status,source:source.name,source_id:source.id,vendor_quartier:source.quartier,added_by:user.userId,confirmed_at:null,confirmed_by:null,price_provenance:provenance}).select().single()
   if(error)throw error;return NextResponse.json({ok:true,material:data,status:'pending_review'})
  }
  const id=z.string().uuid().safeParse(body.id);if(!id.success)return NextResponse.json({error:'Identifiant invalide'},{status:400})
  let query
  if(action==='verify_source')query=supabaseAdmin.from('price_sources').update({verified:true}).eq('id',id.data)
  else if(action==='set_partner'){
   if(body.is_partner===true && (typeof body.partnership_reference!=='string'||body.partnership_reference.trim().length<5))return NextResponse.json({error:'Indiquez la référence de l’accord existant avant de déclarer un partenariat.'},{status:400})
   query=supabaseAdmin.from('price_sources').update({is_partner:body.is_partner===true,partnership_reference:body.is_partner?body.partnership_reference.trim():null}).eq('id',id.data)
  } else if(action==='confirm_material'){
   const {data:row}=await supabaseAdmin.from('price_materials').select('observed_at,evidence_url,source_url,price_market').eq('id',id.data).maybeSingle()
   if(!row?.observed_at || (!row.evidence_url&&!row.source_url))return NextResponse.json({error:'Une date et un justificatif ou un lien produit sont requis pour valider le relevé.'},{status:400})
   if(Date.now()-Date.parse(row.observed_at)>30*86400000)return NextResponse.json({error:'Relevé ancien : demandez un nouveau prix daté.'},{status:400})
   query=supabaseAdmin.from('price_materials').update({confirmed_at:new Date().toISOString(),confirmed_by:user.userId}).eq('id',id.data)
  } else if(action==='delete_source')return NextResponse.json({error:'Conservez l’historique : la suppression d’une source n’est pas proposée.'},{status:409})
  else return NextResponse.json({error:'Action inconnue'},{status:400})
  const {data,error}=await query.select('id').maybeSingle();if(error)throw error;if(!data)return NextResponse.json({error:'Enregistrement introuvable'},{status:404})
  return NextResponse.json({ok:true})
 }catch{return NextResponse.json({error:'L’enregistrement n’a pas abouti. Réessayez.'},{status:500})}
}
