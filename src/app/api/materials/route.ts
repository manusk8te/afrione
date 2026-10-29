import {NextRequest,NextResponse} from 'next/server'
import {authenticate} from '@/lib/mission-auth'
import {lookupMaterialOffers} from '@/lib/material-sourcing/lookup'
export const dynamic='force-dynamic'
export const maxDuration=30
export async function GET(req:NextRequest){try{
 if(!await authenticate(req))return NextResponse.json({error:'Connexion requise'},{status:401})
 const category=(req.nextUrl.searchParams.get('category')??'Plomberie').slice(0,80)
 const raw=req.nextUrl.searchParams.get('items')??''
 const parsed=raw.startsWith('[')?JSON.parse(raw):raw.split(',')
 if(!Array.isArray(parsed)||parsed.some(n=>typeof n!=='string'))return NextResponse.json({error:'Liste de fournitures invalide'},{status:400})
 const items:string[]=parsed.map(n=>n.trim()).filter(Boolean)
 if(items.length>4||items.some(n=>n.length>120))return NextResponse.json({error:'Quatre fournitures de 120 caractères maximum par recherche.'},{status:400})
 const web=await Promise.all(items.map(name=>lookupMaterialOffers(name,'mission')))
 const materials=items.map((name,i)=>({name,tiers:{economique:null,standard:null,premium:null},offers:web[i].offers,comparison_references:web[i].comparison_references??[],found:web[i].found,note:web[i].note}))
 return NextResponse.json({category,market_reference_fcfa:null,materials,unpriced_items:materials.filter(m=>!m.found).map(m=>m.name),cache_max_age_seconds:3600,note:'Recherche à la demande, sans enregistrement au catalogue. Prix des articles vendus, conditionnement et livraison à confirmer ; non ajoutés à la prestation.'},{headers:{'Cache-Control':'private, no-store'}})
}catch{return NextResponse.json({error:'Recherche indisponible ; fournitures à confirmer.',materials:[]},{status:503})}}
export async function POST(req:NextRequest){try{
 if(!await authenticate(req))return NextResponse.json({error:'Connexion requise'},{status:401})
 const {name}=await req.json();if(typeof name!=='string'||name.trim().length<2||name.length>120)return NextResponse.json({found:false},{status:400})
 return NextResponse.json(await lookupMaterialOffers(name,'mission'),{headers:{'Cache-Control':'private, no-store'}})
}catch{return NextResponse.json({found:false,error:'Recherche indisponible ; fourniture à confirmer.'},{status:503})}}
