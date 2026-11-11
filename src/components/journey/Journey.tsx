import Link from 'next/link'
import { AlertTriangle, ArrowRight, Check, Clock } from 'lucide-react'

export type JourneyState = 'done' | 'current' | 'waiting' | 'problem' | 'todo'

export type JourneyStep = {
  id: string
  title: string
  /** Une phrase simple : ce que c'est, pourquoi, ce qu'il faut faire. */
  help: string
  state: JourneyState
  /** Court état en toutes lettres : « Validé », « En vérification (24 à 48 h) »… */
  status?: string
  href?: string
  /** Texte du bouton : un verbe d'action (« Envoyer mes documents »). */
  cta?: string
}

/**
 * Suivi guidé : où j'en suis, ce que je dois faire maintenant, et où cliquer.
 * L'étape en cours est mise en avant avec un grand bouton fléché ; une étape
 * « en attente » dit clairement qu'il n'y a rien à faire et comment être prévenu.
 */
export default function Journey({ title, intro, steps }: { title: string; intro?: string; steps: JourneyStep[] }) {
  const done = steps.filter(s => s.state === 'done').length
  const next = steps.find(s => s.state === 'problem') ?? steps.find(s => s.state === 'current') ?? steps.find(s => s.state === 'waiting')

  return (
    <section className="journey" aria-label={title}>
      <header className="journey__head">
        <div>
          <h2 className="journey__title">{title}</h2>
          {intro && <p className="journey__intro">{intro}</p>}
        </div>
        <span className="journey__count">{done} sur {steps.length}</span>
      </header>

      <div className="journey__bar" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Avancement">
        <span style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>

      {next && (
        <div className="journey__next" data-state={next.state}>
          <p className="journey__eyebrow">{next.state === 'waiting' ? 'En cours de traitement' : next.state === 'problem' ? 'À corriger' : 'Votre prochaine étape'}</p>
          <p className="journey__nexttitle">{next.title}</p>
          <p className="journey__nexthelp">{next.help}</p>
          {next.href && next.state !== 'waiting' && (
            <Link className="journey__btn" href={next.href}>
              {next.cta ?? 'Continuer'} <ArrowRight size={18} aria-hidden="true" />
            </Link>
          )}
          {next.state === 'waiting' && (
            <p className="journey__wait">
              <Clock size={15} aria-hidden="true" /> Rien à faire pour le moment. Vous serez prévenu par une notification (la cloche en haut à droite).
            </p>
          )}
        </div>
      )}

      <ol className="journey__list">
        {steps.map((s, i) => (
          <li key={s.id} className="journey__item" data-state={s.state} aria-current={s === next ? 'step' : undefined}>
            <span className="journey__marker" aria-hidden="true">
              {s.state === 'done' ? <Check size={15} /> : s.state === 'waiting' ? <Clock size={14} /> : s.state === 'problem' ? <AlertTriangle size={14} /> : i + 1}
            </span>
            <span className="journey__body">
              <span className="journey__row">
                <strong>{s.title}</strong>
                {s.status && <span className="journey__status">{s.status}</span>}
                {s === next && s.state !== 'waiting' && <span className="journey__here">← vous êtes ici</span>}
              </span>
              {s.state !== 'done' && <span className="journey__help">{s.help}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
