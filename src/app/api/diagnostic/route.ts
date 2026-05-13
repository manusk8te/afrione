import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { enrichItemsWithJumia } from '@/lib/jumia-lookup'

const CATEGORIES = `Plomberie|Électricité|Maçonnerie|Peinture|Menuiserie|Climatisation|Serrurerie|Carrelage`

// ─── Playbook expert par domaine ─────────────────────────────────────────────
// Chaque arbre a 2 niveaux :
//   NIVEAU 1 — identifier le problème exact (diagnostic)
//   NIVEAU 2 — extraire les signaux de pricing (quantité, surface, matériaux)
const EXPERT_PLAYBOOK = `
PLOMBERIE
• Fuite tuyau visible (évier/lavabo/WC) :
  N1 → robinet qui goutte OU jonction/raccord qui fuit ?
  N2 → l'artisan doit remplacer la pièce ou juste resserrer/recoller ? [impact matériaux]
• Fuite dans mur/plafond :
  N1 → tache sèche (infiltration lente) OU eau qui coule activement ?
  N2 → superficie de la zone humide : petite tache (< 30cm) OU grande zone ? [impact durée]
• WC qui fuit :
  N1 → réservoir qui coule en continu OU chasse incomplète ?
  N2 → WC récent (< 5 ans) OU ancien ? [impact pièce à remplacer]
• Tuyau bouché / pression faible :
  N1 → un seul point d'eau OU toute la maison ?
  N2 → débouchage simple OU remplacement du tuyau ? [impact matériaux]
• PRIX SIGNAL PLOMBERIE : toujours demander "Vous avez déjà les pièces (joint, robinet) ou l'artisan doit les apporter ?"

ÉLECTRICITÉ
• Disjoncteur qui saute :
  N1 → quel appareil précis déclenche la coupure ? odeur de brûlé oui/non ?
  N2 → un seul disjoncteur à remplacer OU problème de câblage ? [impact matériaux + durée]
• Pas de courant dans une prise/pièce :
  N1 → une seule prise OU toute la pièce ?
  N2 → si toute la pièce : combien de prises/interrupteurs à vérifier ? [impact quantité]
• Étincelles / court-circuit → URGENCE done:true
• Installation neuve / ajout de prise :
  N1 → combien de prises à installer ? dans combien de pièces ?
  N2 → tableau électrique accessible et avec place disponible ? [impact durée + matériaux]
• PRIX SIGNAL ÉLECTRICITÉ : demander "Combien de points (prises/interrupteurs) sont concernés ?"

PEINTURE
• Peindre une pièce :
  N1 → dimensions approximatives (ex: "4m × 5m") OU superficie en m² ? [CRITIQUE pour pricing]
  N2 → murs seulement OU plafond aussi ? couleur foncée actuelle (nécessite plus de couches) ?
• Peinture qui cloque/s'écaille :
  N1 → zone humide OU mur sec ? superficie touchée : quelques taches OU toute la surface ?
  N2 → refaire uniquement la zone OU toute la pièce ? [impact surface réelle]
• PRIX SIGNAL PEINTURE : la surface m² est OBLIGATOIRE — si pas donnée, demander "Environ combien de m² de murs à peindre ?"

MAÇONNERIE
• Fissure :
  N1 → verticale/horizontale (enduit) OU diagonale 45° (structure) ?
  N2 → longueur de la fissure : < 50cm, 50cm–2m OU > 2m ? [impact matériaux]
• Humidité/moisissures :
  N1 → rez-de-chaussée OU étage ? saison des pluies OU permanent ?
  N2 → superficie touchée en m² approximatif ? [impact matériaux]
• PRIX SIGNAL MAÇONNERIE : demander "C'est une petite zone (< 1m²) ou une grande surface ?"

CARRELAGE
• Poser du carrelage :
  N1 → sol OU murs OU les deux ? carrelage déjà acheté ou à commander ?
  N2 → superficie exacte en m² ? [CRITIQUE — prix = f(m²)] quelle pièce (cuisine/bain/salon) ?
• Carrelage cassé/décollé :
  N1 → combien de carreaux ? un seul OU plusieurs ?
  N2 → même modèle disponible ou différent (joints à refaire) ?
• PRIX SIGNAL CARRELAGE : la surface m² est OBLIGATOIRE

MENUISERIE
• Porte qui ferme mal :
  N1 → frotte en haut/bas/côté ? bois OU métallique ?
  N2 → simple rabotage/réglage OU remplacement de paumelles/serrure ? [impact matériaux]
• Installation/remplacement :
  N1 → combien de portes/fenêtres concernées ?
  N2 → menuiserie fournie par le client OU artisan doit apporter ? [impact majeur prix]

SERRURERIE
• Serrure bloquée :
  N1 → clé cassée dedans OU mécanisme bloqué ? bloqué dehors OU dedans ?
  N2 → remplacer le barillet seulement OU toute la serrure ? [impact matériaux]

CLIMATISATION
• Clim ne refroidit plus :
  N1 → elle tourne OU elle ne démarre pas ? split (unité intérieure + extérieure) OU fenêtre ?
  N2 → dernier entretien/nettoyage : < 6 mois OU jamais ? [impact durée]
• PRIX SIGNAL CLIM : demander "Quelle puissance (BTU ou CV) et quelle marque ?"
`

