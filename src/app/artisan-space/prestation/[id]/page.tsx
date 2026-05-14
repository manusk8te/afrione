'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Camera, Upload, CheckCircle, Zap } from 'lucide-react'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

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
      <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
        <div style={{ maxWidth: '380px', width: '100%', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', background: 'rgba(34,197,94,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <CheckCircle size={40} color="#22c55e" />
          </div>
          <h1 style={{ fontWeight: 700, fontSize: '28px', color: '#3D4852', marginBottom: '12px' }}>Prestation validée !</h1>
          <p style={{ color: '#6B7280', marginBottom: '8px' }}>Le client a reçu votre rapport de fin de mission</p>
          <div style={{ background: '#FFFFFF', boxShadow: NEU_SHADOW, borderRadius: '20px', padding: '16px', marginBottom: '32px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
              <span style={{ color: '#6B7280' }}>Total facturé</span>
              <span style={{ fontWeight: 700, color: '#3D4852' }}>{total.toLocaleString()} FCFA</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
              <span style={{ color: '#6B7280' }}>Commission AfriOne (12%)</span>
              <span style={{ color: '#6B7280' }}>{commission.toLocaleString()} FCFA</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid #E2E8F0', paddingTop: '8px' }}>
              <span style={{ fontWeight: 700, color: '#3D4852' }}>Vos gains</span>
              <span style={{ fontWeight: 700, color: '#E85D26' }}>{net.toLocaleString()} FCFA</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>Les fonds seront disponibles après validation du client.</p>
          <Link href="/artisan-space/dashboard" className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}>
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA' }}>
      {/* Header */}
      <div style={{ background: '#FFFFFF', boxShadow: '0 1px 0 #E2E8F0' }}>
        <div style={{ maxWidth: '672px', margin: '0 auto', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/artisan-space/dashboard" style={{ padding: '6px', borderRadius: '8px', display: 'flex', transition: 'background 0.15s', color: '#3D4852' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F5F7FA'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div style={{ fontWeight: 700, color: '#3D4852' }}>{step === 'saisie' ? 'Saisie de prestation' : 'Photo de fin de chantier'}</div>
            <div style={{ fontSize: '12px', color: '#8B95A5' }}>Mission #AF-2847</div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex' }}>
        {['saisie', 'photo'].map((s, i) => (
          <div key={s} className={`h-1 flex-1 transition-all ${i === 0 && (step === 'saisie' || step === 'photo') ? 'afrione-gradient' : step === 'photo' && i === 1 ? 'afrione-gradient' : ''}`}
            style={!(i === 0 && (step === 'saisie' || step === 'photo')) && !(step === 'photo' && i === 1) ? { height: '4px', flex: 1, background: '#E2E8F0' } : { height: '4px', flex: 1 }} />
        ))}
      </div>

      <div style={{ padding: '24px 16px 64px' }}>
        <div style={{ maxWidth: '672px', margin: '0 auto' }}>

          {/* STEP SAISIE */}
          {step === 'saisie' && (
            <div>
              <h1 style={{ fontWeight: 700, fontSize: '24px', color: '#3D4852', marginBottom: '24px' }}>Travaux réalisés</h1>

              {/* Items list */}
              <div style={{ background: '#FFFFFF', boxShadow: NEU_SHADOW, borderRadius: '20px', padding: '20px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        fontSize: '11px', padding: '4px 8px', borderRadius: '8px', flexShrink: 0,
                        background: item.type === 'main_oeuvre' ? 'rgba(232,93,38,0.08)' : 'rgba(34,197,94,0.08)',
                        color: item.type === 'main_oeuvre' ? '#E85D26' : '#16a34a',
                      }}>
                        {item.type === 'main_oeuvre' ? 'MO' : 'MAT'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#3D4852' }}>{item.label}</div>
                        <div style={{ fontSize: '12px', color: '#8B95A5' }}>{item.qty} × {item.prix.toLocaleString()} FCFA</div>
                      </div>
                      <div style={{ fontWeight: 700, color: '#3D4852', fontSize: '14px' }}>{(item.qty * item.prix).toLocaleString()}</div>
                      <button onClick={() => removeItem(item.id)} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Trash2 size={14} color="#8B95A5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid #E2E8F0', marginTop: '16px', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, color: '#3D4852' }}>Total</span>
                  <span style={{ fontWeight: 700, fontSize: '22px', color: '#3D4852' }}>{total.toLocaleString()} FCFA</span>
                </div>
              </div>

              {/* Add item */}
              <div style={{ background: '#FFFFFF', boxShadow: NEU_SHADOW, borderRadius: '20px', padding: '20px', marginBottom: '24px' }}>
                <h3 style={{ fontWeight: 600, color: '#3D4852', fontSize: '14px', marginBottom: '12px' }}>Ajouter un élément</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <select value={newType} onChange={e => setNewType(e.target.value as any)}
                    style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', color: '#3D4852', outline: 'none' }}>
                    <option value="main_oeuvre">Main d'œuvre</option>
                    <option value="materiau">Matériau</option>
                  </select>
                  <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                    placeholder="Description"
                    style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', color: '#3D4852', outline: 'none' }} />
                  <input type="number" value={newQty} onChange={e => setNewQty(e.target.value)}
                    placeholder="Qté"
                    style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', color: '#3D4852', outline: 'none' }} />
                  <input type="number" value={newPrix} onChange={e => setNewPrix(e.target.value)}
                    placeholder="Prix unitaire FCFA"
                    style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', color: '#3D4852', outline: 'none' }} />
                </div>
                <button onClick={addItem} disabled={!newLabel || !newPrix}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 500, color: '#E85D26', border: '1.5px solid rgba(232,93,38,0.3)', padding: '10px', borderRadius: '12px', background: '#FFFFFF', boxShadow: NEU_SMALL, cursor: 'pointer', opacity: (!newLabel || !newPrix) ? 0.4 : 1 }}>
                  <Plus size={14} /> Ajouter
                </button>
              </div>

              <button onClick={generateDevis} disabled={items.length === 0 || generating}
                className="btn-primary" style={{ width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: (items.length === 0 || generating) ? 0.4 : 1 }}>
                {generating ? (
                  <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Génération IA...</>
                ) : (
                  <><Zap size={16} /> Générer le devis final et continuer</>
                )}
              </button>
            </div>
          )}

          {/* STEP PHOTO */}
          {step === 'photo' && (
            <div className="animate-fade-up">
              <h1 style={{ fontWeight: 700, fontSize: '24px', color: '#3D4852', marginBottom: '8px' }}>Photo de fin de chantier</h1>
              <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>Envoyez la preuve de votre travail pour déclencher le paiement</p>

              <div
                onClick={() => setPhotoUploaded(true)}
                style={{
                  border: `2px dashed ${photoUploaded ? '#22c55e' : '#E2E8F0'}`,
                  background: photoUploaded ? 'rgba(34,197,94,0.04)' : '#FFFFFF',
                  borderRadius: '20px', padding: '48px', textAlign: 'center', cursor: 'pointer',
                  transition: 'all 0.2s', marginBottom: '24px',
                  boxShadow: NEU_SHADOW,
                }}
              >
                {photoUploaded ? (
                  <div>
                    <CheckCircle size={40} color="#22c55e" style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontWeight: 600, color: '#22c55e' }}>Photo ajoutée !</p>
                    <p style={{ fontSize: '12px', color: '#8B95A5', marginTop: '4px' }}>chantier_terminé.jpg</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
                      <Camera size={32} color="#8B95A5" />
                      <Upload size={32} color="#8B95A5" />
                    </div>
                    <p style={{ fontWeight: 600, color: '#3D4852' }}>Prendre ou importer une photo</p>
                    <p style={{ fontSize: '12px', color: '#8B95A5', marginTop: '4px' }}>Montrez le travail terminé proprement</p>
                  </div>
                )}
              </div>

              {/* Récapitulatif */}
              <div style={{ background: '#FFFFFF', boxShadow: NEU_SHADOW, borderRadius: '20px', padding: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                  <span style={{ color: '#6B7280' }}>Total prestation</span>
                  <span style={{ fontWeight: 700, color: '#3D4852' }}>{total.toLocaleString()} FCFA</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                  <span style={{ color: '#6B7280' }}>Commission AfriOne (12%)</span>
                  <span style={{ color: '#6B7280' }}>{commission.toLocaleString()} FCFA</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid #E2E8F0', paddingTop: '8px' }}>
                  <span style={{ fontWeight: 700, color: '#3D4852' }}>Vos gains</span>
                  <span style={{ fontWeight: 700, fontSize: '18px', color: '#E85D26' }}>{net.toLocaleString()} FCFA</span>
                </div>
              </div>

              <button onClick={() => setStep('done')} disabled={!photoUploaded}
                className="btn-primary" style={{ width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: !photoUploaded ? 0.4 : 1 }}>
                <CheckCircle size={16} /> Soumettre et demander la validation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
