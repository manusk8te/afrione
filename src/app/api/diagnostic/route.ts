import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabaseAdmin } from '@/lib/supabase'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { text, mission_id } = await req.json()
    if (!text || text.length < 5) {
      return NextResponse.json({ error: 'Texte trop court' }, { status: 400 })
    }

    // 1. Appel GPT-4o pour analyser le problème
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Tu es AfriOne-Brain, l'IA de diagnostic de la plateforme AfriOne à Abidjan (Côte d'Ivoire).
          
Ton rôle : analyser la description d'un problème client et retourner une analyse structurée en JSON.

Base de référence des tarifs à Abidjan :
- Plombier : 3000 FCFA/h + matériaux
- Électricien : 3500 FCFA/h + matériaux  
- Peintre : 2500 FCFA/h + matériaux
- Maçon : 2800 FCFA/h
- Menuisier : 3000 FCFA/h
- Climaticien : 4000 FCFA/h

Réponds UNIQUEMENT en JSON valide, sans markdown, sans texte autour.`,
        },
        {
          role: 'user',
          content: `Analyse ce problème et retourne un JSON avec exactement ces champs :
{
  "summary": "résumé technique précis en 1-2 phrases",
  "category": "Plomberie|Électricité|Peinture|Maçonnerie|Menuiserie|Climatisation|Serrurerie|Carrelage",
  "urgency": "low|medium|high|emergency",
  "price_min": <nombre entier en FCFA>,
  "price_max": <nombre entier en FCFA>,
  "items_needed": ["liste", "des", "matériaux"],
  "duration_estimate": "ex: 1 à 2 heures",
  "artisan_tips": "conseils pour le client avant l'arrivée de l'artisan"
}

Problème client : "${text}"`,
        },
      ],
      max_tokens: 600,
      temperature: 0.3,
    })

    const rawJson = completion.choices[0].message.content || '{}'
    const diagResult = JSON.parse(rawJson)

    // 2. Générer l'embedding pour pgvector
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })

    // 3. Sauvegarder en base si mission_id fourni
    if (mission_id) {
      await supabaseAdmin.from('diagnostics').insert({
        mission_id,
        raw_text: text,
        ai_summary: diagResult.summary,
        category_detected: diagResult.category,
        estimated_price_min: diagResult.price_min,
        estimated_price_max: diagResult.price_max,
        items_needed: diagResult.items_needed,
        urgency_level: diagResult.urgency,
        embedding: embedding.data[0].embedding,
      })

      // Mettre à jour le statut de la mission
      await supabaseAdmin
        .from('missions')
        .update({ status: 'matching', category: diagResult.category })
        .eq('id', mission_id)
    }

    return NextResponse.json(diagResult)

  } catch (error) {
    console.error('Diagnostic API error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse' },
      { status: 500 }
    )
  }
}
