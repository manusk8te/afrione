/**
 * Source de vérité unique des rôles et des permissions d'une mission.
 *
 * Importé par les pages (ce qui s'affiche) ET par les routes API (ce qui est
 * autorisé) : les deux ne peuvent plus diverger, puisqu'ils lisent la même
 * table de règles.
 *
 * Règle fondatrice : le rôle d'un utilisateur DANS une mission ne se déduit
 * jamais de son profil global. `users.role = 'artisan'` dit quel type de
 * compte c'est ; il ne dit rien de la relation à CETTE mission. Confondre les
 * deux donnait l'interface prestataire — « Démarrer le suivi GPS » compris —
 * à tout compte artisan ouvrant n'importe quelle mission.
 */

export type MissionRole = 'client' | 'artisan' | 'admin' | 'guest'

export type MissionStatus =
  | 'diagnostic' | 'matching' | 'dispatching' | 'negotiation' | 'scheduled'
  | 'en_route' | 'en_cours' | 'payment' | 'pending_validation'
  | 'completed' | 'disputed' | 'cancelled'

export const ALL_STATUSES: MissionStatus[] = [
  'diagnostic', 'matching', 'dispatching', 'negotiation', 'scheduled',
  'en_route', 'en_cours', 'payment', 'pending_validation',
  'completed', 'disputed', 'cancelled',
]

/** Statuts terminaux : plus aucune action de workflow n'est possible. */
export const CLOSED_STATUSES: MissionStatus[] = ['completed', 'cancelled']

/** Statuts où la négociation du prix est encore ouverte. */
const NEGOTIATING: MissionStatus[] = ['matching', 'negotiation']

/** Statuts où l'intervention est engagée sur le terrain. */
const ON_SITE: MissionStatus[] = ['en_route', 'en_cours']

export const OPEN_STATUSES = ALL_STATUSES.filter(s => !CLOSED_STATUSES.includes(s))

export type MissionAction =
  // Lecture
  | 'view_mission'          // ouvrir la war room / le suivi
  | 'view_diagnostic'       // fiche technique
  | 'view_gps'              // carte de suivi
  | 'view_other_phone'      // bouton appel
  // Conversation
  | 'send_message'
  // Négociation — artisan
  | 'send_quote'            // devis
  | 'suggest_material'      // matériau non prévu
  | 'adjust_time'           // requalification du temps
  | 'send_final_proposal'
  | 'answer_counter_offer'  // répondre à une contre-proposition client
  // Négociation — client
  | 'answer_quote'          // accepter / refuser un devis artisan
  | 'counter_offer'
  | 'answer_material'       // valider / refuser un matériau proposé
  | 'pay_mission'
  | 'schedule_mission'      // « maintenant » ou date programmée
  // Terrain — artisan
  | 'start_tracking'        // démarrer le suivi GPS
  | 'mark_arrived'
  | 'declare_materials'
  | 'upload_proof'
  | 'mark_done'
  // Clôture — client
  | 'validate_mission'      // libérer le paiement
  | 'report_issue'          // litige
  | 'cancel_mission'
  | 'leave_review'

type Rule = { roles: MissionRole[]; statuses: MissionStatus[] | 'any' }

/**
 * Matrice unique. Chaque action = qui + dans quel état.
 *
 * `admin` est délibérément absent de toutes les actions d'écriture du
 * workflow : un administrateur observe une mission, il n'y participe pas.
 * Le code précédent le rangeait avec l'artisan (`isArtisan = artisan ||
 * admin`), si bien que ses messages étaient enregistrés comme venant du
 * prestataire et ses actions modifiaient une mission réelle sans trace.
 */
const RULES: Record<MissionAction, Rule> = {
  view_mission:        { roles: ['client', 'artisan', 'admin'], statuses: 'any' },
  view_diagnostic:     { roles: ['client', 'artisan', 'admin'], statuses: 'any' },
  view_gps:            { roles: ['client', 'artisan', 'admin'], statuses: ['scheduled', ...ON_SITE, 'pending_validation', 'completed', 'disputed'] },
  view_other_phone:    { roles: ['client', 'artisan'],          statuses: 'any' },

  send_message:        { roles: ['client', 'artisan'],          statuses: OPEN_STATUSES },

  send_quote:          { roles: ['artisan'], statuses: NEGOTIATING },
  suggest_material:    { roles: ['artisan'], statuses: NEGOTIATING },
  adjust_time:         { roles: ['artisan'], statuses: NEGOTIATING },
  send_final_proposal: { roles: ['artisan'], statuses: NEGOTIATING },
  answer_counter_offer:{ roles: ['artisan'], statuses: NEGOTIATING },

  answer_quote:        { roles: ['client'],  statuses: NEGOTIATING },
  counter_offer:       { roles: ['client'],  statuses: NEGOTIATING },
  answer_material:     { roles: ['client'],  statuses: OPEN_STATUSES },
  pay_mission:         { roles: ['client'],  statuses: ['diagnostic', ...NEGOTIATING] },
  schedule_mission:    { roles: ['client'],  statuses: ['payment'] },

  start_tracking:      { roles: ['artisan'], statuses: ['scheduled', 'en_route'] },
  mark_arrived:        { roles: ['artisan'], statuses: ['en_route'] },
  declare_materials:   { roles: ['artisan'], statuses: ON_SITE },
  upload_proof:        { roles: ['artisan'], statuses: [...ON_SITE, 'pending_validation'] },
  mark_done:           { roles: ['artisan'], statuses: ['en_cours'] },

  validate_mission:    { roles: ['client'],  statuses: ['pending_validation'] },
  report_issue:        { roles: ['client'],  statuses: ['en_cours', 'pending_validation'] },
  cancel_mission:      { roles: ['client', 'admin'], statuses: ['diagnostic', 'matching', 'dispatching', 'negotiation', 'scheduled', 'payment'] },
  leave_review:        { roles: ['client'],  statuses: ['completed'] },
}

