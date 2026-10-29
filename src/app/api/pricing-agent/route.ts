import { describeSupplies } from '@/lib/supplies'
import { authenticate, resolveMissionViewer } from '@/lib/mission-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { runPricingAgent } from '@/lib/pricing-agent'
import { previewStudyQuote, getPriceContext } from '@/lib/pricing-studies'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const studyPreviewSchema = z.object({
  pricing_mode: z.literal('study_preview'),
  mission: z.string().trim().min(1).max(200),
  hours: z.number().positive().finite(),
  materials: z.array(z.object({
    material_id: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    quantity: z.number().positive().finite(),
    unit: z.string().trim().min(1).max(50),
  }).strict()).max(20),
}).strict()
const contextPreviewSchema = z.object({
  pricing_mode: z.literal('context_preview'),
  reference_id: z.string().trim().min(1).max(50),
  hours: z.number().positive().finite(),
}).strict()

const agentInputSchema = z.object({
  mission_id: z.string().uuid().optional(),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(8000),
  items_needed: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  hours_estimate: z.number().positive().finite(),
  quartier: z.string().trim().min(1).max(100).default('Cocody'),
  urgency: z.string().trim().min(1).max(100).default('medium'),
  artisan_id: z.string().uuid().optional(),
}).strict()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (body.pricing_mode === 'context_preview') {
      const parsed = contextPreviewSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'Demande de contexte invalide' }, { status: 400 })
      return NextResponse.json(getPriceContext(parsed.data.reference_id, parsed.data.hours))
    }
    if (body.pricing_mode === 'study_preview') {
      const parsed = studyPreviewSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Demande de simulation invalide', details: parsed.error.issues }, { status: 400 })
      }
      const { mission, hours, materials } = parsed.data
      return NextResponse.json(await previewStudyQuote(mission, hours, materials))
    }
    if (body.pricing_mode !== undefined) {
      return NextResponse.json({ error: 'Mode de tarification inconnu' }, { status: 400 })
    }
    const parsed = agentInputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ status: 'informations_requises', total: null, error: 'Précisez la prestation et une durée positive.', details: parsed.error.issues }, { status: 400 })
    }
    const identity=await authenticate(req)
    if(!identity)return NextResponse.json({error:'Reconnectez-vous pour calculer votre prix'},{status:401})
    const missionId=parsed.data.mission_id
    if(missionId){
      const viewer=await resolveMissionViewer(req,missionId)
      if(!viewer.ok)return viewer.res
      if(viewer.viewer.mission.client_id!==identity.userId)return NextResponse.json({error:'Mission non autorisée'},{status:403})
      if(!['diagnostic','matching','negotiation'].includes(viewer.viewer.mission.status))return NextResponse.json({error:'Cette mission ne peut plus être recalculée'},{status:409})
    }
    let diag:any=null
    let context:any={}
    let agentInput=parsed.data
    if(missionId){
      const {data,error}=await supabaseAdmin.from('diagnostics').select('id,raw_text').eq('mission_id',missionId).maybeSingle()
      if(error||!data)throw Error('Diagnostic introuvable pour préparer le devis')
      diag=data;try{context=JSON.parse(diag.raw_text||'{}')}catch{}
      if(['onsite_required','urgent'].includes(context.diagnostic_status))return NextResponse.json({status:'informations_requises',total:null,error:'Le pré-diagnostic nécessite une vérification par le prestataire avant de chiffrer.'},{status:422})
      if(Array.isArray(context.product_requirements)&&context.product_requirements.length)agentInput={...parsed.data,description:parsed.data.description+'\nCritères de fournitures issus du diagnostic (inconnues à confirmer, aucune gamme déduite du prix) : '+JSON.stringify(context.product_requirements).slice(0,3000)}
    }
    const result = await runPricingAgent(agentInput)
    const supplies = describeSupplies(result.price_context && 'sources' in result.price_context ? result.price_context.sources : [])
    if(missionId){
      context.afrione_pricing={estimate:result.total,applied_estimator:result.applied_estimator,price_context:result.price_context,server_generated:true,supplies}
      const {error:saveError}=await supabaseAdmin.from('diagnostics').update({raw_text:JSON.stringify(context),estimated_price_min:result.total,estimated_price_max:result.total}).eq('id',diag.id)
      if(saveError)throw Error('Le devis n’a pas été enregistré')
      const {data:saved,error:missionError}=await supabaseAdmin.from('missions').update({total_price:result.total}).eq('id',missionId).in('status',['diagnostic','matching','negotiation']).select('id').maybeSingle()
      if(missionError || !saved)throw Error('Le prix de la mission n’a pas été enregistré')
    }

    return NextResponse.json({...result,supplies})
  } catch (err: any) {
    if (String(err?.message).startsWith('informations_requises:')) {
      return NextResponse.json({ status: 'informations_requises', total: null, error: String(err.message).slice('informations_requises:'.length).trim() }, { status: 422 })
    }
    console.error('[pricing-agent]', err?.message)
    return NextResponse.json({ status: 'devis_requis', total: null, error: 'Calcul de prix indisponible' }, { status: 500 })
  }
}
