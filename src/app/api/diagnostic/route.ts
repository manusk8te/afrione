import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const SYSTEM_DIAG = `Tu es un expert diagnostiqueur en artisanat à Abidjan, Côte d'Ivoire. Tu parles français.`

const CATEGORIES = `Plomberie|Electricité|Maçonnerie|Peinture|Menuiserie|Climatisation|Serrurerie|Carrelage`

async function callOpenAI(messages: any[], max_tokens = 512) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: 'gpt-4o', max_tokens, temperature: 0.3, messages }),
  })
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || '{}'
  return JSON.parse(content.replace(/```json|```/g, '').trim())
}

function fallbackQuestion(index: number): { question: string; type: 'yesno' | 'text'; done: boolean } {
  const FALLBACK_QUESTIONS = [
    { question: "Depuis combien de temps avez-vous ce problème ?", type: 'text' as const },
    { question: "Le problème s'est-il aggravé récemment ?", type: 'yesno' as const },
    { question: "Y a-t-il des dégâts visibles (eau, fissures, fumée…) ?", type: 'yesno' as const },
    { question: "Avez-vous déjà essayé de réparer vous-même ?", type: 'yesno' as const },
  ]
  if (index >= FALLBACK_QUESTIONS.length) return { question: '', type: 'text', done: true }
  return { ...FALLBACK_QUESTIONS[index], done: false }
}

function fallbackResult(text: string) {
  const lower = text.toLowerCase()
  if (lower.includes('fuite') || lower.includes('eau') || lower.includes('robinet') || lower.includes('wc')) {
    return { summary: "Vous avez un problème de plomberie nécessitant l'intervention d'un plombier qualifié.", technical_notes: "Inspection du réseau d'alimentation et évacuation. Prévoir joint, siphon et clé à molette.", category: 'Plomberie', urgency: 'high', price_min: 8000, price_max: 35000, items_needed: ['Joint', 'Siphon PVC', 'Clé à molette'], duration_estimate: '1 à 3 heures' }
  } else if (lower.includes('electr') || lower.includes('courant') || lower.includes('disjoncteur') || lower.includes('clim')) {
    return { summary: "Vous avez un problème électrique nécessitant un électricien certifié.", technical_notes: "Vérification du tableau électrique et des circuits. Prévoir multimètre et disjoncteurs.", category: 'Électricité', urgency: 'medium', price_min: 10000, price_max: 45000, items_needed: ['Disjoncteur', 'Câble électrique'], duration_estimate: '1 à 4 heures' }
  } else if (lower.includes('peinture') || lower.includes('peindre') || lower.includes('mur')) {
    return { summary: "Vous souhaitez des travaux de peinture dans votre espace.", technical_notes: "Préparation des surfaces, application apprêt et 2 couches. Prévoir bâche de protection.", category: 'Peinture', urgency: 'low', price_min: 15000, price_max: 80000, items_needed: ['Peinture', 'Rouleau', 'Bâche'], duration_estimate: '4 à 8 heures' }
  }
  return { summary: "Vous avez un problème artisanal nécessitant une intervention professionnelle.", technical_notes: "Diagnostic complet à réaliser sur place.", category: 'Maçonnerie', urgency: 'medium', price_min: 10000, price_max: 50000, items_needed: ['Matériaux selon diagnostic'], duration_estimate: '2 à 6 heures' }
}

function buildUserMessage(text: string, photos: string[], extra = '') {
  if (!photos?.length) return [{ role: 'user', content: (extra ? extra + '\n\n' : '') + text }]
  return [{
    role: 'user',
    content: [
      { type: 'text', text: (extra ? extra + '\n\n' : '') + text },
      ...photos.slice(0, 4).map(url => ({ type: 'image_url', image_url: { url, detail: 'low' } })),
    ],
  }]
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { mode, text, photos = [], qa = [], index = 0, user_id, quartier } = body

  try {
    // ── MODE START : première question après la description initiale ──
    if (mode === 'start') {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json(fallbackQuestion(0))
      }
      const result = await callOpenAI([
        {
          role: 'system',
          content: `${SYSTEM_DIAG}
Le client décrit son problème. Pose UNE seule question de suivi pertinente pour mieux comprendre.
Réponds UNIQUEMENT en JSON valide: {"question": "...", "type": "yesno"|"text", "done": false}
- "yesno" pour les questions oui/non simples
- "text" pour les questions nécessitant une réponse ouverte
- Si la description est déjà très complète, mets "done": true et "question": ""`,
        },
        ...buildUserMessage(text, photos),
      ])
      return NextResponse.json(result)
    }

    // ── MODE NEXT : question suivante selon Q&A précédentes ──
    if (mode === 'next') {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json(fallbackQuestion(index))
      }
      const qaText = qa.map((q: any) => `Q: ${q.question}\nR: ${q.answer}`).join('\n\n')
      const result = await callOpenAI([
        {
          role: 'system',
          content: `${SYSTEM_DIAG}
Tu as déjà posé ${index} question(s) sur ce problème. Maximum 4 questions au total.
Si tu as assez d'infos pour diagnostiquer, mets "done": true.
Sinon, pose UNE question supplémentaire pertinente.
Réponds UNIQUEMENT en JSON valide: {"question": "...", "type": "yesno"|"text", "done": true|false}`,
        },
        ...buildUserMessage(text, photos, `Questions/réponses précédentes:\n${qaText}`),
      ])
      if (index >= 4) return NextResponse.json({ ...result, done: true })
      return NextResponse.json(result)
    }

    // ── MODE FINALIZE : résumé + fiche technique complète ──
    if (mode === 'finalize') {
      let result: any

      if (process.env.OPENAI_API_KEY) {
        const qaText = qa.length
          ? '\n\nInformations complémentaires:\n' + qa.map((q: any) => `Q: ${q.question}\nR: ${q.answer}`).join('\n\n')
          : ''
        result = await callOpenAI([
          {
            role: 'system',
            content: `${SYSTEM_DIAG}
Génère un diagnostic complet en JSON valide avec ces champs EXACTS:
{
  "summary": "Résumé clair du problème pour le client (2-3 phrases, en français)",
  "technical_notes": "Notes techniques détaillées pour l'artisan: diagnostic probable, méthode d'intervention recommandée, points d'attention, risques",
  "category": "${CATEGORIES}",
  "urgency": "low|medium|high|emergency",
  "price_min": number,
  "price_max": number,
  "items_needed": ["item1", "item2"],
  "duration_estimate": "X à Y heures"
}
Prix réalistes en FCFA pour Abidjan. Réponds UNIQUEMENT avec le JSON.`,
          },
          ...buildUserMessage(text, photos, qaText),
        ], 1024)
      } else {
        result = fallbackResult(text)
      }

      // Sauvegarder en base si user connecté
      if (user_id) {
        const { data: mission } = await supabaseAdmin
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
          // Stocker le contexte complet dans raw_text (Q&A + photos + notes techniques)
          const rawContext = JSON.stringify({
            original: text,
            qa,
            photos,
            technical_notes: result.technical_notes,
          })

          await supabaseAdmin.from('diagnostics').insert({
            mission_id: mission.id,
            raw_text: rawContext,
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
    }

    return NextResponse.json({ error: 'Mode invalide' }, { status: 400 })
  } catch (err: any) {
    console.error('[diagnostic]', err.message)
    // Fallback mode start/next
    if (mode === 'start' || mode === 'next') {
      return NextResponse.json(fallbackQuestion(index))
    }
    return NextResponse.json(fallbackResult(text))
  }
}
