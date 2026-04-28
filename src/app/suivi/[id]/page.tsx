'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Phone, MessageCircle, AlertTriangle, CheckCircle, Clock, Navigation, Zap } from 'lucide-react'

export default function SuiviPage() {
  const params = useParams()
  const [eta, setEta] = useState(18)
  const [status, setStatus] = useState<'en_route' | 'arrive' | 'en_cours'>('en_route')
  const [progress, setProgress] = useState(35)

  useEffect(() => {
    if (status !== 'en_route') return
    const interval = setInterval(() => {
      setEta(e => {
        if (e <= 1) {
          clearInterval(interval)
          setStatus('arrive')
          setProgress(100)
          return 0
        }
        setProgress(p => Math.min(p + 2, 95))
        return e - 1
      })
    }, 4000)
    return () => clearInterval(interval)
  }, [status])

  const statusConfig = {
    en_route: { label: 'En route vers vous', color: 'text-accent', bg: 'bg-accent/10', dot: 'bg-accent' },
    arrive: { label: 'Artisan arrivé !', color: 'text-accent2', bg: 'bg-accent2/10', dot: 'bg-accent2' },
    en_cours: { label: 'Mission en cours', color: 'text-accent2', bg: 'bg-accent2/10', dot: 'bg-accent2' },
  }
  const sc = statusConfig[status]

  return (
    <div className="min-h-screen bg-dark text-cream flex flex-col">

      {/* Header */}
      <div className="px-4 pt-safe pt-6 pb-4 flex items-center justify-between flex-shrink-0">
        <div>
          <span className="font-mono text-xs text-muted uppercase tracking-wider">SUIVI EN DIRECT</span>
          <h1 className="font-display text-2xl font-bold text-cream mt-0.5">Mission #AF-2847</h1>
        </div>
        <Link href="/dashboard" className="text-sm text-muted hover:text-cream transition-colors">
          Dashboard
        </Link>
      </div>

      {/* Map placeholder */}
      <div className="mx-4 rounded-2xl overflow-hidden flex-shrink-0 relative bg-dark2 border border-border/30" style={{ height: 260 }}>
        {/* Fake map grid */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '30px 30px'
          }}
        />
        {/* Roads */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 260">
          <path d="M 0 130 L 400 130" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
          <path d="M 200 0 L 200 260" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
          <path d="M 0 70 L 150 130 L 400 90" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
          {/* Route en pointillé */}
          <path d="M 80 80 L 180 120 L 220 130" stroke="#E85D26" strokeWidth="3" strokeDasharray="8 4" fill="none" />
          {/* Artisan position */}
          <circle cx="80" cy="80" r="10" fill="#E85D26" opacity="0.9" />
          <circle cx="80" cy="80" r="18" fill="#E85D26" opacity="0.2" />
          <text x="80" y="85" textAnchor="middle" fontSize="12">🔧</text>
          {/* Client position */}
          <circle cx="220" cy="130" r="10" fill="#2B6B3E" opacity="0.9" />
          <circle cx="220" cy="130" r="18" fill="#2B6B3E" opacity="0.2" />
          <text x="220" y="135" textAnchor="middle" fontSize="12">📍</text>
        </svg>

        {/* Map labels */}
        <div className="absolute top-3 left-3 bg-dark/80 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2">
          <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <span>Artisan · {eta > 0 ? `${eta} min` : 'Arrivé'}</span>
        </div>
        <div className="absolute bottom-3 right-3 bg-dark/80 px-2 py-1 rounded-lg text-xs text-muted">
          Abidjan, Cocody
        </div>
      </div>

      {/* Status card */}
      <div className="mx-4 mt-4 flex-shrink-0">
        <div className={`${sc.bg} border border-current/20 rounded-2xl p-4 flex items-center gap-4`}>
          <div className={`w-3 h-3 ${sc.dot} rounded-full animate-pulse-soft flex-shrink-0`} />
          <div className="flex-1">
            <div className={`font-display font-bold ${sc.color}`}>{sc.label}</div>
            {status === 'en_route' && (
              <div className="text-sm text-muted mt-0.5">Arrivée estimée dans <span className="font-semibold text-cream">{eta} minutes</span></div>
            )}
            {status === 'arrive' && (
              <div className="text-sm text-muted mt-0.5">L'artisan est à votre porte</div>
            )}
          </div>
          {status === 'arrive' && (
            <button
              onClick={() => setStatus('en_cours')}
              className="bg-accent2 text-white text-xs font-semibold px-3 py-2 rounded-xl"
            >
              Confirmer
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {status === 'en_route' && (
        <div className="mx-4 mt-4 flex-shrink-0">
          <div className="h-1.5 bg-dark2 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Artisan card */}
      <div className="mx-4 mt-4 bg-dark2 border border-border/30 rounded-2xl p-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-dark rounded-xl flex items-center justify-center text-2xl">🔧</div>
          <div className="flex-1">
            <div className="font-display font-bold text-cream">Kouadio Brou Emmanuel</div>
            <div className="text-sm text-muted">Plombier · ⭐ 4.9 · 184 missions</div>
          </div>
          <div className="flex gap-2">
            <button className="w-10 h-10 bg-accent2/20 rounded-xl flex items-center justify-center hover:bg-accent2/30 transition-colors">
              <Phone size={16} className="text-accent2" />
            </button>
            <Link href={`/warroom/${params.id}`} className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center hover:bg-accent/30 transition-colors">
              <MessageCircle size={16} className="text-accent" />
            </Link>
          </div>
        </div>
      </div>

      {/* Mission details */}
      <div className="mx-4 mt-4 bg-dark2 border border-border/30 rounded-2xl p-4 flex-shrink-0">
        <div className="font-mono text-xs text-muted uppercase tracking-wider mb-3">Détails mission</div>
        <div className="space-y-2">
          {[
            { icon: Clock, label: 'Durée estimée', value: '1h30 – 2h' },
            { icon: Zap, label: 'Service', value: 'Réparation fuite sous évier' },
            { icon: CheckCircle, label: 'Montant', value: '21 450 FCFA (en séquestre)' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 text-sm">
              <item.icon size={14} className="text-muted flex-shrink-0" />
              <span className="text-muted">{item.label}</span>
              <span className="text-cream ml-auto">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panic button */}
      <div className="mx-4 mt-4 mb-8 flex-shrink-0">
        <button className="w-full flex items-center justify-center gap-2 border border-red-500/30 text-red-400 text-sm font-medium py-3 rounded-xl hover:bg-red-500/10 transition-colors">
          <AlertTriangle size={16} /> Signaler un problème
        </button>
      </div>

      {/* CTA si mission en cours */}
      {status === 'en_cours' && (
        <div className="mx-4 mb-8 flex-shrink-0">
          <Link
            href={`/cloture/${params.id}`}
            className="btn-primary w-full flex items-center justify-center gap-2 py-4"
          >
            <CheckCircle size={16} /> Valider la fin de mission
          </Link>
        </div>
      )}
    </div>
  )
}
