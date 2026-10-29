import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveMissionViewer, authorize } from '@/lib/mission-auth'

export const dynamic = 'force-dynamic'

// No invented market ranges, automatic contractual acceptance, or AI call per message.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const resolved = await resolveMissionViewer(req, body?.mission_id)
  if (!resolved.ok) return resolved.res
  const { viewer } = resolved
  const denied = authorize(viewer, 'send_message')
  if (denied) return denied
  const { data: recent, error } = await supabaseAdmin.from('chat_history')
    .select('text, type, sender_id, trigger_type').eq('mission_id', viewer.mission.id)
    .order('created_at', { ascending: false }).limit(30)
  if (error) return NextResponse.json({ error: 'Modération indisponible' }, { status: 503 })
  const last = recent?.find(m => m.type === 'text' && m.sender_id === viewer.userId)
  if (!last) return NextResponse.json({ should_intervene: false })
  const rules = [
    { type: 'abusive_language', pattern: /\b(connard|connasse|salope|enculé|encule|imbécile|imbecile)\b/i,
      message: 'Les échanges doivent rester respectueux, côté client comme prestataire. En cas de désaccord, décrivez les faits et utilisez le signalement.' },
    { type: 'off_platform_payment', pattern: /pai(?:e|ement).*hors plateforme|payer en (?:liquide|espèces)|verse.*(?:whatsapp|direct)/i,
      message: 'Gardez les accords et justificatifs dans AfriOne. Le paiement actuellement présenté est une simulation : aucun débit ni garantie financière ne doit être supposé.' },
  ]
  const rule = rules.find(r => r.pattern.test(last.text) && !recent?.some(m => m.trigger_type === r.type))
  if (!rule) return NextResponse.json({ should_intervene: false })
  const { data: message, error: writeError } = await supabaseAdmin.from('chat_history').insert({
    mission_id: viewer.mission.id, sender_id: viewer.userId, sender_role: 'system',
    sender_type: 'afrione_system', trigger_type: rule.type, text: rule.message, type: 'system',
    metadata: { severity: 'warning', auto_moderated: true },
  }).select().single()
  if (writeError) return NextResponse.json({ error: 'Rappel non enregistré' }, { status: 503 })
  return NextResponse.json({ should_intervene: true, message })
}
