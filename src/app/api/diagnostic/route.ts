import { authenticate } from '@/lib/mission-auth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { enrichItemsWithJumia } from '@/lib/jumia-lookup'
import { normalizeMetier } from '@/lib/metier'

export const dynamic = 'force-dynamic'
export const maxDuration=90


import {questionPrompt,normalizeDiagnosticQuestion,REPORT_POLICY} from '@/lib/diagnostic-policy'

// ─── Appel OpenAI ─────────────────────────────────────────────────────────────
async function callOpenAI(messages: any[], max_tokens = 900) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages,
    }),
  })
  if(!res.ok)throw Error(`Modèle indisponible (${res.status})`)
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if(!content)throw Error('Réponse de diagnostic absente')
  return JSON.parse(content)
}

function buildMessages(text: string, photos: string[], systemPrompt: string, extra = '') {
  const userText = extra ? `${extra}\n\n${text}` : text
  const userContent = photos?.length
    ? [
        { type: 'text', text: userText },
        ...photos.slice(0, 4).map(url => ({ type: 'image_url', image_url: { url, detail: 'low' as const } })),
      ]
    : userText

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]
}

// ─── Détecte et traduit l'anglais en français ───────────────────────────────
async function ensureFrench(text: string): Promise<string> {
  if (!text || !process.env.OPENAI_API_KEY) return text

  // Heuristique rapide : compte de mots anglais courants
  const englishKeywords = /\b(problem|issue|leak|water|electricity|paint|crack|wall|pipe|plug|circuit|broken|damage|humid|smell|noise|burn)\b/gi
  const matches = text.match(englishKeywords) || []

  // Si < 15% de mots anglais détectés, c'est probablement déjà français
  const englishRatio = matches.length / (text.split(/\s+/).length || 1)
  if (englishRatio < 0.15) return text

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Traduis UNIQUEMENT en français, sans ajout ni commentaire :\n\n${text}`,
        }],
      }),
    })

    if (!res.ok) return text // Si réponse non-OK, garder l'original

    const data = await res.json()
    const translated = data.choices?.[0]?.message?.content || text
    return translated.trim()
  } catch (e) {
    console.error('[ensureFrench]', e)
    return text // Si erreur traduction, garder l'original
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const identity = await authenticate(req)
  if(!identity)return NextResponse.json({error:'Reconnectez-vous pour enregistrer votre demande'},{status:401})
  const body = await req.json()
  let { mode, text, photos = [], qa = [], index = 0, quartier } = body
  const user_id = identity.userId

  // Traduire la description en français si détectée en anglais
  if (mode === 'start' && text && process.env.OPENAI_API_KEY) {
    text = await ensureFrench(text)
  }

  const hasKey = !!process.env.OPENAI_API_KEY

  try {
    if(!hasKey)return NextResponse.json({error:'Le diagnostic est temporairement indisponible. Aucun résultat automatique de remplacement n’est généré.'},{status:503})
    if(!['start','next','finalize'].includes(mode)||typeof text!=='string'||text.trim().length<10||text.length>12000||!Array.isArray(qa)||qa.length>8)return NextResponse.json({error:'Demande de diagnostic invalide'},{status:400})
    if(mode==='start'||mode==='next'){
      const history=mode==='start'?[]:qa
      if(history.some((q:any)=>typeof q.question!=='string'||typeof q.answer!=='string'))return NextResponse.json({error:'Réponses invalides'},{status:400})
      const extra=JSON.stringify({description:text,reponses:history})
      for(let attempt=0;attempt<2;attempt++){
        const raw=await callOpenAI(buildMessages(text,photos,questionPrompt(history)+(attempt?'\nLa réponse précédente ne respectait pas le contrat. Choisis une information nouvelle utile, ou conclus explicitement.':''),extra),1300)
        try{return NextResponse.json(normalizeDiagnosticQuestion(raw,history))}catch(error){if(attempt===1)throw error}
      }
    }

    // ── MODE FINALIZE ─────────────────────────────────────────────────────────
    if (mode === 'finalize') {
      let result: any

      if (hasKey) {
        const qaBlock = qa.length
          ? 'ÉCHANGES DE DIAGNOSTIC :\n' + qa.map((q: any, i: number) => `Q${i+1}: ${q.question}\nR${i+1}: ${q.answer}`).join('\n\n') + '\n\nDESCRIPTION INITIALE :'
          : ''

        const systemFinalize = REPORT_POLICY

        result = await callOpenAI(buildMessages(text, photos, systemFinalize, qaBlock), 2000)
      } else {
        throw Error('Diagnostic indisponible')
      }

      const TOOLS_RE = /\b(clé (à molette|plate|allen|dynamométrique)|tournevis|perceuse|niveau (à bulle)?|taloche|truelle|spatule|marteau|scie|pince|mètre ruban|testeur (de prise)?|multimètre|bâche|ruban (de masquage|adhésif|américain)|gants|masque|casque|lunettes de protection)\b/i
      const rawItems = Array.isArray(result.items_needed) ? result.items_needed : []
      const normalizedItems = rawItems
        .map((it: any) =>
          typeof it === 'string'
            ? { name: it, qty: null, unit: null }
            : { name: String(it.name || ''), qty: typeof it.qty==='number'&&it.qty>0?it.qty:null, unit: typeof it.unit==='string'?it.unit:null }
        )
        .filter((it: any) => it.name && !TOOLS_RE.test(it.name))
        .slice(0, 4)

      if(typeof result.summary!=='string'||!result.summary.trim()||typeof result.technical_notes!=='string'||!result.technical_notes.trim())throw Error('Rapport incomplet')
      const strings=(v:any)=>Array.isArray(v)?v.filter((s:any)=>typeof s==='string').map((s:string)=>s.slice(0,300)).slice(0,8):[]
      if(!normalizeMetier(result.category))throw Error('Métier non reconnu : précisez votre prestation')
      result = {
        summary:           result.summary         || 'Problème artisanal identifié, intervention recommandée.',
        technical_notes:   result.technical_notes || 'Diagnostic complet à réaliser sur place.',
        // Le schéma du prompt présente la liste des catégories comme valeur
        // d'exemple (`"category": "Plomberie|Électricité|…"`). Le modèle est
        // censé en choisir une ; il lui arrive de recopier la chaîne entière,
        // et une mission s'est retrouvée en base avec les huit métiers collés
        // pour catégorie — donc zéro matériau, et aucun artisan au matching.
        // Ce que le code peut garantir n'a rien à faire dans un prompt.
        category:          normalizeMetier(result.category) || 'Maçonnerie',
        urgency:           result.urgency         || 'medium',
        price_min:         null,
        price_max:         null,
        items_needed:      normalizedItems,
        duration_estimate: result.duration_estimate || null,
        diagnostic_status: ['preliminary','onsite_required','urgent'].includes(result.diagnostic_status)?result.diagnostic_status:'onsite_required',
        product_requirements: Array.isArray(result.product_requirements)?result.product_requirements.filter((r:any)=>r&&typeof r.item==='string').slice(0,4).map((r:any)=>({item:r.item.slice(0,150),confirmed_specs:strings(r.confirmed_specs),unknown_specs:strings(r.unknown_specs),selection_criteria:strings(r.selection_criteria)})):[],
        surface_m2:        result.surface_m2 != null ? Number(result.surface_m2) : null,
        budget_client:     result.budget_client || null,
      }

      const jumiaPromise = result.diagnostic_status==='preliminary' && normalizedItems.length > 0
        ? enrichItemsWithJumia(normalizedItems.map((i: any) => i.name), result.category)
        : Promise.resolve([])

      if (user_id) {
        const { data: mission, error: missionError } = await supabaseAdmin
          .from('missions')
          .insert({
            client_id: user_id,
            status:    'diagnostic',
            category:  result.category,
            quartier:  quartier || 'Abidjan',
          })
          .select()
          .single()

        if (missionError || !mission) throw Error('Enregistrement de la mission impossible')
        if (mission) {
          const rawContext = JSON.stringify({ original: text, qa, photos, technical_notes: result.technical_notes, duration_estimate: result.duration_estimate, diagnostic_status:result.diagnostic_status,product_requirements:result.product_requirements })

          const [diagnosticWrite, jumiaItems] = await Promise.all([
            supabaseAdmin.from('diagnostics').insert({
              mission_id:          mission.id,
              raw_text:            rawContext,
              ai_summary:          result.summary,
              category_detected:   result.category,
              estimated_price_min: result.price_min,
              estimated_price_max: result.price_max,
              items_needed:        result.items_needed.map((item: any) => item.name),
              urgency_level:       result.urgency,
            }),
            jumiaPromise,
          ])

          if(diagnosticWrite.error)throw Error('Enregistrement du diagnostic impossible')
          return NextResponse.json({ ...result, mission_id: mission.id, jumia_items: jumiaItems })
        }
      }

      const jumiaItems = await jumiaPromise
      return NextResponse.json({ ...result, jumia_items: jumiaItems })
    }

    return NextResponse.json({ error: 'Mode invalide' }, { status: 400 })

  } catch (err: any) {
    console.error('[diagnostic]', err.message)
    return NextResponse.json({error:'Le diagnostic n’a pas abouti. Vos réponses sont conservées ; réessayez sans inventer les informations manquantes.'},{status:503})
  }
}
