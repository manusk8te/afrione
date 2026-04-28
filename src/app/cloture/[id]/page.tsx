'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle, Star, Camera, Upload, Zap, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const CRITERIA = [
  { id: 'ponctualite', label: 'Ponctualité' },
  { id: 'qualite', label: 'Qualité du travail' },
  { id: 'proprete', label: 'Propreté du chantier' },
  { id: 'communication', label: 'Communication' },
]

export default function CloturePage() {
  const params = useParams()
  const router = useRouter()
  const [step, setStep] = useState<'photo' | 'note' | 'done'>('photo')
  const [photoUploaded, setPhotoUploaded] = useState(false)
  const [globalNote, setGlobalNote] = useState(0)
  const [hoverNote, setHoverNote] = useState(0)
  const [criteriaRatings, setCriteriaRatings] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const setRating = (id: string, note: number) => setCriteriaRatings(r => ({ ...r, [id]: note }))

  const submitNotation = () => {
    setSubmitting(true)
    setTimeout(() => setStep('done'), 1500)
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-24 h-24 bg-accent2/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={48} className="text-accent2" />
          </div>
          <h1 className="font-display text-3xl font-bold text-dark mb-3">Mission accomplie !</h1>
          <p className="text-muted mb-2">21 450 FCFA libérés vers l'artisan</p>
          <p className="text-sm text-muted mb-8">Merci pour votre confiance. Votre avis aide toute la communauté AfriOne.</p>

          <div className="flex justify-center gap-1 mb-8">
            {[1,2,3,4,5].map(n => (
              <Star key={n} size={28} className={n <= globalNote ? 'text-gold fill-gold' : 'text-border'} />
            ))}
          </div>

          <div className="space-y-3">
            <Link href="/diagnostic" className="btn-primary w-full flex items-center justify-center gap-2">
              <Zap size={16} /> Nouvelle mission
            </Link>
            <Link href="/dashboard" className="btn-outline w-full flex items-center justify-center gap-2">
              Voir mon tableau de bord
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="pt-8 pb-16 px-4">
        <div className="max-w-lg mx-auto">

          <Link href={`/suivi/${params.id}`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-dark mb-6 transition-colors">
            <ArrowLeft size={16} /> Retour au suivi
          </Link>

          {/* Progress */}
          <div className="flex gap-2 mb-8">
            {['photo', 'note'].map((s, i) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all ${
                (step === 'photo' && i === 0) || step === 'note' ? 'bg-accent' : 'bg-border'
              }`} />
            ))}
          </div>

          {/* STEP PHOTO */}
          {step === 'photo' && (
            <div className="animate-fade-up">
              <span className="section-label block mb-2">ÉTAPE 1/2</span>
              <h1 className="font-display text-3xl font-bold text-dark mb-2">Photo de fin de chantier</h1>
              <p className="text-muted text-sm mb-8">Prenez une photo du travail terminé pour valider la mission et libérer les fonds</p>

              <div
                onClick={() => setPhotoUploaded(true)}
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all mb-6 ${
                  photoUploaded
                    ? 'border-accent2 bg-accent2/5'
                    : 'border-border hover:border-accent hover:bg-accent/5'
                }`}
              >
                {photoUploaded ? (
                  <div>
                    <CheckCircle size={40} className="text-accent2 mx-auto mb-3" />
                    <p className="font-semibold text-accent2">Photo ajoutée</p>
                    <p className="text-xs text-muted mt-1">fin_chantier_plomberie.jpg</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-center gap-4 mb-4">
                      <Camera size={32} className="text-muted" />
                      <Upload size={32} className="text-muted" />
                    </div>
                    <p className="font-semibold text-dark">Prendre / importer une photo</p>
                    <p className="text-xs text-muted mt-1">JPG, PNG · Max 10 MB</p>
                  </div>
                )}
              </div>

              <div className="bg-gold/10 border border-gold/20 rounded-xl p-4 mb-6">
                <p className="text-xs text-muted">
                  ⚠️ En validant cette photo, vous confirmez que les travaux ont été réalisés à votre satisfaction. Les <strong className="text-dark">21 450 FCFA</strong> seront libérés à l'artisan.
                </p>
              </div>

              <button
                onClick={() => setStep('note')}
                disabled={!photoUploaded}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                Valider et noter l'artisan
              </button>
            </div>
          )}

          {/* STEP NOTATION */}
          {step === 'note' && (
            <div className="animate-fade-up">
              <span className="section-label block mb-2">ÉTAPE 2/2</span>
              <h1 className="font-display text-3xl font-bold text-dark mb-2">Notez l'artisan</h1>
              <p className="text-muted text-sm mb-8">Votre avis est important pour la communauté</p>

              {/* Global star rating */}
              <div className="card mb-4 text-center">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-bg2 rounded-xl flex items-center justify-center text-2xl">🔧</div>
                  <div className="text-left">
                    <div className="font-display font-bold text-dark">Kouadio Brou Emmanuel</div>
                    <div className="text-xs text-muted">Plombier · Mission #AF-2847</div>
                  </div>
                </div>
                <p className="text-sm text-muted mb-3">Note globale</p>
                <div className="flex justify-center gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      onMouseEnter={() => setHoverNote(n)}
                      onMouseLeave={() => setHoverNote(0)}
                      onClick={() => setGlobalNote(n)}
                    >
                      <Star
                        size={36}
                        className={`transition-colors ${n <= (hoverNote || globalNote) ? 'text-gold fill-gold' : 'text-border'}`}
                      />
                    </button>
                  ))}
                </div>
                {globalNote > 0 && (
                  <p className="text-sm font-semibold text-dark mt-2">
                    {['', 'Mauvais', 'Passable', 'Correct', 'Bien', 'Excellent !'][globalNote]}
                  </p>
                )}
              </div>

              {/* Criteria */}
              <div className="card mb-4 space-y-4">
                {CRITERIA.map(c => (
                  <div key={c.id} className="flex items-center justify-between">
                    <span className="text-sm text-dark">{c.label}</span>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setRating(c.id, n)}>
                          <Star size={18} className={`transition-colors ${n <= (criteriaRatings[c.id] || 0) ? 'text-gold fill-gold' : 'text-border'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Comment */}
              <div className="mb-6">
                <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Commentaire (optionnel)</label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Décrivez votre expérience..."
                  className="input min-h-24 resize-none"
                />
              </div>

              <button
                onClick={submitNotation}
                disabled={globalNote === 0 || submitting}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Envoi...</>
                ) : (
                  <><CheckCircle size={16} /> Valider la mission</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
