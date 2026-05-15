import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { enrichItemsWithJumia } from '@/lib/jumia-lookup'

export const dynamic = 'force-dynamic'

const CATEGORIES = `Plomberie|Électricité|Maçonnerie|Peinture|Menuiserie|Climatisation|Serrurerie|Carrelage`

// ─── Connaissance terrain Abidjan ─────────────────────────────────────────────
// Structure : pour chaque domaine, les vraies causes fréquentes + ce qui permet
// de les distinguer + les signaux de prix critiques.
const TERRAIN_KNOWLEDGE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLOMBERIE — causes fréquentes à Abidjan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Causes terrain (par ordre de fréquence) :
① Joint torique usé sous robinet ou raccord — clapet/siège plat sur robinetterie Africaine bon marché
② Siphon PVC fissuré ou bague de serrage desserrée (vibrations de pompe SODECI)
③ Tuyau PVC fêlé par choc thermique (eau froide/chaude alternant — très fréquent avec eau solaire)
④ Infiltration descendant du toit-terrasse non étanche (carrelage fissuré, chape fissurée)
⑤ Canalisation encastrée percée — souvent après des travaux récents (perçage accidentel)
⑥ WC : flotteur défaillant OU joint de cuvette au sol OU mécanisme de chasse usé

Signaux clés pour le prix :
- La fuite est sur tuyau apparent/accessible vs encastrée dans le mur (×3 sur la durée si encastrée)
- Besoin de couper l'eau générale ou seulement le robinet local ?
- Client fournit les pièces ou artisan les apporte ? (impact direct sur le prix total)
- Pression eau SODECI : stable ou coupures fréquentes ? (si coupures → retour de pression = coup de bélier possible)

Questions qui font la différence :
- "Vous pouvez toucher l'endroit exact où ça fuit ?" → localise précisément
- "Il y a de l'eau liquide qui coule ou une tache humide/sèche ?" → fuite active vs infiltration
- "Quand vous fermez le robinet principal, la fuite s'arrête ?" → isole le circuit

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÉLECTRICITÉ — causes fréquentes à Abidjan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Causes terrain :
① Surcharge sur un circuit — trop d'appareils sur un même disjoncteur (AC + frigo + micro-onde)
② Court-circuit sur fil vieilli — isolant PVC qui craquelle sous chaleur prolongée (40°C+)
③ Prise desserrée/brûlée — oxydation rapide en zone humide (Abidjan côtière)
④ Disjoncteur vieilli qui saute pour rien — seuil de déclenchement qui baisse avec le temps
⑤ Problème CIE (pas un problème interne) — voisins également touchés = appeler CIE
⑥ Mise à la terre absente — très fréquent dans les vieilles constructions, cause des chocs

Signaux urgence absolue : odeur de brûlé persistante, fil noirci visible, étincelles → STOP, disjoncteur général coupé

Signaux clés pour le prix :
- Prise/interrupteur isolé vs circuit entier vs tout le logement
- Tableau électrique accessible et avec place disponible ?
- Installation encastrée (dans mur) vs apparente (dans gaine) — durée ×2 si encastrée

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MAÇONNERIE — causes fréquentes à Abidjan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Causes terrain :
① Fissure enduit (capillaire) — retrait normal du béton, pas structurel. < 0.3mm, stable
② Fissure de tassement différentiel — bâtiment posé sur sol argileux ou remblai. Diagonale.
③ Infiltration toit-terrasse — joint de dilatation absent ou carrelage terrasse fissuré
④ Remontées capillaires — mur rez-de-chaussée humide depuis le bas (sol non drainé)
⑤ Carbonatation béton vieilli — porosité augmente, humidité s'infiltre, armatures rouillent

Diagnostic fissure (critique) :
- Verticale/horizontale en milieu de mur → enduit, pas structurel
- Diagonale à 45° depuis angle de fenêtre/porte → tassement différentiel → expert avant travaux
- En étoile depuis un point → impact mécanique → rebouchage simple
- Fissure traversante (voit la lumière) → structurel potentiel → prudence

