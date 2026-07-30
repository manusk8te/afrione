/**
 * AfriOne — Simulation de conversations clients
 * Usage : npm run test:simulate
 *
 * Simule 40 clients (8 par persona) qui passent par le flow complet :
 * diagnostic -> pricing-agent
 * Utilise Anthropic (claude-sonnet-4-5-20251001) pour générer les réponses clients
 */

import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// ── Configuration ─────────────────────────────────────────────────────────────

const BASE_URL    = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY  // fallback
const TIMEOUT_MS  = 30_000
const OUT_DIR     = path.resolve(process.cwd(), 'test-results', 'conversations')
const SUMMARY_FILE = path.resolve(process.cwd(), 'test-results', 'conversations-summary.json')

// ── Types ─────────────────────────────────────────────────────────────────────

type Persona = 'urgent' | 'hesitant' | 'entreprise' | 'vague' | 'exigeant'

interface ClientScenario {
  id:        number
  persona:   Persona
  quartier:  string
  problem:   string
  context:   string
}

interface QAPair {
  question: string
  answer:   string
  type:     string
}

interface ConversationResult {
  clientId:      number
  persona:       Persona
  quartier:      string
  problem:       string
  status:        'success' | 'error' | 'partial'
  qa:            QAPair[]
  diagnostic:    Record<string, unknown> | null
  pricing:       Record<string, unknown> | null
  missionId:     string | null
  durationMs:    number
  errorMessage?: string
  stepsCompleted: number
}

interface ConversationSummary {
  totalClients:     number
  successCount:     number
  errorCount:       number
  partialCount:     number
  byPersona:        Record<Persona, { success: number; error: number; partial: number }>
  missions:         Array<{
    clientId:   number
    persona:    Persona
    quartier:   string
    category:   string
    missionId:  string | null
    pricing:    Record<string, unknown> | null
  }>
  generatedAt: string
}

// ── Scénarios par persona ─────────────────────────────────────────────────────

const QUARTIERS = ['Cocody', 'Yopougon', 'Plateau', 'Marcory', 'Adjamé', 'Abobo', 'Treichville', 'Koumassi']

