'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Navigation, MapPin, CheckCircle, Clock, Navigation2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// Coordonnées des quartiers d'Abidjan — remplacer par adresse GPS exacte du client plus tard
const QUARTIER_COORDS: Record<string, [number, number]> = {
  'Cocody':      [5.3600, -3.9910],
  'Plateau':     [5.3190, -4.0200],
  'Marcory':     [5.3000, -4.0050],
  'Treichville': [5.3050, -4.0100],
  'Yopougon':    [5.3450, -4.0700],
  'Adjamé':      [5.3550, -4.0300],
  'Abobo':       [5.4150, -4.0000],
  'Port-Bouët':  [5.2550, -3.9400],
  'Koumassi':    [5.2950, -3.9800],
}
const ABIDJAN_CENTER: [number, number] = [5.3600, -4.0083]

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function etaFromKm(km: number) {
  return Math.max(2, Math.round(km / 30 * 60)) // 30 km/h moyenne Abidjan
}

export default function SuiviPage() {
  const { id: missionId } = useParams() as { id: string }
  const router = useRouter()

  const [mission, setMission]       = useState<any>(null)
  const [user, setUser]             = useState<any>(null)
  const [isArtisan, setIsArtisan]   = useState(false)
  const [artisanPos, setArtisanPos] = useState<{ lat: number; lng: number } | null>(null)
  const [clientPos, setClientPos]   = useState<[number, number]>(ABIDJAN_CENTER)
  const [isTracking, setIsTracking] = useState(false)
  const [eta, setEta]               = useState<number | null>(null)
  const [distanceKm, setDistKm]     = useState<number | null>(null)
  const [loading, setLoading]       = useState(true)
  const [acting, setActing]         = useState(false)
  const watchRef                    = useRef<number | null>(null)
  const clientPosRef                = useRef<[number, number]>(ABIDJAN_CENTER)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      setUser(session.user)

      const { data: userData } = await supabase
        .from('users').select('role').eq('id', session.user.id).single()
      const role = userData?.role ?? 'client'
      setIsArtisan(role === 'artisan' || role === 'admin')

      const { data: m } = await supabase
        .from('missions')
        .select('*, artisan_pros(id, user_id, metier, users(name, avatar_url)), users!missions_client_id_fkey(name, quartier, avatar_url)')
        .eq('id', missionId)
        .single()
      if (!m) { setLoading(false); return }
      setMission(m)

      const quartier = m.users?.quartier || m.quartier || ''
      const coords: [number, number] = QUARTIER_COORDS[quartier] || ABIDJAN_CENTER
      setClientPos(coords)
      clientPosRef.current = coords

      // Dernière position GPS connue
      const { data: lastGps } = await supabase
        .from('gps_tracking')
        .select('lat, lng, eta_minutes')
        .eq('mission_id', missionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (lastGps) {
        setArtisanPos({ lat: lastGps.lat, lng: lastGps.lng })
        setEta(lastGps.eta_minutes)
        setDistKm(haversineKm(lastGps.lat, lastGps.lng, coords[0], coords[1]))
      }

      setLoading(false)
    }
    init()

    // Realtime positions GPS
    const ch = supabase.channel(`suivi-${missionId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gps_tracking', filter: `mission_id=eq.${missionId}` },
        payload => {
          const { lat, lng, eta_minutes } = payload.new
          setArtisanPos({ lat, lng })
          setEta(eta_minutes)
          setDistKm(haversineKm(lat, lng, clientPosRef.current[0], clientPosRef.current[1]))
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'missions', filter: `id=eq.${missionId}` },
        payload => setMission((prev: any) => ({ ...prev, ...payload.new }))
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
    }
  }, [missionId])

  const startTracking = async () => {
    if (!('geolocation' in navigator)) { toast.error('GPS non disponible sur cet appareil'); return }
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
        await supabase.from('gps_tracking').insert({
          mission_id: missionId,
          artisan_id: mission?.artisan_pros?.id,
          lat, lng, eta_minutes: etaMin,
        })
      },
      err => { console.error(err); toast.error('Erreur GPS — vérifiez les permissions') },
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
    const { error } = await supabase.from('missions')
      .update({ status: 'en_cours', started_at: new Date().toISOString() })
      .eq('id', missionId)
    if (error) { toast.error('Erreur'); setActing(false); return }
    setMission((prev: any) => ({ ...prev, status: 'en_cours' }))
    await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id, sender_role: 'artisan',
      text: "L'artisan est arrivé — mission démarrée ! ⚡", type: 'system',
    })
    if (mission?.client_id) {
      fetch('/api/push-send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: mission.client_id, title: 'AfriOne — L\'artisan est arrivé !', body: 'La mission vient de démarrer.', url: `https://afrione-sepia.vercel.app/warroom/${missionId}` }),
      }).catch(() => {})
    }
    toast.success('Mission démarrée !')
    setActing(false)
    router.push(`/warroom/${missionId}`)
  }

  if (loading) return (
    <div style={{ height: '100dvh', background: '#0F1410', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid rgba(232,93,38,0.2)', borderTop: '4px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  const status = mission?.status || 'en_route'
  const artisanName = mission?.artisan_pros?.users?.name || 'Artisan'
  const clientName = mission?.users?.name || 'Client'
  const quartier = mission?.users?.quartier || mission?.quartier || 'Abidjan'

  // Iframe OpenStreetMap — sera remplacé par Google Maps JS API (clé requise)
  const bbox = artisanPos ? {
    minLng: Math.min(artisanPos.lng, clientPos[1]) - 0.025,
    minLat: Math.min(artisanPos.lat, clientPos[0]) - 0.018,
    maxLng: Math.max(artisanPos.lng, clientPos[1]) + 0.025,
    maxLat: Math.max(artisanPos.lat, clientPos[0]) + 0.018,
  } : {
    minLng: clientPos[1] - 0.03, minLat: clientPos[0] - 0.02,
    maxLng: clientPos[1] + 0.03, maxLat: clientPos[0] + 0.02,
  }
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}&layer=mapnik&marker=${clientPos[0]},${clientPos[1]}`
  const googleMapsUrl = artisanPos
    ? `https://www.google.com/maps/dir/${artisanPos.lat},${artisanPos.lng}/${clientPos[0]},${clientPos[1]}`
    : `https://www.google.com/maps/search/?api=1&query=${clientPos[0]},${clientPos[1]}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0F1410', color: '#FAFAF5' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Link href={`/warroom/${missionId}`} style={{ color: '#FAFAF5', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>
            {isArtisan ? `Chez ${clientName} — ${quartier}` : `Suivi de ${artisanName}`}
          </div>
          <div style={{ fontSize: '12px', marginTop: '2px', color: status === 'en_route' ? '#E85D26' : status === 'en_cours' ? '#2B6B3E' : '#7A7A6E' }}>
            {status === 'en_route' ? '🚗 En route' : status === 'en_cours' ? '⚡ Mission en cours' : '⏳ En attente du départ'}
          </div>
        </div>
        {eta !== null && status === 'en_route' && (
          <div style={{ background: 'rgba(232,93,38,0.15)', border: '1px solid rgba(232,93,38,0.3)', borderRadius: '20px', padding: '6px 14px', textAlign: 'center', minWidth: '56px' }}>
            <div style={{ fontFamily: 'Space Mono', fontSize: '20px', fontWeight: 700, color: '#E85D26', lineHeight: 1 }}>{eta}</div>
            <div style={{ fontSize: '10px', color: '#7A7A6E' }}>min</div>
          </div>
        )}
      </div>

      {/* Carte */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* ─── MAP ─────────────────────────────────────────────────────────
            OpenStreetMap en attendant la clé Google Maps.
            Pour intégrer Google Maps :
            1. Ajouter NEXT_PUBLIC_GOOGLE_MAPS_KEY dans .env.local
            2. Remplacer l'iframe par <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}>
               <Map> ... <Marker position={artisanPos} /> <Marker position={clientPos} /> </Map>
               </APIProvider>  (via @vis.gl/react-google-maps)
        ─────────────────────────────────────────────────────────────────── */}
        <iframe src={mapSrc} style={{ width: '100%', height: '100%', border: 'none', filter: 'brightness(0.88) saturate(0.9)' }} title="Carte de suivi" />

        {/* Position artisan (overlay) */}
        {artisanPos && (
          <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(15,20,16,0.93)', backdropFilter: 'blur(10px)', borderRadius: '14px', padding: '10px 14px', border: '1px solid rgba(232,93,38,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
              <span style={{ width: '8px', height: '8px', background: '#E85D26', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 0 3px rgba(232,93,38,0.25)' }} />
              <span style={{ fontSize: '12px', fontWeight: 600 }}>{isArtisan ? 'Vous' : artisanName}</span>
            </div>
            <div style={{ fontSize: '10px', color: '#7A7A6E', fontFamily: 'Space Mono' }}>{artisanPos.lat.toFixed(5)}, {artisanPos.lng.toFixed(5)}</div>
          </div>
        )}

        {/* Destination (overlay) */}
        <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(15,20,16,0.93)', backdropFilter: 'blur(10px)', borderRadius: '14px', padding: '10px 14px', border: '1px solid rgba(43,107,62,0.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <MapPin size={13} color="#2B6B3E" />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>{isArtisan ? clientName : 'Chez vous'}</span>
          </div>
          <div style={{ fontSize: '10px', color: '#7A7A6E' }}>{quartier}</div>
        </div>

        {/* Distance */}
        {distanceKm !== null && (
          <div style={{ position: 'absolute', bottom: '56px', left: '12px', background: 'rgba(15,20,16,0.93)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '7px 12px', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontFamily: 'Space Mono', fontSize: '13px', fontWeight: 700 }}>
              {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
            </span>
          </div>
        )}

        {/* Ouvrir dans Maps */}
        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
          style={{ position: 'absolute', bottom: '12px', right: '12px', background: '#4285F4', color: 'white', padding: '8px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
          <Navigation2 size={13} /> Ouvrir dans Maps
        </a>
      </div>

      {/* Barre d'action */}
      <div style={{ flexShrink: 0, background: '#1A1F1B', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '18px 16px 20px' }}>

        {/* ARTISAN */}
        {isArtisan && status !== 'en_cours' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {!isTracking ? (
              <button onClick={startTracking} style={{ width: '100%', padding: '15px', background: '#E85D26', color: 'white', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Navigation size={18} /> Démarrer le suivi GPS
              </button>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(232,93,38,0.1)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(232,93,38,0.25)' }}>
                  <span style={{ width: '10px', height: '10px', background: '#E85D26', borderRadius: '50%', flexShrink: 0, boxShadow: '0 0 0 4px rgba(232,93,38,0.18)' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#E85D26' }}>GPS actif — position transmise en direct</div>
                    <div style={{ fontSize: '11px', color: '#7A7A6E', marginTop: '2px' }}>Le client voit votre déplacement sur la carte</div>
                  </div>
                </div>
                <button onClick={markArrived} disabled={acting} style={{ width: '100%', padding: '15px', background: '#2B6B3E', color: 'white', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: acting ? 0.6 : 1 }}>
                  <CheckCircle size={18} /> {acting ? 'Chargement…' : 'Je suis arrivé — Démarrer la mission'}
                </button>
              </>
            )}
          </div>
        )}

        {/* CLIENT */}
        {!isArtisan && (
          <div style={{ textAlign: 'center' }}>
            {status === 'en_route' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ width: '10px', height: '10px', background: '#E85D26', borderRadius: '50%', boxShadow: '0 0 0 4px rgba(232,93,38,0.15)' }} />
                  <span style={{ fontWeight: 700, fontSize: '15px' }}>{artisanName} est en route</span>
                </div>
                {eta !== null
                  ? <p style={{ fontSize: '13px', color: '#7A7A6E' }}>Arrivée estimée dans <strong style={{ color: '#E85D26' }}>{eta} min</strong></p>
                  : <p style={{ fontSize: '13px', color: '#7A7A6E' }}>En attente de la position GPS de l'artisan…</p>
                }
              </>
            ) : status === 'en_cours' ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <CheckCircle size={20} color="#2B6B3E" />
                <span style={{ fontWeight: 700, fontSize: '15px', color: '#2B6B3E' }}>Mission démarrée !</span>
              </div>
            ) : (
              <>
                <Clock size={20} style={{ margin: '0 auto 8px', color: '#7A7A6E', display: 'block' }} />
                <p style={{ fontSize: '14px', color: '#7A7A6E' }}>En attente du départ de l'artisan…</p>
              </>
            )}
          </div>
        )}

        {status === 'en_cours' && (
          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <Link href={`/warroom/${missionId}`} style={{ fontSize: '14px', color: '#E85D26', fontWeight: 600, textDecoration: 'none' }}>
              Retour à la conversation →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
