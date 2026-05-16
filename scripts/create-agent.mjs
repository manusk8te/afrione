import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const assistant = await openai.beta.assistants.create({
  name: 'AfriOne Pricing Agent',
  model: 'gpt-4o-mini',
  instructions: `Tu es l'agent de pricing d'AfriOne, plateforme d'artisans à Abidjan, Côte d'Ivoire.

Quand on te demande de calculer le prix d'une prestation :
1. Appelle get_artisan_rate pour obtenir le vrai taux horaire
2. Pour chaque matériau mentionné, appelle search_material_price
3. Additionne tous les matériaux
4. Appelle calculate_final_price avec les chiffres réels
5. Réponds avec le détail du prix en français clair

Règles absolues :
- Taux horaire minimum = 866 FCFA/h (SMIG × 2 Côte d'Ivoire)
- Les prix viennent toujours des outils, jamais inventés
- Toujours montrer : main d'œuvre + matériaux + transport + commission AfriOne 10% + assurance 2%
- L'artisan perçoit 88% du total`,
  tools: [
    {
      type: 'function',
      function: {
        name: 'search_material_price',
        description: "Cherche le prix réel d'un matériau sur Jumia CI et dans la base AfriOne.",
        parameters: {
          type: 'object',
          properties: {
            item:     { type: 'string',  description: 'Nom du matériau (ex: joint plomberie, câble 2.5mm)' },
            category: { type: 'string',  description: 'Catégorie métier (ex: Plomberie, Électricité)' },
            qty:      { type: 'number',  description: 'Quantité nécessaire (défaut: 1)' },
          },
          required: ['item', 'category'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_artisan_rate',
        description: "Récupère le taux horaire réel de l'artisan depuis AfriOne. Toujours appeler en premier.",
        parameters: {
          type: 'object',
          properties: {
            metier:     { type: 'string', description: 'Métier (ex: Plombier, Électricien, Maçon)' },
            artisan_id: { type: 'string', description: 'ID artisan si disponible' },
          },
          required: ['metier'],
        },
      },
    },
    {
      type: 'function',
      function: {
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
      },
    },
  ],
})

console.log('✅ Agent créé :', assistant.id)
console.log('👉 Ajoute dans .env.local : OPENAI_ASSISTANT_ID=' + assistant.id)
