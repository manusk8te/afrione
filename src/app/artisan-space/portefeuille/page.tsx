'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Wallet, Phone, CheckCircle, Clock, AlertCircle } from 'lucide-react'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

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
    <div className="min-h-screen" style={{background:'#F5F7FA'}}>
      {/* Header bar */}
      <div style={{background:'#FFFFFF',borderBottom:'1px solid #E2E8F0',boxShadow:NEU_SMALL}}>
        <div className="page-container py-4 flex items-center gap-3 max-w-2xl">
          <Link href="/artisan-space/dashboard" style={{padding:'4px',borderRadius:'8px',display:'flex',alignItems:'center',color:'#6B7280',textDecoration:'none'}}>
            <ArrowLeft size={18} />
          </Link>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <Wallet size={18} className="afrione-gradient-text" />
            <div className="font-display font-bold" style={{color:'#3D4852'}}>Mon Portefeuille</div>
          </div>
        </div>
      </div>

      <div className="pt-6 pb-16 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Balance card */}
          <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'24px',marginBottom:'24px',textAlign:'center'}}>
            <p style={{fontFamily:'Tahoma',fontSize:'12px',color:'#8B95A5',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'8px'}}>Solde disponible</p>
            <p className="font-display" style={{fontSize:'48px',fontWeight:700,color:'#3D4852',marginBottom:'4px'}}>
              {balance.toLocaleString()}
            </p>
            <p style={{fontFamily:'Tahoma',fontSize:'14px',color:'#8B95A5'}}>FCFA</p>

            {pending > 0 && (
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginTop:'16px',fontSize:'14px'}}>
                <Clock size={14} color="#C9A84C" />
                <span style={{color:'#6B7280'}}>{pending.toLocaleString()} FCFA en attente de validation</span>
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginTop:'24px',textAlign:'center'}}>
              {[
                { label: 'Ce mois', value: '58 960 FCFA' },
                { label: 'En séquestre', value: '8 800 FCFA' },
                { label: 'Total retraits', value: '30 000 FCFA' },
              ].map(s => (
                <div key={s.label} style={{background:'#F5F7FA',borderRadius:'12px',padding:'12px',boxShadow:NEU_SMALL}}>
                  <div style={{color:'#3D4852',fontWeight:600,fontSize:'14px'}}>{s.value}</div>
                  <div style={{color:'#8B95A5',fontSize:'12px',marginTop:'2px'}}>{s.label}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowWithdraw(true)}
              className="mt-6 w-full afrione-gradient text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              style={{marginTop:'24px'}}
            >
              <ArrowUpRight size={16} /> Retirer vers Wave
            </button>
          </div>

          {/* Withdraw modal */}
          {showWithdraw && (
            <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'20px',border:'2px solid rgba(232,93,38,0.2)',marginBottom:'24px'}}>
              {withdrawStep === 'form' && (
                <div>
                  <h3 className="font-display font-bold" style={{color:'#3D4852',marginBottom:'16px'}}>Retrait Wave</h3>
                  <div className="space-y-4">
                    <div>
                      <label style={{display:'block',fontSize:'12px',fontFamily:'Tahoma',color:'#8B95A5',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'8px'}}>Numéro Wave</label>
                      <div style={{display:'flex',gap:'8px'}}>
                        <div style={{background:'#F5F7FA',border:'1.5px solid #E2E8F0',borderRadius:'12px',padding:'12px',fontSize:'14px',fontFamily:'Tahoma',flexShrink:0,color:'#3D4852',boxShadow:NEU_SMALL}}>🇨🇮 +225</div>
                        <input type="tel" value={withdrawPhone} onChange={e => setWithdrawPhone(e.target.value)}
                          placeholder="07 00 00 00 00"
                          style={{flex:1,padding:'12px',border:'1.5px solid #E2E8F0',borderRadius:'12px',fontFamily:'Tahoma',fontSize:'14px',color:'#3D4852',outline:'none',background:'#FFFFFF'}} />
                      </div>
                    </div>
                    <div>
                      <label style={{display:'block',fontSize:'12px',fontFamily:'Tahoma',color:'#8B95A5',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'8px'}}>Montant (FCFA)</label>
                      <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                        placeholder={`Max : ${balance.toLocaleString()} FCFA`}
                        style={{width:'100%',padding:'12px',border:'1.5px solid #E2E8F0',borderRadius:'12px',fontSize:'14px',color:'#3D4852',outline:'none',background:'#FFFFFF',boxSizing:'border-box'}} />
                    </div>
                    <div style={{display:'flex',gap:'12px'}}>
                      <button onClick={handleWithdraw} disabled={!withdrawPhone || !withdrawAmount}
                        className="btn-primary flex-1 disabled:opacity-40"
                        style={{flex:1,opacity:(!withdrawPhone || !withdrawAmount) ? 0.4 : 1}}>
                        Confirmer
                      </button>
                      <button
                        onClick={() => setShowWithdraw(false)}
                        style={{flex:1,padding:'12px',background:'#FFFFFF',color:'#6B7280',border:'1.5px solid #E2E8F0',borderRadius:'12px',cursor:'pointer',fontWeight:600,fontSize:'14px',boxShadow:NEU_SMALL}}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {withdrawStep === 'processing' && (
                <div style={{textAlign:'center',padding:'16px 0'}}>
                  <div style={{width:'40px',height:'40px',border:'4px solid rgba(232,93,38,0.2)',borderTop:'4px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto 12px'}} />
                  <p style={{fontWeight:600,color:'#3D4852'}}>Traitement en cours...</p>
                  <p style={{fontSize:'14px',color:'#6B7280'}}>Connexion à Wave Business</p>
                </div>
              )}
              {withdrawStep === 'done' && (
                <div style={{textAlign:'center',padding:'16px 0'}}>
                  <CheckCircle size={40} style={{color:'#2B6B3E',margin:'0 auto 12px'}} />
                  <p style={{fontWeight:600,color:'#3D4852'}}>Retrait effectué !</p>
                  <p style={{fontSize:'14px',color:'#6B7280'}}>{parseInt(withdrawAmount).toLocaleString()} FCFA envoyés</p>
                  <button onClick={() => { setShowWithdraw(false); setWithdrawStep('form') }}
                    className="mt-4 text-sm afrione-gradient-text hover:underline"
                    style={{marginTop:'16px',background:'none',border:'none',cursor:'pointer',fontSize:'14px'}}>Fermer</button>
                </div>
              )}
            </div>
          )}

          {/* Transactions */}
          <div>
            <h2 className="font-display" style={{fontSize:'18px',fontWeight:700,color:'#3D4852',marginBottom:'16px'}}>Historique</h2>
            <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
              {TRANSACTIONS.map(t => (
                <div key={t.id} style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'16px',padding:'16px',display:'flex',alignItems:'center',gap:'16px'}}>
                  <div style={{
                    width:'40px',height:'40px',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
                    background: t.type === 'credit' ? 'rgba(43,107,62,0.08)' : 'rgba(232,93,38,0.08)',
                    boxShadow: NEU_SMALL,
                  }}>
                    {t.type === 'credit'
                      ? <ArrowDownLeft size={18} style={{color:'#2B6B3E'}} />
                      : <ArrowUpRight size={18} className="afrione-gradient-text" />}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:500,color:'#3D4852',fontSize:'14px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.label}</div>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'2px'}}>
                      <span style={{fontSize:'12px',color:'#8B95A5'}}>{t.date}</span>
                      {t.status === 'pending' && (
                        <span style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'12px',color:'#C9A84C'}}>
                          <Clock size={10} /> En attente
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`font-display font-bold flex-shrink-0 ${
                    t.type === 'credit' ? '' : 'afrione-gradient-text'
                  }`} style={{color: t.type === 'credit' ? '#2B6B3E' : undefined}}>
                    {t.type === 'credit' ? '+' : '-'}{t.amount.toLocaleString()}
                    <span style={{fontSize:'12px',fontWeight:400,color:'#8B95A5',marginLeft:'4px'}}>FCFA</span>
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