Signaux clés pour le prix :
- Surface en m² (surface murale totale à traiter)
- Intérieur ou extérieur (ravalement façade = prix ×2-3)
- Humidité associée ? (si oui, traitement hydrofuge avant rebouchage = étape supplémentaire)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PEINTURE — signaux critiques
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
La surface m² est LA variable de prix numéro 1.
Autres variables :
- Couleur actuelle foncée → couche de fond obligatoire (coût +20%)
- Peinture qui s'écaille → ponçage/préparation = 40% du temps total
- Salle de bain ou cuisine → peinture anti-humidité obligatoire (prix matériaux ×1.5)
- Plafond inclus → ajouter 30-40% sur le temps

Formule rapide : pièce standard 12m² = environ 4 murs × (3m × 3m) = ~36m² de surface murale

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLIMATISATION — causes fréquentes à Abidjan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Causes terrain :
① Filtre encrassé (90% des "clim qui ne refroidit plus") — entretien négligé > 6 mois
② Fuite de gaz frigorigène R410A ou R22 — eau qui coule de l'unité intérieure, givre
③ Sonde de température défaillante — clim tourne mais pas au bon régime
④ Compresseur défaillant — bruit anormal, chaud en sortie même après 30 min
⑤ Condenseur encrassé côté extérieur — unité extérieure obstruée par poussière

Signal priorité : "Elle tourne mais souffle de l'air tiède" = gaz ou compresseur (coûteux)
vs "Elle ne démarre pas" = électronique ou relais (souvent moins grave)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CARRELAGE / MENUISERIE / SERRURERIE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Carrelage : surface m² est critique. Dépose ancien carrelage = +50% durée et prix.
Menuiserie : fourniture par client ou artisan = impact majeur. Bois local Samba/Iroko vs bois importé.
Serrurerie : barillet seul vs serrure complète. Porte blindée vs bois = techniques différentes.
`

// ─── Identité et processus de raisonnement ────────────────────────────────────
const EXPERT_IDENTITY = `Tu es le système de diagnostic d'AfriOne, une plateforme artisanale professionnelle à Abidjan, Côte d'Ivoire.
Tu incarnes un expert-diagnostiqueur senior avec 20 ans d'expérience terrain : plombier, électricien, maçon — tu connais tous les problèmes réels des bâtiments ivoiriens.

Tu penses et tu agis comme un détective, pas comme un formulaire.

PROCESSUS INTERNE (avant chaque question) :
1. Analyse : qu'est-ce que le client a dit exactement ? Quels mots-clés ? Quelle gravité ?
2. Hypothèses : quelles sont les 2-4 causes les plus probables compte tenu du contexte ?
3. Question optimale : quelle question unique permettrait d'éliminer la moitié des hypothèses d'un coup ?
4. Formulation : la question doit montrer que tu sais de quoi tu parles — référence la description du client

STYLE DE TES QUESTIONS :
✓ "Pour une fuite de ce type, ça vient généralement de deux endroits — d'où vient l'eau exactement ?" → type choice, options: ["Du siphon en plastique sous l'évier", "De la jonction du robinet/tuyau d'alimentation"]
✓ "Le disjoncteur saute comment ?" → type choice, options: ["Dès qu'on allume un appareil précis", "Aléatoirement sans raison apparente", "Il retombe immédiatement dès qu'on le relève"]
✓ "Y a-t-il une odeur de brûlé ?" → type yesno (vraie oui/non, aucune alternative nommée)
✗ JAMAIS : "Depuis combien de temps avez-vous ce problème ?" (générique et inutile pour le prix)
✗ JAMAIS : "Avez-vous contacté un professionnel ?" (hors sujet)
✗ JAMAIS : "Quel est votre budget ?" (interdit)

CONNAISSANCE TERRAIN :
${TERRAIN_KNOWLEDGE}

RÈGLES ABSOLUES :
— UNE seule question à la fois, courte, dans le langage du quotidien (pas de jargon technique)
— Ne jamais redemander quelque chose déjà dit ou implicitement connu
— Urgence réelle (étincelles actives, eau qui monte, odeur de brûlé forte) → done:true immédiatement avec note d'urgence
— La question doit MONTRER que tu as compris le problème spécifique, pas être générique

