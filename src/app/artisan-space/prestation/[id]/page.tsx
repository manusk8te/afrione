'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Camera, Upload, CheckCircle, Zap } from 'lucide-react'

type Item = { id: string; label: string; qty: number; prix: number; type: 'main_oeuvre' | 'materiau' }

export default function PrestationPage() {
  const params = useParams()
  const [step, setStep] = useState<'saisie' | 'photo' | 'done'>('saisie')
  const [photoUploaded, setPhotoUploaded] = useState(false)
  const [items, setItems] = useState<Item[]>([
    { id: '1', label: 'Main d\'œuvre', qty: 2, prix: 6000, type: 'main_oeuvre' },
    { id: '2', label: 'Joint d\'étanchéité', qty: 2, prix: 1500, type: 'materiau' },
  ])
  const [newLabel, setNewLabel] = useState('')
  const [newQty, setNewQty] = useState('1')
  const [newPrix, setNewPrix] = useState('')
  const [newType, setNewType] = useState<'main_oeuvre' | 'materiau'>('materiau')
  const [generating, setGenerating] = useState(false)

  const total = items.reduce((s, i) => s + i.qty * i.prix, 0)
  const commission = Math.round(total * 0.12)
  const net = total - commission

  const addItem = () => {
    if (!newLabel || !newPrix) return
    setItems(it => [...it, {
      id: Date.now().toString(), label: newLabel,
      qty: parseInt(newQty), prix: parseInt(newPrix), type: newType,
    }])
    setNewLabel(''); setNewQty('1'); setNewPrix('')
  }

  const removeItem = (id: string) => setItems(it => it.filter(i => i.id !== id))

  const generateDevis = () => {
    setGenerating(true)
    setTimeout(() => { setGenerating(false); setStep('photo') }, 1500)
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-accent2/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-accent2" />
          </div>
          <h1 className="font-display text-3xl font-bold text-dark mb-3">Prestation validée !</h1>
          <p className="text-muted mb-2">Le client a reçu votre rapport de fin de mission</p>
          <div className="bg-white border border-border rounded-2xl p-4 mb-8 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Total facturé</span>
              <span className="font-bold text-dark">{total.toLocaleString()} FCFA</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Commission AfriOne (12%)</span>
              <span className="text-muted">{commission.toLocaleString()} FCFA</span>
            </div>
            <div className="flex justify-between text-sm border-t border-border pt-2">
              <span className="font-bold text-dark">Vos gains</span>
              <span className="font-bold text-accent2">{net.toLocaleString()} FCFA</span>
            </div>
          </div>
          <p className="text-sm text-muted mb-6">Les fonds seront disponibles après validation du client.</p>
          <Link href="/artisan-space/dashboard" className="btn-primary w-full flex items-center justify-center gap-2">
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-dark text-cream">
        <div className="page-container py-4 flex items-center gap-3 max-w-2xl">
          <Link href="/artisan-space/dashboard" className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="font-display font-bold">{step === 'saisie' ? 'Saisie de prestation' : 'Photo de fin de chantier'}</div>
            <div className="text-xs text-muted">Mission #AF-2847</div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-0 flex-shrink-0">
        {['saisie', 'photo'].map((s, i) => (
          <div key={s} className={`h-1 flex-1 transition-all ${i === 0 && (step === 'saisie' || step === 'photo') ? 'bg-accent' : step === 'photo' && i === 1 ? 'bg-accent' : 'bg-border'}`} />
        ))}
      </div>

      <div className="pt-6 pb-16 px-4">
        <div className="max-w-2xl mx-auto">

          {/* STEP SAISIE */}
          {step === 'saisie' && (
            <div>
              <h1 className="font-display text-2xl font-bold text-dark mb-6">Travaux réalisés</h1>

              {/* Items list */}
              <div className="card mb-4">
                <div className="space-y-3">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className={`text-xs px-2 py-1 rounded-lg flex-shrink-0 ${
                        item.type === 'main_oeuvre' ? 'bg-accent/10 text-accent' : 'bg-accent2/10 text-accent2'
                      }`}>
                        {item.type === 'main_oeuvre' ? 'MO' : 'MAT'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-dark">{item.label}</div>
                        <div className="text-xs text-muted">{item.qty} × {item.prix.toLocaleString()} FCFA</div>
                      </div>
                      <div className="font-bold text-dark text-sm">{(item.qty * item.prix).toLocaleString()}</div>
                      <button onClick={() => removeItem(item.id)} className="p-1 hover:text-red-500 transition-colors">
                        <Trash2 size={14} className="text-muted" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border mt-4 pt-4 flex justify-between">
                  <span className="font-display font-bold text-dark">Total</span>
                  <span className="font-display text-2xl font-bold text-dark">{total.toLocaleString()} FCFA</span>
                </div>
              </div>

              {/* Add item */}
              <div className="card mb-6">
                <h3 className="font-semibold text-dark text-sm mb-3">Ajouter un élément</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <select value={newType} onChange={e => setNewType(e.target.value as any)} className="input text-sm">
                    <option value="main_oeuvre">Main d'œuvre</option>
                    <option value="materiau">Matériau</option>
                  </select>
                  <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                    placeholder="Description" className="input text-sm" />
                  <input type="number" value={newQty} onChange={e => setNewQty(e.target.value)}
                    placeholder="Qté" className="input text-sm" />
                  <input type="number" value={newPrix} onChange={e => setNewPrix(e.target.value)}
                    placeholder="Prix unitaire FCFA" className="input text-sm" />
                </div>
                <button onClick={addItem} disabled={!newLabel || !newPrix}
                  className="w-full flex items-center justify-center gap-2 text-sm font-medium text-accent border border-accent/30 py-2.5 rounded-xl hover:bg-accent/5 transition-colors disabled:opacity-40">
                  <Plus size={14} /> Ajouter
                </button>
              </div>

              <button onClick={generateDevis} disabled={items.length === 0 || generating}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-40">
                {generating ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Génération IA...</>
                ) : (
                  <><Zap size={16} /> Générer le devis final et continuer</>
                )}
              </button>
            </div>
          )}

          {/* STEP PHOTO */}
          {step === 'photo' && (
            <div className="animate-fade-up">
              <h1 className="font-display text-2xl font-bold text-dark mb-2">Photo de fin de chantier</h1>
              <p className="text-muted text-sm mb-6">Envoyez la preuve de votre travail pour déclencher le paiement</p>

              <div
                onClick={() => setPhotoUploaded(true)}
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all mb-6 ${
                  photoUploaded ? 'border-accent2 bg-accent2/5' : 'border-border hover:border-accent hover:bg-accent/5'
                }`}
              >
                {photoUploaded ? (
                  <div>
                    <CheckCircle size={40} className="text-accent2 mx-auto mb-3" />
                    <p className="font-semibold text-accent2">Photo ajoutée !</p>
                    <p className="text-xs text-muted mt-1">chantier_terminé.jpg</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-center gap-4 mb-4">
                      <Camera size={32} className="text-muted" />
                      <Upload size={32} className="text-muted" />
                    </div>
                    <p className="font-semibold text-dark">Prendre ou importer une photo</p>
                    <p className="text-xs text-muted mt-1">Montrez le travail terminé proprement</p>
                  </div>
                )}
              </div>

              <div className="bg-dark rounded-2xl p-4 mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted">Total prestation</span>
                  <span className="text-cream font-bold">{total.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted">Commission AfriOne (12%)</span>
                  <span className="text-muted">{commission.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between text-sm border-t border-border/30 pt-2">
                  <span className="text-cream font-bold">Vos gains</span>
                  <span className="text-accent2 font-bold text-lg">{net.toLocaleString()} FCFA</span>
                </div>
              </div>

              <button onClick={() => setStep('done')} disabled={!photoUploaded}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-40">
                <CheckCircle size={16} /> Soumettre et demander la validation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
