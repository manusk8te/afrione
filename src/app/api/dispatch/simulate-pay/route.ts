import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { startUrgentDispatch } from '@/lib/dispatch'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { mission_id, amount } = await req.json()

  if (!mission_id || !amount) {
    return NextResponse.json({ error: 'mission_id et amount requis' }, { status: 400 })
  }

  // Vérifier que la mission existe et est en mode urgent
  const { data: mission } = await supabase
    .from('missions')
    .select('id, client_id, mode, category, status')
    .eq('id', mission_id)
    .single()

  if (!mission) return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 })
  if (mission.mode !== 'urgent') return NextResponse.json({ error: 'Mode non urgent' }, { status: 400 })

  const totalAmount   = Number(amount)
  // Urgent mode platform fee is 15% (standard is 12%)
  const platformFee   = Math.round(totalAmount * 0.15)
  const artisanAmount = totalAmount - platformFee
  const simId         = `sim_${Date.now()}`

  // Mettre à jour la mission : prix + status payment
  await supabase
    .from('missions')
    .update({ total_price: totalAmount, status: 'payment' })
    .eq('id', mission_id)

  // Enregistrer la transaction en escrow
  await supabase.from('transactions').insert({
    mission_id,
    wave_transaction_id: simId,
    amount:              totalAmount,
    platform_fee:        platformFee,
    artisan_amount:      artisanAmount,
    status:              'escrow',
    payment_method:      'wave_simulation',
    created_at:          new Date().toISOString(),
  })

  // Message système + lancement du dispatch
  await supabase.from('chat_history').insert({
    mission_id,
    sender_id:   mission.client_id,
    sender_role: 'system',
    sender_type: 'afrione_system',
    text:        `💳 Paiement de ${totalAmount.toLocaleString('fr-FR')} FCFA confirmé (simulation). Recherche d'un artisan en cours...`,
    type:        'system',
  })

  await startUrgentDispatch(mission_id, mission.client_id, mission.category)

  return NextResponse.json({ ok: true, simulation: true })
}
