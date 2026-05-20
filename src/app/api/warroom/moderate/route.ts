import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PROMPT_MODE_LIBRE_MODERATION = `Tu es l'IA AfriOne dans la War Room. Tu observes une conversation entre un client et un artisan à Abidjan. Tu interviens UNIQUEMENT dans ces cas précis :

1. PRIX ANORMAL : Si l'artisan propose un prix > 20% du marché estimé pour cette catégorie
   → Message : "⚠️ Info transparence : prix proposé X FCFA, fourchette marché Y-Z FCFA. C'est au-dessus du prix du marché estimé."

2. CONTOURNEMENT DÉTECTÉ : Si quelqu'un mentionne numéro téléphone, WhatsApp, Telegram, "appel direct"
   → Message : "Le partage de numéros directs n'est pas autorisé sur AfriOne pour ta protection."

3. PAIEMENT HORS PLATEFORME : Si mention de "cash", "espèces", "en main propre"
   → Message : "Le paiement doit passer par AfriOne pour activer la garantie travaux."

4. LANGAGE ABUSIF : Si insulte détectée
   → Message : "Restons respectueux. Les insultes peuvent entraîner une suspension."

5. PRIX VALIDÉ : Quand le client confirme explicitement un prix
   → Message : "✅ Prix final validé : [montant] FCFA"

Tu réponds TOUJOURS en JSON strict :
{
  "should_intervene": true|false,
  "trigger_type": "price_alert_20" | "contact_share" | "off_platform_payment" | "abusive_language" | "price_validated" | null,
  "message": "...",
  "severity": "info" | "warning" | "critical"
}

Règles :
- Toujours FACTUEL, jamais accusatoire
- Donner des chiffres précis quand disponibles
- Tutoyer
- Présumer la bonne foi
- Ne JAMAIS dire "tu arnaques" → dire "c'est au-dessus du marché estimé"
- Intervenir une fois max par déclencheur (pas de spam)
- Si rien de suspect → should_intervene: false`

// Fourchettes marché Abidjan par catégorie (référence interne)
const MARKET_RANGES: Record<string, { low: number; high: number }> = {
  plomberie:     { low: 4000,  high: 15000 },
  electricite:   { low: 4000,  high: 12000 },
  climatisation: { low: 6000,  high: 30000 },
  serrurerie:    { low: 8000,  high: 15000 },
  peinture:      { low: 5000,  high: 20000 },
  maconnerie:    { low: 10000, high: 50000 },
  menuiserie:    { low: 8000,  high: 30000 },
  carrelage:     { low: 8000,  high: 40000 },
}

