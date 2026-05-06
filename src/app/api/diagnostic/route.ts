import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { enrichItemsWithJumia } from '@/lib/jumia-lookup'

const CATEGORIES = `Plomberie|Électricité|Maçonnerie|Peinture|Menuiserie|Climatisation|Serrurerie|Carrelage`

// ─── Playbook expert par domaine ─────────────────────────────────────────────
const EXPERT_PLAYBOOK = `
PLOMBERIE — arbre de diagnostic :
• "eau coule / fuite" → 1er : tuyau visible qui coule OU mur/plafond humide ?
  - Si tuyau visible → sous quel meuble (évier, lavabo, WC) ? robinet qui goutte ou jonction qui fuit ?
  - Si mur humide → côté rue ou intérieur ? en bas (proche sol) ou en haut (proche plafond) ? tache sèche ou eau active ?
• "WC qui déborde / fuit" → réservoir qui coule en continu OU chasse incomplète ? eau au sol ou juste dans la cuvette ?
• "pas d'eau / pression faible" → tout l'appartement OU un seul robinet/point d'eau ? les voisins ont de l'eau ?
• "odeur d'égout" → dans quelle pièce ? permanent OU seulement après la pluie / la chaleur ?
• "chauffe-eau" → pas d'eau chaude du tout OU eau tiède ? électrique ou à gaz ?

ÉLECTRICITÉ — arbre de diagnostic :
• "disjoncteur saute" → quel appareil déclenche la coupure ? odeur de brûlé oui/non ? un seul circuit OU tout l'appartement ?
• "pas de courant dans une prise/pièce" → une seule prise OU toute la pièce ? les lumières de la pièce fonctionnent ? le disjoncteur a sauté ?
• "étincelles / court-circuit" → URGENCE — vous avez coupé le courant au tableau ? d'où viennent les étincelles ?
• "prise qui chauffe" → quel appareil est branché ? prise récente ou ancienne installation ?
• "plus de courant partout" → compteur CIE (crédit épuisé) ? tableau général vérifié ? voisins ont du courant ?

MAÇONNERIE — arbre de diagnostic :
• "fissure" → dans le mur OU le plafond ? verticale, horizontale OU diagonale (45°) ? elle grandit ou stable ? proche d'une fenêtre/porte ?
• "mur qui s'écaille / enduit décollé" → intérieur OU extérieur ? zone humide OU mur sec ?
• "sol qui bouge / carrelage décollé" → un seul carreau OU plusieurs ? ça sonne creux ? dans quelle pièce ?
• "humidité / moisissures" → toujours présent OU seulement en saison des pluies ? rez-de-chaussée OU étage ?

PEINTURE — arbre de diagnostic :
• "peindre une pièce" → superficie approximative (m²) OU dimensions ? murs seulement OU plafond aussi ? couleur actuelle claire OU sombre ?
• "peinture qui cloque / s'écaille" → zone humide OU mur sec ? moisissures noires visibles ? peinture ancienne OU récente ?

CLIMATISATION — arbre de diagnostic :
• "clim ne refroidit plus" → elle tourne et souffle de l'air OU elle ne démarre pas ? split OU climatiseur fenêtre ? dernier entretien ?
• "fuite d'eau sous la clim" → eau de l'unité intérieure OU extérieure ? gouttes continues OU seulement quand elle tourne ?
• "clim fait du bruit" → bruit au démarrage OU en continu ? grincement, sifflement OU vibration ?

MENUISERIE — arbre de diagnostic :
• "porte qui ferme mal" → elle frotte en haut, en bas OU sur le côté ? porte en bois OU métallique ? récent ou progressif ?
• "fenêtre cassée" → verre brisé OU mécanisme (poignée, paumelle) ? sécurité urgente OU peut attendre ?

SERRURERIE — arbre de diagnostic :
• "serrure bloquée" → clé tourne OU bloquée complètement ? clé cassée dedans ? vous êtes bloqué dehors ?

CARRELAGE — arbre de diagnostic :
• "poser du carrelage" → superficie en m² OU dimensions de la pièce ? sol OU murs OU les deux ? carrelage déjà acheté ?
• "carrelage cassé / décollé" → un seul carreau OU plusieurs ? quelle pièce ? même modèle disponible ?
`

