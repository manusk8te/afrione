'use client'
export const dynamic = 'force-dynamic'

import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Zap, Users, Briefcase, CheckCircle, Clock, TrendingUp,
  Plus, Edit3, X, ExternalLink, Building2, Phone, Mail,
  MapPin, Star, Shield, AlertCircle, ChevronDown, ChevronUp, Camera,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

const TABS = [
  { id: 'overview',  label: "Vue d'ensemble", icon: TrendingUp },
  { id: 'team',      label: 'Équipe',          icon: Users },
  { id: 'missions',  label: 'Missions',         icon: Briefcase },
  { id: 'profil',    label: 'Profil entreprise', icon: Building2 },
]

const KYC_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: 'Approuvé',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  pending:  { label: 'En attente', color: '#C9A84C', bg: 'rgba(201,168,76,0.1)' },
  rejected: { label: 'Rejeté',    color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
}

const SECTEURS_OPTS = [
  'Plomberie', 'Électricité', 'Maçonnerie', 'Peinture', 'Menuiserie',
  'Climatisation', 'Sécurité', 'Nettoyage', 'Jardinage', 'Informatique',
  'Carrelage', 'Toiture', 'Soudure', 'Vitrage', 'Déménagement',
]

const QUARTIERS_ABJ = [
  'Cocody', 'Plateau', 'Marcory', 'Treichville', 'Adjamé', 'Abobo',
  'Yopougon', 'Koumassi', 'Port-Bouët', 'Attécoubé', 'Bingerville', 'Anyama',
]

export default function EntrepriseDashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B95A5', fontSize: '14px' }}>Chargement…</div>}>
      <EntrepriseDashboard />
    </Suspense>
  )
}