export async function POST(req: NextRequest) {
  const { mission_id, messages, last_message } = await req.json()

  if (!mission_id || !last_message) {
    return NextResponse.json({ should_intervene: false })
  }

  // Vérifier que c'est bien une mission en mode libre (ou sans mode)
  const { data: mission } = await supabaseAdmin
    .from('missions')
    .select('mode, category, client_id')
    .eq('id', mission_id)
    .single()

  if (!mission) return NextResponse.json({ should_intervene: false })
  if (['urgent', 'standard'].includes(mission.mode ?? '')) {
    return NextResponse.json({ should_intervene: false, skipped: 'mode_not_libre' })
  }

  // Vérifier si ce trigger a déjà été utilisé récemment (anti-spam)
  const recentMessages = messages?.slice(-20) ?? []
  const triggerHistory = recentMessages
    .filter((m: any) => m.sender_type === 'afrione_system')
    .map((m: any) => m.trigger_type)
    .filter(Boolean)

  // Contexte pour l'IA
  const category = (mission.category || '').toLowerCase().replace(/é/g, 'e').replace(/è/g, 'e')
  const marketRef = MARKET_RANGES[category] ?? MARKET_RANGES.maconnerie
  const recentConversation = recentMessages
    .filter((m: any) => m.type === 'text' || m.type === 'devis')
    .slice(-6)
    .map((m: any) => `[${m.sender_role ?? 'inconnu'}] : ${m.text}`)
    .join('\n')

  const systemPrompt = PROMPT_MODE_LIBRE_MODERATION +
    `\n\nContexte: catégorie "${mission.category}", fourchette marché estimée: ${marketRef.low.toLocaleString('fr')}–${marketRef.high.toLocaleString('fr')} FCFA.` +
    (triggerHistory.length ? `\nDéjà intervenu pour : ${Array.from(new Set(triggerHistory)).join(', ')} — ne pas répéter ces triggers.` : '')

  const userPrompt = `Conversation récente :\n${recentConversation}\n\nDernier message à analyser :\n[${last_message.sender_role}] : ${last_message.text}`

  const apiKey = process.env.OPENAI_API_KEY

  let result: { should_intervene: boolean; trigger_type: string | null; message: string; severity: string }

  if (!apiKey) {
    // Fallback heuristique si pas de clé OpenAI
    result = heuristicModeration(last_message.text, last_message.sender_role, marketRef, triggerHistory)
  } else {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 300,
        }),
      })

      if (!res.ok) throw new Error('OpenAI error')
      const data = await res.json()
      result = JSON.parse(data.choices[0].message.content)
    } catch {
      result = heuristicModeration(last_message.text, last_message.sender_role, marketRef, triggerHistory)
    }
  }

  if (!result.should_intervene) {
    return NextResponse.json({ should_intervene: false })
  }

  // Insérer le message de modération dans le chat
  const { data: inserted } = await supabaseAdmin.from('chat_history').insert({
    mission_id,
    sender_id:   mission.client_id,
    sender_role: 'system',
    sender_type: 'afrione_system',
    trigger_type: result.trigger_type,
    text:        result.message,
    type:        'system',
    metadata:    { severity: result.severity, auto_moderated: true },
  }).select().single()

  // Enregistrer l'alerte si c'est un prix anormal
  if (result.trigger_type === 'price_alert_20') {
    const priceMatch = last_message.text.match(/(\d[\d\s]*)\s*(f|fcfa|xof)/i)
    const proposed = priceMatch ? parseInt(priceMatch[1].replace(/\s/g, '')) : null
    if (proposed) {
      await supabaseAdmin.from('pricing_alerts').insert({
        mission_id,
        proposed_price: proposed,
        market_low:     marketRef.low,
        market_high:    marketRef.high,
        alert_level:    result.severity as 'info' | 'warning' | 'critical',
      })
    }
  }

  return NextResponse.json({ should_intervene: true, message: inserted })
}

// ── Modération heuristique (fallback sans OpenAI) ─────────────────────────────

function heuristicModeration(
  text: string,
  senderRole: string,
  marketRef: { low: number; high: number },
  triggerHistory: string[]
): { should_intervene: boolean; trigger_type: string | null; message: string; severity: string } {

  const t = text.toLowerCase()

  // Contournement contact
  if (!triggerHistory.includes('contact_share') &&
      /whatsapp|wa\.me|0[0-9]{9}|\+225|telegram|appel direct/.test(t)) {
    return {
      should_intervene: true,
      trigger_type: 'contact_share',
      message: 'Le partage de numéros directs n\'est pas autorisé sur AfriOne pour ta protection.',
      severity: 'warning',
    }
  }

  // Paiement hors-plateforme
  if (!triggerHistory.includes('off_platform_payment') &&
      /cash|espèce|en main propre|en liquide/.test(t)) {
    return {
      should_intervene: true,
      trigger_type: 'off_platform_payment',
      message: 'Le paiement doit passer par AfriOne pour activer la garantie travaux.',
      severity: 'warning',
    }
  }

  // Prix trop élevé (artisan uniquement)
  if (!triggerHistory.includes('price_alert_20') && senderRole === 'artisan') {
    const priceMatch = text.match(/(\d[\d\s]*)\s*(f|fcfa|xof)/i)
    if (priceMatch) {
      const proposed = parseInt(priceMatch[1].replace(/\s/g, ''))
      if (proposed > marketRef.high * 1.2) {
        return {
          should_intervene: true,
          trigger_type: 'price_alert_20',
          message: `⚠️ Info transparence : prix proposé ${proposed.toLocaleString('fr')} FCFA, fourchette marché estimée ${marketRef.low.toLocaleString('fr')}–${marketRef.high.toLocaleString('fr')} FCFA. C'est au-dessus du marché estimé.`,
          severity: 'warning',
        }
      }
    }
  }

  return { should_intervene: false, trigger_type: null, message: '', severity: 'info' }
}