RÈGLE CRITIQUE SUR LES TYPES — respecter IMPÉRATIVEMENT :
— "yesno" = UNIQUEMENT les questions dont la SEULE réponse sensée est "Oui" ou "Non"
  ✓ Exemples corrects : "Y a-t-il une odeur de brûlé ?" / "Est-ce que ça fait du bruit ?"
  ✗ INTERDIT si la question propose deux alternatives nommées ("brusquement OU progressivement", "une prise OU tout le circuit", "intérieur OU extérieur")
— "choice" = toute question qui oppose deux alternatives ou plus, même formulée avec "ou"
  → Dans ce cas, TOUJOURS fournir "options" avec les alternatives comme items distincts
  ✓ Exemple : "C'est apparu comment ?" → type:"choice", options:["Brusquement depuis moins de 48h","Ça empire progressivement depuis plusieurs jours"]
  ✓ Exemple : "Où exactement ?" → type:"choice", options:["Sous l'évier (siphon/robinet)","Dans le mur ou le plafond","Au sol près du WC"]
— "text" = mesures, dimensions, descriptions libres`

// ─── Appel OpenAI ─────────────────────────────────────────────────────────────
async function callOpenAI(messages: any[], max_tokens = 900) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
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
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || '{}'
  return JSON.parse(content)
}

// ─── Normalise la réponse question ───────────────────────────────────────────
function normalizeQuestion(raw: any, fallbackIndex: number): {
  question: string; type: 'yesno'|'choice'|'text'; options?: string[]; done: boolean
} {
  if (raw.done === true) return { question: '', type: 'text', done: true }

  const question = (raw.question || '').trim()
  if (!question) return { question: '', type: 'text', done: true }

  let type: 'yesno'|'choice'|'text' =
    raw.type === 'yesno' ? 'yesno' :
    raw.type === 'choice' ? 'choice' : 'text'

  const rawOptions: string[] = Array.isArray(raw.options)
    ? raw.options.filter((o: any) => typeof o === 'string' && o.trim())
    : []

  // Garde-fou : yesno interdit pour les questions "A ou B ?"
  // Une vraie question oui/non ne contient jamais "ou" entre deux alternatives
  if (type === 'yesno' && /\bou\b/i.test(question)) {
    if (rawOptions.length >= 2) {
      // L'IA a quand même fourni des options → choice
      type = 'choice'
    } else {
      // Pas d'options → texte libre, toujours mieux que Oui/Non trompeur
      type = 'text'
    }
  }

  if (type === 'choice' && rawOptions.length < 2) type = 'text'

  return {
    question,
    type,
    options: type === 'choice' ? rawOptions : undefined,
    done: false,
  }
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
function fallbackQuestion(index: number): { question: string; type: 'yesno'|'text'|'choice'; options?: string[]; done: boolean } {
  const F: { question: string; type: 'yesno'|'text'|'choice'; options?: string[] }[] = [
    { question: "Pour mieux cerner le problème — c'est quoi exactement qui ne va pas ?", type: 'choice', options: ['Une fuite d\'eau visible', 'Un problème électrique (courant, prise, disjoncteur)', 'Des dégradations (fissure, humidité, peinture)', 'Un appareil ou installation qui ne fonctionne plus'] },
    { question: "Y a-t-il un danger immédiat — eau qui coule activement, odeur de brûlé, étincelles ?", type: 'yesno' },
    { question: "C'est dans quelle pièce exactement, et quelle surface est concernée ?", type: 'text' },
    { question: "Vous êtes dans une maison ou un appartement ?", type: 'choice', options: ['Maison individuelle (RDC)', 'Maison individuelle (étage)', 'Appartement (étage bas, 1-3)', 'Appartement (étage haut, 4+)'] },
    { question: "Des travaux ont été faits récemment dans cette zone ?", type: 'yesno' },
    { question: "Vous avez une idée de la cause — choc, usure, pluies, coupure de courant ?", type: 'text' },
  ]
  if (index >= F.length) return { question: '', type: 'text', done: true }
  return { ...F[index], done: false }
}

function fallbackResult(text: string) {
  const lower = text.toLowerCase()
  if (lower.includes('fuite') || lower.includes('eau') || lower.includes('robinet') || lower.includes('wc') || lower.includes('tuyau')) {
    return {
      summary: "Le problème signalé correspond à une fuite plomberie. Les causes les plus fréquentes à Abidjan sont un joint torique usé sous un robinet ou raccord, un siphon fissuré, ou une infiltration descendant du toit. L'artisan commencera par couper l'arrivée d'eau concernée, puis localisera la fuite avec précision — un joint de robinet se règle en 20 minutes, une canalisation encastrée peut nécessiter 2 à 3 heures. Il est important de ne pas laisser une fuite active trop longtemps : l'humidité détériore rapidement l'enduit et peut atteindre les armatures béton.",
      technical_notes: "1. Fermer le robinet d'isolement local (ou général si pas de robinet local). 2. Sécher la zone et identifier visuellement l'origine exacte de la fuite (jonction, corps robinet, siphon, raccord). 3. Joint torique ⌀32 ou ⌀40 selon robinetterie — dévisser presse-garniture, remplacer le joint, resserrer sans forcer. 4. Siphon PVC : dévisser à la main, inspecter la bague de serrage et la rondelle plate, remplacer si usée. 5. Raccord fileté : nettoyer les filets, filasse + pâte à joint sur 6-8 spires, revisser modérément. 6. Tester l'étanchéité en rouvrant progressivement l'eau — vérifier 5 minutes sous pression. 7. Si humidité dans mur : utiliser humidimètre, mesurer le taux, noter la superficie touchée.",
      category: 'Plomberie', urgency: 'high', price_min: 5000, price_max: 35000,
      items_needed: [{ name: 'Joint torique ⌀32', qty: 2, unit: 'unité' }, { name: 'Filasse + pâte à joint', qty: 1, unit: 'kit' }],
      duration_estimate: '1 heure'
    }
  } else if (lower.includes('electr') || lower.includes('courant') || lower.includes('disjoncteur') || lower.includes('prise')) {
    return {
      summary: "Le problème décrit correspond à une anomalie électrique. À Abidjan, la grande majorité des cas de ce type vient soit d'une surcharge sur un circuit (trop d'appareils), soit d'un disjoncteur vieilli dont le seuil de déclenchement a baissé avec le temps. Avant l'arrivée de l'artisan, vérifiez si vos voisins ont aussi le courant — si oui, c'est interne à votre logement. Évitez de toucher les fils ou les prises. L'électricien commencera par tester chaque circuit au multimètre pour isoler la cause exacte avant d'intervenir.",
      technical_notes: "1. Vérifier si les voisins ont le courant (distingue problème CIE vs interne). 2. Au tableau : identifier quel disjoncteur a sauté, le relever, observer s'il retombe immédiatement (court-circuit) ou reste levé (surcharge résolue). 3. Tester chaque prise du circuit concerné avec testeur de prise. 4. Mesurer la tension au tableau : doit être 220V ±5%. 5. Inspecter visuellement les prises et interrupteurs — traces noires, brûlures, fils dénudés = remplacement obligatoire. 6. Si disjoncteur à remplacer : noter la référence (16A, 20A, 32A) et le type (Phase + Neutre ou différentiel 30mA). 7. Si câble endommagé : remplacer sur toute la longueur du circuit, pas de jonction en milieu de gaine.",
      category: 'Électricité', urgency: 'medium', price_min: 8000, price_max: 45000,
      items_needed: [{ name: 'Disjoncteur 16A bipolaire', qty: 1, unit: 'unité' }],
      duration_estimate: '1h30'
    }
  } else if (lower.includes('peinture') || lower.includes('peindre') || lower.includes('repeindre')) {
    return {
      summary: "Travaux de peinture à réaliser. La préparation des surfaces représente 40% du travail total et conditionne la durabilité du résultat : les zones écaillées doivent être poncées, les fissures rebouchées à l'enduit de lissage, et un apprêt appliqué avant la peinture finale. En zone humide (salle de bain, cuisine), une peinture anti-humidité est obligatoire sinon la peinture se décolle en quelques mois. Comptez 2 couches de finition minimum pour une bonne couvrance et une peinture lavable.",
      technical_notes: "1. Bâcher le sol et protéger les menuiseries au ruban. 2. Poncer les zones écaillées (papier grain 80 puis 120), dépoussiérer. 3. Reboucher fissures à l'enduit de lissage en poudre (laisser sécher 2h minimum, poncer, repasser si nécessaire). 4. Apprêt acrylique 1 couche (séchage 1h à 40°C ambiant). 5. Peinture vinylique lavable : 2 couches avec séchage 1h30 entre chaque. En salle de bain : glycéro ou peinture spéciale humidité. 6. Calcul : 1L couvre environ 8-10m² (2 couches). Surface murale réelle = périmètre de la pièce × hauteur, moins les ouvertures. 7. Finir par les angles et plinthes au pinceau avant le rouleau.",
      category: 'Peinture', urgency: 'low', price_min: 15000, price_max: 80000,
      items_needed: [{ name: 'Peinture vinylique lavable', qty: 10, unit: 'L' }, { name: 'Apprêt acrylique', qty: 5, unit: 'L' }],
      duration_estimate: '1 journée'
    }
  } else if (lower.includes('fissure') || lower.includes('lézard') || lower.includes('humidité') || lower.includes('moisissure')) {
    return {
      summary: "Des fissures ou dégradations murales sont signalées. Le diagnostic clé est de distinguer une fissure superficielle d'enduit (aucun risque, réparation simple) d'une fissure structurelle (diagonale à 45°, traversante) qui nécessite une expertise avant travaux. À Abidjan, les fissures apparaissent souvent en saison sèche (retrait du béton) ou après les premières grosses pluies (tassement). Si des moisissures sont présentes, il faut impérativement traiter l'humidité avant de repeindre, sinon elles reviennent en quelques semaines.",
      technical_notes: "1. Classifier la fissure : verticale/horizontale = enduit (bénin) ; diagonale 45° depuis angle ouverture = tassement (surveiller) ; étoile = impact (bénin). 2. Mesurer la largeur au calibre ou carte : < 0.2mm = capillaire (enduit) ; > 0.3mm = active (surveiller avec repère crayon + date). 3. Traitement fissure enduit : brosser, souffler, enduire avec enduit de rebouchage en deux passes (fond + finition), poncer, appliquer fibre de verre en renfort si > 5cm. 4. Si humidité associée : appliquer hydrofuge de surface (Keim, Sika) avant l'enduit. Attendre 24h de séchage minimum. 5. Traitement moisissures : nettoyer à l'eau de Javel diluée (1:5), laisser agir 15 min, sécher, appliquer antifongique avant de repeindre. 6. Ravalement façade extérieure : crépi à la projection ou manuel avec taloche, accrochage obligatoire sur béton lisse.",
      category: 'Maçonnerie', urgency: 'medium', price_min: 8000, price_max: 60000,
      items_needed: [{ name: 'Enduit de rebouchage en poudre 5kg', qty: 1, unit: 'sac' }, { name: 'Bande fibre de verre', qty: 1, unit: 'rouleau' }],
      duration_estimate: '3 heures'
    }
  }
  return {
    summary: "Problème artisanal détecté nécessitant une intervention sur place. L'artisan effectuera d'abord un diagnostic visuel complet avant de décider de la méthode et des matériaux nécessaires.",
    technical_notes: "1. Diagnostic visuel complet de la zone concernée. 2. Identifier la cause racine avant de commencer à intervenir. 3. Lister les matériaux nécessaires selon constat. 4. Établir un plan d'intervention étape par étape avec le client. 5. Valider la réparation avant de partir.",
    category: 'Maçonnerie', urgency: 'medium', price_min: 10000, price_max: 50000,
    items_needed: [], duration_estimate: '2 heures'
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { mode, text, photos = [], qa = [], index = 0, user_id, quartier } = body

  const hasKey = !!process.env.OPENAI_API_KEY

  const MIN_Q = 4  // questions min avant de pouvoir terminer
  const MAX_Q = 6  // questions max au total

  try {
    // ── MODE START ────────────────────────────────────────────────────────────
    if (mode === 'start') {
      if (!hasKey) return NextResponse.json(fallbackQuestion(0))

      const systemStart = `${EXPERT_IDENTITY}