const SYSTEM_EXPERT = `Tu es AfriOne IA, expert diagnostiqueur en artisanat à Abidjan, Côte d'Ivoire.
Tu fonctionnes comme un maître artisan expérimenté qui diagnostique à distance — direct, précis, jamais générique.

CONTEXTE ABIDJAN : logements souvent en béton, humidité tropicale, coupures CIE fréquentes, matériaux Wavin/Cimaf disponibles, quartiers Cocody/Yopougon/Adjamé/Marcory.

${EXPERT_PLAYBOOK}

RÈGLES DE QUESTIONNEMENT OBLIGATOIRES :
1. UNE seule question à la fois — jamais deux questions dans la même bulle
2. Chaque question élimine une hypothèse précise comme un médecin
3. Si l'info est déjà dans la description → ne la redemande JAMAIS
4. Toujours des repères concrets : "sous l'évier", "au tableau électrique", "côté rue"
5. Propose des options quand c'est possible : "A ou B ?" pour accélérer le diagnostic
6. Urgence absolue (étincelles actives, inondation, gaz) → done:true immédiatement
7. Maximum 4 questions avant finalisation`

// ─── Appel OpenAI ─────────────────────────────────────────────────────────────
async function callOpenAI(messages: any[], max_tokens = 600) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages,
    }),
  })
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || '{}'
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

// ─── Fallbacks sans clé API ───────────────────────────────────────────────────
function fallbackQuestion(index: number): { question: string; type: 'yesno' | 'text'; done: boolean } {
  const FALLBACK: { question: string; type: 'yesno' | 'text' }[] = [
    { question: "Le problème vient-il d'un élément visible (tuyau, câble, mur fissuré) ou c'est plutôt un dysfonctionnement (appareil, installation) ?", type: 'yesno' },
    { question: "C'est apparu brusquement (moins de 48h) ou ça empire progressivement depuis plusieurs jours ?", type: 'yesno' },
    { question: "Y a-t-il des dégâts visibles autour — eau au sol, traces d'humidité, odeur, traces de brûlé ?", type: 'yesno' },
    { question: "Avez-vous une idée de la cause — choc, usure, ancienne installation, suite à des travaux ?", type: 'text' },
  ]
  if (index >= FALLBACK.length) return { question: '', type: 'text', done: true }
  return { ...FALLBACK[index], done: false }
}

