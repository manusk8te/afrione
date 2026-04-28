'use client'
import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, X, Eye, Clock, Shield, AlertCircle, Filter } from 'lucide-react'

type KycStatus = 'pending' | 'approved' | 'rejected'
type KycDoc = { id: string; name: string; metier: string; submitted: string; status: KycStatus; docs: string[]; phone: string; quartier: string }

const INIT_DOCS: KycDoc[] = [
  { id: '1', name: 'Sanogo Cheick', metier: 'Menuiserie', submitted: 'Il y a 2h', status: 'pending', docs: ['CNI Recto', 'CNI Verso', 'Diplôme CAP'], phone: '+225 07 45 12 34', quartier: 'Adjamé' },
  { id: '2', name: 'Koffi Yao Bernard', metier: 'Électricité', submitted: 'Il y a 5h', status: 'pending', docs: ['CNI Recto', 'CNI Verso', 'Habilitation B2V'], phone: '+225 05 89 34 12', quartier: 'Cocody' },
  { id: '3', name: 'Ouattara Dramane', metier: 'Plomberie', submitted: 'Hier 14h', status: 'pending', docs: ['CNI Recto', 'CNI Verso'], phone: '+225 01 22 56 78', quartier: 'Yopougon' },
  { id: '4', name: 'Bamba Issouf', metier: 'Maçonnerie', submitted: 'Hier 09h', status: 'approved', docs: ['CNI Recto', 'CNI Verso', 'Attestation'], phone: '+225 07 11 22 33', quartier: 'Abobo' },
  { id: '5', name: 'Koné Drissa', metier: 'Peinture', submitted: 'Il y a 3 jours', status: 'rejected', docs: ['CNI Recto'], phone: '+225 05 44 55 66', quartier: 'Marcory' },
]