export interface PermissionContext {
  role: MissionRole
  status: MissionStatus | string | null | undefined
}

/**
 * Rôle de l'utilisateur DANS cette mission.
 *
 * Pas de repli sur le rôle global : un compte qui n'est ni le client ni
 * l'artisan assigné est un `guest`, quel que soit son profil. Seul `admin`
 * fait exception, et il n'obtient qu'un accès en lecture (voir RULES).
 *
 * Le client l'emporte sur l'artisan : un compte à la fois client et artisan
 * (courant en test) reste client sur SA propre demande.
 */
export function resolveMissionRole(p: {
  userId: string | null | undefined
  globalRole?: string | null
  clientId?: string | null
  artisanUserId?: string | null
}): MissionRole {
  if (!p.userId) return 'guest'
  if (p.clientId && p.clientId === p.userId) return 'client'
  if (p.artisanUserId && p.artisanUserId === p.userId) return 'artisan'
  if (p.globalRole === 'admin') return 'admin'
  return 'guest'
}

/**
 * Ce rôle porte-t-il cette action, quel que soit l'état de la mission ?
 * Sert à distinguer « pas ton rôle » (refus définitif) de « pas maintenant »
 * (refus circonstanciel) — notamment pour rejouer une transition déjà faite
 * sans la refuser à tort.
 */
export function canRole(action: MissionAction, role: MissionRole): boolean {
  return RULES[action]?.roles.includes(role) ?? false
}

/** L'action est-elle permise à ce rôle, dans cet état de mission ? */
export function can(action: MissionAction, ctx: PermissionContext): boolean {
  const rule = RULES[action]
  if (!rule) return false
  if (!rule.roles.includes(ctx.role)) return false
  if (rule.statuses === 'any') return true
  return rule.statuses.includes(ctx.status as MissionStatus)
}

/**
 * Motif du refus, en français, destiné aux réponses d'API et aux toasts.
 * Distinguer « pas ton rôle » de « pas le bon moment » évite les
 * « Erreur. » qui ont coûté une journée de débogage sur les écritures
 * missions.
 */
export function denialReason(action: MissionAction, ctx: PermissionContext): string | null {
  const rule = RULES[action]
  if (!rule) return 'Action inconnue.'
  if (ctx.role === 'guest') return "Vous n'êtes pas partie prenante de cette mission."
  if (!rule.roles.includes(ctx.role)) {
    return ctx.role === 'admin'
      ? "Le mode administrateur est en lecture seule sur les missions."
      : "Cette action appartient à l'autre partie de la mission."
  }
  if (rule.statuses !== 'any' && !rule.statuses.includes(ctx.status as MissionStatus)) {
    return "Cette action n'est pas possible dans l'état actuel de la mission."
  }
  return null
}

/** Libellé du rôle, affiché à l'utilisateur pour qu'il sache qui il est. */
export const ROLE_LABEL: Record<MissionRole, string> = {
  client:  'Vous êtes le client',
  artisan: "Vous êtes l'artisan",
  admin:   'Mode administrateur — lecture seule',
  guest:   'Accès non autorisé',
}

/**
 * Ce que l'utilisateur doit faire maintenant, selon son rôle et l'état.
 * Une War Room compréhensible en quelques secondes suppose de répondre à
 * « qu'est-ce que je fais maintenant ? » sans lire les boutons.
 */
export function nextStepHint(role: MissionRole, status: MissionStatus | string): string {
  const s = status as MissionStatus
  if (role === 'client') {
    switch (s) {
      case 'diagnostic':   return 'Diagnostic en cours — précisez votre besoin.'
      case 'dispatching':  return "Recherche d'un artisan disponible…"
      case 'matching':
      case 'negotiation':  return "Échangez avec l'artisan et attendez son devis."
      case 'payment':      return "Paiement reçu — choisissez le moment de l'intervention."
      case 'scheduled':    return "Intervention programmée — l'artisan viendra à la date convenue."
      case 'en_route':     return "L'artisan est en route — suivez son trajet."
      case 'en_cours':     return 'Mission en cours — un souci ? Signalez-le.'
      case 'pending_validation': return 'Validez les travaux pour libérer le paiement.'
      case 'completed':    return "Mission terminée — laissez un avis à l'artisan."
      case 'cancelled':    return 'Mission annulée — vous êtes remboursé.'
      case 'disputed':     return "Litige ouvert — l'équipe AfriOne examine le cas."
      default:             return ''
    }
  }
  if (role === 'artisan') {
    switch (s) {
      case 'matching':
      case 'negotiation':  return 'Présentez-vous, puis envoyez votre devis.'
      case 'payment':      return "Paiement en escrow — le client choisit le moment de l'intervention."
      case 'scheduled':    return "Intervention programmée — démarrez le suivi le jour venu."
      case 'en_route':     return 'Démarrez le suivi GPS, puis signalez votre arrivée.'
      case 'en_cours':     return 'Mission en cours — photos, matériaux, puis clôture.'
      case 'pending_validation': return 'En attente de la validation du client (max 24h).'
      case 'completed':    return 'Mission bouclée — paiement libéré.'
      case 'cancelled':    return 'Mission annulée — elle ne compte pas dans vos statistiques.'
      case 'disputed':     return "Litige ouvert — l'équipe AfriOne examine le cas."
      default:             return ''
    }
  }
  if (role === 'admin') return 'Observation — aucune action disponible sur cette mission.'
  return ''
}
