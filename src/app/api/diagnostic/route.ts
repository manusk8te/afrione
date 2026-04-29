import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { text, user_id, quartier } = await req.json()
    let result: any

    if (process.env.ANTHROPIC_API_KEY) {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `Tu es un expert en artisanat a Abidjan, Cote d'Ivoire. Analyse ce probleme et reponds UNIQUEMENT en JSON valide sans texte avant ou apres: {"summary":"resume 1-2 phrases","category":"Plomberie|Electricite|Maconnerie|Peinture|Menuiserie|Climatisation|Serrurerie|Carrelage","urgency":"low|medium|high|emergency","price_min":nombre,"price_max":nombre,"items_needed":["item1","item2"],"duration_estimate":"X a Y heures"}. Prix realistes en FCFA pour Abidjan. Probleme: ${text}`
          }],
        }),
      })
      const claudeData = await claudeRes.json()
      const content = claudeData.content?.[0]?.text || '{}'
      const clean = content.replace(/```json|```/g, '').trim()
      result = JSON.parse(clean)
    } else {
      const lower = text.toLowerCase()
      if (lower.includes('fuite') || lower.includes('eau') || lower.includes('robinet') || lower.includes('wc')) {
        result = { summary: 'Probleme de plomberie necessitant un plombier qualifie.', category: 'Plomberie', urgency: 'high', price_min: 8000, price_max: 35000, items_needed: ['Joint', 'Siphon PVC', 'Cle a molette'], duration_estimate: '1 a 3 heures' }
      } else if (lower.includes('electr') || lower.includes('courant') || lower.includes('disjoncteur') || lower.includes('clim')) {
        result = { summary: 'Probleme electrique necessitant un electricien certifie.', category: 'Electricite', urgency: 'medium', price_min: 10000, price_max: 45000, items_needed: ['Disjoncteur', 'Cable electrique'], duration_estimate: '1 a 4 heures' }
      } else if (lower.includes('peinture') || lower.includes('peindre') || lower.includes('mur')) {
        result = { summary: 'Travaux de peinture necessitant un peintre experimente.', category: 'Peinture', urgency: 'low', price_min: 15000, price_max: 80000, items_needed: ['Peinture', 'Rouleau', 'Bache'], duration_estimate: '4 a 8 heures' }
      } else {
        result = { summary: 'Probleme artisanal necessitant une intervention professionnelle.', category: 'Maconnerie', urgency: 'medium', price_min: 10000, price_max: 50000, items_needed: ['Materiaux selon devis'], duration_estimate: '2 a 6 heures' }
      }
    }

    if (user_id && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
      const { data: mission } = await supabase
        .from('missions')
        .insert({ client_id: user_id, status: 'diagnostic', category: result.category, quartier: quartier || 'Abidjan' })
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