Le client décrit son problème pour la première fois. Tu as accès à ta connaissance terrain d'Abidjan.

PROCESSUS OBLIGATOIRE avant de formuler ta question :
① Identifie le domaine (plomberie, électricité, maçonnerie, peinture, menuiserie, clim, serrurerie, carrelage)
② Liste mentalement les 2-4 causes les plus probables pour CE problème précis dans le contexte d'Abidjan
③ Détermine ce que TU NE SAIS PAS ENCORE et qui est critique pour établir la cause exacte
④ Formule une question qui cible cette ambiguïté précise — et qui MONTRE que tu as compris le problème

RÈGLE ABSOLUE : Ne pose JAMAIS done:true dès le premier échange — il manque toujours une info critique.
Si la description est déjà très précise → demande la localisation exacte ou l'étendue pour le pricing.
Si urgence réelle (étincelles, inondation, odeur forte de brûlé) → done:true avec mention urgence dans la question.

FORMAT DE RÉPONSE (JSON uniquement) :

Question avec options :
{"question": "texte ?", "type": "choice", "options": ["Option A", "Option B", "Option C"], "done": false}

Question oui/non :
{"question": "texte ?", "type": "yesno", "done": false}

Question ouverte :
{"question": "texte ?", "type": "text", "done": false}