const SYSTEM_EXPERT = `Tu es AfriOne IA, expert diagnostiqueur en artisanat à Abidjan, Côte d'Ivoire.
Tu fonctionnes comme un maître artisan expérimenté — direct, précis, jamais générique.

CONTEXTE ABIDJAN : béton, humidité tropicale, coupures CIE, matériaux Wavin/Cimaf/Holcim, marchés Adjamé/Koumassi.

${EXPERT_PLAYBOOK}

RÈGLES STRICTES :
1. UNE seule question à la fois — courte, claire, vocabulaire du quotidien (pas technique)
2. Priorité diagnostic (N1) → puis prix (N2)
3. Jamais redemander ce qui est déjà dans la description
4. Urgence réelle (étincelles, inondation active) → done:true immédiatement
5. Maximum 4 questions — la dernière doit extraire surface/quantité si pas encore connue
6. Si superficie ou quantité déjà connue → ne pas redemander
7. JAMAIS poser de question sur le budget, les matériaux ou les fournitures

TYPES DE RÉPONSE :
- "choice" + "options": ["...", "..."] → quand il y a 2 à 4 options concrètes distinctes (préférer ce type)
- "yesno" → UNIQUEMENT pour de vraies questions oui/non sans ambiguïté (ex: "Y a-t-il une odeur de brûlé ?")
- "text" → pour des mesures, descriptions libres, localisations (ex: "Environ combien de m² ?")`

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

Réponds UNIQUEMENT en JSON (un de ces formats) :

Question avec options concrètes :
{"question": "Question courte ?", "type": "choice", "options": ["Option A", "Option B", "Option C"], "done": false}

Question oui/non pure :
{"question": "Question oui/non ?", "type": "yesno", "done": false}

Question ouverte (mesure, description) :
{"question": "Question ouverte ?", "type": "text", "done": false}

Diagnostic terminé :
{"done": true}

EXEMPLES de bonnes questions choice :
- "C'est quoi exactement ?" → options: ["Robinet qui goutte", "Tuyau qui fuit sous l'évier", "Humidité dans le mur"]
- "Combien de pièces sont touchées ?" → options: ["Une seule pièce", "Plusieurs pièces", "Tout l'appartement"]
- "C'est apparu comment ?" → options: ["Brusquement", "Ça empire progressivement depuis quelques jours"]`

      const result = await callOpenAI(buildMessages(text, photos, systemStart))
      return NextResponse.json(result)
    }

    // ── MODE NEXT : question suivante ─────────────────────────────────────────
    if (mode === 'next') {
      if (!hasKey) return NextResponse.json(fallbackQuestion(index))
      if (index >= 4) return NextResponse.json({ question: '', type: 'text', done: true })

      const qaBlock = qa.map((q: any) => `❓ ${q.question}\n💬 ${q.answer}`).join('\n\n')

      const hasSurfaceInfo = qa.some((q: any) =>
        /m²|mètre|surface|superficie|dimension|carreaux|grande pièce|petite pièce/i.test(q.question + q.answer)
      )
      const hasQtyInfo = qa.some((q: any) =>
        /combien|nombre|plusieurs|une seule|tout l'appart|une pièce/i.test(q.question + q.answer)
      )

      const lastQuestionInstruction = (index >= 3)
        ? `\nC'est la DERNIÈRE question. Une seule règle :

