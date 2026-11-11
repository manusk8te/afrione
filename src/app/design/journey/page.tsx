'use client'

import { useState } from 'react'
import Journey, { type JourneyStep } from '@/components/journey/Journey'

/* Aperçu du suivi guidé dans ses différents états (données fictives). */
const CASES: Record<string, JourneyStep[]> = {
  'Documents à envoyer': [
    { id: 'a', title: 'Compte créé', help: '', state: 'done', status: 'Terminé' },
    { id: 'b', title: 'Métier et zone choisis', help: '', state: 'done', status: 'Terminé' },
    { id: 'c', title: 'Vérifier votre identité', help: 'Envoyez votre carte d’identité (recto et verso) et une photo de vous. C’est obligatoire pour recevoir des missions.', state: 'current', status: 'À faire', href: '#', cta: 'Envoyer mes documents' },
    { id: 'd', title: 'Remplir le questionnaire', help: 'Vos tarifs, vos zones et votre matériel. Cela permet de calculer des devis justes.', state: 'todo', status: 'À faire' },
    { id: 'e', title: 'Recevoir des clients', help: 'Une fois votre identité vérifiée, vous êtes visible dans l’annuaire.', state: 'todo' },
  ],
  'En vérification': [
    { id: 'a', title: 'Compte créé', help: '', state: 'done', status: 'Terminé' },
    { id: 'b', title: 'Métier et zone choisis', help: '', state: 'done', status: 'Terminé' },
    { id: 'c', title: 'Vérifier votre identité', help: 'Notre équipe contrôle vos documents sous 24 à 48 h ouvrées.', state: 'waiting', status: 'En vérification (24 à 48 h)' },
    { id: 'd', title: 'Remplir le questionnaire', help: 'Vos tarifs, vos zones et votre matériel.', state: 'todo', status: 'À faire' },
    { id: 'e', title: 'Recevoir des clients', help: 'Visible dans l’annuaire une fois l’identité vérifiée.', state: 'todo' },
  ],
  'Documents refusés': [
    { id: 'a', title: 'Compte créé', help: '', state: 'done', status: 'Terminé' },
    { id: 'b', title: 'Métier et zone choisis', help: '', state: 'done', status: 'Terminé' },
    { id: 'c', title: 'Vérifier votre identité', help: 'La photo de la carte d’identité est floue. Renvoyez-la bien nette, en pleine lumière.', state: 'problem', status: 'Documents refusés', href: '#', cta: 'Renvoyer mes documents' },
    { id: 'd', title: 'Remplir le questionnaire', help: 'Vos tarifs, vos zones et votre matériel.', state: 'todo', status: 'À faire' },
  ],
}

export default function JourneyPreview() {
  const [key, setKey] = useState(Object.keys(CASES)[0])
  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px 64px', background: '#faf8f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {Object.keys(CASES).map(k => (
          <button key={k} onClick={() => setKey(k)} aria-pressed={key === k}
            style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid #c9b8aa', background: key === k ? '#c2410c' : '#fff', color: key === k ? '#fff' : '#1f1611', font: '600 13px Inter, sans-serif', cursor: 'pointer' }}>
            {k}
          </button>
        ))}
      </div>
      <Journey title="Terminer votre inscription" intro="Quelques étapes pour apparaître dans l’annuaire et recevoir des clients." steps={CASES[key]} />
    </main>
  )
}