function fallbackResult(text: string) {
  const lower = text.toLowerCase()
  if (lower.includes('fuite') || lower.includes('eau') || lower.includes('robinet') || lower.includes('wc') || lower.includes('tuyau')) {
    return { summary: "Vous avez une fuite plomberie. Selon la localisation (tuyau visible ou mur humide), l'artisan inspectera les joints, siphons ou la canalisation encastrée.", technical_notes: "Vérifier joints de compression sous l'évier, siphon PVC, joint de cuvette WC. Si mur humide : humidimètre, identifier tracé canalisation encastrée. Matériaux : joint torique ⌀32, siphon universel, clé à molette.", category: 'Plomberie', urgency: 'high', price_min: 8000, price_max: 35000, items_needed: ['Joint torique', 'Siphon PVC', 'Clé à molette'], duration_estimate: '1 à 3 heures' }
  } else if (lower.includes('electr') || lower.includes('courant') || lower.includes('disjoncteur') || lower.includes('prise')) {
    return { summary: "Problème électrique détecté. L'électricien testera les circuits concernés et vérifiera le tableau de distribution.", technical_notes: "Test des circuits avec testeur de prise. Vérifier disjoncteur différentiel 30mA. Contrôler mise à la terre. Prévoir multimètre, testeur de prise, disjoncteur 16A/20A de remplacement.", category: 'Électricité', urgency: 'medium', price_min: 10000, price_max: 45000, items_needed: ['Disjoncteur 16A', 'Câble 2.5mm', 'Testeur de prise'], duration_estimate: '1 à 4 heures' }
  } else if (lower.includes('peinture') || lower.includes('peindre')) {
    return { summary: "Travaux de peinture. L'artisan préparera les surfaces, appliquera un apprêt puis deux couches de finition.", technical_notes: "Poncer les zones écaillées, reboucher fissures avec enduit plâtre, apprêt acrylique, 2 couches peinture vinylique. Bâche de protection obligatoire.", category: 'Peinture', urgency: 'low', price_min: 15000, price_max: 80000, items_needed: ['Peinture vinylique', 'Apprêt', 'Rouleau', 'Bâche'], duration_estimate: '4 à 8 heures' }
  } else if (lower.includes('fissure') || lower.includes('lézard') || lower.includes('mur')) {
    return { summary: "Fissures ou dégradation murale détectées. Le maçon évaluera si c'est superficiel (enduit) ou structurel avant d'intervenir.", technical_notes: "Fissure verticale/horizontale : enduit de rebouchage + fibre. Fissure diagonale 45° : risque structurel, expertise approfondie. Matériaux : enduit de rebouchage, fibre de verre, taloche, peinture de finition.", category: 'Maçonnerie', urgency: 'medium', price_min: 12000, price_max: 60000, items_needed: ['Enduit de rebouchage', 'Fibre de verre', 'Taloche'], duration_estimate: '2 à 6 heures' }
  }
  return { summary: "Intervention artisanale nécessaire. L'artisan effectuera un diagnostic complet sur place.", technical_notes: "Diagnostic sur place indispensable. Matériaux selon constat de l'artisan.", category: 'Maçonnerie', urgency: 'medium', price_min: 10000, price_max: 50000, items_needed: ['Matériaux selon diagnostic sur place'], duration_estimate: '2 à 6 heures' }
}

