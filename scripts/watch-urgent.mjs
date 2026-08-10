/**
 * AfriOne — Suivi en direct d'un test de mission urgente
 *
 *   node scripts/watch-urgent.mjs
 *
 * Lecture seule, sonde toutes les 2s. N'affiche que les CHANGEMENTS, pour que
 * la sortie se lise comme une chronologie du parcours plutôt que comme un
 * rafraîchissement continu.
 *
 * Ctrl+C pour arrêter.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const DEPUIS = new Date(Date.now() - 10 * 60 * 1000).toISOString()

// Lu une fois : sert à nommer les artisans au lieu d'afficher des UUID.
const { data: artisans } = await db.from('artisan_pros').select('id, user_id, metier')
const { data: users }    = await db.from('users').select('id, email')
const nomArtisan = id => {
  const a = (artisans ?? []).find(x => x.id === id)
  const u = (users ?? []).find(x => x.id === a?.user_id)
  return u?.email?.split('@')[0] ?? String(id).slice(0, 8)
}

const vu = new Map()
const h  = () => new Date().toLocaleTimeString('fr-FR')

console.log(`\n👀 Surveillance des missions urgentes créées après ${new Date(DEPUIS).toLocaleTimeString('fr-FR')}`)
console.log('   Lance ton parcours client maintenant. Ctrl+C pour arrêter.\n')

async function tick() {
  const { data: missions } = await db
    .from('missions')
    .select('id, status, category, artisan_id, created_at')
    .eq('mode', 'urgent')
    .gte('created_at', DEPUIS)
    .order('created_at', { ascending: true })

  for (const m of missions ?? []) {
    const cle   = `m:${m.id}`
    const etat  = `${m.status}|${m.artisan_id ?? ''}`
    const court = m.id.slice(0, 8)

    if (!vu.has(cle)) {
      console.log(`${h()}  🆕 mission ${court} (${m.category}) créée — statut '${m.status}'`)
    } else if (vu.get(cle) !== etat) {
      const [ancien] = vu.get(cle).split('|')
      const suffixe  = m.artisan_id ? ` → ${nomArtisan(m.artisan_id)}` : ''
      const icone    = m.status === 'en_route' ? '🎉' : m.status === 'cancelled' ? '💀' : '➡️ '
      console.log(`${h()}  ${icone} mission ${court} : ${ancien} → ${m.status}${suffixe}`)
    }
    vu.set(cle, etat)

    const { data: attempts } = await db
      .from('dispatch_attempts')
      .select('id, artisan_id, response, expires_at')
      .eq('mission_id', m.id)

    for (const a of attempts ?? []) {
      const ac  = `a:${a.id}`
      const rep = a.response ?? 'en attente'

      if (!vu.has(ac)) {
        const reste = Math.round((new Date(a.expires_at).getTime() - Date.now()) / 1000)
        console.log(`${h()}     📨 offre envoyée à ${nomArtisan(a.artisan_id)} (expire dans ${reste}s)`)
      } else if (vu.get(ac) !== rep) {
        const icone = rep === 'accepted' ? '✅' : rep === 'refused' ? '🚫' : rep === 'cancelled' ? '⏹️ ' : '⏱️ '
        console.log(`${h()}     ${icone} ${nomArtisan(a.artisan_id)} → ${rep}`)
      }
      vu.set(ac, rep)
    }
  }
}

await tick()
setInterval(tick, 2000)
