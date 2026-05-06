/**
 * Crée un artisan de test avec documents KYC en attente de validation
 * Usage : node scripts/add-kyc-artisan.js
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SK  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SK) {
  console.error('❌ Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SK)

// Images de substitution lisibles (format carte ID + diplôme)
const CNI_FRONT_URL   = 'https://placehold.co/800x500/1a1f1b/E85D26?text=CNI+RECTO%0AKoné+Mamadou%0ADN+07%2F03%2F1990%0ACI-AB-12345'
const CNI_BACK_URL    = 'https://placehold.co/800x500/1a1f1b/C9A84C?text=CNI+VERSO%0AKoné+Mamadou%0AProfession%3A+Plombier%0AAdresse%3A+Cocody+Abidjan'
const DIPLOMA_URL     = 'https://placehold.co/800x600/1a1f1b/2B6B3E?text=CERTIFICAT+DE+QUALIFICATION%0AProfessionnelle+en+Plomberie%0AKoné+Mamadou%0ACFA+Abidjan+2018'

async function main() {
  console.log('👷 Création de l\'artisan KYC de test...\n')

  // 1. User
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('phone', '+2250700KYC01')
    .maybeSingle()

  let userId
  if (existing) {
    userId = existing.id
    console.log('ℹ️  Utilisateur déjà existant, réutilisation :', userId)
  } else {
    const { data: user, error: uErr } = await supabase
      .from('users')
      .insert({
        phone: '+2250700KYC01',
        name: 'Koné Mamadou',
        email: 'kone.mamadou.plombier@gmail.com',
        role: 'artisan',
        quartier: 'Cocody',
        is_active: true,
      })
      .select('id')
      .single()

    if (uErr) { console.error('❌ Erreur user :', uErr.message); process.exit(1) }
    userId = user.id
    console.log('✅ User créé :', userId)
  }

  // 2. Profil artisan (kyc_status: pending)
  const { data: artisan, error: aErr } = await supabase
    .from('artisan_pros')
    .insert({
      user_id: userId,
      metier: 'Plombier',
      bio: 'Plombier expérimenté, 8 ans de métier à Abidjan. Spécialisé fuites, WC, chauffe-eau et canalisation encastrée.',
      quartiers: ['Cocody', 'Marcory', 'Plateau'],
      zone_gps: { lat: 5.3569, lng: -3.9780 },
      tarif_min: 8000,
      rayon_km: 12,
      is_available: false,
      kyc_status: 'pending',        // <-- en attente de validation
      rating_avg: 0,
      rating_count: 0,
      years_experience: 8,
      specialties: ['Fuite d\'eau', 'WC', 'Chauffe-eau', 'Canalisation'],
      certifications: ['CAP Plomberie CFA Abidjan 2018'],
      scoring_weight: 0.0,
    })
    .select('id')
    .single()

  if (aErr) { console.error('❌ Erreur artisan_pros :', aErr.message); process.exit(1) }
  console.log('✅ Profil artisan créé :', artisan.id)

  // 3. Documents KYC
  const { data: kyc, error: kErr } = await supabase
    .from('kyc_security')
    .insert({
      artisan_id: artisan.id,
      cni_front_url: CNI_FRONT_URL,
      cni_back_url: CNI_BACK_URL,
      diploma_urls: [DIPLOMA_URL],
      status: 'pending',
    })
    .select('id')
    .single()

  if (kErr) { console.error('❌ Erreur kyc_security :', kErr.message); process.exit(1) }
  console.log('✅ Documents KYC créés :', kyc.id)

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Artisan KYC prêt à valider !

  Nom     : Koné Mamadou
  Métier  : Plombier — Cocody
  Statut  : pending (en attente)
  Docs    : CNI recto + verso + Diplôme

  👉 Va sur http://localhost:3000/admin
     Onglet "KYC" → filtre "À valider"
     Tu verras Koné Mamadou avec ses 3 documents.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

main().catch(err => {
  console.error('Fatal :', err)
  process.exit(1)
})
