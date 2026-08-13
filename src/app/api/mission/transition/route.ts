/**
 * POST /api/mission/transition
 *
 * Point d'entrée UNIQUE des changements d'état d'une mission.
 *
 * Avant : chaque écran faisait `supabase.from('missions').update({ status })`
 * en direct. La policy RLS `missions_participants` étant un `FOR ALL` sans
 * distinction de rôle, le client pouvait écrire `en_route`, `en_cours` ou
 * `pending_validation` sur sa propre mission — c'est-à-dire exécuter toutes
 * les actions réservées à l'artisan, bouton masqué ou pas. Masquer un bouton
 * n'a jamais été une autorisation.
 *
 * Ici : le rôle est résolu côté serveur à partir du token, confronté à la
 * matrice de `mission-roles`, et seul le service role écrit. Le message
 * système et la notification partent d'ici aussi — le navigateur ne peut donc
 * plus déclarer un `sender_role` qui l'arrange.
 *
 * Body : { mission_id, action, scheduled_at?, reason? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveMissionViewer, authorize, type MissionViewer } from '@/lib/mission-auth'
import { canRole, denialReason, type MissionAction, type MissionStatus } from '@/lib/mission-roles'
import { sendPushToUser } from '@/lib/push'

export const dynamic = 'force-dynamic'

type TransitionName =
  | 'start_now'        // client : devis payé, intervention immédiate
  | 'schedule'         // client : intervention programmée
  | 'start_tracking'   // artisan : départ + suivi GPS
  | 'arrived'          // artisan : sur place
  | 'done'             // artisan : travaux terminés
  | 'dispute'          // client : litige

interface TransitionSpec {
  permission: MissionAction
  nextStatus: MissionStatus
  /** Statut déjà atteint → succès silencieux plutôt qu'erreur (double-clic, retry). */
  idempotentOn?: MissionStatus[]
}

const TRANSITIONS: Record<TransitionName, TransitionSpec> = {
  start_now:      { permission: 'schedule_mission', nextStatus: 'en_route',           idempotentOn: ['en_route'] },
  schedule:       { permission: 'schedule_mission', nextStatus: 'scheduled',          idempotentOn: ['scheduled'] },
  start_tracking: { permission: 'start_tracking',   nextStatus: 'en_route',           idempotentOn: ['en_route'] },
  arrived:        { permission: 'mark_arrived',     nextStatus: 'en_cours',           idempotentOn: ['en_cours'] },
  done:           { permission: 'mark_done',        nextStatus: 'pending_validation', idempotentOn: ['pending_validation'] },
  dispute:        { permission: 'report_issue',     nextStatus: 'disputed',           idempotentOn: ['disputed'] },
}

/**
 * Postgres refuse certaines écritures pour des raisons métier précises.
 * Les renvoyer toutes en « Erreur. » a coûté une journée de débogage.
 */
function explain(message: string): string {
  if (message.includes('idx_artisan_single_active_mission')) {
    return "L'artisan a déjà une mission en cours. Elle doit être terminée avant d'en démarrer une autre."
  }
  if (message.includes('Transition interdite')) {
    return "Cette action n'est plus possible dans l'état actuel de la mission. Rafraîchissez la page."
  }
  if (message.includes('missions_status_check')) {
    return 'Statut de mission refusé par la base — prévenez le support AfriOne.'
  }
  return `Action refusée : ${message}`
}

