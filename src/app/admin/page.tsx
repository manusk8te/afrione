'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Zap, TrendingUp, Users, CheckCircle, AlertCircle, DollarSign, Activity } from 'lucide-react'

const KPI_CARDS = [
  { label: 'CA du mois', value: '2 847 500 FCFA', change: '+18%', icon: DollarSign, color: 'text-accent2' },
  { label: 'Missions ce mois', value: '147', change: '+12%', icon: Activity, color: 'text-accent' },
  { label: 'Artisans actifs', value: '89', change: '+5', icon: Users, color: 'text-gold' },
  { label: 'Taux satisfaction', value: '97.3%', change: '+0.8%', icon: TrendingUp, color: 'text-accent2' },
]

const RECENT_MISSIONS = [
  { id: 'm1', client: 'Aya K.', artisan: 'Kouadio B.', category: 'Plomberie', amount: 18000, status: 'en_cours' },
  { id: 'm2', client: 'Jean M.', artisan: 'Diallo M.', category: 'Électricité', amount: 35000, status: 'completed' },
  { id: 'm3', client: 'Fatou D.', artisan: 'Koné A.', category: 'Peinture', amount: 75000, status: 'disputed' },
  { id: 'm4', client: 'Moussa T.', artisan: 'Bamba S.', category: 'Climatisation', amount: 45000, status: 'payment' },
]

const KYC_PENDING = [
  { name: 'Sanogo Cheick', metier: 'Menuiserie', submitted: 'Il y a 2h' },
  { name: 'Koffi Yao', metier: 'Électricité', submitted: 'Il y a 5h' },
  { name: 'Ouattara Dramane', metier: 'Plomberie', submitted: 'Hier' },
]

const STATUS_COLORS: Record<string, string> = {
  en_cours: 'text-accent2 bg-accent2/10',
  completed: 'text-accent2 bg-accent2/10',
  disputed: 'text-red-600 bg-red-50',
  payment: 'text-gold bg-gold/10',
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="min-h-screen bg-dark text-cream">
      {/* Sidebar */}
      <div className="flex">
        <aside className="hidden lg:flex flex-col w-64 bg-dark2 border-r border-border min-h-screen p-6">
          <Link href="/" className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-xl">AFRI<span className="text-accent">ONE</span></span>
          </Link>

          <nav className="space-y-1 flex-1">
            {[
              { id: 'overview', label: 'Vue d\'ensemble', icon: '📊' },
              { id: 'missions', label: 'Missions', icon: '📋' },
              { id: 'artisans', label: 'Artisans', icon: '🔧' },
              { id: 'kyc', label: 'Validations KYC', icon: '🪪' },
              { id: 'litiges', label: 'Litiges', icon: '⚠️' },
              { id: 'prices', label: 'Grille des prix', icon: '💰' },
              { id: 'finance', label: 'Finance', icon: '💳' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                  activeTab === item.id ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-border hover:text-cream'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="pt-6 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-white font-bold text-sm">A</div>
              <div>
                <div className="text-sm font-medium">Admin</div>
                <div className="text-xs text-muted">AfriOne</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="font-display text-3xl font-bold">Dashboard Admin</h1>
                <p className="text-muted text-sm mt-1">Jeudi 5 Mars 2025</p>
              </div>
              <div className="flex items-center gap-2 bg-accent2/10 border border-accent2/20 px-4 py-2 rounded-full">
                <span className="w-2 h-2 bg-accent2 rounded-full animate-pulse-soft" />
                <span className="text-xs font-mono text-accent2">SYSTÈME OPÉRATIONNEL</span>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {KPI_CARDS.map(k => (
                <div key={k.label} className="bg-dark2 border border-border rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <k.icon size={18} className={k.color} />
                    <span className="font-mono text-xs text-accent2">+{k.change}</span>
                  </div>
                  <div className={`font-display text-2xl font-bold ${k.color}`}>{k.value}</div>
                  <div className="font-mono text-xs text-muted mt-1 uppercase tracking-wider">{k.label}</div>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent missions */}
              <div className="bg-dark2 border border-border rounded-2xl p-6">
                <h2 className="font-display text-lg font-bold mb-5">Missions récentes</h2>
                <div className="space-y-3">
                  {RECENT_MISSIONS.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-3 bg-dark rounded-xl">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{m.client} → {m.artisan}</div>
                        <div className="text-xs text-muted">{m.category}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono">{m.amount.toLocaleString()} F</div>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${STATUS_COLORS[m.status]}`}>
                          {m.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* KYC Pending */}
              <div className="bg-dark2 border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display text-lg font-bold">KYC en attente</h2>
                  <span className="badge bg-accent/10 text-accent">{KYC_PENDING.length} en attente</span>
                </div>
                <div className="space-y-3">
                  {KYC_PENDING.map(k => (
                    <div key={k.name} className="flex items-center gap-3 p-3 bg-dark rounded-xl">
                      <div className="w-10 h-10 bg-border rounded-xl flex items-center justify-center text-lg">🔧</div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{k.name}</div>
                        <div className="text-xs text-muted">{k.metier} · {k.submitted}</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="w-8 h-8 bg-accent2/20 text-accent2 rounded-lg flex items-center justify-center hover:bg-accent2/30 transition-colors">
                          <CheckCircle size={14} />
                        </button>
                        <button className="w-8 h-8 bg-accent/20 text-accent rounded-lg flex items-center justify-center hover:bg-accent/30 transition-colors">
                          <AlertCircle size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
