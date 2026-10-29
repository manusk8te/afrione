import {NextRequest,NextResponse} from 'next/server'
import {supabaseAdmin} from '@/lib/supabase'
import {authenticate} from '@/lib/mission-auth'
import {materialObservationUsable} from '@/lib/supplies'
import {normalizeMetier} from '@/lib/metier'
import {lookupMaterialOffers} from '@/lib/material-sourcing/lookup'
export const dynamic='force-dynamic'
export const maxDuration=30
const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
function matches(name:string,row:any){const tokens=fold(name).split(/[^a-z0-9]+/).filter(t=>t.length>2&&!['pour','avec','sans','des','une','materiaux','standard'].includes(t));const text=fold(row.name+' '+row.category);return tokens.length>0&&tokens.every(t=>text.includes(t))}
async function observedRows(category:string){const {data}=await supabaseAdmin.from('price_materials').select('*').eq('category',normalizeMetier(category)??category).order('observed_at',{ascending:false,nullsFirst:false}).limit(500);return (data??[]).filter(r=>materialObservationUsable(r)&&r.stock_status!=='unavailable')}
function visible(row:any){return {...row,evidence_url:undefined,added_by:undefined,confirmed_by:undefined,source_kind:row.price_provenance,price_status:'observed',currency:'XOF',included_in_service_price:false}}
export async function GET(req:NextRequest){try{
 if(!await authenticate(req))return NextResponse.json({error:'Connexion requise'},{status:401})
 const category=(req.nextUrl.searchParams.get('category')??'Plomberie').slice(0,80)
 const items=(req.nextUrl.searchParams.get('items')??'').split(',').map(n=>n.trim()).filter(Boolean)
 if(items.length>4||items.some(n=>n.length>120))return NextResponse.json({error:'Quatre fournitures de 120 caractères maximum par recherche.'},{status:400})
 const [rows,web]=await Promise.all([observedRows(category),Promise.all(items.map(name=>lookupMaterialOffers(name)))])
 const materials=items.map((name,i)=>{const found=rows.filter(r=>matches(name,r));const tiers:any={economique:null,standard:null,premium:null};for(const row of found)if(!tiers[row.tier])tiers[row.tier]=visible(row);return {name,tiers,offers:web[i].offers,comparison_references:web[i].comparison_references??[],found:found.length>0||web[i].found,note:web[i].note}})
 return NextResponse.json({category,market_reference_fcfa:null,materials,unpriced_items:materials.filter(m=>!m.found).map(m=>m.name),cache_max_age_seconds:3600,note:'Recherche à la demande, sans enregistrement au catalogue. Prix des articles vendus, conditionnement et livraison à confirmer ; non ajoutés à la prestation.'},{headers:{'Cache-Control':'private, no-store'}})
}catch{return NextResponse.json({error:'Recherche indisponible ; fournitures à confirmer.',materials:[]},{status:503})}}
export async function POST(req:NextRequest){try{
 if(!await authenticate(req))return NextResponse.json({error:'Connexion requise'},{status:401})
 const {name}=await req.json();if(typeof name!=='string'||name.trim().length<2||name.length>120)return NextResponse.json({found:false},{status:400})
 return NextResponse.json(await lookupMaterialOffers(name),{headers:{'Cache-Control':'private, no-store'}})
}catch{return NextResponse.json({found:false,error:'Recherche indisponible ; fourniture à confirmer.'},{status:503})}}