function buildScenarios(): ClientScenario[] {
  const scenarios: ClientScenario[] = []
  let id = 1

  const personaProblems: Record<Persona, string[]> = {
    urgent: [
      "URGENT ! Il y a une fuite d'eau massive sous mon évier, l'eau coule partout sur le sol de la cuisine !",
      "Court-circuit grave ! Toute la maison est sans courant depuis 2h, ça sentait le brûlé avant.",
      "Ma clim a completement lâché, il fait 38 degrés dans la maison et j'ai des enfants en bas âge !",
      "Fuite d'eau au plafond de ma chambre, l'eau tombe directement sur mon lit, situation critique !",
      "Panne électrique soudaine, le disjoncteur principal saute immédiatement quand je le relève.",
      "Tuyau d'eau pété dans la salle de bain, l'eau gicle fort, j'ai coupé le général mais besoin urgent d'intervention !",
      "Odeur de brûlé forte dans ma cuisine, une prise a cramé, j'ai coupé le courant par sécurité.",
      "Fuite sous le chauffe-eau, l'eau s'écoule depuis 1h, j'ai mis des serviettes partout.",
    ],
    hesitant: [
      "Bonjour... j'ai un petit problème de robinet je crois. Ça goutte un peu. Pas trop urgent mais bon.",
      "Hum, y a une petite tache humide au mur du salon. Je sais pas si c'est grave ou pas.",
      "J'aurais besoin de repeindre mon salon je pense... mais je sais pas combien ça coûte.",
      "Mon interrupteur dans la chambre marche parfois pas. C'est peut-être normal ?",
      "Il y a une fissure dans le mur de ma cuisine. Petite fissure. Faut s'inquiéter ?",
      "Ma porte ferme mal, y a un peu d'espace. C'est de la menuiserie ça ? Je sais pas.",
      "La clim fait un bruit bizarre depuis une semaine. Un peu comme un sifflement.",
      "Le sol de ma terrasse a des carreaux qui bougent. Deux ou trois carreaux je crois.",
    ],
    entreprise: [
      "Bonjour, je représente une société. Nous avons besoin de rénover entièrement nos bureaux de 200m², peinture, électricité et plomberie. Délai : 3 semaines.",
      "Notre restaurant doit être remis aux normes. Toute la plomberie de la cuisine professionnelle + salle de bain handicapé à refaire. Budget conséquent.",
      "Nous gérons un immeuble de 8 appartements. Besoin d'un audit électrique complet + mise aux normes de tout le bâtiment.",
      "Rénovation d'un hôtel de 25 chambres : climatisation centrale à installer, peinture de toutes les chambres, carrelage des couloirs.",
      "Construction d'un magasin de 150m². Besoin de tout : plomberie, électricité, peinture, menuiserie pour les présentoirs.",
      "Réhabilitation d'un immeuble commercial. Façade extérieure à ravaler, 400m² de peinture intérieure, 8 climatiseurs à installer.",
      "Notre entrepôt doit être sécurisé. Installation de 12 prises industrielles, câblage réseau, éclairage LED dans tout l'espace.",
      "Projet de construction annexe : 3 pièces supplémentaires à bâtir, maçonnerie complète, menuiserie (portes + fenêtres), peinture finale.",
    ],
    vague: [
      "Problème chez moi.",
      "Ça marche plus.",
      "Besoin d'aide.",
      "Y a quelque chose qui va pas.",
      "Problème eau.",
      "Lumière.",
      "Mur abîmé.",
      "Clim.",
    ],
    exigeant: [
      "J'ai un robinet mitigeur thermostatique Hansgrohe qui présente une perte de pression en amont. Le joint de siège semble usé. Besoin d'un plombier certifié avec expérience sur robinetterie haut de gamme.",
      "Problème sur mon tableau électrique Legrand : le disjoncteur différentiel 30mA de la salle de bain déclenche systématiquement en présence d'humidité. Suspicion de mise à la terre défaillante.",
      "Ma climatisation Daikin Inverter R32 présente une surchauffe du compresseur. La pression de service à l'entrée est anormale. Je veux un frigoriste avec attestation d'aptitude gaz.",
      "Fissures diagonales à 45° depuis les linteaux de mes baies vitrées. Bâtiment de 2002, sol argileux. Besoin d'un expert maçon qui sait distinguer tassement structurel d'une fissure cosmétique.",
      "Menuiserie aluminium à remplacer : 4 baies coulissantes 2,4m × 2,1m, double vitrage 4/12/4, rupture de pont thermique. Je veux une offre précise en fourniture + pose.",
      "Carrelage de ma terrasse 45m² à reprendre entièrement : dépose de l'existant, pose chape réglante, carrelage grès cérame 60×60 antidérapant R11. Qui peut me faire une étude de prix sérieuse ?",
      "Rénovation électrique complète d'un appartement de 120m² : passage de 1P+N à 3P+N, ajout de 6 circuits supplémentaires, pose de prises USB-C, mise aux normes NFC 15-100.",
      "J'ai une infiltration par capillarité en pied de mur RDC. J'ai déjà eu une injection de résine il y a 3 ans qui n'a pas tenu. Je cherche quelqu'un qui maîtrise le traitement par injection de gel acrylique ou le drain périphérique.",
    ],
  }

  const personaQuartiers: Record<Persona, string[]> = {
    urgent:    ['Cocody', 'Yopougon', 'Plateau', 'Marcory', 'Adjamé', 'Abobo', 'Treichville', 'Koumassi'],
    hesitant:  ['Cocody', 'Bingerville', 'Riviera', 'Marcory', 'Yopougon', 'Abobo', 'Treichville', 'Koumassi'],
    entreprise:['Plateau', 'Cocody', 'Marcory', 'Zone 4', 'Adjamé', 'Yopougon', 'Treichville', 'Koumassi'],
    vague:     ['Abobo', 'Yopougon', 'Adjamé', 'Treichville', 'Koumassi', 'Marcory', 'Cocody', 'Bingerville'],
    exigeant:  ['Cocody', 'Riviera', 'Deux-Plateaux', 'Angré', 'Marcory', 'Plateau', 'Zone 4', 'Bingerville'],
  }

  const personaContexts: Record<Persona, string> = {
    urgent:    'Client en situation d\'urgence, réclame une intervention immédiate, prêt à payer le prix urgent',
    hesitant:  'Client avec budget serré, hésite, donne des infos incomplètes, a peur du prix',
    entreprise:'Client professionnel, travaux importants, durée en semaines, plusieurs corps d\'état',
    vague:     'Client peu loquace, descriptions floues, répond par monosyllabes, difficile à cerner',
    exigeant:  'Client précis, connaissances techniques, pose des contre-questions, exige de la qualité',
  }

  const personaList: Persona[] = ['urgent', 'hesitant', 'entreprise', 'vague', 'exigeant']

  for (const persona of personaList) {
    const problems  = personaProblems[persona]
    const quartiers = personaQuartiers[persona]

    for (let i = 0; i < 8; i++) {
      scenarios.push({
        id:      id++,
        persona,
        quartier: quartiers[i],
        problem:  problems[i],
        context:  personaContexts[persona],
      })
    }
  }

  return scenarios
}

