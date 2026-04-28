'use client'
import Link from 'next/link'
import { Plus, Clock, CheckCircle, AlertCircle, Star, ArrowRight, Zap } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'

const MOCK_MISSIONS = [
  { id: 'm1', category: 'Plomberie', status: 'en_cours', artisan: 'Kouadio Brou', date: '05 Mar 2025', price: 18000, icon: '🔧' },
  { id: 'm2', category: 'Électricité', status: 'completed', artisan: 'Diallo Mamadou', date: '28 Fév 2025', price: 25000, icon: '⚡' },
  { id: 'm3', category: 'Peinture', status: 'completed', artisan: 'Koné Adama', date: '15 Fév 2025', price: 45000, icon: '🎨' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  diagnostic: { label: 'Diagnostic', color: 'text-gold', icon: Clock },
  matching: { label: 'Recherche artisan', color: 'text-accent', icon: Zap },
  en_route: { label: 'En route', color: 'text-accent', icon: Clock },
  en_cours: { label: 'En cours', color: 'text-accent2', icon: Clock },
  completed: { label: 'Terminée', color: 'text-accent2', icon: CheckCircle },
  disputed: { label: 'Litige', color: 'text-red-500', icon: AlertCircle },
}

export default function DashboardPage() {
  const totalSpent = MOCK_MISSIONS.filter(m => m.status === 'completed').reduce((sum, m) => sum + m.price, 0)

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="page-container max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="section-label">MON ESPACE CLIENT</span>
              <h1 className="font-display text-3xl font-bold text-dark mt-1">Bonjour 👋</h1>
            </div>
            <Link href="/diagnostic" className="btn-primary flex items-center gap-2">
              <Plus size={16} />
              Nouvelle mission
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Missions totales', value: MOCK_MISSIONS.length, icon: '📋' },
              { label: 'Missions terminées', value: MOCK_MISSIONS.filter(m => m.status === 'completed').length, icon: '✅' },
              { label: 'Total dépensé', value: `${totalSpent.toLocaleString()} FCFA`, icon: '💳' },
            ].map(s => (
              <div key={s.label} className="card text-center">
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className="font-display text-2xl font-bold text-dark">{s.value}</div>
                <div className="font-mono text-xs text-muted mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Missions */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-dark">Mes missions</h2>
            </div>
            <div className="space-y-4">
              {MOCK_MISSIONS.map(m => {
                const cfg = STATUS_CONFIG[m.status]
                const Icon = cfg?.icon || Clock
                return (
                  <Link
                    key={m.id}
                    href={`/mission/${m.id}`}
                    className="flex items-center gap-4 p-4 bg-bg rounded-xl hover:bg-bg2 transition-colors group"
                  >
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl border border-border">
                      {m.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-dark">{m.category}</span>
                        <span className={`flex items-center gap-1 text-xs font-mono ${cfg?.color}`}>
                          <Icon size={10} />
                          {cfg?.label}
                        </span>
                      </div>
                      <div className="text-sm text-muted mt-0.5">{m.artisan} · {m.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-dark">{m.price.toLocaleString()} FCFA</div>
                      {m.status === 'completed' && (
                        <div className="flex items-center justify-end gap-1 text-xs text-gold mt-0.5">
                          <Star size={10} className="fill-gold" />
                          Noté
                        </div>
                      )}
                    </div>
                    <ArrowRight size={16} className="text-muted group-hover:text-accent transition-colors" />
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
