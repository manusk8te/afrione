'use client'
import { useState, useEffect } from 'react'
import { Video, CheckCircle, XCircle, AlertTriangle, RefreshCw, ExternalLink, Clock, User, Wrench } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import AdminSidebar from '@/components/admin/AdminSidebar'

const NEU_SMALL = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

type Filter = 'pending' | 'reviewed'
type Decision = 'full' | 'partial' | 'refused'

interface CasC {
  id: string
  mission_id: string
  artisan_id: string
  client_id: string
  video_url: string | null
  reason: string | null
  refund_decision: Decision | null
  refund_amount: number | null
  reviewed_by_admin: boolean
  created_at: string
  missions?: {
    category: string
    total_price: number
    status: string
    quartier: string
    mode: string
    insurance_taken: boolean
    users?: { name: string }
    artisan_pros?: { users?: { name: string }; metier: string }
  }
}

export default function CasCReviewPage() {
  const [reports, setReports]       = useState<CasC[]>([])
  const [filter, setFilter]         = useState<Filter>('pending')
  const [selected, setSelected]     = useState<CasC | null>(null)
  const [loading, setLoading]       = useState(true)
  const [acting, setActing]         = useState(false)
  const [partialAmount, setPartialAmount] = useState('')
  const [flash, setFlash]           = useState('')

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 4000) }

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cas_c_reports')
      .select(`
        *,
        missions (
          category, total_price, status, quartier, mode, insurance_taken,
          users ( name ),
          artisan_pros ( metier, users ( name ) )
        )
      `)
      .order('created_at', { ascending: false })
    setReports((data || []) as CasC[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = reports.filter(r =>
    filter === 'pending' ? !r.reviewed_by_admin : r.reviewed_by_admin
  )

  const decide = async (decision: Decision, amount?: number) => {
    if (!selected) return
    setActing(true)

    const refundAmt = decision === 'full'
      ? (selected.missions?.total_price ?? 0)
      : decision === 'partial'
      ? (amount ?? 0)
      : 0

    await supabase
      .from('cas_c_reports')
      .update({
        refund_decision: decision,
        refund_amount: refundAmt,
        reviewed_by_admin: true,
      })
      .eq('id', selected.id)

    if (decision !== 'refused' && refundAmt > 0) {
      await supabase
        .from('transactions')
        .insert({
          user_id: selected.client_id,
          mission_id: selected.mission_id,
          type: 'refund',
          amount: refundAmt,
          status: 'completed',
          description: `Remboursement Cas C — ${decision === 'full' ? 'total' : 'partiel'}`,
        })
    }

    showFlash(
      decision === 'full'    ? `✓ Remboursement total de ${refundAmt.toLocaleString()} FCFA initié` :
      decision === 'partial' ? `✓ Remboursement partiel de ${refundAmt.toLocaleString()} FCFA initié` :
      '✓ Remboursement refusé — artisan crédité'
    )
    setActing(false)
    setSelected(null)
    setPartialAmount('')
    load()
  }

  const decisionLabel: Record<Decision, { label: string; color: string }> = {
    full:    { label: 'Remboursé (total)',   color: '#2B6B3E' },
    partial: { label: 'Remboursé (partiel)', color: '#C9A84C' },
    refused: { label: 'Refusé',              color: '#ef4444' },
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: '#F5F7FA' }}>
      <AdminSidebar activeId="cas-c" adminName="Admin" />

      <main style={{ flex: 1, padding: '24px 32px', maxWidth: '1200px', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700, color: '#3D4852' }}>
              Cas Complexes (Cas C)
            </h1>
            <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
              Litiges graves — visionnez la vidéo et traitez le remboursement
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {flash && (
              <span style={{ fontSize: '12px', color: '#2B6B3E', background: 'rgba(43,107,62,0.1)', padding: '6px 14px', borderRadius: '20px' }}>
                {flash}
              </span>
            )}
            <button
              onClick={load}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', color: '#6B7280', boxShadow: NEU_SMALL }}
            >
              <RefreshCw size={14} /> Actualiser
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {(['pending', 'reviewed'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 20px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: filter === f ? 600 : 400,
                background: filter === f ? '#E85D26' : '#fff',
                color:      filter === f ? '#fff'    : '#6B7280',
                boxShadow:  filter === f ? 'none'    : NEU_SMALL,
                transition: 'all 0.15s',
              }}
            >
              {f === 'pending' ? `En attente (${reports.filter(r => !r.reviewed_by_admin).length})` : `Traités (${reports.filter(r => r.reviewed_by_admin).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
            <div style={{ width: '36px', height: '36px', border: '4px solid rgba(232,93,38,0.2)', borderTop: '4px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: '20px' }}>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#6B7280', fontSize: '14px' }}>
                  {filter === 'pending' ? '🎉 Aucun Cas C en attente' : 'Aucun Cas C traité'}
                </div>
              )}
              {filtered.map(r => {
                const isSelected = selected?.id === r.id
                const mission = r.missions
                return (
                  <button
                    key={r.id}
                    onClick={() => { setSelected(isSelected ? null : r); setPartialAmount('') }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '16px 18px',
                      background: isSelected ? 'rgba(232,93,38,0.05)' : '#fff',
                      border: `1.5px solid ${isSelected ? '#E85D26' : '#E2E8F0'}`,
                      borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
                      boxShadow: isSelected ? 'none' : NEU_SMALL, transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                      background: r.video_url ? 'rgba(232,93,38,0.1)' : 'rgba(107,114,128,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {r.video_url ? <Video size={18} color="#E85D26" /> : <AlertTriangle size={18} color="#6B7280" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#3D4852' }}>
                          {mission?.users?.name || 'Client'} — {mission?.category || '—'}
                        </span>
                        {r.refund_decision && (
                          <span style={{
                            fontSize: '10px', padding: '2px 8px', borderRadius: '20px', fontWeight: 600,
                            background: `${decisionLabel[r.refund_decision].color}18`,
                            color: decisionLabel[r.refund_decision].color,
                          }}>
                            {decisionLabel[r.refund_decision].label}
                          </span>
                        )}
                        {mission?.insurance_taken && (
                          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(201,168,76,0.15)', color: '#C9A84C', fontWeight: 600 }}>
                            Assuré
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '3px' }}>
                        Artisan : {mission?.artisan_pros?.users?.name || '—'} · {mission?.artisan_pros?.metier || '—'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px', display: 'flex', gap: '12px' }}>
                        <span>{mission?.total_price?.toLocaleString() ?? '—'} FCFA</span>
                        <span>{mission?.quartier || 'Abidjan'}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={10} />
                          {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      {r.reason && (
                        <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '6px', background: '#F9FAFB', padding: '6px 10px', borderRadius: '8px', fontStyle: 'italic' }}>
                          "{r.reason}"
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Detail panel */}
            {selected && (
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px', boxShadow: NEU_SMALL, position: 'sticky', top: '24px', alignSelf: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#3D4852' }}>Détail du rapport</h2>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
                </div>

                {/* Video player */}
                {selected.video_url ? (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      Vidéo soumise par le client
                    </div>
                    <video
                      src={selected.video_url}
                      controls
                      style={{ width: '100%', borderRadius: '10px', background: '#000', maxHeight: '280px' }}
                    />
                    <a
                      href={selected.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '8px', fontSize: '12px', color: '#E85D26', textDecoration: 'none' }}
                    >
                      <ExternalLink size={12} /> Ouvrir en plein écran
                    </a>
                  </div>
                ) : (
                  <div style={{ marginBottom: '20px', padding: '20px', background: '#F9FAFB', borderRadius: '10px', textAlign: 'center' }}>
                    <Video size={28} color="#D1D5DB" style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '13px', color: '#9CA3AF' }}>Aucune vidéo soumise</p>
                  </div>
                )}

                {/* Mission info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                  {[
                    { icon: User,   label: 'Client',   value: selected.missions?.users?.name || '—' },
                    { icon: Wrench, label: 'Artisan',  value: selected.missions?.artisan_pros?.users?.name || '—' },
                    { icon: AlertTriangle, label: 'Catégorie', value: selected.missions?.category || '—' },
                    { icon: Clock,  label: 'Montant',  value: `${(selected.missions?.total_price ?? 0).toLocaleString()} FCFA` },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} style={{ padding: '10px 12px', background: '#F9FAFB', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <Icon size={12} color="#9CA3AF" />
                        <span style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#3D4852' }}>{value}</div>
                    </div>
                  ))}
                </div>

                {selected.reason && (
                  <div style={{ marginBottom: '20px', padding: '12px 14px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#ef4444', marginBottom: '4px' }}>MOTIF DÉCLARÉ</div>
                    <p style={{ fontSize: '13px', color: '#3D4852', fontStyle: 'italic', margin: 0 }}>"{selected.reason}"</p>
                  </div>
                )}

                {/* Already reviewed */}
                {selected.reviewed_by_admin && selected.refund_decision ? (
                  <div style={{ padding: '14px', background: `${decisionLabel[selected.refund_decision].color}0F`, border: `1px solid ${decisionLabel[selected.refund_decision].color}30`, borderRadius: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: decisionLabel[selected.refund_decision].color, marginBottom: '4px' }}>
                      Décision : {decisionLabel[selected.refund_decision].label}
                    </div>
                    {selected.refund_amount ? (
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        Montant remboursé : {selected.refund_amount.toLocaleString()} FCFA
                      </div>
                    ) : null}
                  </div>
                ) : (
                  /* Action buttons */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Décision de remboursement
                    </div>

                    {/* Full refund */}
                    <button
                      onClick={() => !acting && decide('full')}
                      disabled={acting}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px',
                        background: acting ? '#F9FAFB' : 'rgba(43,107,62,0.06)',
                        border: '1.5px solid rgba(43,107,62,0.3)', borderRadius: '12px',
                        cursor: acting ? 'default' : 'pointer', opacity: acting ? 0.6 : 1,
                      }}
                    >
                      <CheckCircle size={18} color="#2B6B3E" />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#2B6B3E' }}>Remboursement total</div>
                        <div style={{ fontSize: '11px', color: '#6B7280' }}>{(selected.missions?.total_price ?? 0).toLocaleString()} FCFA au client</div>
                      </div>
                    </button>

                    {/* Partial refund */}
                    <div style={{ background: 'rgba(201,168,76,0.06)', border: '1.5px solid rgba(201,168,76,0.3)', borderRadius: '12px', padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <AlertTriangle size={18} color="#C9A84C" />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#C9A84C' }}>Remboursement partiel</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="number"
                          placeholder="Montant FCFA"
                          value={partialAmount}
                          onChange={e => setPartialAmount(e.target.value)}
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(201,168,76,0.4)',
                            background: '#fff', fontSize: '13px', color: '#3D4852', outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => !acting && partialAmount && decide('partial', parseInt(partialAmount))}
                          disabled={acting || !partialAmount}
                          style={{
                            padding: '8px 14px', background: '#C9A84C', color: '#fff', border: 'none',
                            borderRadius: '8px', cursor: !partialAmount || acting ? 'not-allowed' : 'pointer',
                            fontSize: '12px', fontWeight: 600, opacity: !partialAmount ? 0.5 : 1,
                          }}
                        >
                          Valider
                        </button>
                      </div>
                    </div>

                    {/* Refuse */}
                    <button
                      onClick={() => !acting && decide('refused')}
                      disabled={acting}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px',
                        background: acting ? '#F9FAFB' : 'rgba(239,68,68,0.04)',
                        border: '1.5px solid rgba(239,68,68,0.25)', borderRadius: '12px',
                        cursor: acting ? 'default' : 'pointer', opacity: acting ? 0.6 : 1,
                      }}
                    >
                      <XCircle size={18} color="#ef4444" />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>Refuser le remboursement</div>
                        <div style={{ fontSize: '11px', color: '#6B7280' }}>Artisan crédité, travail validé</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
