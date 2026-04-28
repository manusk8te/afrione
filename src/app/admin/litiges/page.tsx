'use client'
import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle, Zap, MessageCircle, DollarSign, X, Clock, Shield } from 'lucide-react'

type Litige = {
  id: string; client: string; artisan: string; category: string; amount: number
  date: string; status: 'open' | 'analyzing' | 'resolved'
  description: string; sentiment: 'negative' | 'very_negative' | 'neutral'
  aiSuggestion?: string; messages: { sender: string; text: string; time: string }[]
}

const LITIGES: Litige[] = [
  {
    id: 'l1', client: 'Aya Konaté', artisan: 'Bamba Seydou', category: 'Électricité',
    amount: 35000, date: 'Aujourd\'hui 10h', status: 'open', sentiment: 'very_negative',
    description: 'Le disjoncteur saute encore après l\'intervention. L\'artisan refuse de revenir.',
    aiSuggestion: 'Intervention incomplète probable. Recommandation : remboursement partiel 50% ou retour artisan sous 48h.',
    messages: [
      { sender: 'Aya K.', text: 'Le problème persiste, mon disjoncteur continue de sauter !', time: '10h15' },
      { sender: 'Bamba S.', text: 'J\'ai fait mon travail correctement, le problème vient d\'ailleurs.', time: '10h32' },
    ],
  },
  {
    id: 'l2', client: 'Jean-Marc G.', artisan: 'Koné Adama', category: 'Peinture',
    amount: 75000, date: 'Hier 16h', status: 'analyzing', sentiment: 'negative',
    description: 'La peinture commence à se décoller après 3 jours. Mauvaise préparation des murs.',
    aiSuggestion: 'Défaut de qualité confirmé par les photos. Recommandation : reprise des travaux sans frais supplémentaires.',
    messages: [
      { sender: 'Jean-Marc G.', text: 'La peinture se décolle partout, c\'est du travail bâclé !', time: 'Hier 16h' },
    ],
  },
  {
    id: 'l3', client: 'Fatou Diallo', artisan: 'Traoré Sékou', category: 'Plomberie',
    amount: 12000, date: 'Il y a 3 jours', status: 'resolved', sentiment: 'neutral',
    description: 'Désaccord sur le prix final vs devis initial.',
    aiSuggestion: 'Résolu — remboursement de 3 000 FCFA accordé au client.',
    messages: [],
  },
]

