/**
 * AfriOne — Débloquer les missions coincées en 'dispatching'
 *
 *   node scripts/cleanup-stuck-dispatch.mjs           → DRY-RUN (défaut)
 *   node scripts/cleanup-stuck-dispatch.mjs --apply   → annulation réelle
 *
 * Une mission reste en 'dispatching' pour toujours quand plus aucune tentative
 * n'est vivante et que personne n'a pu accepter : le timeout côté client ne
 * repasse jamais dessus une fois l'onglet fermé. C'est ce qu'a produit le bug
 * de machine à états réparé par la migration 006.
 *
 * Sécurité : on n'annule QUE les missions dont toutes les tentatives sont
 * closes ou expirées, et jamais celles qui ont déjà un artisan attribué. Une
 * mission dont une offre est encore vivante est laissée tranquille — un artisan
 * est peut-être en train d'y répondre.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const APPLY = process.argv.includes('--apply')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data: stuck, error } = await db
  .from('missions')
  .select('id, category, created_at, artisan_id, client_id')
  .eq('status', 'dispatching')
  .order('created_at', { ascending: false })

if (error) {
  console.error(`❌ Lecture des missions : ${error.message}`)
  process.exit(1)
}

console.log(`\n${APPLY ? '⚙️  APPLIQUÉ' : '🔍 DRY-RUN (aucune écriture)'} — ${stuck?.length ?? 0} mission(s) en 'dispatching'\n`)

const now = Date.now()
let annulees = 0
let ignorees = 0

for (const m of stuck ?? []) {
  const date = new Date(m.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  const tag  = `${date}  ${(m.category || '?').padEnd(12)} ${m.id.slice(0, 8)}`

  if (m.artisan_id) {
    console.log(`  ⏭️  ${tag} — artisan déjà attribué, on ne touche pas`)
    ignorees++
    continue
  }

  const { data: attempts } = await db
    .from('dispatch_attempts')
    .select('id, response, expires_at')
    .eq('mission_id', m.id)

  const vivantes = (attempts ?? []).filter(
    a => a.response === null && new Date(a.expires_at).getTime() > now,
  )

  if (vivantes.length) {
    console.log(`  ⏭️  ${tag} — ${vivantes.length} offre(s) encore vivante(s), on ne touche pas`)
    ignorees++
    continue
  }

  const ouvertes = (attempts ?? []).filter(a => a.response === null).length

  if (!APPLY) {
    console.log(`  → ${tag} — à annuler (${attempts?.length ?? 0} tentative(s), dont ${ouvertes} expirée(s) non close(s))`)
    annulees++
    continue
  }

  // Clore les tentatives expirées restées NULL : sans ça, la carte urgente
  // reste affichée chez l'artisan sur une offre qu'il ne peut plus prendre.
  if (ouvertes) {
    const { error: closeError } = await db
      .from('dispatch_attempts')
      .update({ response: 'timeout', responded_at: new Date().toISOString() })
      .eq('mission_id', m.id)
      .is('response', null)

    if (closeError) console.warn(`     ⚠️  tentatives non closes : ${closeError.message}`)
  }

  // Rembourser l'escrow avant d'annuler — une transaction laissée en 'escrow'
  // sur une mission annulée immobilise l'argent du client.
  const { error: refundError } = await db
    .from('transactions')
    .update({ status: 'refunded', released_at: new Date().toISOString() })
    .eq('mission_id', m.id)
    .eq('status', 'escrow')

  if (refundError) console.warn(`     ⚠️  remboursement non appliqué : ${refundError.message}`)

  const { data: cancelled, error: cancelError } = await db
    .from('missions')
    .update({ status: 'cancelled' })
    .eq('id', m.id)
    .eq('status', 'dispatching')   // garde : ne pas écraser une acceptation concurrente
    .select('id')
    .maybeSingle()

  if (cancelError || !cancelled) {
    console.log(`  ❌ ${tag} — ${cancelError?.message ?? 'statut changé entre-temps, ignorée'}`)
    ignorees++
  } else {
    console.log(`  ✅ ${tag} — annulée${ouvertes ? `, ${ouvertes} tentative(s) close(s)` : ''}`)
    annulees++
  }
}

console.log(
  APPLY
    ? `\n${annulees} annulée(s), ${ignorees} laissée(s) intacte(s).\n`
    : `\n${annulees} seraient annulée(s), ${ignorees} laissée(s) intacte(s).\n   Relance avec --apply pour appliquer.\n`,
)
