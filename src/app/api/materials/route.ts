import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { materialObservationUsable } from '@/lib/supplies'
import { normalizeMetier } from '@/lib/metier'
import { lookupItemOnJumia } from '@/lib/jumia-lookup'
export const dynamic='force-dynamic'
const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
function matches(name:string,row:any){const tokens=fold(name).split(/[^a-z0-9]+/).filter(t=>t.length>2&&!['pour','avec','sans','des','une','materiaux','standard'].includes(t));const text=fold(row.name+' '+row.category);return tokens.length>0&&tokens.every(t=>text.includes(t))}
async function observedRows(category:string){const {data,error}=await supabaseAdmin.from('price_materials').select('*').eq('category',normalizeMetier(category)??category).order('observed_at',{ascending:false,nullsFirst:false}).limit(500);if(error)throw error;return (data??[]).filter(r=>materialObservationUsable(r)&&r.stock_status!=='unavailable')}
function visible(row:any){return {...row,evidence_url:undefined,added_by:undefined,confirmed_by:undefined,source_kind:row.price_provenance,price_status:'observed',currency:'XOF',included_in_service_price:false}}
export async function GET(req:NextRequest){try{
 const category=req.nextUrl.searchParams.get('category')??'Plomberie';const items=(req.nextUrl.searchParams.get('items')??'').split(',').filter(Boolean).slice(0,20);const rows=await observedRows(category)
 const materials=items.map(name=>{const found=rows.filter(r=>matches(name,r));const tiers:any={economique:null,standard:null,premium:null};for(const row of found)if(!tiers[row.tier])tiers[row.tier]=visible(row);return {name,tiers,found:found.length>0}}).filter(x=>x.found)
 return NextResponse.json({category,market_reference_fcfa:null,materials,unpriced_items:items.filter(name=>!materials.some(m=>m.name===name)),note:'Prix observés et datés uniquement. Aucun prix inventé pour une gamme absente ; aucune addition automatique au tarif de prestation.'})
}catch{return NextResponse.json({error:'Catalogue indisponible',materials:[]},{status:503})}}
export async function POST(req:NextRequest){try{
 const {name,category}=await req.json();if(typeof name!=='string'||name.trim().length<2||name.length>150)return NextResponse.json({found:false},{status:400})
 const rows=await observedRows(typeof category==='string'?category:'Plomberie');const row=rows.find(r=>matches(name,r))
 if(row)return NextResponse.json({found:true,...visible(row),from_db:true})
 const web=await lookupItemOnJumia(name,category??'Plomberie')
 if(web.found&&web.price&&web.url)return NextResponse.json({found:true,name:web.name,price_market:web.price,web_price:web.price,source:'Jumia CI',source_url:web.url,photo_url:web.photo_url,currency:'XOF',observed_at:new Date().toISOString(),price_status:'web_observation',included_in_service_price:false,from_db:false})
 return NextResponse.json({found:false,price_market:null,note:'Aucun prix récent vérifiable ; demander un relevé au magasin.'})
}catch{return NextResponse.json({found:false,error:'Recherche de prix indisponible'},{status:503})}}