export default function AdminLitigesPage() {
  const [litiges, setLitiges] = useState<Litige[]>(LITIGES)
  const [selected, setSelected] = useState<Litige | null>(LITIGES[0])
  const [analyzing, setAnalyzing] = useState(false)

  const analyze = (id: string) => {
    setAnalyzing(true)
    setTimeout(() => {
      setLitiges(ls => ls.map(l => l.id === id ? { ...l, status: 'analyzing' } : l))
      setAnalyzing(false)
    }, 2000)
  }

  const resolve = (id: string, action: 'refund' | 'close' | 'redo') => {
    setLitiges(ls => ls.map(l => l.id === id ? { ...l, status: 'resolved' } : l))
    setSelected(s => s?.id === id ? { ...s, status: 'resolved' } : s)
  }

  const sentimentConfig = {
    very_negative: { label: 'Très négatif', color: 'text-red-400', bg: 'bg-red-500/10' },
    negative: { label: 'Négatif', color: 'text-accent', bg: 'bg-accent/10' },
    neutral: { label: 'Neutre', color: 'text-muted', bg: 'bg-white/5' },
  }

  const statusConfig = {
    open: { label: 'Ouvert', color: 'bg-red-500/20 text-red-400' },
    analyzing: { label: 'Analyse IA', color: 'bg-gold/20 text-yellow-400' },
    resolved: { label: 'Résolu', color: 'bg-accent2/20 text-accent2' },
  }

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
              { href: '/admin/kyc', label: '🔍 Validation KYC' },
              { href: '/admin/litiges', label: '⚖️ Litiges', active: true },
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
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-cream">Litiges & Arbitrage</h1>
            <p className="text-muted text-sm">{litiges.filter(l => l.status === 'open').length} litige{litiges.filter(l => l.status === 'open').length > 1 ? 's' : ''} ouvert{litiges.filter(l => l.status === 'open').length > 1 ? 's' : ''}</p>
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            {/* List */}
            <div className="lg:col-span-2 space-y-3">
              {litiges.map(l => (
                <button key={l.id} onClick={() => setSelected(l)}
                  className={`w-full text-left bg-dark2 border rounded-2xl p-4 transition-all ${
                    selected?.id === l.id ? 'border-accent' : 'border-border/30 hover:border-border'
                  }`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-semibold text-cream text-sm">{l.client}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusConfig[l.status].color}`}>
                      {statusConfig[l.status].label}
                    </span>
                  </div>
                  <div className="text-xs text-muted mb-1">vs {l.artisan} · {l.category}</div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">{l.date}</span>
                    <span className="font-bold text-cream">{l.amount.toLocaleString()} FCFA</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail */}
            {selected && (
              <div className="lg:col-span-3 bg-dark2 border border-border/30 rounded-2xl p-5 space-y-5 animate-fade-in">

                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-display text-lg font-bold text-cream">Litige #{selected.id}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-sm text-muted">{selected.client} vs {selected.artisan}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig[selected.status].color}`}>
                        {statusConfig[selected.status].label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl font-bold text-cream">{selected.amount.toLocaleString()}</div>
                    <div className="text-xs text-muted">FCFA en litige</div>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-dark border border-border/30 rounded-xl p-4">
                  <p className="font-mono text-xs text-muted uppercase tracking-wider mb-2">Description du litige</p>
                  <p className="text-sm text-cream">{selected.description}</p>
                  <div className={`inline-flex items-center gap-1 mt-3 text-xs px-2 py-1 rounded-lg ${sentimentConfig[selected.sentiment].bg} ${sentimentConfig[selected.sentiment].color}`}>
                    <AlertCircle size={10} /> Sentiment : {sentimentConfig[selected.sentiment].label}
                  </div>
                </div>

                {/* Chat history */}
                {selected.messages.length > 0 && (
                  <div>
                    <p className="font-mono text-xs text-muted uppercase tracking-wider mb-3">Historique chat</p>
                    <div className="space-y-2">
                      {selected.messages.map((msg, i) => (
                        <div key={i} className="bg-dark border border-border/20 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-cream">{msg.sender}</span>
                            <span className="text-xs text-muted">{msg.time}</span>
                          </div>
                          <p className="text-sm text-muted">{msg.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI suggestion */}
                {selected.aiSuggestion && (
                  <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap size={14} className="text-accent" />
                      <span className="font-mono text-xs text-accent uppercase tracking-wider">Suggestion IA</span>
                    </div>
                    <p className="text-sm text-cream">{selected.aiSuggestion}</p>
                  </div>
                )}

                {/* Actions */}
                {selected.status === 'open' && (
                  <div className="space-y-3">
                    <button onClick={() => analyze(selected.id)} disabled={analyzing}
                      className="w-full flex items-center justify-center gap-2 bg-dark border border-border/30 text-cream text-sm font-medium py-3 rounded-xl hover:bg-dark2 transition-colors disabled:opacity-40">
                      {analyzing ? (
                        <><div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /> Analyse IA en cours...</>
                      ) : (
                        <><Zap size={14} className="text-accent" /> Analyser avec l'IA</>
                      )}
                    </button>
                  </div>
                )}

                {selected.status === 'analyzing' && (
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => resolve(selected.id, 'refund')}
                      className="flex flex-col items-center gap-1.5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 hover:bg-red-500/20 transition-colors text-xs font-medium">
                      <DollarSign size={16} /> Rembourser
                    </button>
                    <button onClick={() => resolve(selected.id, 'redo')}
                      className="flex flex-col items-center gap-1.5 p-3 bg-gold/10 border border-gold/20 rounded-xl text-yellow-400 hover:bg-gold/20 transition-colors text-xs font-medium">
                      <MessageCircle size={16} /> Reprise travaux
                    </button>
                    <button onClick={() => resolve(selected.id, 'close')}
                      className="flex flex-col items-center gap-1.5 p-3 bg-accent2/10 border border-accent2/20 rounded-xl text-accent2 hover:bg-accent2/20 transition-colors text-xs font-medium">
                      <CheckCircle size={16} /> Clôturer
                    </button>
                  </div>
                )}

                {selected.status === 'resolved' && (
                  <div className="flex items-center gap-2 bg-accent2/10 border border-accent2/20 rounded-xl p-3">
                    <CheckCircle size={16} className="text-accent2" />
                    <span className="text-sm text-accent2">Litige résolu</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