export default function AdminKYCPage() {
  const [docs, setDocs] = useState<KycDoc[]>(INIT_DOCS)
  const [selected, setSelected] = useState<KycDoc | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [filter, setFilter] = useState<KycStatus | 'all'>('pending')

  const approve = (id: string) => {
    setDocs(d => d.map(doc => doc.id === id ? { ...doc, status: 'approved' } : doc))
    setSelected(null)
  }

  const reject = (id: string) => {
    setDocs(d => d.map(doc => doc.id === id ? { ...doc, status: 'rejected' } : doc))
    setSelected(null)
    setRejectReason('')
  }

  const filtered = filter === 'all' ? docs : docs.filter(d => d.status === filter)
  const pendingCount = docs.filter(d => d.status === 'pending').length

  const statusBadge = (s: KycStatus) => ({
    pending: 'bg-gold/20 text-yellow-700',
    approved: 'bg-accent2/10 text-accent2',
    rejected: 'bg-red-100 text-red-700',
  }[s])

  const statusLabel = (s: KycStatus) => ({ pending: 'En attente', approved: 'Approuvé', rejected: 'Rejeté' }[s])

  return (
    <div className="min-h-screen bg-dark text-cream">
      <div className="flex">
        <aside className="hidden lg:flex flex-col w-56 bg-dark2 border-r border-border min-h-screen p-5 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center text-xs font-bold text-white">A</div>
            <span className="font-display font-bold">AFRIONE</span>
          </Link>
          <nav className="space-y-1">
            {[
              { href: '/admin', label: '📊 Vue d\'ensemble' },
              { href: '/admin/prix', label: '💰 Prix' },
              { href: '/admin/kyc', label: '🔍 Validation KYC', active: true },
              { href: '/admin/litiges', label: '⚖️ Litiges' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  item.active ? 'bg-accent/20 text-accent' : 'text-muted hover:text-cream hover:bg-white/5'
                }`}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-cream">Validation KYC</h1>
              <p className="text-muted text-sm">{pendingCount} dossier{pendingCount > 1 ? 's' : ''} en attente</p>
            </div>
            {pendingCount > 0 && (
              <div className="flex items-center gap-2 bg-gold/20 text-yellow-400 px-3 py-2 rounded-xl text-sm">
                <Clock size={14} /> {pendingCount} à traiter
              </div>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { id: 'pending' as const, label: 'En attente', count: docs.filter(d => d.status === 'pending').length },
              { id: 'approved' as const, label: 'Approuvés', count: docs.filter(d => d.status === 'approved').length },
              { id: 'rejected' as const, label: 'Rejetés', count: docs.filter(d => d.status === 'rejected').length },
              { id: 'all' as const, label: 'Tous', count: docs.length },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all ${
                  filter === f.id ? 'bg-accent text-white' : 'bg-dark2 text-muted hover:text-cream'
                }`}>
                {f.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === f.id ? 'bg-white/20' : 'bg-white/10'}`}>{f.count}</span>
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* List */}
            <div className="space-y-3">
              {filtered.map(doc => (
                <button key={doc.id} onClick={() => setSelected(doc)}
                  className={`w-full text-left bg-dark2 border rounded-2xl p-4 transition-all ${
                    selected?.id === doc.id ? 'border-accent' : 'border-border/30 hover:border-border'
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-dark rounded-xl flex items-center justify-center font-bold text-cream flex-shrink-0">
                      {doc.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-cream">{doc.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(doc.status)}`}>
                          {statusLabel(doc.status)}
                        </span>
                      </div>
                      <div className="text-sm text-muted mt-0.5">{doc.metier} · {doc.quartier}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                        <Clock size={10} /> {doc.submitted}
                        <span>·</span>
                        <Shield size={10} /> {doc.docs.length} document{doc.docs.length > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail panel */}
            {selected ? (
              <div className="bg-dark2 border border-border/30 rounded-2xl p-6 animate-fade-in">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="font-display text-xl font-bold text-cream">{selected.name}</h2>
                    <p className="text-muted text-sm">{selected.metier} · {selected.quartier}</p>
                    <p className="text-muted text-sm mt-0.5">{selected.phone}</p>
                  </div>
                  <span className={`text-xs px-3 py-1.5 rounded-full ${statusBadge(selected.status)}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className="space-y-3 mb-6">
                  <p className="font-mono text-xs text-muted uppercase tracking-wider">Documents soumis</p>
                  {selected.docs.map(doc => (
                    <div key={doc} className="flex items-center gap-3 bg-dark border border-border/30 rounded-xl p-3">
                      <Shield size={14} className="text-accent2" />
                      <span className="text-sm text-cream flex-1">{doc}</span>
                      <button className="text-xs text-accent hover:underline flex items-center gap-1">
                        <Eye size={12} /> Voir
                      </button>
                    </div>
                  ))}
                </div>

                {selected.status === 'pending' && (
                  <div className="space-y-3">
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Motif de rejet (optionnel)..."
                      className="w-full bg-dark border border-border/30 rounded-xl px-4 py-3 text-cream placeholder:text-muted text-sm focus:outline-none focus:border-accent transition-colors resize-none min-h-20"
                    />
                    <div className="flex gap-3">
                      <button onClick={() => approve(selected.id)}
                        className="flex-1 bg-accent2 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                        <CheckCircle size={16} /> Approuver
                      </button>
                      <button onClick={() => reject(selected.id)}
                        className="flex-1 bg-red-500/20 text-red-400 font-semibold py-3 rounded-xl hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2">
                        <X size={16} /> Rejeter
                      </button>
                    </div>
                  </div>
                )}

                {selected.status === 'approved' && (
                  <div className="flex items-center gap-2 bg-accent2/10 border border-accent2/20 rounded-xl p-3">
                    <CheckCircle size={16} className="text-accent2" />
                    <span className="text-sm text-accent2">Dossier approuvé — artisan actif sur la plateforme</span>
                  </div>
                )}

                {selected.status === 'rejected' && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                    <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-sm text-red-400">Dossier rejeté</span>
                      <button onClick={() => approve(selected.id)}
                        className="block mt-2 text-xs text-accent hover:underline">
                        Réapprouver ce dossier
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-dark2 border border-border/30 rounded-2xl p-6 flex items-center justify-center text-center">
                <div>
                  <Shield size={40} className="text-muted mx-auto mb-3" />
                  <p className="text-muted text-sm">Sélectionnez un dossier pour le consulter</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
