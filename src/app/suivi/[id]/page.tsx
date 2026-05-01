'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Navigation, MapPin, CheckCircle, Clock, Navigation2, Camera, Upload, AlertCircle, MessageCircle, X, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const QUARTIER_COORDS: Record<string, [number, number]> = {
  'Cocody':      [5.3600, -3.9910], 'Plateau':     [5.3190, -4.0200],
  'Marcory':     [5.3000, -4.0050], 'Treichville': [5.3050, -4.0100],
  'Yopougon':    [5.3450, -4.0700], 'Adjamé':      [5.3550, -4.0300],
  'Abobo':       [5.4150, -4.0000], 'Port-Bouët':  [5.2550, -3.9400],
  'Koumassi':    [5.2950, -3.9800],
}
const ABIDJAN_CENTER: [number, number] = [5.3600, -4.0083]

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
function etaFromKm(km: number) { return Math.max(2, Math.round(km/30*60)) }

export default function MissionLivePage() {
  const { id: missionId } = useParams() as { id: string }
  const router = useRouter()

  const [mission, setMission]         = useState<any>(null)
  const [user, setUser]               = useState<any>(null)
  const [userRole, setUserRole]       = useState('client')
  const [artisanPos, setArtisanPos]   = useState<{ lat: number; lng: number } | null>(null)
  const [clientPos, setClientPos]     = useState<[number, number]>(ABIDJAN_CENTER)
  const [isTracking, setIsTracking]   = useState(false)
  const [eta, setEta]                 = useState<number | null>(null)
  const [distanceKm, setDistKm]       = useState<number | null>(null)
  const [loading, setLoading]         = useState(true)
  const [acting, setActing]           = useState(false)
  const [tab, setTab]                 = useState<'gps'|'photos'|'infos'>('gps')

  // Photos de chantier
  const [proofAfterUrls, setProofAfterUrls] = useState<string[]>([])
  const [proofNotes, setProofNotes]         = useState('')
  const [uploadingProof, setUploadingProof] = useState(false)
  const [proofSaved, setProofSaved]         = useState(false)
  const proofRef = useRef<HTMLInputElement>(null)

  // Litige
  const [showLitige, setShowLitige]         = useState(false)
  const [litigeText, setLitigeText]         = useState('')
  const [submittingLitige, setSubmittingLitige] = useState(false)

  const watchRef     = useRef<number | null>(null)
  const clientPosRef = useRef<[number, number]>(ABIDJAN_CENTER)

  const isArtisan = userRole === 'artisan' || userRole === 'admin'

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      setUser(session.user)

      const { data: ud } = await supabase.from('users').select('role').eq('id', session.user.id).single()
      const role = ud?.role ?? 'client'
      setUserRole(role)
      const artisan = role === 'artisan' || role === 'admin'

      const { data: m } = await supabase
        .from('missions')
        .select('*, artisan_pros(id, user_id, metier, users(name, avatar_url)), users!missions_client_id_fkey(name, quartier, avatar_url)')
        .eq('id', missionId).single()
      if (!m) { setLoading(false); return }
      setMission(m)

      const quartier = m.users?.quartier || m.quartier || ''
      const coords: [number, number] = QUARTIER_COORDS[quartier] || ABIDJAN_CENTER
      setClientPos(coords)
      clientPosRef.current = coords

      // Dernière position GPS
      const { data: lastGps } = await supabase
        .from('gps_tracking').select('lat, lng, eta_minutes')
        .eq('mission_id', missionId).order('created_at', { ascending: false }).limit(1).single()
      if (lastGps) {
        setArtisanPos({ lat: lastGps.lat, lng: lastGps.lng })
        setEta(lastGps.eta_minutes)
        setDistKm(haversineKm(lastGps.lat, lastGps.lng, coords[0], coords[1]))
      }

      // Photos existantes
      const { data: proof } = await supabase.from('proof_of_work').select('*').eq('mission_id', missionId).maybeSingle()
      if (proof) {
        setProofAfterUrls(proof.photo_after_urls || [])
        setProofNotes(proof.artisan_notes || '')
        setProofSaved(true)
      }

      // Tab par défaut selon statut et rôle
      if (m.status === 'en_cours') setTab(artisan ? 'photos' : 'infos')

      setLoading(false)
    }
    init()

    const ch = supabase.channel(`suivi-${missionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gps_tracking', filter: `mission_id=eq.${missionId}` },
        payload => {
          const { lat, lng, eta_minutes } = payload.new
          setArtisanPos({ lat, lng })
          setEta(eta_minutes)
          setDistKm(haversineKm(lat, lng, clientPosRef.current[0], clientPosRef.current[1]))
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'missions', filter: `id=eq.${missionId}` },
        payload => setMission((prev: any) => ({ ...prev, ...payload.new })))
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
    }
  }, [missionId])

  // ── GPS ──────────────────────────────────────────────────────────────────
  const startTracking = async () => {
    if (!('geolocation' in navigator)) { toast.error('GPS non disponible'); return }
    setIsTracking(true)
    if (mission?.status !== 'en_route') {
      await supabase.from('missions').update({ status: 'en_route' }).eq('id', missionId)
      setMission((prev: any) => ({ ...prev, status: 'en_route' }))
    }
    const id = navigator.geolocation.watchPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setArtisanPos({ lat, lng })
        const dist = haversineKm(lat, lng, clientPosRef.current[0], clientPosRef.current[1])
        setDistKm(dist)
        const etaMin = etaFromKm(dist)
        setEta(etaMin)
        await supabase.from('gps_tracking').insert({ mission_id: missionId, artisan_id: mission?.artisan_pros?.id, lat, lng, eta_minutes: etaMin })
      },
      err => { console.error(err); toast.error('Erreur GPS') },
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 15000 }
    )
    watchRef.current = id
  }

  const stopTracking = () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = null
    setIsTracking(false)
  }

  const markArrived = async () => {
    setActing(true)
    stopTracking()
    await supabase.from('missions').update({ status: 'en_cours', started_at: new Date().toISOString() }).eq('id', missionId)
    setMission((prev: any) => ({ ...prev, status: 'en_cours' }))
    await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id, sender_role: 'artisan',
      text: "L'artisan est arrivé — mission démarrée ! ⚡", type: 'system',
    })
    if (mission?.client_id) {
      fetch('/api/push-send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: mission.client_id, title: "AfriOne — L'artisan est arrivé !", body: 'La mission vient de démarrer.', url: `https://afrione-sepia.vercel.app/suivi/${missionId}` }) }).catch(() => {})
    }
    setTab('photos')
    toast.success("Mission démarrée !")
    setActing(false)
  }

  // ── PHOTOS ───────────────────────────────────────────────────────────────
  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploadingProof(true)
    const urls: string[] = []
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `proof/${missionId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('portfolio').upload(path, file, { upsert: false })
      if (!error) urls.push(supabase.storage.from('portfolio').getPublicUrl(path).data.publicUrl)
    }
    setProofAfterUrls(prev => [...prev, ...urls])
    setProofSaved(false)
    setUploadingProof(false)
  }

  const saveProof = async () => {
    if (!proofAfterUrls.length) { toast.error('Ajoutez au moins une photo'); return }
    const { data: existing } = await supabase.from('proof_of_work').select('id').eq('mission_id', missionId).maybeSingle()
    const payload = { mission_id: missionId, photo_after_urls: proofAfterUrls, artisan_notes: proofNotes.trim() || null }
    if (existing) await supabase.from('proof_of_work').update(payload).eq('mission_id', missionId)
    else await supabase.from('proof_of_work').insert(payload)
    await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id, sender_role: userRole,
      text: JSON.stringify({ urls: proofAfterUrls, notes: proofNotes.trim() }), type: 'proof',
    })
    setProofSaved(true)
    toast.success('Photos enregistrées !')
  }

  // ── MARQUER TERMINÉ ───────────────────────────────────────────────────────
  const markDone = async () => {
    setActing(true)
    await supabase.from('missions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', missionId)
    setMission((prev: any) => ({ ...prev, status: 'completed' }))
    const amount = mission?.total_price || 0
    if (amount > 0) {
      const { error } = await supabase.rpc('release_escrow', { p_mission_id: missionId })
      if (error) console.error('[release_escrow]', error)
    }
    await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id, sender_role: userRole,
      text: `Mission terminée ✅ — ${amount > 0 ? `${amount.toLocaleString()} FCFA transférés sur votre wallet.` : 'Merci pour votre confiance !'}`,
      type: 'system',
    })
    if (mission?.client_id) {
      fetch('/api/push-send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: mission.client_id, title: 'AfriOne — Mission terminée !', body: 'Pensez à laisser un avis à votre artisan.', url: `https://afrione-sepia.vercel.app/warroom/${missionId}` }) }).catch(() => {})
    }
    toast.success('Mission terminée !')
    setActing(false)
    router.push(`/warroom/${missionId}`)
  }

  // ── LITIGE ─────────────────────────────────────────────────────────────────
  const submitLitige = async () => {
    if (!litigeText.trim()) { toast.error('Décrivez le problème'); return }
    setSubmittingLitige(true)
    await supabase.from('missions').update({ status: 'disputed' }).eq('id', missionId)
    setMission((prev: any) => ({ ...prev, status: 'disputed' }))
    await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id, sender_role: userRole,
      text: `⚠️ Litige signalé : ${litigeText.trim()}`, type: 'system',
    })
    if (mission?.artisan_pros?.user_id) {
      fetch('/api/push-send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: mission.artisan_pros.user_id, title: 'AfriOne — Litige ouvert', body: 'Un problème a été signalé sur cette mission.', url: `https://afrione-sepia.vercel.app/suivi/${missionId}` }) }).catch(() => {})
    }
    setShowLitige(false)
    setLitigeText('')
    setSubmittingLitige(false)
    toast('Litige signalé. Notre équipe va examiner le cas.', { icon: '⚠️', duration: 5000 })
  }

  if (loading) return (
    <div style={{ height: '100dvh', background: '#0F1410', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid rgba(232,93,38,0.2)', borderTop: '4px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  const status   = mission?.status || 'en_route'
  const artisanName = mission?.artisan_pros?.users?.name || 'Artisan'
  const artisanMetier = mission?.artisan_pros?.metier || ''
  const clientName  = mission?.users?.name || 'Client'
  const quartier    = mission?.users?.quartier || mission?.quartier || 'Abidjan'
  const amount      = mission?.total_price || 0

  // Map
  const bbox = artisanPos ? {
    minLng: Math.min(artisanPos.lng, clientPos[1]) - 0.025, minLat: Math.min(artisanPos.lat, clientPos[0]) - 0.018,
    maxLng: Math.max(artisanPos.lng, clientPos[1]) + 0.025, maxLat: Math.max(artisanPos.lat, clientPos[0]) + 0.018,
  } : { minLng: clientPos[1]-0.03, minLat: clientPos[0]-0.02, maxLng: clientPos[1]+0.03, maxLat: clientPos[0]+0.02 }
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}&layer=mapnik&marker=${clientPos[0]},${clientPos[1]}`
  const googleMapsUrl = artisanPos
    ? `https://www.google.com/maps/dir/${artisanPos.lat},${artisanPos.lng}/${clientPos[0]},${clientPos[1]}`
    : `https://www.google.com/maps/search/?api=1&query=${clientPos[0]},${clientPos[1]}`

  // Timeline steps
  const STEPS = [
    { key: 'en_route',  label: 'En route',  icon: '🚗' },
    { key: 'en_cours',  label: 'Sur place',  icon: '📍' },
    { key: 'completed', label: 'Terminé',    icon: '✅' },
  ]
  const stepIndex = status === 'completed' ? 2 : status === 'en_cours' || status === 'disputed' ? 1 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0F1410', color: '#FAFAF5' }}>

      {/* ── MODAL LITIGE ─────────────────────────────────────────────── */}
      {showLitige && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,14,11,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '420px', background: 'white', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', background: 'rgba(239,68,68,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={18} color="#ef4444" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: '#0F1410' }}>Signaler un problème</div>
                <div style={{ fontSize: '12px', color: '#7A7A6E' }}>Notre équipe examinera la situation sous 24h</div>
              </div>
            </div>
            <textarea value={litigeText} onChange={e => setLitigeText(e.target.value)}
              placeholder="Décrivez le problème en détail : travaux non conformes, artisan absent, dégâts..."
              rows={4} style={{ width: '100%', padding: '12px', border: '1.5px solid #D8D2C4', borderRadius: '12px', fontSize: '14px', resize: 'none', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '16px', color: '#0F1410' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowLitige(false)} style={{ flex: 1, padding: '12px', background: 'none', border: '1.5px solid #D8D2C4', borderRadius: '12px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: '#7A7A6E' }}>Annuler</button>
              <button onClick={submitLitige} disabled={submittingLitige || !litigeText.trim()} style={{ flex: 2, padding: '12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', opacity: submittingLitige ? 0.6 : 1 }}>
                {submittingLitige ? 'Envoi…' : '⚠️ Ouvrir le litige →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ───────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, background: '#0F1410', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
          <Link href={`/warroom/${missionId}`} style={{ color: '#7A7A6E', display: 'flex' }}>
            <ArrowLeft size={20} />
          </Link>
          <div style={{ width: '36px', height: '36px', background: '#1A2018', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0 }}>
            {mission?.artisan_pros?.users?.avatar_url
              ? <img src={mission.artisan_pros.users.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : '🔧'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artisanName}</div>
            <div style={{ fontSize: '11px', color: '#7A7A6E' }}>{artisanMetier}</div>
          </div>
          <Link href={`/warroom/${missionId}`} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '6px 12px', textDecoration: 'none', color: '#FAFAF5', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
            <MessageCircle size={13} /> Chat
          </Link>
        </div>

        {/* Timeline */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px 14px', gap: 0 }}>
          {STEPS.map((s, i) => {
            const done = i < stepIndex
            const active = i === stepIndex
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', border: `2px solid ${done ? '#2B6B3E' : active ? '#E85D26' : 'rgba(255,255,255,0.15)'}`, background: done ? 'rgba(43,107,62,0.2)' : active ? 'rgba(232,93,38,0.15)' : 'transparent', flexShrink: 0 }}>
                    {done ? <CheckCircle size={16} color="#2B6B3E" /> : <span>{s.icon}</span>}
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: done ? '#2B6B3E' : active ? '#E85D26' : '#7A7A6E', whiteSpace: 'nowrap' }}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: '2px', background: done ? '#2B6B3E' : 'rgba(255,255,255,0.1)', marginBottom: '16px', marginLeft: '4px', marginRight: '4px' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── TABS ─────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, display: 'flex', background: '#1A1F1B', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '4px 12px', gap: '4px' }}>
        {[
          { id: 'gps' as const, label: '🗺️ GPS' },
          { id: 'photos' as const, label: `📸 Photos${proofAfterUrls.length > 0 ? ` (${proofAfterUrls.length})` : ''}` },
          { id: 'infos' as const, label: 'ℹ️ Infos' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '10px 8px', background: tab === t.id ? 'rgba(232,93,38,0.15)' : 'transparent', border: tab === t.id ? '1px solid rgba(232,93,38,0.35)' : '1px solid transparent', borderRadius: '10px', color: tab === t.id ? '#E85D26' : '#7A7A6E', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CONTENU ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* GPS */}
        {tab === 'gps' && (
          <div style={{ height: '100%', position: 'relative' }}>
            <iframe src={mapSrc} style={{ width: '100%', height: '100%', border: 'none', filter: 'brightness(0.85) saturate(0.85)' }} title="Carte" />
            {artisanPos && (
              <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(15,20,16,0.93)', backdropFilter: 'blur(10px)', borderRadius: '14px', padding: '10px 14px', border: '1px solid rgba(232,93,38,0.35)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
                  <span style={{ width: '8px', height: '8px', background: '#E85D26', borderRadius: '50%', boxShadow: '0 0 0 3px rgba(232,93,38,0.25)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{isArtisan ? 'Vous' : artisanName}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#7A7A6E', fontFamily: 'Space Mono' }}>{artisanPos.lat.toFixed(4)}, {artisanPos.lng.toFixed(4)}</div>
              </div>
            )}
            <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(15,20,16,0.93)', backdropFilter: 'blur(10px)', borderRadius: '14px', padding: '10px 14px', border: '1px solid rgba(43,107,62,0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <MapPin size={13} color="#2B6B3E" />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{isArtisan ? clientName : 'Chez vous'}</span>
              </div>
              <div style={{ fontSize: '10px', color: '#7A7A6E' }}>{quartier}</div>
            </div>
            {distanceKm !== null && (
              <div style={{ position: 'absolute', bottom: '16px', left: '12px', background: 'rgba(15,20,16,0.93)', borderRadius: '12px', padding: '7px 12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontFamily: 'Space Mono', fontSize: '13px', fontWeight: 700 }}>
                  {distanceKm < 1 ? `${Math.round(distanceKm*1000)} m` : `${distanceKm.toFixed(1)} km`}
                </span>
              </div>
            )}
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', bottom: '16px', right: '12px', background: '#4285F4', color: 'white', padding: '8px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
              <Navigation2 size={13} /> Google Maps
            </a>
          </div>
        )}

        {/* PHOTOS */}
        {tab === 'photos' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
            {isArtisan ? (
              <div>
                <div style={{ marginBottom: '14px' }}>
                  <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#FAFAF5', marginBottom: '4px' }}>Photos de chantier</h3>
                  <p style={{ fontSize: '12px', color: '#7A7A6E' }}>Ces photos seront visibles par le client et ajoutées à votre portfolio.</p>
                </div>
                <input ref={proofRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleProofUpload} />

                {proofAfterUrls.length > 0 ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '12px' }}>
                      {proofAfterUrls.map((url, i) => (
                        <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', background: '#1A2018' }}>
                          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button onClick={() => { setProofAfterUrls(prev => prev.filter((_,j) => j !== i)); setProofSaved(false) }} style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => proofRef.current?.click()} disabled={uploadingProof} style={{ aspectRatio: '1', borderRadius: '10px', border: '2px dashed rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', color: '#7A7A6E' }}>
                        {uploadingProof ? <div style={{ width: '18px', height: '18px', border: '2px solid rgba(232,93,38,0.3)', borderTop: '2px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <><Upload size={18} /><span>Ajouter</span></>}
                      </button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => proofRef.current?.click()} disabled={uploadingProof} style={{ width: '100%', aspectRatio: '16/9', border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
                    {uploadingProof ? <div style={{ width: '28px', height: '28px', border: '3px solid rgba(232,93,38,0.3)', borderTop: '3px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Camera size={36} color="rgba(255,255,255,0.2)" />}
                    <span style={{ fontSize: '14px', color: '#7A7A6E' }}>Appuyer pour ajouter des photos</span>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)' }}>Avant / Après · Résultats · Pièces remplacées</span>
                  </button>
                )}

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#7A7A6E', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>NOTES SUR LE CHANTIER (optionnel)</label>
                  <textarea value={proofNotes} onChange={e => { setProofNotes(e.target.value); setProofSaved(false) }} placeholder="Ex: Remplacement robinet cuisine + joint sous évier. Client informé de l'état de la tuyauterie…" rows={3} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '13px', color: '#FAFAF5', resize: 'none', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <button onClick={saveProof} disabled={!proofAfterUrls.length || uploadingProof} style={{ width: '100%', padding: '14px', background: proofAfterUrls.length ? (proofSaved ? 'rgba(43,107,62,0.3)' : '#2B6B3E') : 'rgba(255,255,255,0.07)', color: 'white', border: proofSaved ? '1px solid rgba(43,107,62,0.5)' : 'none', borderRadius: '14px', fontWeight: 700, fontSize: '14px', cursor: proofAfterUrls.length ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {proofSaved ? <><CheckCircle size={16} /> Photos enregistrées ✓</> : <><Camera size={16} /> Enregistrer les photos →</>}
                </button>
              </div>
            ) : (
              /* Client : voir les photos */
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#FAFAF5', marginBottom: '4px' }}>Photos de chantier</h3>
                <p style={{ fontSize: '12px', color: '#7A7A6E', marginBottom: '16px' }}>Photos ajoutées par l'artisan en cours de mission.</p>
                {proofAfterUrls.length > 0 ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px', marginBottom: '12px' }}>
                      {proofAfterUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: 'block', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', background: '#1A2018' }}>
                          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </a>
                      ))}
                    </div>
                    {proofNotes && <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', fontSize: '13px', color: '#7A7A6E', fontStyle: 'italic' }}>"{proofNotes}"</div>}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <Camera size={40} color="rgba(255,255,255,0.1)" style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontSize: '14px', color: '#7A7A6E' }}>L'artisan n'a pas encore ajouté de photos.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* INFOS */}
        {tab === 'infos' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
              {[
                { label: 'Mission', value: mission?.category || 'Intervention' },
                { label: isArtisan ? 'Client' : 'Artisan', value: isArtisan ? clientName : `${artisanName} · ${artisanMetier}` },
                { label: 'Quartier', value: quartier },
                { label: 'Montant', value: amount > 0 ? `${amount.toLocaleString()} FCFA` : '—' },
                { label: 'Statut escrow', value: status === 'completed' ? 'Transféré ✓' : status === 'disputed' ? '⚠️ En litige' : '🔒 Sécurisé' },
              ].map((item, i, arr) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <span style={{ fontSize: '12px', color: '#7A7A6E' }}>{item.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAFAF5' }}>{item.value}</span>
                </div>
              ))}
            </div>

            <Link href={`/warroom/${missionId}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', color: '#FAFAF5', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>
              <MessageCircle size={16} /> Ouvrir la conversation
            </Link>

            {status === 'disputed' && (
              <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#ef4444' }}>Litige en cours</div>
                  <div style={{ fontSize: '12px', color: '#7A7A6E', marginTop: '4px' }}>Notre équipe examine la situation. Les fonds restent sécurisés en attendant la résolution.</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── BARRE D'ACTIONS ─────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, background: '#1A1F1B', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* ARTISAN — En route */}
        {isArtisan && status === 'en_route' && (
          <>
            {!isTracking ? (
              <button onClick={startTracking} style={{ width: '100%', padding: '15px', background: '#E85D26', color: 'white', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Navigation size={18} /> Démarrer le suivi GPS
              </button>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(232,93,38,0.1)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(232,93,38,0.25)' }}>
                  <span style={{ width: '10px', height: '10px', background: '#E85D26', borderRadius: '50%', flexShrink: 0, boxShadow: '0 0 0 4px rgba(232,93,38,0.18)' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#E85D26' }}>GPS actif — position transmise</div>
                    <div style={{ fontSize: '11px', color: '#7A7A6E' }}>Le client voit votre déplacement en direct</div>
                  </div>
                </div>
                <button onClick={markArrived} disabled={acting} style={{ width: '100%', padding: '15px', background: '#2B6B3E', color: 'white', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: acting ? 0.6 : 1 }}>
                  <CheckCircle size={18} /> {acting ? 'Chargement…' : "Je suis arrivé — Démarrer la mission"}
                </button>
              </>
            )}
          </>
        )}

        {/* ARTISAN — En cours */}
        {isArtisan && status === 'en_cours' && (
          <button onClick={markDone} disabled={acting} style={{ width: '100%', padding: '15px', background: 'rgba(43,107,62,0.2)', color: '#2B6B3E', border: '1px solid rgba(43,107,62,0.4)', borderRadius: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: acting ? 0.6 : 1 }}>
            <CheckCircle size={18} /> {acting ? 'En cours…' : 'Marquer la mission comme terminée'}
          </button>
        )}

        {/* CLIENT — En route */}
        {!isArtisan && status === 'en_route' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ width: '8px', height: '8px', background: '#E85D26', borderRadius: '50%', boxShadow: '0 0 0 4px rgba(232,93,38,0.15)' }} />
              <span style={{ fontWeight: 700, fontSize: '14px' }}>{artisanName} est en route</span>
            </div>
            {eta !== null
              ? <p style={{ fontSize: '13px', color: '#7A7A6E' }}>Arrivée estimée dans <strong style={{ color: '#E85D26' }}>{eta} min</strong></p>
              : <p style={{ fontSize: '13px', color: '#7A7A6E' }}>En attente de la position GPS…</p>
            }
          </div>
        )}

        {/* CLIENT — En cours */}
        {!isArtisan && status === 'en_cours' && (
          <button onClick={() => setShowLitige(true)} style={{ width: '100%', padding: '13px', background: 'none', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '14px', color: '#ef4444', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <AlertCircle size={15} /> Signaler un problème
          </button>
        )}

        {/* Terminée */}
        {status === 'completed' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <CheckCircle size={20} color="#2B6B3E" />
              <span style={{ fontWeight: 700, fontSize: '15px', color: '#2B6B3E' }}>Mission terminée !</span>
            </div>
            <Link href={`/warroom/${missionId}`} style={{ fontSize: '13px', color: '#E85D26', fontWeight: 600, textDecoration: 'none' }}>
              {isArtisan ? 'Voir le récapitulatif →' : 'Laisser un avis →'}
            </Link>
          </div>
        )}

        {/* Litige */}
        {status === 'disputed' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 0' }}>
            <AlertCircle size={16} color="#ef4444" />
            <span style={{ fontSize: '13px', color: '#ef4444', fontWeight: 600 }}>Litige en cours — notre équipe examine le cas</span>
          </div>
        )}
      </div>
    </div>
  )
}