// ── Appel HTTP avec timeout ───────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timer)
  }
}

// ── Appel Anthropic pour générer une réponse de client ───────────────────────

async function generateClientResponse(
  persona: Persona,
  question: string,
  questionType: string,
  options: string[] | undefined,
  originalProblem: string,
  conversationHistory: QAPair[],
): Promise<string> {
  if (!ANTHROPIC_KEY) {
    // Fallback sans API : réponse générique selon le type
    if (questionType === 'yesno') {
      return persona === 'urgent' ? 'Oui' : 'Non'
    }
    if (questionType === 'choice' && options && options.length > 0) {
      const idx = persona === 'vague' ? 0 :
                  persona === 'exigeant' ? options.length - 1 :
                  Math.floor(Math.random() * options.length)
      return options[idx] || options[0]
    }
    return persona === 'vague' ? 'Je sais pas' : 'C\'est dans le couloir, accessible facilement'
  }

  const personaInstructions: Record<Persona, string> = {
    urgent: `Tu es un client en panique, situation d'urgence. Tes réponses sont courtes, directes, parfois en majuscules pour montrer l'urgence. Tu veux un artisan MAINTENANT. Tu fournis les infos demandées rapidement.`,
    hesitant: `Tu es un client hésitant avec un budget serré. Tu réponds de manière incomplète, tu hésite, tu poses des questions sur le prix, tu dis "c'est pas trop grave normalement ?". Tu donnes parfois des infos incorrectes puis tu te corriges.`,
    entreprise: `Tu es le responsable logistique d'une entreprise. Tu parles de surfaces précises, de délais, de budget global. Tes réponses sont professionnelles et structurées. Tu mentionnes souvent que c'est pour un usage professionnel.`,
    vague: `Tu es un client qui donne le moins d'infos possible. Tes réponses sont des monosyllabes : "oui", "non", "je sais pas", "dans la maison", "ça fait du bruit". Évite les détails à tout prix.`,
    exigeant: `Tu es un client expert qui connaît son métier. Tu utilises le vocabulaire technique correct. Tu poses des contre-questions sur la méthode d'intervention. Tu mentionnes des marques, des normes, des références techniques.`,
  }

  const historyText = conversationHistory.length > 0
    ? 'Historique de la conversation:\n' + conversationHistory.map(qa =>
        `Question: ${qa.question}\nTa réponse précédente: ${qa.answer}`
      ).join('\n\n') + '\n\n'
    : ''

  const optionsText = options && options.length > 0
    ? `\nOptions proposées: ${options.map((o, i) => `${i+1}. ${o}`).join(' | ')}`
    : ''

  const prompt = `${personaInstructions[persona]}

Contexte de ton problème initial: "${originalProblem}"
${historyText}
L'expert te pose cette question:
"${question}"${optionsText}

Type de réponse attendue: ${questionType === 'yesno' ? 'Oui ou Non seulement' : questionType === 'choice' ? 'Choisis parmi les options ou reformule une option' : 'Réponse libre courte'}

Réponds UNIQUEMENT avec ta réponse client, sans explication, sans guillemets supplémentaires. Maximum 2 phrases.`

  try {
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':         'application/json',
        'x-api-key':            ANTHROPIC_KEY,
        'anthropic-version':    '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5-20251001',
        max_tokens: 150,
        messages:   [{ role: 'user', content: prompt }],
      }),
    }, 15_000)

    if (!response.ok) {
      const text = await response.text()
      console.warn(`    [WARN] Anthropic API error ${response.status}: ${text.slice(0, 100)}`)
      // Fallback
      if (questionType === 'yesno') return 'Oui'
      if (questionType === 'choice' && options?.length) return options[0]
      return 'Dans le salon, au mur'
    }

    const data = await response.json() as { content: Array<{ text: string }> }
    return data.content?.[0]?.text?.trim() || 'Oui'

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`    [WARN] Anthropic call failed: ${msg}`)
    if (questionType === 'yesno') return 'Oui'
    if (questionType === 'choice' && options?.length) return options[0]
    return 'Dans la cuisine'
  }
}

