'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const HOURS = ['08h', '09h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h', '18h']

const MISSIONS = [
  { day: 1, hour: '10h', label: 'Mission #AF-2847', color: 'bg-accent text-white' },
  { day: 3, hour: '14h', label: 'Mission #AF-2831', color: 'bg-accent2/20 text-accent2' },
  { day: 4, hour: '09h', label: 'RDV client', color: 'bg-gold/20 text-yellow-700' },
]

export default function PlanningPage() {
  const [available, setAvailable] = useState<Record<string, boolean>>({
    'lun': true, 'mar': true, 'mer': true, 'jeu': true, 'ven': true, 'sam': false, 'dim': false,
  })
  const [week, setWeek] = useState(0)

  const toggle = (day: string) => setAvailable(a => ({ ...a, [day]: !a[day] }))

  const getMission = (dayIdx: number, hour: string) =>
    MISSIONS.find(m => m.day === dayIdx && m.hour === hour)

  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-dark text-cream">
        <div className="page-container py-4 flex items-center gap-3 max-w-3xl">
          <Link href="/artisan-space/dashboard" className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="font-display font-bold">Mon Planning</div>
        </div>
      </div>

      <div className="pt-6 pb-16 px-4">
        <div className="max-w-3xl mx-auto">

          {/* Availability toggles */}
          <div className="card mb-6">
            <h2 className="font-display font-bold text-dark mb-4">Jours disponibles</h2>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((d, i) => {
                const key = d.toLowerCase().slice(0, 3)
                const isAvail = available[key] ?? true
                return (
                  <button
                    key={d}
                    onClick={() => toggle(key)}
                    className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 transition-all ${
                      isAvail ? 'border-accent2 bg-accent2/5 text-accent2' : 'border-border text-muted hover:border-dark/30'
                    }`}
                  >
                    <span className="text-xs font-mono font-bold">{d}</span>
                    {isAvail ? <Check size={14} /> : <X size={14} />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Calendar week */}
          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-dark">Semaine en cours</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setWeek(w => w - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg2 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <span className="font-mono text-xs text-muted">10 – 16 Mar 2025</span>
                <button onClick={() => setWeek(w => w + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg2 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="min-w-[600px]">
              {/* Header days */}
              <div className="grid grid-cols-8 gap-1 mb-2">
                <div className="text-xs text-muted font-mono" />
                {DAYS.map((d, i) => (
                  <div key={d} className="text-center">
                    <div className="text-xs font-mono text-muted">{d}</div>
                    <div className={`text-sm font-bold mt-0.5 w-8 h-8 rounded-full flex items-center justify-center mx-auto ${
                      i === 0 ? 'bg-accent text-white' : 'text-dark'
                    }`}>{10 + i}</div>
                  </div>
                ))}
              </div>

              {/* Hour rows */}
              {HOURS.map(h => (
                <div key={h} className="grid grid-cols-8 gap-1 mb-1">
                  <div className="text-xs font-mono text-muted flex items-center pr-2">{h}</div>
                  {DAYS.map((d, i) => {
                    const mission = getMission(i, h)
                    const dayKey = d.toLowerCase().slice(0, 3)
                    const avail = available[dayKey] ?? true
                    return (
                      <div
                        key={d}
                        className={`h-8 rounded-lg text-xs flex items-center justify-center cursor-pointer transition-colors ${
                          mission ? mission.color + ' font-semibold text-center px-1 truncate' :
                          avail ? 'hover:bg-accent2/10 hover:border hover:border-accent2/30' :
                          'bg-bg2 opacity-40'
                        }`}
                      >
                        {mission ? <span className="truncate px-1 text-xs">{mission.label.split(' ')[1]}</span> : null}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 text-xs text-muted">
            {[
              { color: 'bg-accent', label: 'Mission confirmée' },
              { color: 'bg-accent2/20', label: 'Mission en cours' },
              { color: 'bg-gold/20', label: 'RDV' },
              { color: 'bg-bg2', label: 'Non disponible' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${item.color}`} />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
