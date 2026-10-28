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
    const result = await runPricingAgent(parsed.data)

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[pricing-agent]', err?.message)
    return NextResponse.json({ status: 'devis_requis', total: null, error: 'Calcul de prix indisponible' }, { status: 500 })
  }
}
