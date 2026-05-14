'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const HOURS = ['08h', '09h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h', '18h']

const MISSIONS = [
  { day: 1, hour: '10h', label: 'Mission #AF-2847', color: 'afrione-gradient text-white' },
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
    <div className="min-h-screen" style={{background:'#F5F7FA'}}>
      {/* Header bar */}
      <div style={{background:'#FFFFFF',borderBottom:'1px solid #E2E8F0',boxShadow:NEU_SMALL}}>
        <div className="page-container py-4 flex items-center gap-3 max-w-3xl">
          <Link href="/artisan-space/dashboard" style={{padding:'4px',borderRadius:'8px',display:'flex',alignItems:'center',color:'#6B7280',textDecoration:'none'}}>
            <ArrowLeft size={18} />
          </Link>
          <div className="font-display font-bold" style={{color:'#3D4852'}}>Mon Planning</div>
        </div>
      </div>

      <div className="pt-6 pb-16 px-4">
        <div className="max-w-3xl mx-auto">

          {/* Availability toggles */}
          <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'20px',marginBottom:'24px'}}>
            <h2 className="font-display font-bold" style={{color:'#3D4852',marginBottom:'16px'}}>Jours disponibles</h2>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((d, i) => {
                const key = d.toLowerCase().slice(0, 3)
                const isAvail = available[key] ?? true
                return (
                  <button
                    key={d}
                    onClick={() => toggle(key)}
                    style={{
                      display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',
                      padding:'12px 16px',borderRadius:'12px',cursor:'pointer',transition:'all 0.2s',
                      border: isAvail ? '2px solid #E85D26' : '2px solid #E2E8F0',
                      background: isAvail ? 'rgba(232,93,38,0.05)' : '#FFFFFF',
                      boxShadow: NEU_SMALL,
                      color: isAvail ? '#E85D26' : '#8B95A5',
                    }}
                  >
                    <span style={{fontSize:'12px',fontFamily:'Space Mono',fontWeight:700}}>{d}</span>
                    {isAvail ? <Check size={14} /> : <X size={14} />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Calendar week */}
          <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'20px',overflowX:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
              <h2 className="font-display font-bold" style={{color:'#3D4852'}}>Semaine en cours</h2>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <button
                  onClick={() => setWeek(w => w - 1)}
                  style={{width:'32px',height:'32px',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'8px',border:'1px solid #E2E8F0',background:'#FFFFFF',boxShadow:NEU_SMALL,cursor:'pointer',color:'#6B7280'}}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{fontFamily:'Space Mono',fontSize:'12px',color:'#8B95A5'}}>10 – 16 Mar 2025</span>
                <button
                  onClick={() => setWeek(w => w + 1)}
                  style={{width:'32px',height:'32px',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'8px',border:'1px solid #E2E8F0',background:'#FFFFFF',boxShadow:NEU_SMALL,cursor:'pointer',color:'#6B7280'}}
                >
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
                    <div style={{fontSize:'12px',fontFamily:'Space Mono',color:'#8B95A5'}}>{d}</div>
                    <div className={`text-sm font-bold mt-0.5 w-8 h-8 rounded-full flex items-center justify-center mx-auto ${
                      i === 0 ? 'afrione-gradient text-white' : ''
                    }`} style={{color: i === 0 ? undefined : '#3D4852'}}>{10 + i}</div>
                  </div>
                ))}
              </div>

              {/* Hour rows */}
              {HOURS.map(h => (
                <div key={h} className="grid grid-cols-8 gap-1 mb-1">
                  <div style={{fontSize:'12px',fontFamily:'Space Mono',color:'#8B95A5',display:'flex',alignItems:'center',paddingRight:'8px'}}>{h}</div>
                  {DAYS.map((d, i) => {
                    const mission = getMission(i, h)
                    const dayKey = d.toLowerCase().slice(0, 3)
                    const avail = available[dayKey] ?? true
                    return (
                      <div
                        key={d}
                        className={`h-8 rounded-lg text-xs flex items-center justify-center cursor-pointer transition-colors ${
                          mission ? mission.color + ' font-semibold text-center px-1 truncate' : ''
                        }`}
                        style={{
                          background: !mission && !avail ? '#F5F7FA' : !mission && avail ? undefined : undefined,
                          opacity: !mission && !avail ? 0.4 : 1,
                        }}
                        onMouseEnter={e => {
                          if (!mission && avail) (e.currentTarget as HTMLElement).style.background = 'rgba(232,93,38,0.08)'
                        }}
                        onMouseLeave={e => {
                          if (!mission && avail) (e.currentTarget as HTMLElement).style.background = ''
                        }}
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
          <div style={{display:'flex',gap:'16px',marginTop:'16px',fontSize:'12px',color:'#8B95A5'}}>
            {[
              { color: 'afrione-gradient', label: 'Mission confirmée' },
              { color: 'bg-accent2/20', label: 'Mission en cours' },
              { color: 'bg-gold/20', label: 'RDV' },
              { colorStyle: '#F5F7FA', label: 'Non disponible' },
            ].map(item => (
              <div key={item.label} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                {'colorStyle' in item
                  ? <div style={{width:'12px',height:'12px',borderRadius:'4px',background:item.colorStyle,border:'1px solid #E2E8F0'}} />
                  : <div className={`w-3 h-3 rounded ${item.color}`} />
                }
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
