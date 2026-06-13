'use client'
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Play, PlayCircle, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import AdminSidebar from '@/components/admin/AdminSidebar'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

type TestCase = {
  id:            string
  label:         string
  category:      string
  metier:        string
  quartier:      string
  urgency:       string
  hours:         number
  expected_min:  number
  expected_max:  number
  source_note:   string
  run_count:     number
  within_count:  number
  last_result:   {
    agent_price:     number
    within_range:    boolean
    deviation_pct:   number | null
    run_at:          string
    agent_breakdown: Record<string, number> | null
  } | null
}

const URGENCY_LABEL: Record<string, string> = {
  low: 'Bas', medium: 'Normal', high: 'Urgent', emergency: 'Extrême',
}

const CAT_COLORS: Record<string, string> = {
  'Plomberie':      '#3B82F6',
  'Électricité':    '#F59E0B',
  'Peinture':       '#8B5CF6',
  'Climatisation':  '#06B6D4',
  'Maçonnerie':     '#78716C',
  'Carrelage':      '#EC4899',
}

function deviation(agent: number, min: number, max: number) {
  const mid = (min + max) / 2
  return Math.round((agent - mid) / mid * 100)
}

function DeviationBadge({ pct, inRange }: { pct: number; inRange: boolean }) {
  const abs = Math.abs(pct)
  const color = inRange
    ? '#16a34a'
    : abs <= 15 ? '#d97706'
    : '#dc2626'
  const bg = inRange
    ? 'rgba(22,163,74,0.1)'
    : abs <= 15 ? 'rgba(217,119,6,0.1)'
    : 'rgba(220,38,38,0.1)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '9999px',
      color, background: bg,
    }}>
      {inRange
        ? <CheckCircle size={10} />
        : abs <= 15 ? <AlertCircle size={10} />
        : <XCircle size={10} />}
      {pct > 0 ? '+' : ''}{pct}%
    </span>
  )
}

