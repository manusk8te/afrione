/**
 * Configure les tools de l'agent AfriOne sur OpenAI via API.
 * Lancer une seule fois : npx ts-node scripts/setup-agent-tools.ts
 */

const AGENT_ID     = process.env.OPENAI_AGENT_ID || 'wf_6a084fa83e648190a097efab184635fb012d5e5358b9e872'
const OPENAI_KEY   = process.env.OPENAI_API_KEY!
const BASE_URL     = 'https://afrione-sepia.vercel.app'

const tools = [
  {
    type: 'function',
    name: 'search_material_price',
    description: 'Cherche le prix réel d\'un matériau sur Jumia CI et dans la base AfriOne.',
    parameters: {
      type: 'object',
      properties: {
        item:     { type: 'string',  description: 'Nom du matériau (ex: joint plomberie, câble 2.5mm)' },
        category: { type: 'string',  description: 'Catégorie métier (ex: Plomberie, Électricité)' },
        qty:      { type: 'number',  description: 'Quantité (défaut: 1)' },
      },
      required: ['item', 'category'],
    },
    url: `${BASE_URL}/api/tools/search-material`,
  },
  {
    type: 'function',
    name: 'get_artisan_rate',
    description: 'Récupère le taux horaire de l\'artisan depuis la base AfriOne. Appeler en premier.',
    parameters: {
      type: 'object',
      properties: {
        metier:     { type: 'string', description: 'Métier (ex: Plombier, Électricien, Maçon)' },
        artisan_id: { type: 'string', description: 'ID artisan si disponible' },
      },
      required: ['metier'],
    },
    url: `${BASE_URL}/api/tools/get-artisan-rate`,
  },
  {
    type: 'function',
    name: 'calculate_final_price',
    description: 'Calcule le prix final AfriOne avec dégressivité longues tâches + commission.',
    parameters: {
      type: 'object',
      properties: {
        hours:           { type: 'number', description: 'Durée en heures' },
        hourly_rate:     { type: 'number', description: 'Taux horaire FCFA' },
        materials_total: { type: 'number', description: 'Total matériaux FCFA' },
        urgency:         { type: 'string', enum: ['low', 'medium', 'high', 'emergency'] },
        quartier:        { type: 'string', description: 'Quartier client Abidjan' },
      },
      required: ['hours', 'hourly_rate', 'materials_total'],
    },
    url: `${BASE_URL}/api/tools/calculate-price`,
  },
]

async function setupTools() {
  console.log(`Configuration des tools pour l'agent ${AGENT_ID}...`)

  const res = await fetch(`https://api.openai.com/v1/agents/${AGENT_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type':  'application/json',
      'OpenAI-Beta':   'agents=v1',
    },
    body: JSON.stringify({ tools }),
  })

  const data = await res.json()

  if (res.ok) {
    console.log('✅ Tools configurés avec succès')
    console.log(JSON.stringify(data, null, 2))
  } else {
    console.error('❌ Erreur:', data)
  }
}

setupTools()