// ── Flow complet d'une conversation ──────────────────────────────────────────

async function simulateConversation(scenario: ClientScenario): Promise<ConversationResult> {
  const startTime = Date.now()
  const result: ConversationResult = {
    clientId:       scenario.id,
    persona:        scenario.persona,
    quartier:       scenario.quartier,
    problem:        scenario.problem,
    status:         'error',
    qa:             [],
    diagnostic:     null,
    pricing:        null,
    missionId:      null,
    durationMs:     0,
    stepsCompleted: 0,
  }

  try {
    // ── Étape 1 : START ────────────────────────────────────────────────────────
    console.log(`  [${scenario.id}/${scenario.persona}] Étape 1: diagnostic/start...`)

    const startResp = await fetchWithTimeout(`${BASE_URL}/api/diagnostic`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        mode:    'start',
        text:    scenario.problem,
        quartier: scenario.quartier,
      }),
    })

    if (!startResp.ok) {
      throw new Error(`diagnostic/start HTTP ${startResp.status}`)
    }

    let currentQuestion = await startResp.json() as {
      question: string
      type:     string
      options?: string[]
      done:     boolean
    }
    result.stepsCompleted = 1

    // ── Étape 2 : Boucle questions/réponses ───────────────────────────────────
    let questionIndex = 0

    while (!currentQuestion.done && questionIndex < 6) {
      const questionText = currentQuestion.question
      if (!questionText) break

      // Générer une réponse cohérente avec le persona
      const answer = await generateClientResponse(
        scenario.persona,
        questionText,
        currentQuestion.type,
        currentQuestion.options,
        scenario.problem,
        result.qa,
      )

      result.qa.push({
        question: questionText,
        answer,
        type: currentQuestion.type,
      })

      console.log(`  [${scenario.id}] Q${questionIndex+1}: "${questionText.slice(0, 60)}..." → "${answer.slice(0, 40)}..."`)

      // Appel next
      const nextResp = await fetchWithTimeout(`${BASE_URL}/api/diagnostic`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          mode:    'next',
          text:    scenario.problem,
          qa:      result.qa,
          index:   questionIndex + 1,
          quartier: scenario.quartier,
        }),
      })

      if (!nextResp.ok) {
        throw new Error(`diagnostic/next HTTP ${nextResp.status} (question ${questionIndex+1})`)
      }

      currentQuestion = await nextResp.json() as {
        question: string
        type:     string
        options?: string[]
        done:     boolean
      }
      questionIndex++
      result.stepsCompleted = 1 + questionIndex
    }

    // ── Étape 3 : FINALIZE ────────────────────────────────────────────────────
    console.log(`  [${scenario.id}] Étape finale: diagnostic/finalize...`)

    const finalResp = await fetchWithTimeout(`${BASE_URL}/api/diagnostic`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        mode:    'finalize',
        text:    scenario.problem,
        qa:      result.qa,
        quartier: scenario.quartier,
      }),
    })

    if (!finalResp.ok) {
      throw new Error(`diagnostic/finalize HTTP ${finalResp.status}`)
    }

    result.diagnostic = await finalResp.json() as Record<string, unknown>
    result.missionId  = (result.diagnostic.mission_id as string) || null
    result.stepsCompleted++

    const diagnosticData = result.diagnostic
    console.log(`  [${scenario.id}] Diagnostic: ${diagnosticData.category} — urgence: ${diagnosticData.urgency} — prix: ${diagnosticData.price_min}–${diagnosticData.price_max} FCFA`)

    // ── Étape 4 : PRICING AGENT ───────────────────────────────────────────────
    console.log(`  [${scenario.id}] Appel pricing-agent...`)

    const pricingResp = await fetchWithTimeout(`${BASE_URL}/api/pricing-agent`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        category:       diagnosticData.category || 'Plomberie',
        description:    diagnosticData.summary  || scenario.problem,
        items_needed:   Array.isArray(diagnosticData.items_needed)
          ? (diagnosticData.items_needed as Array<{ name: string }>).map((i) => i.name)
          : [],
        hours_estimate: parseDuration(String(diagnosticData.duration_estimate || '1 heure')),
        quartier:       scenario.quartier,
        urgency:        diagnosticData.urgency || 'medium',
      }),
    })

    if (!pricingResp.ok) {
      throw new Error(`pricing-agent HTTP ${pricingResp.status}`)
    }

    result.pricing = await pricingResp.json() as Record<string, unknown>
    result.stepsCompleted++
    result.status = 'success'

    const pricing = result.pricing
    console.log(`  [${scenario.id}] Pricing: total=${pricing.total} FCFA — artisan_percoit=${pricing.artisan_percoit} FCFA`)

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errorMessage = msg
    result.status = result.stepsCompleted > 1 ? 'partial' : 'error'
    console.error(`  [${scenario.id}] ERREUR (step ${result.stepsCompleted}): ${msg}`)
  }

  result.durationMs = Date.now() - startTime
  return result
}

