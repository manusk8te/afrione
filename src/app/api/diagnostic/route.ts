import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { text, user_id, quartier } = await req.json()

    let result: any

    if (process.env.ANTHROPIC_API_KEY) {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: `Tu es un expert en artisanat à Abidjan, Côte d'Ivoire.
Analyse ce problème et réponds UNIQUEMENT en JSON valide, sans texte avant ou après:
{
  "summary": "résumé du problème en 1-2 phrases",
  "category": "Plomberie|Électricité|Maçonnerie|Peinture|Menuiserie|Climatisation|Serrurerie|Carrelage",
  "urgency": "low|medium|high|emergency",
  "price_min": nombre en FCFA,
  "price_max": nombre en FCFA,
  "items_needed": ["matériel1", "matériel2"],
  "duration_estimate": "X à Y heures"
}
Prix réalistes pour Abidjan en FCFA.

Problème: ${text}`
            }
          ],
        }),
      })
      const claudeData = await claudeRes.json()
      const content = claudeData.content?.[0]?.text || '{}'
      const clean = content.replace(/```json|```/g, '').trim()
      result = JSON.parse(clean)
    } else {
      // Fallback intelligent sans clé
      const lower = text.toLowerCase()
      const isPlomberie = lower.includes('fuite') || lower.includes('eau') || lower.includes('robinet') || lower.includes('tuyau') || lower.includes('wc') || lower.includes('évier')
      const isElec = lower.includes('électr') || lower.includes('courant') || lower.includes('disjoncteur') || lower.includes('prise') || lower.includes('lumière') || lower.includes('clim')
      const isPeinture = lower.includes('peinture') || lower.includes('peindre') || lower.includes('mur') || lower.includes('salon')
      const isUrgent = lower.includes('urgent') || lower.includes('plus en plus') || lower.includes('inondation')

      if (isPlomberie) {
        result = { summary: 'Problème de plomberie nécessitant l\'intervention d\'un plombier qualifié.', category: 'Plomberie', urgency: isUrgent ? 'high' : 'medium', price_min: 8000, price_max: 35000, items_needed: ['Joint d\'étanchéité', 'Siphon PVC', 'Clé à molette'], duration_estimate: '1 à 3 heures' }
      } else if (isElec) {
        result = { summary: 'Problème électrique nécessitant un électricien certifié.', category: 'Électricité', urgency: isUrgent ? 'high' : 'medium', price_min: 10000, price_max: 45000, items_needed: ['Disjoncteur', 'Câble électrique', 'Gaine'], duration_estimate: '1 à 4 heures' }
      } else if (isPeinture) {
        result = { summary: 'Travaux de peinture nécessitant un peintre expérimenté.', category: 'Peinture', urgency: 'low', price_min: 15000, price_max: 80000, items_needed: ['Peinture acrylique', 'Rouleau', 'Bâche'], duration_estimate: '4 à 8 heures' }
      } else {
        result = { summary: 'Problème artisanal nécessitant une intervention professionnelle.', category: 'Maçonnerie', urgency: 'medium', price_min: 10000, price_max: 50000, items_needed: ['Matériaux selon devis'], duration_estimate: '2 à 6 heures' }
      }
    }

    // Créer la mission en BDD si user connecté
    if (user_id) {
      const { data: mission } = await supabase
        .from('missions')
        .insert({
          client_id: user_id,
          status: 'diagnostic',
          category: result.category,
          quartier: quartier || 'Abidjan',
        })
        .select()
        .single()

      if (mission) {
        await supabase.from('diagnostics').insert({
          mission_id: mission.id,
          raw_text: text,
          ai_summary: result.summary,
          category_detected: result.category,
          estimated_price_min: result.price_min,
          estimated_price_max: result.price_max,
          items_needed: result.items_needed,
          urgency_level: result.urgency,
        })
        return NextResponse.json({ ...result, mission_id: mission.id })
      }
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