// ─── Handler principal ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { mode, text, photos = [], qa = [], index = 0, user_id, quartier } = body

  const hasKey = !!process.env.OPENAI_API_KEY

  try {
    // ── MODE START : première question ────────────────────────────────────────
    if (mode === 'start') {
      if (!hasKey) return NextResponse.json(fallbackQuestion(0))

      const systemStart = `${SYSTEM_EXPERT}

Le client décrit son problème pour la première fois. Identifie le domaine (plomberie, électricité, maçonnerie, etc.) et pose la PREMIÈRE question d'élimination la plus pertinente selon l'arbre de diagnostic correspondant.

Si la description est déjà très complète et précise, mets done:true.

Réponds UNIQUEMENT en JSON :
{"question": "Ta question experte ici", "type": "yesno ou text", "done": false}

Choix du type :
- "yesno" : question binaire (A ou B, oui ou non) — client choisit parmi des options
- "text" : question ouverte nécessitant une réponse libre (mesures, description, localisation floue)`

      const result = await callOpenAI(buildMessages(text, photos, systemStart))
      return NextResponse.json(result)
    }

    // ── MODE NEXT : question suivante ─────────────────────────────────────────
    if (mode === 'next') {
      if (!hasKey) return NextResponse.json(fallbackQuestion(index))
      if (index >= 4) return NextResponse.json({ question: '', type: 'text', done: true })

      const qaBlock = qa.map((q: any) => `❓ ${q.question}\n💬 ${q.answer}`).join('\n\n')

      const systemNext = `${SYSTEM_EXPERT}

Tu as déjà posé ${index} question(s). Analyse TOUTES les réponses précédentes et les informations déjà connues.
Ne redemande JAMAIS une information déjà donnée.

Décide :
- Tu as assez d'infos pour un diagnostic précis → done:true
- Il manque encore une info clé → pose la question qui lève le plus d'ambiguïté

Réponds UNIQUEMENT en JSON :
{"question": "Ta question", "type": "yesno ou text", "done": true ou false}`

      const extra = `ÉCHANGES PRÉCÉDENTS :\n${qaBlock}\n\nPROBLÈME INITIAL DU CLIENT :`
      const result = await callOpenAI(buildMessages(text, photos, systemNext, extra))
      return NextResponse.json(result)
    }

    // ── MODE FINALIZE : diagnostic complet ────────────────────────────────────
    if (mode === 'finalize') {
      let result: any

      if (hasKey) {
        const qaBlock = qa.length
          ? 'ÉCHANGES DE DIAGNOSTIC :\n' + qa.map((q: any) => `❓ ${q.question}\n💬 ${q.answer}`).join('\n\n') + '\n\nPROBLÈME INITIAL :'
          : ''

        const systemFinalize = `Tu es AfriOne IA, expert diagnostiqueur artisanal à Abidjan, Côte d'Ivoire.
${EXPERT_PLAYBOOK}

Génère un diagnostic complet basé sur TOUTES les informations recueillies.
Le résumé client : clair, rassurant, 2-3 phrases.
Les notes techniques : pour l'artisan — précises, avec méthode d'intervention, matériaux à apporter, points d'attention.
Prix réalistes en FCFA pour Abidjan (main-d'œuvre + matériaux locaux).

Réponds UNIQUEMENT en JSON avec ces champs EXACTS :
{
  "summary": "Résumé clair pour le client (2-3 phrases en français)",
  "technical_notes": "Notes détaillées pour l'artisan : diagnostic probable, méthode, matériaux à apporter, risques",
  "category": "${CATEGORIES}",
  "urgency": "low|medium|high|emergency",
  "price_min": number,
  "price_max": number,
  "items_needed": ["item1", "item2", "item3"],
  "duration_estimate": "X à Y heures"
}`

        result = await callOpenAI(buildMessages(text, photos, systemFinalize, qaBlock), 900)
      } else {
        result = fallbackResult(text)
      }

      // Normaliser
      result = {
        summary:           result.summary          || 'Problème artisanal détecté, intervention recommandée.',
        technical_notes:   result.technical_notes  || 'Diagnostic complet à réaliser sur place.',
        category:          result.category         || 'Maçonnerie',
        urgency:           result.urgency          || 'medium',
        price_min:         Number(result.price_min)  || 8000,
        price_max:         Number(result.price_max)  || 35000,
        items_needed:      Array.isArray(result.items_needed) ? result.items_needed : [],
        duration_estimate: result.duration_estimate || '2 à 4 heures',
      }

      // Scrape Jumia CI for each item_needed in parallel with DB save
      const jumiaPromise = result.items_needed.length > 0
        ? enrichItemsWithJumia(result.items_needed, result.category)
        : Promise.resolve([])

      // Sauvegarder en base si connecté
      if (user_id) {
        const { data: mission } = await supabaseAdmin
          .from('missions')
          .insert({
            client_id: user_id,
            status:    'diagnostic',
            category:  result.category,
            quartier:  quartier || 'Abidjan',
          })
          .select()
          .single()

        if (mission) {
          const rawContext = JSON.stringify({
            original: text,
            qa,
            photos,
            technical_notes:   result.technical_notes,
            duration_estimate: result.duration_estimate,
          })

          const [, jumiaItems] = await Promise.all([
            supabaseAdmin.from('diagnostics').insert({
              mission_id:          mission.id,
              raw_text:            rawContext,
              ai_summary:          result.summary,
              category_detected:   result.category,
              estimated_price_min: result.price_min,
              estimated_price_max: result.price_max,
              items_needed:        result.items_needed,
              urgency_level:       result.urgency,
            }),
            jumiaPromise,
          ])

          return NextResponse.json({ ...result, mission_id: mission.id, jumia_items: jumiaItems })
        }
      }

      const jumiaItems = await jumiaPromise
      return NextResponse.json({ ...result, jumia_items: jumiaItems })
    }

    return NextResponse.json({ error: 'Mode invalide' }, { status: 400 })

  } catch (err: any) {
    console.error('[diagnostic]', err.message)
    if (mode === 'start' || mode === 'next') return NextResponse.json(fallbackQuestion(index))
    return NextResponse.json(fallbackResult(text))
  }
}