function EntrepriseDashboard() {
  const router     = useRouter()
  const params     = useSearchParams()
  const entrepriseId = params.get('id')

  const [tab, setTab]           = useState('overview')
  const [loading, setLoading]   = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [entreprise, setEntreprise]       = useState<any>(null)
  const [team, setTeam]                   = useState<any[]>([])
  const [missions, setMissions]           = useState<any[]>([])
  const [expandedArtisan, setExpandedArtisan] = useState<string | null>(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const [joinRequests, setJoinRequests] = useState<any[]>([])

  // Profil édition
  const [editing, setEditing]     = useState(false)
  const [eName, setEName]         = useState('')
  const [eDesc, setEDesc]         = useState('')
  const [ePhone, setEPhone]       = useState('')
  const [eEmail, setEEmail]       = useState('')
  const [eWebsite, setEWebsite]   = useState('')
  const [eSecteurs, setESecteurs] = useState<string[]>([])
  const [eQuartiers, setEQuartiers] = useState<string[]>([])
  const [saving, setSaving]       = useState(false)

  // ── Chargement ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth'); return }
    setCurrentUserId(session.user.id)

    // Résoudre l'id entreprise : soit via ?id= (depuis admin), soit via ownership
    let eId = entrepriseId
    if (!eId) {
      const { data: owned } = await supabase
        .from('entreprises')
        .select('id')
        .eq('owner_id', session.user.id)
        .single()
      if (!owned) { router.push('/auth'); return }
      eId = owned.id
    }

    // Entreprise + owner
    const { data: ent } = await supabase
      .from('entreprises')
      .select('*, users!entreprises_owner_id_fkey(name, email, avatar_url)')
      .eq('id', eId)
      .single()

    if (!ent) { router.push('/auth'); return }

    // Autorisation : soit admin soit owner
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    const isAdmin  = userRow?.role === 'admin'
    const isOwner  = ent.owner_id === session.user.id

    if (!isAdmin && !isOwner) { router.push('/'); return }

    setEntreprise(ent)
    setEName(ent.name || '')
    setEDesc(ent.description || '')
    setEPhone(ent.phone || '')
    setEEmail(ent.email || '')
    setEWebsite(ent.website || '')
    setESecteurs(ent.secteurs || [])
    setEQuartiers(ent.quartiers || [])

    // Artisans membres
    const { data: artisans } = await supabase
      .from('artisan_pros')
      .select('id, metier, kyc_status, is_available, created_at, users!artisan_pros_user_id_fkey(name, email, avatar_url, phone)')
      .eq('entreprise_id', eId)
      .order('created_at', { ascending: false })

    setTeam(artisans || [])

    // Demandes en attente
    const { data: requests } = await supabase
      .from('entreprise_requests')
      .select('id, created_at, artisan_pros(id, metier, users!artisan_pros_user_id_fkey(name, email, avatar_url, phone))')
      .eq('entreprise_id', eId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    setJoinRequests(requests || [])

    // Missions liées aux artisans de cette entreprise
    if (artisans && artisans.length > 0) {
      const artisanIds = artisans.map((a: any) => a.id)
      const { data: mData } = await supabase
        .from('missions')
        .select('id, category, quartier, status, total_price, created_at, users!missions_client_id_fkey(name), artisan_pros(id, metier, users!artisan_pros_user_id_fkey(name))')
        .in('artisan_id', artisanIds)
        .order('created_at', { ascending: false })
        .limit(50)
      setMissions(mData || [])
    } else {
      setMissions([])
    }

    setLoading(false)
  }, [entrepriseId, router])

  useEffect(() => { load() }, [load])

  // ── Upload bannière ────────────────────────────────────────────────────
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !entreprise) return
    setUploadingBanner(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `banners/${entreprise.id}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('entreprises')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('entreprises').getPublicUrl(path)
      await supabase.from('entreprises').update({ banner_url: publicUrl }).eq('id', entreprise.id)
      setEntreprise((prev: any) => ({ ...prev, banner_url: publicUrl }))
      toast.success('Bannière mise à jour ✓')
    } catch (err: any) {
      toast.error('Erreur upload bannière')
    }
    setUploadingBanner(false)
  }

  // ── Demandes d'adhésion ────────────────────────────────────────────────
  const approveRequest = async (req: any) => {
    const artisanId = req.artisan_pros?.id
    if (!artisanId || !entreprise) return
    await supabase.from('entreprise_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', req.id)
    await supabase.from('artisan_pros').update({ entreprise_id: entreprise.id }).eq('id', artisanId)
    toast.success(`${req.artisan_pros?.users?.name || 'Artisan'} ajouté à l'équipe ✓`)
    load()
  }

  const rejectRequest = async (req: any) => {
    await supabase.from('entreprise_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', req.id)
    toast(`Demande refusée`)
    setJoinRequests(prev => prev.filter(r => r.id !== req.id))
  }

  // ── Sauvegarder profil ─────────────────────────────────────────────────
  const saveProfil = async () => {
    if (!entreprise) return
    setSaving(true)
    const { error } = await supabase
      .from('entreprises')
      .update({
        name: eName.trim(),
        description: eDesc.trim(),
        phone: ePhone.trim(),
        email: eEmail.trim(),
        website: eWebsite.trim(),
        secteurs: eSecteurs,
        quartiers: eQuartiers,
      })
      .eq('id', entreprise.id)
    if (error) toast.error('Erreur lors de la sauvegarde')
    else { toast.success('Profil mis à jour'); setEditing(false); load() }
    setSaving(false)
  }

  // ── KPI stats ──────────────────────────────────────────────────────────
  const stats = {
    total:     team.length,
    approved:  team.filter(a => a.kyc_status === 'approved').length,
    active:    team.filter(a => a.is_available).length,
    missions:  missions.length,
    enCours:   missions.filter(m => m.status === 'en_cours').length,
    completed: missions.filter(m => m.status === 'completed').length,
    revenue:   missions.filter(m => m.status === 'completed').reduce((s: number, m: any) => s + (m.total_price || 0), 0),
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#8B95A5', fontSize: '14px' }}>Chargement…</div>
    </div>
  )

  if (!entreprise) return null

  const kyb = KYC_BADGE[entreprise.kyc_status] ?? KYC_BADGE.pending

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', color: '#3D4852', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── BANNIÈRE ───────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: '100%', height: '200px', background: entreprise.banner_url ? '#E2E8F0' : 'linear-gradient(135deg, #E2E8F0 0%, #F5F7FA 60%, #EEF2F7 100%)', overflow: 'hidden', cursor: 'pointer' }}
        onClick={() => bannerInputRef.current?.click()}>
        {entreprise.banner_url
          ? <img src={entreprise.banner_url} alt="Bannière" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
          : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Building2 size={40} color="rgba(139,149,165,0.4)" />
              <span style={{ fontSize: '12px', color: '#8B95A5' }}>Cliquez pour ajouter une bannière</span>
            </div>
          )}
        {/* Overlay bouton upload */}
        <div style={{ position: 'absolute', bottom: '12px', right: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', background: 'rgba(255,255,255,0.85)', borderRadius: '8px', backdropFilter: 'blur(8px)', border: '1px solid #E2E8F0', boxShadow: NEU_SMALL }}>
            {uploadingBanner
              ? <div style={{ width: '14px', height: '14px', border: '2px solid rgba(232,93,38,0.3)', borderTop: '2px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              : <Camera size={14} color="#3D4852" />}
            <span style={{ fontSize: '12px', color: '#3D4852', fontWeight: 500 }}>{uploadingBanner ? 'Upload…' : 'Modifier la bannière'}</span>
          </div>
        </div>
        <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerUpload} />
      </div>

      {/* ── TOP BAR ────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 20px', background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 2px 8px rgba(163,177,198,0.2)',
      }}>
        <Link href="/" className="afrione-gradient" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0 }}>
          <Zap size={14} color="white" />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#3D4852', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entreprise.name}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: kyb.bg, color: kyb.color, flexShrink: 0 }}>
              {kyb.label}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#8B95A5' }}>Espace entreprise</div>
        </div>
        <Link href="/artisan-space/dashboard" style={{ fontSize: '12px', color: '#6B7280', textDecoration: 'none', border: '1px solid #E2E8F0', padding: '6px 12px', borderRadius: '8px', background: '#FFFFFF', boxShadow: NEU_SMALL }}>
          Mon compte
        </Link>
      </header>

      {/* ── TAB BAR ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', padding: '12px 16px 0', borderBottom: '1px solid #E2E8F0', overflowX: 'auto', background: '#FFFFFF' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? '#E85D26' : '#8B95A5',
            background: tab === t.id ? 'rgba(232,93,38,0.06)' : 'transparent',
            borderBottom: tab === t.id ? '2px solid #E85D26' : '2px solid transparent',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>

        {/* ── VUE D'ENSEMBLE ─────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Statut KYC */}
            {entreprise.kyc_status !== 'approved' && (
              <div style={{
                background: entreprise.kyc_status === 'rejected' ? 'rgba(239,68,68,0.06)' : 'rgba(201,168,76,0.06)',
                border: `1px solid ${entreprise.kyc_status === 'rejected' ? 'rgba(239,68,68,0.25)' : 'rgba(201,168,76,0.25)'}`,
                borderRadius: '12px', padding: '16px 20px',
                display: 'flex', alignItems: 'flex-start', gap: '12px',
              }}>
                <AlertCircle size={18} color={entreprise.kyc_status === 'rejected' ? '#ef4444' : '#C9A84C'} style={{ flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: entreprise.kyc_status === 'rejected' ? '#ef4444' : '#C9A84C', marginBottom: '4px' }}>
                    {entreprise.kyc_status === 'rejected' ? 'Validation rejetée' : 'En attente de validation'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.5 }}>
                    {entreprise.kyc_status === 'rejected'
                      ? "Votre dossier a été rejeté. Contactez-nous pour plus d'informations."
                      : "Votre espace entreprise est en cours d'examen par l'équipe AfriOne. Vous serez notifié par email."}
                  </div>
                </div>
              </div>
            )}

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Artisans', value: stats.total, sub: `${stats.approved} approuvés`, icon: Users, color: '#E85D26' },
                { label: 'Disponibles', value: stats.active, sub: 'en ce moment', icon: CheckCircle, color: '#22c55e' },
                { label: 'Missions', value: stats.missions, sub: `${stats.enCours} en cours`, icon: Briefcase, color: '#60a5fa' },
                { label: 'Terminées', value: stats.completed, sub: 'au total', icon: Star, color: '#a78bfa' },
                { label: 'Chiffre d\'affaires', value: `${(stats.revenue / 1000).toFixed(0)}k`, sub: 'FCFA (complétées)', icon: TrendingUp, color: '#C9A84C' },
              ].map(k => (
                <div key={k.label} style={{ background: '#FFFFFF', boxShadow: NEU_SHADOW, borderRadius: '16px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#8B95A5' }}>{k.label}</span>
                    <k.icon size={14} color={k.color} />
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#3D4852' }}>{k.value}</div>
                  <div style={{ fontSize: '11px', color: '#8B95A5', marginTop: '2px' }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Missions récentes */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#3D4852', marginBottom: '12px' }}>Missions récentes</div>
              {missions.slice(0, 5).length === 0 ? (
                <div style={{ textAlign: 'center', color: '#8B95A5', fontSize: '13px', padding: '32px' }}>Aucune mission pour l'instant</div>
              ) : missions.slice(0, 5).map(m => (
                <MissionRow key={m.id} m={m} />
              ))}
              {missions.length > 5 && (
                <button onClick={() => setTab('missions')} style={{ width: '100%', marginTop: '8px', padding: '10px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#6B7280', fontSize: '12px', cursor: 'pointer', boxShadow: NEU_SMALL }}>
                  Voir toutes les missions ({missions.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── ÉQUIPE ─────────────────────────────────────────────────── */}
        {tab === 'team' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#3D4852' }}>Équipe</div>
                <div style={{ fontSize: '12px', color: '#8B95A5', marginTop: '2px' }}>{team.length} artisan{team.length !== 1 ? 's' : ''} dans cet espace</div>
              </div>
              <InviteInfo />
            </div>

            {/* Demandes en attente */}
            {joinRequests.length > 0 && (
              <div style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#C9A84C', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ⏳ {joinRequests.length} demande{joinRequests.length > 1 ? 's' : ''} en attente
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {joinRequests.map(req => {
                    const a = req.artisan_pros
                    const aName = a?.users?.name || a?.metier || 'Artisan'
                    return (
                      <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#FFFFFF', borderRadius: '10px', boxShadow: NEU_SMALL }}>
                        <div className="afrione-gradient" style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', color: 'white', flexShrink: 0 }}>
                          {a?.users?.avatar_url
                            ? <img src={a.users.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            : aName[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#3D4852' }}>{aName}</div>
                          <div style={{ fontSize: '11px', color: '#8B95A5' }}>{a?.metier} · {a?.users?.phone || a?.users?.email || ''}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                          <button onClick={() => rejectRequest(req)} style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                            Refuser
                          </button>
                          <button onClick={() => approveRequest(req)} style={{ padding: '6px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px', color: '#16a34a', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                            Accepter
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {team.length === 0 ? (
              <EmptyTeam />
            ) : team.map(a => {
              const expanded = expandedArtisan === a.id
              const badge = KYC_BADGE[a.kyc_status] ?? KYC_BADGE.pending
              const aName = a.users?.name || a.metier || 'Artisan'
              const artMissions = missions.filter(m => m.artisan_pros?.id === a.id)

              return (
                <div key={a.id} style={{ background: '#FFFFFF', boxShadow: NEU_SHADOW, borderRadius: '16px', overflow: 'hidden' }}>
                  <button onClick={() => setExpandedArtisan(expanded ? null : a.id)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div className="afrione-gradient" style={{ width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px', color: 'white', flexShrink: 0 }}>
                      {a.users?.avatar_url
                        ? <img src={a.users.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        : aName[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#3D4852' }}>{aName}</span>
                        <span style={{ fontSize: '11px', color: '#8B95A5' }}>{a.metier}</span>
                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 7px', borderRadius: '8px', background: badge.bg, color: badge.color }}>{badge.label}</span>
                        {a.is_available && (
                          <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 7px', borderRadius: '8px', background: 'rgba(34,197,94,0.1)', color: '#16a34a' }}>Disponible</span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#8B95A5', marginTop: '2px' }}>
                        {artMissions.length} mission{artMissions.length !== 1 ? 's' : ''} · membre depuis {new Date(a.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    {expanded ? <ChevronUp size={16} color="#8B95A5" /> : <ChevronDown size={16} color="#8B95A5" />}
                  </button>

                  {expanded && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '12px 0' }}>
                        {a.users?.phone && (
                          <a href={`tel:${a.users.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7280', textDecoration: 'none' }}>
                            <Phone size={13} /> {a.users.phone}
                          </a>
                        )}
                        {a.users?.email && (
                          <a href={`mailto:${a.users.email}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7280', textDecoration: 'none' }}>
                            <Mail size={13} /> {a.users.email}
                          </a>
                        )}
                      </div>
                      {artMissions.length > 0 && (
                        <>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#8B95A5', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Missions</div>
                          {artMissions.slice(0, 3).map(m => <MissionRow key={m.id} m={m} compact />)}
                        </>
                      )}
                      <Link href={`/artisan-space/dashboard`} className="afrione-gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '12px', textDecoration: 'none' }}>
                        <ExternalLink size={12} /> Voir le profil complet
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── MISSIONS ───────────────────────────────────────────────── */}
        {tab === 'missions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#3D4852', marginBottom: '8px' }}>
              Missions ({missions.length})
            </div>
            {missions.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#8B95A5', fontSize: '13px', padding: '48px' }}>Aucune mission pour l'instant</div>
            ) : missions.map(m => <MissionRow key={m.id} m={m} />)}
          </div>
        )}

        {/* ── PROFIL ENTREPRISE ──────────────────────────────────────── */}
        {tab === 'profil' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#3D4852' }}>Profil entreprise</div>
              {!editing ? (
                <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#FFFFFF', border: '1px solid rgba(232,93,38,0.25)', borderRadius: '8px', color: '#E85D26', fontSize: '12px', cursor: 'pointer', boxShadow: NEU_SMALL }}>
                  <Edit3 size={13} /> Modifier
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setEditing(false)} style={{ padding: '8px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#6B7280', fontSize: '12px', cursor: 'pointer', boxShadow: NEU_SMALL }}>
                    Annuler
                  </button>
                  <button onClick={saveProfil} disabled={saving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              )}
            </div>

            <FieldGroup label="Nom de l'entreprise">
              {editing
                ? <Input value={eName} onChange={setEName} placeholder="Nom de l'entreprise" />
                : <FieldValue>{entreprise.name}</FieldValue>}
            </FieldGroup>

            <FieldGroup label="Description">
              {editing
                ? <textarea value={eDesc} onChange={e => setEDesc(e.target.value)} placeholder="Décrivez votre entreprise…" rows={4} style={{ width: '100%', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', color: '#3D4852', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                : <FieldValue>{entreprise.description || '—'}</FieldValue>}
            </FieldGroup>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <FieldGroup label="Téléphone">
                {editing
                  ? <Input value={ePhone} onChange={setEPhone} placeholder="+225 07 00 00 00" />
                  : <FieldValue>{entreprise.phone || '—'}</FieldValue>}
              </FieldGroup>
              <FieldGroup label="Email">
                {editing
                  ? <Input value={eEmail} onChange={setEEmail} placeholder="contact@entreprise.ci" />
                  : <FieldValue>{entreprise.email || '—'}</FieldValue>}
              </FieldGroup>
            </div>

            <FieldGroup label="Site web">
              {editing
                ? <Input value={eWebsite} onChange={setEWebsite} placeholder="https://www.entreprise.ci" />
                : <FieldValue>{entreprise.website || '—'}</FieldValue>}
            </FieldGroup>

            {/* Secteurs */}
            <FieldGroup label="Secteurs d'activité">
              {editing ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {SECTEURS_OPTS.map(s => (
                    <button key={s} onClick={() => setESecteurs(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} style={{
                      padding: '5px 12px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontSize: '12px',
                      background: eSecteurs.includes(s) ? 'rgba(232,93,38,0.08)' : '#FFFFFF',
                      borderColor: eSecteurs.includes(s) ? 'rgba(232,93,38,0.4)' : '#E2E8F0',
                      color: eSecteurs.includes(s) ? '#E85D26' : '#6B7280',
                      boxShadow: eSecteurs.includes(s) ? 'none' : NEU_SMALL,
                    }}>{s}</button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(entreprise.secteurs || []).length === 0
                    ? <span style={{ color: '#8B95A5', fontSize: '13px' }}>—</span>
                    : (entreprise.secteurs || []).map((s: string) => (
                      <span key={s} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '12px', background: 'rgba(232,93,38,0.08)', color: '#E85D26', border: '1px solid rgba(232,93,38,0.15)' }}>{s}</span>
                    ))}
                </div>
              )}
            </FieldGroup>

            {/* Quartiers */}
            <FieldGroup label="Zones d'intervention">
              {editing ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {QUARTIERS_ABJ.map(q => (
                    <button key={q} onClick={() => setEQuartiers(prev => prev.includes(q) ? prev.filter(x => x !== q) : [...prev, q])} style={{
                      padding: '5px 12px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontSize: '12px',
                      background: eQuartiers.includes(q) ? 'rgba(96,165,250,0.08)' : '#FFFFFF',
                      borderColor: eQuartiers.includes(q) ? 'rgba(96,165,250,0.35)' : '#E2E8F0',
                      color: eQuartiers.includes(q) ? '#60a5fa' : '#6B7280',
                      boxShadow: eQuartiers.includes(q) ? 'none' : NEU_SMALL,
                    }}>{q}</button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(entreprise.quartiers || []).length === 0
                    ? <span style={{ color: '#8B95A5', fontSize: '13px' }}>—</span>
                    : (entreprise.quartiers || []).map((q: string) => (
                      <span key={q} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '12px', background: 'rgba(96,165,250,0.06)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.15)' }}>{q}</span>
                    ))}
                </div>
              )}
            </FieldGroup>

            {/* Owner info */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', boxShadow: NEU_SMALL }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#8B95A5', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Administrateur</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="afrione-gradient" style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: 'white' }}>
                  {entreprise.users?.name?.[0]?.toUpperCase() || 'A'}
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: '#3D4852', fontWeight: 500 }}>{entreprise.users?.name || '—'}</div>
                  <div style={{ fontSize: '11px', color: '#8B95A5' }}>{entreprise.users?.email || '—'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Sous-composants ─────────────────────────────────────────────────────────

const NEU_SHADOW_SUB = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL_SUB  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  en_cours:   { label: 'En cours',   color: '#22c55e' },
  completed:  { label: 'Terminée',   color: '#60a5fa' },
  disputed:   { label: 'Litige',     color: '#ef4444' },
  payment:    { label: 'Paiement',   color: '#C9A84C' },
  matching:   { label: 'Matching',   color: '#a78bfa' },
  diagnostic: { label: 'Diagnostic', color: '#a78bfa' },
  cancelled:  { label: 'Annulée',    color: '#6b7280' },
}

function MissionRow({ m, compact = false }: { m: any; compact?: boolean }) {
  const st = STATUS_MAP[m.status] ?? { label: m.status, color: '#8B95A5' }
  return (
    <Link href={`/warroom/${m.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: compact ? '8px 12px' : '12px 16px',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '10px', marginBottom: '6px',
        cursor: 'pointer', transition: 'box-shadow 0.15s',
        boxShadow: NEU_SMALL_SUB,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: compact ? '12px' : '13px', fontWeight: 600, color: '#3D4852', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.category || 'Mission'}
            </span>
            {m.quartier && <span style={{ fontSize: '11px', color: '#8B95A5' }}>{m.quartier}</span>}
          </div>
          <div style={{ fontSize: '11px', color: '#8B95A5', marginTop: '2px' }}>
            Client : {m.users?.name || '—'} · {new Date(m.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {m.total_price > 0 && <span style={{ fontSize: '12px', fontWeight: 600, color: '#C9A84C' }}>{m.total_price.toLocaleString()} F</span>}
          <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: `${st.color}15`, color: st.color }}>{st.label}</span>
          <ExternalLink size={13} color="#8B95A5" />
        </div>
      </div>
    </Link>
  )
}

function InviteInfo() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#FFFFFF', border: '1px solid rgba(232,93,38,0.2)', borderRadius: '8px', color: '#E85D26', fontSize: '12px', cursor: 'pointer', boxShadow: NEU_SMALL_SUB }}>
        <Plus size={13} /> Ajouter un artisan
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', width: '280px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', zIndex: 100, boxShadow: NEU_SHADOW_SUB }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#3D4852' }}>Inviter un artisan</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B95A5' }}><X size={14} /></button>
          </div>
          <p style={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.6, margin: 0 }}>
            Pour ajouter un artisan à votre espace, demandez-lui de rejoindre AfriOne et de mentionner votre entreprise lors de son inscription.
            <br /><br />
            Notre équipe effectuera la liaison dans les 24h.
          </p>
          <a href="mailto:support@afrione.ci" className="afrione-gradient-text" style={{ display: 'block', marginTop: '10px', fontSize: '12px', textDecoration: 'none' }}>
            Contacter le support →
          </a>
        </div>
      )}
    </div>
  )
}

function EmptyTeam() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', background: '#FFFFFF', border: '1.5px dashed #E2E8F0', borderRadius: '16px', boxShadow: NEU_SHADOW_SUB }}>
      <Users size={32} color="#8B95A5" style={{ marginBottom: '12px' }} />
      <p style={{ color: '#3D4852', fontWeight: 600, fontSize: '14px', margin: '0 0 6px' }}>Aucun artisan dans votre équipe</p>
      <p style={{ color: '#6B7280', fontSize: '12px', margin: 0, lineHeight: 1.6 }}>
        Contactez le support AfriOne pour rattacher vos artisans à cet espace.
      </p>
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#8B95A5', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      {children}
    </div>
  )
}

function FieldValue({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '13px', color: '#3D4852', padding: '4px 0' }}>{children}</div>
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: '100%', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', color: '#3D4852', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
    />
  )
}