Urgence :
{"question": "urgence note", "type": "text", "done": true}

BONS EXEMPLES — la question doit être spécifique et montrer de l'expertise :
- Client dit "fuite sous l'évier" → "Pour ce type de fuite, il y a souvent deux endroits : le siphon en plastique en bas, ou le raccord à l'entrée du tuyau d'alimentation en haut. Vous pouvez me dire c'est plutôt d'où l'eau sort ?" → options: ["Du coude en plastique en bas (le siphon)", "De la jonction du tuyau en haut", "Je vois pas exactement d'où ça vient"]
- Client dit "disjoncteur qui saute" → "Quand le disjoncteur saute, c'est en allumant un appareil précis ou ça saute tout seul sans raison apparente ?" → options: ["Dès qu'on allume un appareil précis (lequel ?)", "Ça saute aléatoirement même sans appareil", "Dès qu'on relève le disjoncteur il retombe"]
- Client dit "fissure dans le mur" → "La fissure est dans quel sens ?" → options: ["Droite (horizontale ou verticale)", "En diagonale à 45° depuis un angle de porte ou fenêtre", "En étoile/éclats depuis un point"]`

      const raw = await callOpenAI(buildMessages(text, photos, systemStart))
      return NextResponse.json(normalizeQuestion(raw, 0))
    }

    // ── MODE NEXT ─────────────────────────────────────────────────────────────
    if (mode === 'next') {
      if (!hasKey) return NextResponse.json(fallbackQuestion(index))
      if (index >= MAX_Q) return NextResponse.json({ question: '', type: 'text', done: true })

      const qaBlock = qa.map((q: any, i: number) => `Q${i+1}: ${q.question}\nR${i+1}: ${q.answer}`).join('\n\n')

      const canFinish = index >= MIN_Q

      // Ce que le système cherche à établir pour un diagnostic complet
      const convergenceGuide = `
