/**
 * Statuts de mission affichés à l'artisan : libellé français, couleur, groupe
 * (ce qu'il doit faire, ce qu'il attend, ce qui est fini) et action principale.
 * Une seule source pour la liste des missions et la messagerie.
 */

export type StatusTone = 'action' | 'wait' | 'ok' | 'muted' | 'danger'
export type StatusGroup = 'todo' | 'wait' | 'done'

type Meta = {
  label: string
  tone: StatusTone
  group: StatusGroup
  /** Action principale de l'artisan à ce stade. */
  cta?: { label: string; to: (id: string) => string }
}

const warroom = (id: string) => `/warroom/${encodeURIComponent(id)}`
const suivi = (id: string) => `/suivi/${encodeURIComponent(id)}`

export const MISSION_STATUS: Record<string, Meta> = {
  matching:           { label: 'Nouvelle demande',      tone: 'action', group: 'todo', cta: { label: 'Répondre et envoyer un devis', to: warroom } },
  negotiation:        { label: 'En discussion',         tone: 'action', group: 'todo', cta: { label: 'Discuter et envoyer un devis', to: warroom } },
  scheduled:          { label: 'Programmée',            tone: 'action', group: 'todo', cta: { label: 'Démarrer le suivi', to: suivi } },
  en_route:           { label: 'En route',              tone: 'action', group: 'todo', cta: { label: 'Suivi en direct', to: suivi } },
  en_cours:           { label: 'En cours',              tone: 'action', group: 'todo', cta: { label: 'Photos et clôture', to: suivi } },
  payment:            { label: 'Payée, date à fixer',   tone: 'wait',   group: 'wait', cta: { label: 'Ouvrir la discussion', to: warroom } },
  pending_validation: { label: 'À valider par le client', tone: 'wait', group: 'wait', cta: { label: 'Voir la mission', to: warroom } },
  diagnostic:         { label: 'Diagnostic en cours',   tone: 'wait',   group: 'wait' },
  dispatching:        { label: 'Recherche d’un artisan', tone: 'wait',  group: 'wait' },
  completed:          { label: 'Terminée',              tone: 'ok',     group: 'done' },
  cancelled:          { label: 'Annulée',               tone: 'muted',  group: 'done' },
  disputed:           { label: 'Litige en cours',       tone: 'danger', group: 'wait', cta: { label: 'Voir le litige', to: warroom } },
}

/** Statut inconnu : on affiche quand même un libellé lisible, jamais une case vide. */
export function missionStatus(status: string | null | undefined): Meta {
  const known = status ? MISSION_STATUS[status] : undefined
  if (known) return known
  const text = String(status || 'Statut inconnu').replace(/_/g, ' ')
  return { label: text.charAt(0).toUpperCase() + text.slice(1), tone: 'muted', group: 'wait' }
}

export const GROUP_TITLE: Record<StatusGroup, string> = {
  todo: 'À faire',
  wait: 'En attente',
  done: 'Terminées et annulées',
}
