'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Shield, CheckCircle, Zap, Phone, Lock, AlertCircle } from 'lucide-react'

type PayStep = 'form' | 'confirm' | 'processing' | 'success'

export default function PaiementPage() {
  const params = useParams()
  const [step, setStep] = useState<PayStep>('form')
  const [phone, setPhone] = useState('')

  const DEVIS = {
    artisan: 'Kouadio Brou Emmanuel',
    mission: 'Réparation fuite sous évier',
    items: [
      { label: 'Main d\'œuvre (2h)', prix: 12000 },
      { label: 'Joint d\'étanchéité x2', prix: 3000 },
      { label: 'Siphon PVC', prix: 4500 },
    ],
    subtotal: 19500,
    commission: 1950,
    total: 21450,
  }

  const handlePay = () => {
    setStep('processing')
    setTimeout(() => setStep('success'), 3000)
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-accent2/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-accent2" />
          </div>
          <h1 className="font-display text-3xl font-bold text-dark mb-3">Paiement confirmé !</h1>
          <p className="text-muted mb-2">21 450 FCFA en séquestre Wave</p>
          <p className="text-sm text-muted mb-8 max-w-xs mx-auto">
            Les fonds seront libérés à l'artisan uniquement après votre validation de fin de mission.
          </p>
          <div className="bg-white border border-border rounded-2xl p-4 mb-8 text-left space-y-3">
            {[
              { label: 'Référence', value: '#AF-2847' },
              { label: 'Artisan', value: DEVIS.artisan },
              { label: 'Montant', value: `${DEVIS.total.toLocaleString()} FCFA` },
              { label: 'Statut', value: '🔒 En séquestre' },
            ].map(item => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-muted">{item.label}</span>
                <span className="font-medium text-dark">{item.value}</span>
              </div>
            ))}
          </div>
          <Link href={`/suivi/${params.id}`} className="btn-primary w-full flex items-center justify-center gap-2 py-4 mb-3">
            <Zap size={16} /> Suivre l'artisan en direct
          </Link>
          <Link href="/dashboard" className="text-sm text-muted hover:text-dark transition-colors">
            Voir mes missions
          </Link>
        </div>
      </div>
    )
  }

  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-10 h-10 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
          <h2 className="font-display text-2xl font-bold text-dark mb-2">Traitement en cours...</h2>
          <p className="text-muted text-sm">Connexion à Wave Business</p>
          <div className="flex justify-center gap-2 mt-6">
            {['Vérification du compte', 'Débit Wave', 'Mise en séquestre'].map((l, i) => (
              <div key={l} className="flex items-center gap-1.5 text-xs text-muted bg-bg2 px-3 py-2 rounded-full animate-pulse-soft" style={{ animationDelay: `${i * 0.4}s` }}>
                <div className="w-1.5 h-1.5 bg-accent rounded-full" />{l}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="pt-8 pb-16 px-4">
        <div className="max-w-md mx-auto">

          <Link href={`/warroom/${params.id}`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-dark mb-6 transition-colors">
            <ArrowLeft size={16} /> Retour à la discussion
          </Link>

          <span className="section-label block mb-2">PAIEMENT SÉCURISÉ</span>
          <h1 className="font-display text-3xl font-bold text-dark mb-8">Confirmer le paiement</h1>

          {/* Devis recap */}
          <div className="card mb-6">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
              <div className="w-10 h-10 bg-bg2 rounded-xl flex items-center justify-center text-xl">🔧</div>
              <div>
                <div className="font-display font-bold text-dark text-sm">{DEVIS.artisan}</div>
                <div className="text-xs text-muted">{DEVIS.mission}</div>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {DEVIS.items.map(item => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-muted">{item.label}</span>
                  <span className="text-dark">{item.prix.toLocaleString()} FCFA</span>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Sous-total</span>
                <span>{DEVIS.subtotal.toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Commission AfriOne (10%)</span>
                <span>{DEVIS.commission.toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between font-bold text-dark pt-2 border-t border-border">
                <span>Total</span>
                <span className="text-xl font-display">{DEVIS.total.toLocaleString()} FCFA</span>
              </div>
            </div>
          </div>

          {/* Payment method */}
          {step === 'form' && (
            <div className="space-y-4">
              <div className="card bg-dark text-cream">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
                    <Phone size={18} className="text-accent" />
                  </div>
                  <div>
                    <div className="font-semibold">Wave Business</div>
                    <div className="text-xs text-muted">Paiement mobile sécurisé</div>
                  </div>
                  <CheckCircle size={16} className="text-accent2 ml-auto" />
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Numéro Wave</label>
                  <div className="flex gap-3">
                    <div className="flex items-center bg-dark2 border border-border/50 rounded-xl px-3 py-3 text-sm font-mono flex-shrink-0">
                      🇨🇮 +225
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="07 00 00 00 00"
                      className="flex-1 bg-dark2 border border-border/50 rounded-xl px-4 py-3 text-cream placeholder:text-muted font-mono focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-accent2/5 border border-accent2/20 rounded-xl p-3">
                <Lock size={14} className="text-accent2 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted">
                  Votre paiement est sécurisé en séquestre. L'artisan ne reçoit rien tant que vous n'avez pas validé la mission.
                </p>
              </div>

              <button
                onClick={() => setStep('confirm')}
                disabled={phone.length < 8}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Shield size={16} /> Continuer vers la confirmation
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4 animate-fade-up">
              <div className="bg-gold/10 border border-gold/30 rounded-2xl p-5 text-center">
                <div className="font-mono text-xs text-muted uppercase tracking-wider mb-1">Vous allez payer</div>
                <div className="font-display text-5xl font-bold text-dark">{DEVIS.total.toLocaleString()}</div>
                <div className="font-mono text-sm text-muted mt-1">FCFA via Wave</div>
                <div className="text-sm text-dark mt-2">depuis le <span className="font-semibold">+225 {phone}</span></div>
              </div>

              <div className="flex items-start gap-2 bg-orange-50 border border-accent/20 rounded-xl p-3">
                <AlertCircle size={14} className="text-accent flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted">
                  Une notification Wave sera envoyée à votre téléphone pour confirmer le paiement.
                </p>
              </div>

              <button
                onClick={handlePay}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 text-base"
              >
                <Zap size={18} /> Confirmer le paiement
              </button>

              <button
                onClick={() => setStep('form')}
                className="w-full text-center text-sm text-muted hover:text-dark transition-colors py-2"
              >
                Modifier le numéro
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