POUR UN DIAGNOSTIC COMPLET, tu dois avoir établi les points suivants — vérifie ce qui est déjà connu vs ce qui manque :
□ TYPE EXACT du problème (cause probable identifiée, pas juste le symptôme)
□ LOCALISATION précise (quelle pièce, accessible ou encastré, étage)
□ ÉTENDUE / QUANTITÉ (surface m², nombre d'éléments, longueur fissure…)
□ CONTEXTE BÂTIMENT si pertinent (âge, type construction, récents travaux)
□ SIGNAL D'URGENCE vérifié (y a-t-il un risque immédiat ?)

${canFinish
  ? `Tu peux décider de terminer (done:true) si tu as établi le type exact ET au moins l'étendue/quantité pour le pricing. Si une variable critique manque encore, continue.`
  : `OBLIGATOIRE : ${index} question(s) posée(s), minimum ${MIN_Q}. Tu dois poser une autre question. done:true est INTERDIT.`
}`

      // Guide pour la dernière question
      const lastQ = index >= MAX_Q - 1
        ? `\nC'est ta DERNIÈRE question autorisée. Si l'étendue ou la surface n'est pas encore connue pour un travail de surface → la demander. Sinon → done:true.`
        : ''

      const systemNext = `${EXPERT_IDENTITY}

Tu mènes un diagnostic en cours. Tu as posé ${index} question(s).

${convergenceGuide}
${lastQ}

ANALYSE LES ÉCHANGES PRÉCÉDENTS avec soin :
— Ce que tu sais maintenant vs ce que tu cherches encore
— La question suivante doit REFERENCER ce qui a été dit et cibler LA variable manquante la plus critique
— Ne jamais reformuler ce qui est déjà connu
— La question doit montrer que tu as suivi le fil de la conversation

FORMAT : JSON uniquement (choice/yesno/text selon ce qui est le plus approprié, ou done:true si autorisé et pertinent)`

      const extra = `ÉCHANGES DE DIAGNOSTIC (${index} questions posées) :\n${qaBlock}\n\nDESCRIPTION INITIALE DU CLIENT :`
      const raw = await callOpenAI(buildMessages(text, photos, systemNext, extra))
      const normalized = normalizeQuestion(raw, index)

      if (normalized.done && !canFinish) {
        return NextResponse.json(fallbackQuestion(index))
      }

      return NextResponse.json(normalized)
    }

    // ── MODE FINALIZE ─────────────────────────────────────────────────────────
    if (mode === 'finalize') {
      let result: any

      if (hasKey) {
        const qaBlock = qa.length
          ? 'ÉCHANGES DE DIAGNOSTIC :\n' + qa.map((q: any, i: number) => `Q${i+1}: ${q.question}\nR${i+1}: ${q.answer}`).join('\n\n') + '\n\nDESCRIPTION INITIALE :'
          : ''

        const systemFinalize = `Tu es le moteur de diagnostic d'AfriOne, plateforme artisanale à Abidjan.
Tu as mené un diagnostic complet. Tu dois maintenant produire un rapport de diagnostic professionnel.

${TERRAIN_KNOWLEDGE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RAPPORT CLIENT (champ "summary")
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Destiné au client — quelqu'un qui ne connaît rien à l'artisanat.
5 à 8 phrases. Structure obligatoire :
① CE QUI SE PASSE EXACTEMENT — nomme le problème diagnostiqué précisément (pas "problème artisanal")
② POURQUOI — la cause probable identifiée pendant le diagnostic (usure, choc thermique, humidité, surcharge…)
③ CE QUE L'ARTISAN VA FAIRE — les 2-3 étapes principales en termes simples (sans jargon)
④ DURÉE ET IMPLICATION POUR LE CLIENT — combien de temps, faut-il quitter la pièce/couper l'eau/l'électricité
⑤ CONSEIL PRÉVENTIF — une chose concrète à faire pour éviter que ça revienne

Ton : expert mais accessible. Pas vague. Pas de "l'artisan interviendra selon le constat sur place".
Spécifique à CE problème précis, pas un texte qui pourrait s'appliquer à n'importe quel cas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NOTES TECHNIQUES (champ "technical_notes")
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Destiné à L'ARTISAN qui arrive sur place. Liste numérotée, 5 à 8 étapes.
Structure :
① ACTION IMMÉDIATE (couper l'eau/courant, sécuriser…)
② DIAGNOSTIC SUR PLACE (quoi inspecter en premier, avec quoi)
③ MÉTHODE D'INTERVENTION étape par étape avec précisions techniques
④ MATÉRIAUX avec références précises (diamètres, ampérage, volume, marque si pertinent)
⑤ POINTS D'ATTENTION / PIÈGES FRÉQUENTS dans ce type d'intervention à Abidjan
⑥ CRITÈRE DE VALIDATION — comment confirmer que la réparation est réussie avant de partir
Langage technique précis. Références matériaux réelles disponibles à Abidjan (Wavin, PVC PN10, disjoncteur Legrand/Schneider, Holcim, Sika…).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIX (marché informel Abidjan 2025)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Main-d'œuvre uniquement (matériaux en plus si artisan les apporte) :
- Joint/réglage simple : 2 000–6 000 FCFA
- Remplacement pièce simple (robinet, prise, interrupteur) : 5 000–15 000 FCFA
- Débouchage : 5 000–12 000 FCFA
- Peinture 1 pièce (m²) : 600–1 500 FCFA/m² MO seule
- Carrelage pose : 1 500–3 500 FCFA/m² MO seule
- Électricité (tirage câble, ajout circuit) : 8 000–25 000 FCFA
- Climatisation entretien : 8 000–15 000 FCFA / réparation gaz : 25 000–60 000 FCFA
- Maçonnerie rebouchage/fissures (m²) : 3 000–8 000 FCFA/m²

DURÉE précise selon le cas réel :
30 minutes | 45 minutes | 1 heure | 1h30 | 2 heures | 3 heures | 4 heures | 1 journée | 1 à 2 jours

MATÉRIAUX (items_needed) :
- Maximum 4 items. Uniquement pièces à remplacer et consommables.
- JAMAIS les outils de l'artisan (clé, tournevis, perceuse, taloche, multimètre…)
- Quantités précises si connues (ex: "Peinture vinylique 10L" pas "de la peinture")
- Si réparation = réglage pur → items_needed vide []

FORMAT JSON EXACT :
{
  "summary": "string — 5 à 8 phrases spécifiques au cas",
  "technical_notes": "string — liste numérotée 5-8 étapes pour l'artisan",
  "category": "${CATEGORIES}",
  "urgency": "low|medium|high|emergency",
  "price_min": number,
  "price_max": number,
  "duration_estimate": "string",
  "surface_m2": number | null,
  "items_needed": [{"name": "string", "qty": number, "unit": "string"}]
}`

        result = await callOpenAI(buildMessages(text, photos, systemFinalize, qaBlock), 2000)
      } else {
        result = fallbackResult(text)
      }

      const TOOLS_RE = /\b(clé (à molette|plate|allen|dynamométrique)|tournevis|perceuse|niveau (à bulle)?|taloche|truelle|spatule|marteau|scie|pince|mètre ruban|testeur (de prise)?|multimètre|bâche|ruban (de masquage|adhésif|américain)|gants|masque|casque|lunettes de protection)\b/i
      const rawItems = Array.isArray(result.items_needed) ? result.items_needed : []
      const normalizedItems = rawItems
        .map((it: any) =>
          typeof it === 'string'
            ? { name: it, qty: 1, unit: 'unité' }
            : { name: it.name || it, qty: Number(it.qty) || 1, unit: it.unit || 'unité' }
        )
        .filter((it: any) => it.name && !TOOLS_RE.test(it.name))
        .slice(0, 4)

      result = {
        summary:           result.summary         || 'Problème artisanal identifié, intervention recommandée.',
        technical_notes:   result.technical_notes || 'Diagnostic complet à réaliser sur place.',
        category:          result.category        || 'Maçonnerie',
        urgency:           result.urgency         || 'medium',
        price_min:         Number(result.price_min) || 5000,
        price_max:         Number(result.price_max) || 20000,
        items_needed:      normalizedItems,
        duration_estimate: result.duration_estimate || '1 heure',
        surface_m2:        result.surface_m2 != null ? Number(result.surface_m2) : null,
        budget_client:     result.budget_client || null,
      }

      const jumiaPromise = normalizedItems.length > 0
        ? enrichItemsWithJumia(normalizedItems.map((i: any) => i.name), result.category)
        : Promise.resolve([])

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
          const rawContext = JSON.stringify({ original: text, qa, photos, technical_notes: result.technical_notes, duration_estimate: result.duration_estimate })

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
