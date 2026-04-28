'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Wallet, Phone, CheckCircle, Clock, AlertCircle } from 'lucide-react'

const TRANSACTIONS = [
  { id: 't1', type: 'credit', label: 'Mission #AF-2847 · Kouadio B.', amount: 17160, date: 'Aujourd\'hui 18h30', status: 'completed' },
  { id: 't2', type: 'credit', label: 'Mission #AF-2831 · Diallo M.', amount: 22000, date: 'Hier 14h15', status: 'completed' },
  { id: 't3', type: 'debit', label: 'Retrait Wave', amount: 30000, date: '03 Mar 2025', status: 'completed' },
  { id: 't4', type: 'credit', label: 'Mission #AF-2804 · Koné A.', amount: 11000, date: '01 Mar 2025', status: 'completed' },
  { id: 't5', type: 'credit', label: 'Mission #AF-2789 · Aya K.', amount: 8800, date: '27 Fév 2025', status: 'pending' },
]

export default function PortefeuillePage() {
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawPhone, setWithdrawPhone] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawStep, setWithdrawStep] = useState<'form' | 'processing' | 'done'>('form')

  const balance = 58960
  const pending = 8800

  const handleWithdraw = () => {
    setWithdrawStep('processing')
    setTimeout(() => setWithdrawStep('done'), 2000)
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-dark text-cream">
        <div className="page-container py-4 flex items-center gap-3 max-w-2xl">
          <Link href="/artisan-space/dashboard" className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-accent" />
            <div className="font-display font-bold">Mon Portefeuille</div>
          </div>
        </div>
      </div>

      <div className="pt-6 pb-16 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Balance card */}
          <div className="bg-dark rounded-2xl p-6 mb-6 text-center">
            <p className="font-mono text-xs text-muted uppercase tracking-wider mb-2">Solde disponible</p>
            <p className="font-display text-5xl font-bold text-cream mb-1">
              {balance.toLocaleString()}
            </p>
            <p className="font-mono text-sm text-muted">FCFA</p>

            {pending > 0 && (
              <div className="flex items-center justify-center gap-2 mt-4 text-sm">
                <Clock size={14} className="text-gold" />
                <span className="text-muted">{pending.toLocaleString()} FCFA en attente de validation</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mt-6 text-center">
              {[
                { label: 'Ce mois', value: '58 960 FCFA' },
                { label: 'En séquestre', value: '8 800 FCFA' },
                { label: 'Total retraits', value: '30 000 FCFA' },
              ].map(s => (
                <div key={s.label} className="bg-dark2 rounded-xl p-3">
                  <div className="text-cream font-semibold text-sm">{s.value}</div>
                  <div className="text-muted text-xs mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowWithdraw(true)}
              className="mt-6 w-full bg-accent text-white font-semibold py-3 rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowUpRight size={16} /> Retirer vers Wave
            </button>
          </div>

          {/* Withdraw modal */}
          {showWithdraw && (
            <div className="card border-accent/30 border-2 mb-6 animate-fade-up">
              {withdrawStep === 'form' && (
                <div>
                  <h3 className="font-display font-bold text-dark mb-4">Retrait Wave</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Numéro Wave</label>
                      <div className="flex gap-2">
                        <div className="bg-bg2 border border-border rounded-xl px-3 py-3 text-sm font-mono flex-shrink-0">🇨🇮 +225</div>
                        <input type="tel" value={withdrawPhone} onChange={e => setWithdrawPhone(e.target.value)}
                          placeholder="07 00 00 00 00" className="input flex-1 font-mono" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Montant (FCFA)</label>
                      <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                        placeholder={`Max : ${balance.toLocaleString()} FCFA`} className="input" />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={handleWithdraw} disabled={!withdrawPhone || !withdrawAmount}
                        className="btn-primary flex-1 disabled:opacity-40">
                        Confirmer
                      </button>
                      <button onClick={() => setShowWithdraw(false)} className="btn-outline flex-1">Annuler</button>
                    </div>
                  </div>
                </div>
              )}
              {withdrawStep === 'processing' && (
                <div className="text-center py-4">
                  <div className="w-10 h-10 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
                  <p className="font-semibold text-dark">Traitement en cours...</p>
                  <p className="text-sm text-muted">Connexion à Wave Business</p>
                </div>
              )}
              {withdrawStep === 'done' && (
                <div className="text-center py-4">
                  <CheckCircle size={40} className="text-accent2 mx-auto mb-3" />
                  <p className="font-semibold text-dark">Retrait effectué !</p>
                  <p className="text-sm text-muted">{parseInt(withdrawAmount).toLocaleString()} FCFA envoyés</p>
                  <button onClick={() => { setShowWithdraw(false); setWithdrawStep('form') }}
                    className="mt-4 text-sm text-accent hover:underline">Fermer</button>
                </div>
              )}
            </div>
          )}

          {/* Transactions */}
          <div>
            <h2 className="font-display text-lg font-bold text-dark mb-4">Historique</h2>
            <div className="space-y-3">
              {TRANSACTIONS.map(t => (
                <div key={t.id} className="card flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    t.type === 'credit' ? 'bg-accent2/10' : 'bg-accent/10'
                  }`}>
                    {t.type === 'credit'
                      ? <ArrowDownLeft size={18} className="text-accent2" />
                      : <ArrowUpRight size={18} className="text-accent" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-dark text-sm truncate">{t.label}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted">{t.date}</span>
                      {t.status === 'pending' && (
                        <span className="flex items-center gap-1 text-xs text-gold">
                          <Clock size={10} /> En attente
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`font-display font-bold flex-shrink-0 ${
                    t.type === 'credit' ? 'text-accent2' : 'text-accent'
                  }`}>
                    {t.type === 'credit' ? '+' : '-'}{t.amount.toLocaleString()}
                    <span className="text-xs font-normal text-muted ml-1">FCFA</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