/** L'autre partie de la mission, résolue hors RLS (jointure fiable). */
function counterpartId(viewer: MissionViewer): string | null {
  return viewer.role === 'client'
    ? viewer.mission.artisan_user_id
    : viewer.mission.client_id
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any))
  const { mission_id, action, scheduled_at, reason } = body as {
    mission_id?: string; action?: TransitionName; scheduled_at?: string; reason?: string
  }

  if (!action || !(action in TRANSITIONS)) {
    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  }
  const name: TransitionName = action
  const spec = TRANSITIONS[name]

  const resolved = await resolveMissionViewer(req, mission_id)
  if (!resolved.ok) return resolved.res
  const { viewer } = resolved

  // Rejouer la même transition ne doit pas produire d'erreur : le double-clic
  // et le retry réseau sont la norme sur mobile. Ce test passe AVANT la garde
  // de statut, sinon l'artisan qui reclique « Terminer » se voit répondre
  // « action impossible dans cet état » — l'état étant précisément celui qu'il
  // vient d'atteindre. Le rôle, lui, reste exigé.
  if (spec.idempotentOn?.includes(viewer.mission.status)) {
    if (!canRole(spec.permission, viewer.role)) {
      return NextResponse.json(
        { error: denialReason(spec.permission, { role: viewer.role, status: viewer.mission.status }) },
        { status: 403 },
      )
    }
    return NextResponse.json({ ok: true, status: viewer.mission.status, unchanged: true })
  }

  const denied = authorize(viewer, spec.permission)
  if (denied) return denied

  const patch: Record<string, any> = { status: spec.nextStatus, updated_at: new Date().toISOString() }

  if (name === 'schedule') {
    if (!scheduled_at) return NextResponse.json({ error: 'Date et heure requises' }, { status: 400 })
    const when = new Date(scheduled_at)
    if (Number.isNaN(when.getTime())) return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
    patch.scheduled_at = when.toISOString()
  }
  if (name === 'arrived') patch.started_at = new Date().toISOString()
  if (name === 'done') {
    patch.completed_at        = new Date().toISOString()
    patch.validation_deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }

  let { error } = await supabaseAdmin.from('missions').update(patch).eq('id', viewer.mission.id)

  // Repli ciblé : colonne scheduled_at absente du schéma. Rejouer sur
  // n'importe quelle erreur masquerait une transition refusée.
  if (error && name === 'schedule'
      && /scheduled_at/i.test(error.message)
      && /column|schema cache|does not exist/i.test(error.message)) {
    console.warn('[transition] colonne scheduled_at absente — repli sans date')
    error = (await supabaseAdmin.from('missions')
      .update({ status: spec.nextStatus }).eq('id', viewer.mission.id)).error
  }

  if (error) {
    return NextResponse.json({ error: explain(error.message) }, { status: 409 })
  }

  // ── Message système + notification, écrits côté serveur ────────────────────
  const messages: Record<TransitionName, { chat: string; push: { title: string; body: string } }> = {
    start_now: {
      chat: 'Devis accepté — intervention immédiate 🚗 Suivi GPS activé',
      push: { title: 'AfriOne — Mission confirmée', body: "C'est parti ! L'intervention démarre maintenant." },
    },
    schedule: {
      chat: patch.scheduled_at
        ? `Devis accepté — intervention programmée le ${new Date(patch.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${new Date(patch.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} 📅`
        : 'Devis accepté — intervention programmée 📅',
      push: { title: 'AfriOne — Mission programmée', body: 'Une date d\'intervention a été fixée.' },
    },
    start_tracking: {
      chat: "L'artisan est en route 🚗 Suivi GPS activé",
      push: { title: 'AfriOne — Artisan en route', body: 'Suivez son trajet en temps réel.' },
    },
    arrived: {
      chat: "L'artisan est arrivé — mission démarrée ! ⚡",
      push: { title: "AfriOne — L'artisan est arrivé !", body: 'La mission vient de démarrer.' },
    },
    done: {
      chat: "Travaux terminés ✅ — En attente de validation client. L'escrow reste sécurisé jusqu'à validation (max 24h).",
      push: { title: 'AfriOne — Travaux terminés !', body: 'Validez la mission pour libérer le paiement. Vous avez 24h.' },
    },
    dispute: {
      chat: `⚠️ Litige signalé${reason?.trim() ? ` : ${reason.trim()}` : ''}`,
      push: { title: 'AfriOne — Litige ouvert', body: 'Un problème a été signalé sur cette mission.' },
    },
  }

  const msg = messages[name]
  await supabaseAdmin.from('chat_history').insert({
    mission_id:  viewer.mission.id,
    sender_id:   viewer.userId,
    sender_role: viewer.role,
    sender_type: viewer.role === 'artisan' ? 'artisan' : 'client',
    text:        msg.chat,
    type:        'system',
  })

  const recipient = counterpartId(viewer)
  if (recipient) {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://afrione-sepia.vercel.app'
    const url  = ['start_tracking', 'arrived', 'done'].includes(name)
      ? `${base}/suivi/${viewer.mission.id}`
      : `${base}/warroom/${viewer.mission.id}`
    sendPushToUser(recipient, { ...msg.push, url }).catch(() => {})
  }

  return NextResponse.json({ ok: true, status: spec.nextStatus, scheduled_at: patch.scheduled_at ?? null })
}
