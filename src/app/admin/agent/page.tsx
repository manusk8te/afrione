'use client'
import { useState, useEffect } from 'react'
import { RefreshCw, ChevronDown, ChevronRight, CheckCircle, XCircle, ExternalLink, Clock } from 'lucide-react'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { supabase } from '@/lib/supabase'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

type AgentRun = {
  id: string
  agent_name: string
  model: string | null
  input: any
  steps: { type: string; name?: string; arguments?: any; output?: any }[]
  output: any
  total_price: number | null
  parse_ok: boolean
  error: string | null
  duration_ms: number | null
  created_at: string
}

const TOOL_ICONS: Record<string, string> = {
  get_pricing_data:      '📊',
  search_material_price: '🔍',
  get_artisan_rate:      '👷',
  calculate_final_price: '🧮',
}

function JsonBlock({ data }: { data: any }) {
  return (
    <pre style={{
      margin: 0, padding: '10px 12px', background: '#1e293b', color: '#e2e8f0',
      borderRadius: '10px', fontSize: '11px', lineHeight: 1.6, overflowX: 'auto',
      fontFamily: '"JetBrains Mono", monospace', maxHeight: '260px', overflowY: 'auto',
    }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export default function AdminAgentPage() {
  const [runs, setRuns]         = useState<AgentRun[]>([])
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/agent-runs?limit=50', {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` },
      })
      const data = await res.json()
      if (!res.ok) setLoadError(data.error || 'Erreur de chargement')
      else setRuns(data.runs || [])
    } catch {
      setLoadError('Erreur réseau')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const okRuns   = runs.filter(r => !r.error && r.parse_ok)
  const avgMs    = runs.length ? Math.round(runs.reduce((s, r) => s + (r.duration_ms || 0), 0) / runs.length) : 0
  const avgTools = runs.length ? (runs.reduce((s, r) => s + (r.steps || []).filter(x => x.type === 'tool_call').length, 0) / runs.length).toFixed(1) : '0'

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: '#F5F7FA' }}>
      <AdminSidebar activeId="agent" />

      <main className="flex-1 p-6" style={{ maxWidth: '1100px', minWidth: 0 }}>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: '#3D4852' }}>
              Agent IA — Journal des exécutions
            </h1>
            <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '2px' }}>
              Chaque run du pricing agent : prompt, appels d'outils, résultat, durée · conservé dans Supabase (table agent_runs)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a href="https://platform.openai.com/traces" target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#FFF', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '12px', fontWeight: 600, color: '#3D4852', textDecoration: 'none', boxShadow: NEU_SMALL }}>
              <ExternalLink size={13} /> Traces OpenAI
            </a>
            <button onClick={load}
              style={{ padding: '8px', background: '#FFF', borderRadius: '12px', border: '1.5px solid #E2E8F0', cursor: 'pointer', boxShadow: NEU_SMALL }}>
              <RefreshCw size={14} style={{ color: '#6B7280' }} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          {[
            { label: 'Runs (50 derniers)', value: String(runs.length) },
            { label: 'Succès', value: runs.length ? `${Math.round(okRuns.length / runs.length * 100)}%` : '—' },
            { label: 'Durée moyenne', value: avgMs ? `${(avgMs / 1000).toFixed(1)}s` : '—' },
            { label: 'Outils / run', value: avgTools },
          ].map(s => (
            <div key={s.label} style={{ background: '#FFF', borderRadius: '14px', padding: '14px', textAlign: 'center', boxShadow: NEU_SMALL }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#3D4852', fontFamily: 'Tahoma' }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: '#8B95A5', marginTop: '2px', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Erreur de chargement / table absente */}
        {loadError && (
          <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
            {loadError}
          </div>
        )}

        {/* Liste des runs */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#8B95A5', fontSize: '13px', padding: '20px 0' }}>
            <div style={{ width: '16px', height: '16px', border: '2px solid rgba(232,93,38,0.3)', borderTop: '2px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            Chargement des runs…
          </div>
        ) : runs.length === 0 && !loadError ? (
          <div style={{ background: '#FFF', borderRadius: '16px', padding: '32px', textAlign: 'center', boxShadow: NEU_SMALL, color: '#8B95A5', fontSize: '14px' }}>
            Aucun run enregistré pour l'instant — lancez un diagnostic ou ouvrez un devis dans la warroom pour déclencher l'agent.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {runs.map(run => {
              const isOpen = expanded === run.id
              const toolCalls = (run.steps || []).filter(s => s.type === 'tool_call')
              const failed = !!run.error || !run.parse_ok
              return (
                <div key={run.id} style={{ background: '#FFF', borderRadius: '16px', boxShadow: NEU_SMALL, overflow: 'hidden', border: failed ? '1.5px solid rgba(220,38,38,0.3)' : '1.5px solid transparent' }}>

                  {/* Ligne résumé */}
                  <button onClick={() => setExpanded(isOpen ? null : run.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    {isOpen ? <ChevronDown size={15} color="#8B95A5" /> : <ChevronRight size={15} color="#8B95A5" />}
                    {failed
                      ? <XCircle size={15} color="#dc2626" />
                      : <CheckCircle size={15} color="#16a34a" />}
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#3D4852', flexShrink: 0 }}>
                      {run.input?.category || run.agent_name}
                    </span>
                    <span style={{ fontSize: '12px', color: '#8B95A5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {run.input?.quartier} · {run.input?.urgency} · {run.input?.hours}h
                    </span>
                    {run.total_price != null && (
                      <span style={{ fontFamily: 'Tahoma', fontSize: '13px', fontWeight: 700, color: '#E85D26', flexShrink: 0 }}>
                        {Number(run.total_price).toLocaleString('fr')} F
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: '#8B95A5', display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                      <Clock size={11} /> {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </span>
                    <span style={{ fontSize: '10px', color: '#A0AEC0', fontFamily: 'Tahoma', flexShrink: 0 }}>
                      {new Date(run.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>

                  {/* Détail */}
                  {isOpen && (
                    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                      {run.error && (
                        <div style={{ fontSize: '12px', color: '#dc2626', background: 'rgba(220,38,38,0.06)', padding: '8px 12px', borderRadius: '10px' }}>
                          ❌ {run.error}
                        </div>
                      )}

                      {/* Prompt */}
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B95A5', letterSpacing: '0.08em', marginBottom: '6px' }}>PROMPT ENVOYÉ</div>
                        <pre style={{ margin: 0, padding: '10px 12px', background: '#F5F7FA', borderRadius: '10px', fontSize: '11px', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#3D4852', maxHeight: '180px', overflowY: 'auto' }}>
                          {run.input?.prompt || JSON.stringify(run.input)}
                        </pre>
                      </div>

                      {/* Étapes / outils */}
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B95A5', letterSpacing: '0.08em', marginBottom: '6px' }}>
                          APPELS D'OUTILS ({toolCalls.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(run.steps || []).filter(s => s.type === 'tool_call' || s.type === 'tool_result').map((s, i) => (
                            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <span style={{ fontSize: '13px', flexShrink: 0, marginTop: '4px' }}>
                                {s.type === 'tool_call' ? (TOOL_ICONS[s.name || ''] || '🛠') : '↩️'}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: s.type === 'tool_call' ? '#3D4852' : '#6B7280', marginBottom: '3px' }}>
                                  {s.type === 'tool_call' ? `${s.name}(…)` : `résultat ${s.name || ''}`}
                                </div>
                                <JsonBlock data={s.type === 'tool_call' ? s.arguments : s.output} />
                              </div>
                            </div>
                          ))}
                          {toolCalls.length === 0 && (
                            <div style={{ fontSize: '12px', color: '#d97706', background: 'rgba(217,119,6,0.06)', padding: '8px 12px', borderRadius: '10px' }}>
                              ⚠️ Aucun appel d'outil — l'agent a répondu sans consulter les données terrain (prix potentiellement inventé).
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Output final */}
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B95A5', letterSpacing: '0.08em', marginBottom: '6px' }}>
                          RÉPONSE FINALE {run.parse_ok ? '(JSON valide)' : '(⚠️ parse échoué — brut)'}
                        </div>
                        <JsonBlock data={run.output} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