export default function ShadowTestPage() {
  const [cases,    setCases]    = useState<TestCase[]>([])
  const [loading,  setLoading]  = useState(true)
  const [running,  setRunning]  = useState<string | 'all' | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState('Tous')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/shadow-test')
    const data = await res.json()
    setCases(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const runTest = async (id?: string) => {
    setRunning(id || 'all')
    try {
      await fetch('/api/admin/shadow-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { action: 'run_one', test_case_id: id } : { action: 'run_all' }),
      })
      await load()
    } finally {
      setRunning(null)
    }
  }

  const categories = ['Tous', ...Array.from(new Set(cases.map(c => c.category)))]
  const filtered   = filterCat === 'Tous' ? cases : cases.filter(c => c.category === filterCat)

  const tested      = cases.filter(c => c.last_result)
  const inRangeAll  = tested.filter(c => c.last_result?.within_range)
  const avgDevAll   = tested.length
    ? Math.round(tested.reduce((s, c) => {
        if (!c.last_result) return s
        return s + Math.abs(deviation(c.last_result.agent_price, c.expected_min, c.expected_max))
      }, 0) / tested.length)
    : null
  const totalRuns   = cases.reduce((s, c) => s + c.run_count, 0)

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: '#F5F7FA' }}>
      <AdminSidebar activeId="shadow-test" />

      <main className="flex-1 p-6" style={{ maxWidth: '1200px', minWidth: 0 }}>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: '#3D4852' }}>
              Shadow Test — Calibrage IA
            </h1>
            <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '2px' }}>
              15 missions Abidjan · Prix terrain enquête juin 2026 · Comparer l&apos;agent vs marché réel
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load}
              style={{ padding: '8px', background: '#FFF', borderRadius: '12px', border: '1.5px solid #E2E8F0', cursor: 'pointer', boxShadow: NEU_SMALL }}>
              <RefreshCw size={14} style={{ color: '#6B7280' }} />
            </button>
            <button
              onClick={() => runTest()}
              disabled={running === 'all'}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px',
                background: '#FFF', border: '1.5px solid #E2E8F0', borderRadius: '12px',
                fontSize: '13px', fontWeight: 600, cursor: running ? 'default' : 'pointer',
                opacity: running === 'all' ? 0.6 : 1, boxShadow: NEU_SMALL,
              }}>
              <PlayCircle size={14} className={running === 'all' ? 'animate-spin' : ''} style={{ color: '#E85D26' }} />
              <span className="afrione-gradient-text">{running === 'all' ? 'En cours…' : 'Lancer tous'}</span>
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Cas testés',
              value: `${tested.length} / ${cases.length}`,
              sub: `${totalRuns} runs total`,
              color: '#3B82F6',
            },
            {
              label: 'Dans la fourchette',
              value: tested.length ? `${Math.round(inRangeAll.length / tested.length * 100)}%` : '—',
              sub: `${inRangeAll.length} / ${tested.length} missions`,
              color: '#16a34a',
            },
            {
              label: 'Écart moyen',
              value: avgDevAll !== null ? `${avgDevAll}%` : '—',
              sub: 'valeur absolue vs milieu fourchette',
              color: avgDevAll !== null && avgDevAll <= 10 ? '#16a34a' : avgDevAll !== null && avgDevAll <= 20 ? '#d97706' : '#dc2626',
            },
            {
              label: 'Objectif 1 mois',
              value: '≥ 80%',
              sub: 'missions dans la fourchette',
              color: '#E85D26',
            },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: '#FFF', borderRadius: '16px', padding: '20px',
              border: '1px solid #E2E8F0', boxShadow: NEU_SMALL,
            }}>
              <div style={{ fontSize: '11px', fontFamily: 'Tahoma', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: kpi.color, lineHeight: 1, marginBottom: '4px' }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: '11px', color: '#8B95A5' }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {categories.map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              className={filterCat === c ? 'afrione-gradient' : ''}
              style={{
                flexShrink: 0, padding: '7px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: 500,
                cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                background: filterCat === c ? undefined : '#FFF',
                color: filterCat === c ? 'white' : '#6B7280',
                boxShadow: filterCat === c ? 'none' : NEU_SMALL,
              }}>
              {c}
            </button>
          ))}
        </div>

        {/* Test cases table */}
        <div style={{ background: '#FFF', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: NEU_SHADOW }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', background: '#F5F7FA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Tahoma', fontSize: '12px', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cas de test — {filtered.length} missions
            </span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', color: '#6B7280', fontSize: '14px', gap: '8px' }}>
              <RefreshCw size={14} className="animate-spin" /> Chargement…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#F5F7FA' }}>
                    {['Mission', 'Zone', 'Durée', 'Fourchette terrain', 'Agent IA', 'Écart', 'Runs', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', fontFamily: 'Tahoma', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tc => {
                    const isOpen = expanded === tc.id
                    const lastPrice = tc.last_result?.agent_price
                    const dev = lastPrice !== undefined ? deviation(lastPrice, tc.expected_min, tc.expected_max) : null
                    const catColor = CAT_COLORS[tc.category] || '#6B7280'

                    return (
                      <>
                        <tr key={tc.id}
                          style={{ borderBottom: isOpen ? 'none' : '1px solid #E2E8F0', cursor: 'pointer' }}
                          onClick={() => setExpanded(isOpen ? null : tc.id)}
                          onMouseEnter={e => !isOpen && ((e.currentTarget as HTMLElement).style.background = '#F5F7FA')}
                          onMouseLeave={e => !isOpen && ((e.currentTarget as HTMLElement).style.background = '#FFF')}>

                          {/* Mission label + categorie */}
                          <td style={{ padding: '12px 14px', maxWidth: '220px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                                background: catColor,
                              }} />
                              <div>
                                <div style={{ fontWeight: 600, color: '#3D4852', fontSize: '13px', lineHeight: 1.3 }}>
                                  {tc.label.split('·')[0].trim()}
                                </div>
                                <div style={{ fontSize: '11px', color: '#8B95A5', marginTop: '2px' }}>
                                  {tc.category} · {URGENCY_LABEL[tc.urgency]}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Zone */}
                          <td style={{ padding: '12px 14px', color: '#6B7280', whiteSpace: 'nowrap' }}>{tc.quartier}</td>

                          {/* Durée */}
                          <td style={{ padding: '12px 14px', color: '#6B7280', whiteSpace: 'nowrap' }}>{tc.hours}h</td>

                          {/* Fourchette terrain */}
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontFamily: 'Tahoma', fontSize: '12px', color: '#3D4852' }}>
                              {tc.expected_min.toLocaleString('fr')}
                            </span>
                            <span style={{ color: '#8B95A5', margin: '0 4px' }}>–</span>
                            <span style={{ fontFamily: 'Tahoma', fontSize: '12px', color: '#3D4852' }}>
                              {tc.expected_max.toLocaleString('fr')} FCFA
                            </span>
                          </td>

                          {/* Agent IA */}
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            {lastPrice !== undefined ? (
                              <span style={{
                                fontFamily: 'Tahoma', fontSize: '13px', fontWeight: 700,
                                color: tc.last_result?.within_range ? '#16a34a' : '#dc2626',
                              }}>
                                {lastPrice.toLocaleString('fr')} FCFA
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#8B95A5' }}>Non testé</span>
                            )}
                          </td>

                          {/* Écart */}
                          <td style={{ padding: '12px 14px' }}>
                            {dev !== null && tc.last_result ? (
                              <DeviationBadge pct={dev} inRange={tc.last_result.within_range} />
                            ) : '—'}
                          </td>

                          {/* Runs */}
                          <td style={{ padding: '12px 14px' }}>
                            {tc.run_count > 0 ? (
                              <span style={{ fontSize: '12px', color: '#6B7280' }}>
                                {tc.within_count}/{tc.run_count}
                                <span style={{ color: '#8B95A5', marginLeft: '4px', fontSize: '10px' }}>ok</span>
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#8B95A5' }}>0</span>
                            )}
                          </td>

                          {/* Run button */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => runTest(tc.id)}
                              disabled={running !== null}
                              title="Lancer ce test"
                              style={{
                                padding: '6px', background: '#F5F7FA', color: '#E85D26',
                                borderRadius: '8px', border: '1px solid #E2E8F0', cursor: running ? 'default' : 'pointer',
                                opacity: running !== null ? 0.5 : 1,
                              }}>
                              <Play size={12} className={running === tc.id ? 'animate-spin' : ''} />
                            </button>
                          </td>
                        </tr>

                        {/* Expanded details */}
                        {isOpen && (
                          <tr key={`${tc.id}-detail`} style={{ borderBottom: '1px solid #E2E8F0', background: '#FAFAFA' }}>
                            <td colSpan={8} style={{ padding: '12px 14px 16px 32px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>

                                {/* Description */}
                                <div>
                                  <div style={{ fontSize: '10px', fontFamily: 'Tahoma', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Mission</div>
                                  <p style={{ fontSize: '12px', color: '#3D4852', lineHeight: 1.5 }}>{tc.label.split('·').slice(0, 2).join('·')}</p>
                                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    <span style={{ fontSize: '10px', background: '#E2E8F0', borderRadius: '9999px', padding: '2px 8px', color: '#6B7280' }}>
                                      {tc.hours}h · {URGENCY_LABEL[tc.urgency]} · {tc.quartier}
                                    </span>
                                  </div>
                                </div>

                                {/* Source note */}
                                <div>
                                  <div style={{ fontSize: '10px', fontFamily: 'Tahoma', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Source prix terrain</div>
                                  <p style={{ fontSize: '11px', color: '#6B7280', lineHeight: 1.5, fontStyle: 'italic' }}>{tc.source_note}</p>
                                </div>

                                {/* Last breakdown */}
                                {tc.last_result?.agent_breakdown && (
                                  <div>
                                    <div style={{ fontSize: '10px', fontFamily: 'Tahoma', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Dernier calcul agent</div>
                                    {Object.entries(tc.last_result.agent_breakdown).map(([k, v]) => (
                                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '2px 0', borderBottom: '1px solid #F0F0F0' }}>
                                        <span style={{ color: '#6B7280' }}>{k.replace('_', ' ')}</span>
                                        <span style={{ fontFamily: 'Tahoma', fontWeight: 600, color: '#3D4852' }}>{Number(v).toLocaleString('fr')} F</span>
                                      </div>
                                    ))}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, paddingTop: '4px', color: '#3D4852', marginTop: '2px' }}>
                                      <span>Total agent</span>
                                      <span className="afrione-gradient-text">{tc.last_result.agent_price.toLocaleString('fr')} FCFA</span>
                                    </div>
                                  </div>
                                )}

                                {/* Stats historiques */}
                                {tc.run_count > 0 && (
                                  <div>
                                    <div style={{ fontSize: '10px', fontFamily: 'Tahoma', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Historique</div>
                                    <div style={{ fontSize: '12px', color: '#3D4852' }}>
                                      {tc.run_count} run{tc.run_count > 1 ? 's' : ''} total
                                    </div>
                                    <div style={{ marginTop: '4px' }}>
                                      <div style={{
                                        height: '8px', borderRadius: '9999px', background: '#E2E8F0', overflow: 'hidden', width: '120px',
                                      }}>
                                        <div style={{
                                          height: '100%', borderRadius: '9999px',
                                          width: `${Math.round(tc.within_count / tc.run_count * 100)}%`,
                                          background: 'linear-gradient(135deg, #E85D26, #C9A84C)',
                                        }} />
                                      </div>
                                      <span style={{ fontSize: '11px', color: '#8B95A5', marginTop: '2px', display: 'block' }}>
                                        {Math.round(tc.within_count / tc.run_count * 100)}% dans la fourchette
                                      </span>
                                    </div>
                                    {tc.last_result && (
                                      <div style={{ fontSize: '10px', color: '#8B95A5', marginTop: '4px' }}>
                                        Dernier : {new Date(tc.last_result.run_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{ marginTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '11px', color: '#8B95A5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={12} style={{ color: '#16a34a' }} />
            Dans la fourchette terrain
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={12} style={{ color: '#d97706' }} />
            Écart ≤ 15% (acceptable)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <XCircle size={12} style={{ color: '#dc2626' }} />
            Écart &gt; 15% (à recalibrer)
          </div>
          <div style={{ marginLeft: 'auto', fontStyle: 'italic' }}>
            Objectif : ≥ 80% dans la fourchette après 1 mois de données terrain
          </div>
        </div>
      </main>
    </div>
  )
}