Si c'est un travail de SURFACE (peinture, carrelage, enduit, humidité) et qu'on n'a pas encore les dimensions → demande la superficie ou les dimensions approximatives de la zone.
Si c'est un travail en NOMBRE (prises, interrupteurs, robinets, carreaux cassés) et qu'on n'a pas la quantité → demande combien de points sont concernés.
Dans tous les autres cas → done:true, on a assez d'infos.

Ne pose JAMAIS de question sur les matériaux, le budget ou les fournitures — c'est le travail de l'artisan.`
        : ''

      const systemNext = `${SYSTEM_EXPERT}

Tu as déjà posé ${index} question(s). Analyse TOUTES les réponses précédentes.
Ne redemande JAMAIS une information déjà donnée.
${lastQuestionInstruction}

Décide :
- Tu as assez d'infos pour un diagnostic et un prix précis → done:true
- Il manque une info clé → pose la question la plus utile pour le pricing

Réponds UNIQUEMENT en JSON (même format que pour la première question — choice/yesno/text ou done:true)`

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

Génère un diagnostic complet basé sur TOUTES les informations recueillies.
Résumé client : clair, rassurant, 2-3 phrases maximum.
Notes techniques : pour l'artisan — méthode précise, matériaux à apporter, points d'attention.

RÈGLES PRIX (marché informel Abidjan) :
- Réparation simple (joint, débouchage, réglage) : 2 000–8 000 FCFA total
- Remplacement pièce + main-d'œuvre : 5 000–25 000 FCFA
- Travaux surface (peinture, carrelage) : 500–2 000 FCFA/m² main-d'œuvre seule
- Ne JAMAIS dépasser ces fourchettes sauf urgence ou travaux lourds

RÈGLES DURÉE — être précis selon le cas réel :
- Débouchage, réglage, remplacement joint → "30 minutes" ou "45 minutes"
- Remplacement robinet/interrupteur/serrure → "1 heure" ou "1h30"
- Réparation fissure, petite zone → "2 heures"
- Installation neuve, peinture petite pièce → "3 heures" à "1 journée"

Réponds UNIQUEMENT en JSON avec ces champs EXACTS :
{
  "summary": "string",
  "technical_notes": "string",
  "category": "${CATEGORIES}",
  "urgency": "low|medium|high|emergency",
  "price_min": number,
  "price_max": number,
  "duration_estimate": "30 minutes|45 minutes|1 heure|1h30|2 heures|3 heures|4 heures|1 journée",
  "surface_m2": number | null,
  "items_needed": [
    {"name": "nom exact du matériau", "qty": number, "unit": "unité|ml|m²|sac|kit"}
  ]
}`

        result = await callOpenAI(buildMessages(text, photos, systemFinalize, qaBlock), 900)
      } else {
        result = fallbackResult(text)
      }

      // Normaliser — items_needed accepte [{name, qty, unit}] ou ["string"] (legacy)
      const rawItems = Array.isArray(result.items_needed) ? result.items_needed : []
      const normalizedItems = rawItems.map((it: any) =>
        typeof it === 'string'
          ? { name: it, qty: 1, unit: 'unité' }
          : { name: it.name || it, qty: Number(it.qty) || 1, unit: it.unit || 'unité' }
      )

      result = {
        summary:              result.summary         || 'Problème artisanal détecté, intervention recommandée.',
        technical_notes:      result.technical_notes || 'Diagnostic complet à réaliser sur place.',
        category:             result.category        || 'Maçonnerie',
        urgency:              result.urgency         || 'medium',
        price_min:            Number(result.price_min) || 5000,
        price_max:            Number(result.price_max) || 20000,
        items_needed:         normalizedItems,
        duration_estimate: result.duration_estimate || '1 heure',
        surface_m2:        result.surface_m2 != null ? Number(result.surface_m2) : null,
        budget_client:     result.budget_client || null,
      }

      const jumiaPromise = normalizedItems.length > 0
        ? enrichItemsWithJumia(normalizedItems.map((i: any) => i.name), result.category)
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