// ── Parse durée texte → heures ────────────────────────────────────────────────

function parseDuration(text: string): number {
  const lower = text.toLowerCase()
  if (lower.includes('journée') || lower.includes('jour')) return 8
  if (lower.includes('1h30') || lower.includes('1 h 30')) return 1.5
  if (lower.includes('2h') || lower.includes('2 h')) return 2
  if (lower.includes('3h') || lower.includes('3 h')) return 3
  if (lower.includes('4h') || lower.includes('4 h')) return 4
  if (lower.includes('45')) return 0.75
  if (lower.includes('30')) return 0.5
  const match = lower.match(/(\d+)\s*h/)
  if (match) return parseInt(match[1], 10)
  return 1
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('========================================')
  console.log('   AfriOne — Simulation de conversations')
  console.log('========================================')
  console.log(`Base URL  : ${BASE_URL}`)
  console.log(`Anthropic : ${ANTHROPIC_KEY ? 'OK' : 'MANQUANT (mode fallback)'}`)
  console.log(`Timestamp : ${new Date().toISOString()}\n`)

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
  }

  const scenarios = buildScenarios()
  console.log(`Nombre de scénarios : ${scenarios.length}\n`)

  const results: ConversationResult[] = []
  const summary: ConversationSummary = {
    totalClients:  scenarios.length,
    successCount:  0,
    errorCount:    0,
    partialCount:  0,
    byPersona:     {
      urgent:     { success: 0, error: 0, partial: 0 },
      hesitant:   { success: 0, error: 0, partial: 0 },
      entreprise: { success: 0, error: 0, partial: 0 },
      vague:      { success: 0, error: 0, partial: 0 },
      exigeant:   { success: 0, error: 0, partial: 0 },
    },
    missions:    [],
    generatedAt: new Date().toISOString(),
  }

  for (const scenario of scenarios) {
    console.log(`\n[Client ${scenario.id}] Persona: ${scenario.persona.toUpperCase()} | Quartier: ${scenario.quartier}`)
    console.log(`Problème: "${scenario.problem.slice(0, 80)}..."`)

    const result = await simulateConversation(scenario)
    results.push(result)

    // Sauvegarder le résultat individuel
    const outFile = path.join(OUT_DIR, `client_${scenario.id}.json`)
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf-8')

    // Mettre à jour le résumé
    if (result.status === 'success') {
      summary.successCount++
      summary.byPersona[scenario.persona].success++
    } else if (result.status === 'error') {
      summary.errorCount++
      summary.byPersona[scenario.persona].error++
    } else {
      summary.partialCount++
      summary.byPersona[scenario.persona].partial++
    }

    if (result.diagnostic) {
      summary.missions.push({
        clientId:  scenario.id,
        persona:   scenario.persona,
        quartier:  scenario.quartier,
        category:  String(result.diagnostic.category || 'Inconnu'),
        missionId: result.missionId,
        pricing:   result.pricing,
      })
    }

    // Pause courte entre les requêtes pour éviter le rate limiting
    await new Promise<void>(resolve => setTimeout(resolve, 500))
  }

  // Sauvegarder le résumé global
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2), 'utf-8')

  console.log('\n========================================')
  console.log('   RESUME FINAL                         ')
  console.log('========================================')
  console.log(`Total conversations : ${scenarios.length}`)
  console.log(`Succes              : ${summary.successCount}`)
  console.log(`Partielles          : ${summary.partialCount}`)
  console.log(`Echecs              : ${summary.errorCount}`)
  console.log('\nPar persona :')
  for (const [persona, counts] of Object.entries(summary.byPersona)) {
    console.log(`  ${persona.padEnd(12)}: ${counts.success} succes, ${counts.partial} partielles, ${counts.error} echecs`)
  }
  console.log(`\nResultats sauvegardes dans : ${OUT_DIR}`)
  console.log(`Resume global            : ${SUMMARY_FILE}`)
}

main().catch(err => {
  console.error('\nERREUR CRITIQUE :', err)
  process.exit(1)
})
