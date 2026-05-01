'use client'
export const dynamic = 'force-dynamic'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Send, CheckCircle, X, Zap, Clock, AlertCircle, Star } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  negotiation: { label: '💬 En discussion',          color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
  matching:    { label: '🔔 Nouvelle demande',        color: '#E85D26', bg: 'rgba(232,93,38,0.1)'  },
  scheduled:   { label: '📅 Intervention programmée', color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
  en_route:    { label: '🚗 En route',                color: '#E85D26', bg: 'rgba(232,93,38,0.1)'  },
  en_cours:    { label: '⚡ Mission en cours',        color: '#2B6B3E', bg: 'rgba(43,107,62,0.12)' },
  payment:     { label: '💳 Paiement',               color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
  completed:   { label: '✅ Mission terminée',        color: '#2B6B3E', bg: 'rgba(43,107,62,0.1)'  },
  cancelled:   { label: '✗ Annulée',                 color: '#7A7A6E', bg: 'rgba(122,122,110,0.1)' },
}

export default function WarRoomPage() {
  const params = useParams()
  const router = useRouter()
  const missionId = params.id as string

  const [messages, setMessages]       = useState<any[]>([])
  const [input, setInput]             = useState('')
  const [user, setUser]               = useState<any>(null)
  const [userRole, setUserRole]       = useState<string>('client')
  const [mission, setMission]         = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [acting, setActing]           = useState(false)

  // Formulaire devis
  const [showDevis, setShowDevis]     = useState(false)
  const [devisAmount, setDevisAmount] = useState('')
  const [devisDesc, setDevisDesc]     = useState('')

  // Avis post-mission
  const [rating, setRating]               = useState(0)
  const [hoverRating, setHoverRating]     = useState(0)
  const [reviewText, setReviewText]       = useState('')
  const [hasReviewed, setHasReviewed]     = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)

  // Modal paiement Wave (avant scheduling)
  const [showPayment, setShowPayment]       = useState(false)
  const [payStep, setPayStep]               = useState<'form'|'processing'|'success'>('form')
  const [pendingAmount, setPendingAmount]   = useState(0)
  const [wavePhone, setWavePhone]           = useState('')

  // Modal scheduling (après acceptation devis)
  const [showScheduling, setShowScheduling] = useState(false)
  const [schedMode, setSchedMode]           = useState<'now' | 'later' | null>(null)
  const [schedDate, setSchedDate]           = useState('')
  const [schedTime, setSchedTime]           = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  usePushNotifications(user?.id || null)

  const isArtisan = userRole === 'artisan' || userRole === 'admin'

  // Notifier l'autre partie par push
  const notifyOther = useCallback((text: string, recipientId: string) => {
    fetch('/api/push-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: recipientId,
        title: 'AfriOne — Nouveau message',
        body: text.length > 60 ? text.slice(0, 60) + '…' : text,
        url: `https://afrione-sepia.vercel.app/warroom/${missionId}`,
      }),
    }).catch(() => {})
  }, [missionId])

  const getRecipientId = useCallback((m: any, uid: string) =>
    uid === m?.client_id ? m?.artisan_pros?.user_id : m?.client_id
  , [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      setUser(session.user)

      const { data: userData } = await supabase.from('users').select('role').eq('id', session.user.id).single()
      setUserRole(userData?.role ?? 'client')

      const { data: missionData } = await supabase
        .from('missions')
        .select('*, scheduled_at, artisan_pros(id, user_id, metier, users(name, avatar_url))')
        .eq('id', missionId)
        .single()
      setMission(missionData)

      const { data: msgs } = await supabase
        .from('chat_history')
        .select('*, users(name, avatar_url)')
        .eq('mission_id', missionId)
        .order('created_at', { ascending: true })
      setMessages(msgs || [])

      // Marquer lus
      await supabase
        .from('chat_history')
        .update({ read_at: new Date().toISOString() })
        .eq('mission_id', missionId)
        .neq('sender_id', session.user.id)
        .is('read_at', null)

      // Vérifier si le client a déjà laissé un avis pour cette mission
      if ((userData?.role ?? 'client') !== 'artisan') {
        const { data: existingReview } = await supabase
          .from('sentiment_logs')
          .select('id')
          .eq('mission_id', missionId)
          .eq('source', 'review')
          .maybeSingle()
        if (existingReview) setHasReviewed(true)
      }

      setLoading(false)
    }
    init()

    // Realtime — nouveaux messages
    const channel = supabase
      .channel(`warroom-${missionId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_history', filter: `mission_id=eq.${missionId}` },
        payload => setMessages(prev => [...prev, payload.new])
      )
      // Realtime — changement de statut mission
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'missions', filter: `id=eq.${missionId}` },
        payload => setMission((prev: any) => ({ ...prev, ...payload.new }))
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [missionId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Envoyer message texte
  const send = async () => {
    if (!input.trim() || !user) return
    const text = input.trim()
    setInput('')
    const { error } = await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id,
      sender_role: userRole, text, type: 'text',
    })
    if (error) { toast.error('Message non envoyé.'); setInput(text); return }
    const rid = getRecipientId(mission, user.id)
    if (rid) notifyOther(text, rid)
  }

  // Envoyer un devis
  const sendDevis = async () => {
    const amount = parseInt(devisAmount.replace(/\D/g, ''))
    if (!amount || amount <= 0) { toast.error('Montant invalide'); return }
    if (!devisDesc.trim()) { toast.error('Ajoutez une description'); return }
    setActing(true)
    const payload = JSON.stringify({ amount, description: devisDesc.trim() })
    const { error } = await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id,
      sender_role: userRole, text: payload, type: 'quotation',
    })
    if (error) { toast.error('Erreur envoi devis.'); setActing(false); return }
    const rid = getRecipientId(mission, user.id)
    if (rid) notifyOther(`Devis proposé : ${amount.toLocaleString()} FCFA`, rid)
    setShowDevis(false)
    setDevisAmount('')
    setDevisDesc('')
    setActing(false)
  }

  // Client accepte le devis → paiement Wave d'abord
  const acceptDevis = (amount: number) => {
    setPendingAmount(amount)
    setPayStep('form')
    setShowPayment(true)
  }

  // Paiement Wave confirmé → escrow + scheduling
  const confirmPayment = async () => {
    if (!wavePhone.trim()) { toast.error('Entrez votre numéro Wave'); return }
    setPayStep('processing')
    // Simulation délai traitement Wave (2s)
    await new Promise(r => setTimeout(r, 2000))

    // RPC SECURITY DEFINER — vérifie que l'appelant est bien le client de la mission
    const { error: rpcError } = await supabase.rpc('credit_escrow', {
      p_mission_id: missionId,
      p_amount: pendingAmount,
    })
    if (rpcError) {
      console.error('[credit_escrow] code:', rpcError.code, '| message:', rpcError.message, '| details:', rpcError.details)
      toast.error(`Erreur: ${rpcError.message || rpcError.code || 'inconnue'}`)
      setPayStep('form')
      return
    }
    setMission((prev: any) => ({ ...prev, total_price: pendingAmount, status: 'payment' }))

    // Message système dans le chat
    await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id, sender_role: userRole,
      text: `💳 Paiement de ${pendingAmount.toLocaleString()} FCFA sécurisé via Wave. L'argent sera transféré à l'artisan à la fin de la mission.`,
      type: 'system',
    })
    const rid = getRecipientId(mission, user.id)
    if (rid) notifyOther(`Paiement reçu : ${pendingAmount.toLocaleString()} FCFA en escrow.`, rid)

    setPayStep('success')
  }

  // Après succès paiement → ouvrir scheduling
  const afterPayment = () => {
    setShowPayment(false)
    setShowScheduling(true)
    setSchedMode(null)
  }

  // Intervention maintenant → en_route → redirect suivi
  const confirmNow = async () => {
    setActing(true)
    const { error } = await supabase.from('missions')
      .update({ status: 'en_route' }).eq('id', missionId)
    if (error) { toast.error('Erreur.'); setActing(false); return }
    setMission((prev: any) => ({ ...prev, status: 'en_route' }))
    await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id, sender_role: userRole,
      text: 'Devis accepté — intervention maintenant 🚗 Suivi GPS activé', type: 'system',
    })
    const rid = getRecipientId(mission, user.id)
    if (rid) notifyOther("C'est parti ! L'artisan arrive.", rid)
    setShowScheduling(false)
    setActing(false)
    router.push(`/suivi/${missionId}`)
  }

  // Intervention programmée → scheduled + scheduled_at
  const confirmScheduled = async () => {
    if (!schedDate || !schedTime) { toast.error('Choisissez une date et une heure'); return }
    setActing(true)
    const scheduledAt = new Date(`${schedDate}T${schedTime}`).toISOString()
    const dateStr = new Date(scheduledAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

    // Essai avec scheduled_at, fallback sans si la colonne n'existe pas encore
    let error: any = null
    const res1 = await supabase.from('missions')
      .update({ status: 'scheduled', scheduled_at: scheduledAt }).eq('id', missionId)
    error = res1.error
    if (error) {
      // Fallback : mise à jour sans scheduled_at (colonne peut-être absente en base)
      const res2 = await supabase.from('missions')
        .update({ status: 'scheduled' }).eq('id', missionId)
      error = res2.error
    }
    if (error) { toast.error('Erreur lors de la programmation.'); setActing(false); return }

    setMission((prev: any) => ({ ...prev, status: 'scheduled', scheduled_at: scheduledAt }))
    await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id, sender_role: userRole,
      text: `Devis accepté — intervention programmée le ${dateStr} à ${schedTime} 📅`, type: 'system',
    })
    const rid = getRecipientId(mission, user.id)
    if (rid) notifyOther(`Mission programmée le ${dateStr} à ${schedTime}`, rid)
    setShowScheduling(false)
    toast.success('Mission programmée !')
    setActing(false)
  }

  // Client refuse le devis
  const refuseDevis = async () => {
    setActing(true)
    await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id,
      sender_role: userRole, text: 'Devis refusé — une contre-proposition est possible.', type: 'system',
    })
    toast('Devis refusé.')
    setActing(false)
  }

  // Client soumet un avis
  const submitReview = async () => {
    if (rating === 0) { toast.error('Choisissez une note'); return }
    setSubmittingReview(true)
    const artisanId = mission?.artisan_pros?.id
    const { error } = await supabase.from('sentiment_logs').insert({
      mission_id: missionId,
      artisan_id: artisanId,
      source: 'review',
      sentiment_score: rating / 5,
      raw_text: reviewText.trim() || null,
    })
    if (error) {
      console.error('[review insert]', error.code, error.message, error.details)
      toast.error(`Erreur: ${error.message || error.code}`)
      setSubmittingReview(false)
      return
    }

    // Recalculer la note moyenne de l'artisan
    const { data: allReviews } = await supabase
      .from('sentiment_logs')
      .select('sentiment_score')
      .eq('artisan_id', artisanId)
      .eq('source', 'review')
    if (allReviews && allReviews.length > 0) {
      const avg5 = allReviews.reduce((s: number, r: any) => s + r.sentiment_score * 5, 0) / allReviews.length
      await supabase.from('artisan_pros').update({
        rating_avg: Math.round(avg5 * 10) / 10,
        rating_count: allReviews.length,
      }).eq('id', artisanId)
    }

    setHasReviewed(true)
    toast.success('Merci pour votre avis !')
    setSubmittingReview(false)
  }

  // Artisan marque terminé → libère escrow vers wallet disponible
  const markDone = async () => {
    setActing(true)
    const { error } = await supabase
      .from('missions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', missionId)
    if (error) { toast.error('Erreur.'); setActing(false); return }
    setMission((prev: any) => ({ ...prev, status: 'completed' }))

    // RPC SECURITY DEFINER — vérifie que l'appelant est bien l'artisan de la mission
    // Transfère escrow → balance_available + total_earned atomiquement
    const amount = mission?.total_price || 0
    if (amount > 0) {
      const { error: rpcError } = await supabase.rpc('release_escrow', { p_mission_id: missionId })
      if (rpcError) console.error('[release_escrow]', rpcError)
    }

    await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id, sender_role: userRole,
      text: `Mission terminée ✅ — ${amount > 0 ? `${amount.toLocaleString()} FCFA transférés sur votre wallet.` : 'Merci pour votre confiance !'}`,
      type: 'system',
    })
    const rid = getRecipientId(mission, user.id)
    if (rid) notifyOther('Mission terminée ! Pensez à laisser un avis.', rid)
    toast.success('Mission terminée !')
    setActing(false)
  }

  const status = mission?.status || 'negotiation'
  const statusInfo = STATUS_CONFIG[status] || STATUS_CONFIG.negotiation
  const artisanName = mission?.artisan_pros?.users?.name || 'Artisan'
  const artisanMetier = mission?.artisan_pros?.metier || ''
  const isClosed = status === 'completed' || status === 'cancelled'

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:'#F5F0E8'}}>

      {/* ─── MODAL WAVE PAIEMENT (couleurs officielles Wave CI) ──── */}
      {showPayment && (
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'#0A0B2E',display:'flex',flexDirection:'column'}}>

          {/* Status bar simulé */}
          <div style={{height:'44px',flexShrink:0,display:'flex',alignItems:'center',padding:'0 20px',justifyContent:'space-between'}}>
            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',fontFamily:'Space Mono'}}>9:41</span>
            <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
              <div style={{display:'flex',gap:'2px'}}>
                {[3,5,7,9].map(h => <div key={h} style={{width:'3px',height:`${h}px`,background:'rgba(255,255,255,0.4)',borderRadius:'1px'}} />)}
              </div>
              <span style={{fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>WiFi</span>
              <span style={{fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>🔋</span>
            </div>
          </div>

          {/* Header Wave app */}
          <div style={{display:'flex',alignItems:'center',padding:'8px 20px 20px',gap:'16px',flexShrink:0}}>
            {payStep === 'form' && (
              <button onClick={() => setShowPayment(false)} style={{background:'rgba(255,255,255,0.07)',border:'none',borderRadius:'50%',width:'36px',height:'36px',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'white',fontSize:'18px',flexShrink:0}}>
                ←
              </button>
            )}
            <div style={{flex:1,display:'flex',alignItems:'center',gap:'10px'}}>
              {/* Logo Wave — W blanc sur gradient bleu officiel */}
              <div style={{
                width:'38px',height:'38px',borderRadius:'10px',flexShrink:0,
                background:'linear-gradient(135deg,#4144FF,#1DC6FF)',
                display:'flex',alignItems:'center',justifyContent:'center',
                boxShadow:'0 4px 16px rgba(29,198,255,0.35)',
              }}>
                <span style={{color:'white',fontWeight:900,fontSize:'20px',letterSpacing:'-1px',fontFamily:'Arial Black,sans-serif'}}>W</span>
              </div>
              <div>
                <div style={{color:'white',fontWeight:800,fontSize:'16px',letterSpacing:'-0.3px'}}>Wave</div>
                <div style={{color:'rgba(255,255,255,0.4)',fontSize:'11px'}}>Paiement sécurisé</div>
              </div>
            </div>
          </div>

          {/* Corps */}
          <div style={{flex:1,overflowY:'auto',padding:'0 20px 32px'}}>

            {/* ── ÉTAPE 1 : Formulaire ── */}
            {payStep === 'form' && (
              <div>
                {/* Bénéficiaire */}
                <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'16px',padding:'14px 18px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'14px'}}>
                  <div style={{width:'42px',height:'42px',borderRadius:'11px',background:'linear-gradient(135deg,#E85D26,#F87900)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <Zap size={18} color="white" />
                  </div>
                  <div>
                    <div style={{color:'rgba(255,255,255,0.4)',fontSize:'10px',letterSpacing:'0.08em',marginBottom:'2px',textTransform:'uppercase'}}>Bénéficiaire</div>
                    <div style={{color:'white',fontWeight:700,fontSize:'14px'}}>AfriOne — Mission Escrow</div>
                    <div style={{color:'rgba(255,255,255,0.35)',fontSize:'11px'}}>Fonds libérés à la fin de la mission</div>
                  </div>
                </div>

                {/* Montant — style Wave : grand, blanc, centré */}
                <div style={{textAlign:'center',padding:'28px 0 20px'}}>
                  <div style={{color:'rgba(255,255,255,0.35)',fontSize:'11px',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'12px'}}>Montant total</div>
                  <div style={{display:'flex',alignItems:'baseline',justifyContent:'center',gap:'8px'}}>
                    <span style={{color:'white',fontSize:'56px',fontWeight:900,letterSpacing:'-2px',lineHeight:1,fontFamily:'Space Mono'}}>
                      {pendingAmount.toLocaleString()}
                    </span>
                    <span style={{color:'#1DC6FF',fontSize:'18px',fontWeight:700}}>FCFA</span>
                  </div>
                </div>

                {/* Séparateur */}
                <div style={{height:'1px',background:'rgba(255,255,255,0.06)',margin:'0 0 20px'}} />

                {/* Numéro Wave */}
                <div style={{marginBottom:'12px'}}>
                  <div style={{color:'rgba(255,255,255,0.4)',fontSize:'10px',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'10px'}}>Votre numéro Wave</div>
                  <div style={{
                    display:'flex',alignItems:'center',
                    background:'rgba(255,255,255,0.05)',
                    border:`1.5px solid ${wavePhone.trim() ? '#1DC6FF' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius:'14px',overflow:'hidden',
                    transition:'border-color 0.2s',
                  }}>
                    <div style={{padding:'15px 16px',borderRight:'1px solid rgba(255,255,255,0.08)',fontSize:'14px',color:'rgba(255,255,255,0.5)',whiteSpace:'nowrap',flexShrink:0}}>
                      🇨🇮 +225
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="07 00 00 00 00"
                      value={wavePhone}
                      onChange={e => setWavePhone(e.target.value)}
                      style={{
                        flex:1,padding:'15px 16px',background:'transparent',
                        border:'none',outline:'none',fontSize:'17px',
                        color:'white',fontFamily:'Space Mono',letterSpacing:'0.06em',
                      }}
                    />
                  </div>
                </div>

                {/* Info escrow — orange Wave */}
                <div style={{padding:'12px 14px',background:'rgba(248,121,0,0.08)',border:'1px solid rgba(248,121,0,0.2)',borderRadius:'12px',display:'flex',gap:'10px',alignItems:'flex-start',marginBottom:'24px'}}>
                  <span style={{fontSize:'15px',flexShrink:0}}>🔒</span>
                  <div style={{fontSize:'12px',color:'rgba(255,255,255,0.45)',lineHeight:'1.6'}}>
                    Les fonds sont sécurisés par AfriOne et transférés à l'artisan uniquement après validation de la mission.
                  </div>
                </div>

                {/* Bouton — gradient bleu officiel Wave */}
                <button
                  onClick={confirmPayment}
                  disabled={!wavePhone.trim()}
                  style={{
                    width:'100%',padding:'18px',
                    background: wavePhone.trim()
                      ? 'linear-gradient(135deg,#4144FF,#0D99FF)'
                      : 'rgba(255,255,255,0.08)',
                    color:'white',border:'none',borderRadius:'16px',
                    fontSize:'16px',fontWeight:800,letterSpacing:'-0.2px',
                    cursor: wavePhone.trim() ? 'pointer' : 'default',
                    boxShadow: wavePhone.trim() ? '0 8px 28px rgba(65,68,255,0.45)' : 'none',
                    transition:'all 0.2s',
                  }}
                >
                  Payer avec Wave
                </button>

                <div style={{textAlign:'center',marginTop:'14px',fontSize:'11px',color:'rgba(255,255,255,0.2)'}}>
                  Sécurisé par <strong style={{color:'#1DC6FF'}}>Wave</strong> · Chiffrement TLS 1.3
                </div>
              </div>
            )}

            {/* ── ÉTAPE 2 : Processing ── */}
            {payStep === 'processing' && (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'320px',gap:'24px'}}>
                <div style={{position:'relative',width:'80px',height:'80px'}}>
                  <div style={{position:'absolute',inset:0,border:'3px solid rgba(13,153,255,0.12)',borderRadius:'50%'}} />
                  <div style={{position:'absolute',inset:0,border:'3px solid transparent',borderTopColor:'#0D99FF',borderRadius:'50%',animation:'spin 0.85s linear infinite'}} />
                  <div style={{position:'absolute',inset:'10px',background:'linear-gradient(135deg,#4144FF,#1DC6FF)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 20px rgba(29,198,255,0.3)'}}>
                    <span style={{color:'white',fontWeight:900,fontSize:'22px',fontFamily:'Arial Black,sans-serif'}}>W</span>
                  </div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{color:'white',fontWeight:700,fontSize:'18px',marginBottom:'8px'}}>Traitement en cours…</div>
                  <div style={{color:'rgba(255,255,255,0.35)',fontSize:'13px'}}>Vérification via Wave sécurisée</div>
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{width:'7px',height:'7px',borderRadius:'50%',background:'#1DC6FF',opacity: 0.4,animation:`pulse 1.2s ease-in-out ${i*0.35}s infinite`}} />
                  ))}
                </div>
              </div>
            )}

            {/* ── ÉTAPE 3 : Succès ── */}
            {payStep === 'success' && (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',paddingTop:'16px'}}>
                {/* Cercle succès — cyan Wave */}
                <div style={{
                  width:'90px',height:'90px',borderRadius:'50%',
                  background:'linear-gradient(135deg,#4144FF,#1DC6FF)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  marginBottom:'20px',
                  boxShadow:'0 0 0 14px rgba(29,198,255,0.07), 0 0 0 28px rgba(29,198,255,0.03)',
                }}>
                  <CheckCircle size={46} color="white" strokeWidth={2.5} />
                </div>

                <div style={{color:'white',fontSize:'24px',fontWeight:900,marginBottom:'4px',letterSpacing:'-0.5px'}}>Paiement réussi !</div>
                <div style={{color:'rgba(255,255,255,0.4)',fontSize:'13px',marginBottom:'28px'}}>Transaction sécurisée par Wave</div>

                {/* Reçu style Wave */}
                <div style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'20px',overflow:'hidden',marginBottom:'20px'}}>
                  <div style={{padding:'18px 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{color:'rgba(255,255,255,0.4)',fontSize:'12px'}}>Montant</span>
                    <span style={{color:'white',fontWeight:900,fontSize:'20px',fontFamily:'Space Mono'}}>{pendingAmount.toLocaleString()} <span style={{fontSize:'13px',color:'#1DC6FF',fontWeight:700}}>FCFA</span></span>
                  </div>
                  <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between'}}>
                    <span style={{color:'rgba(255,255,255,0.4)',fontSize:'12px'}}>Bénéficiaire</span>
                    <span style={{color:'rgba(255,255,255,0.8)',fontSize:'13px',fontWeight:600}}>AfriOne Escrow</span>
                  </div>
                  <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between'}}>
                    <span style={{color:'rgba(255,255,255,0.4)',fontSize:'12px'}}>Numéro Wave</span>
                    <span style={{color:'rgba(255,255,255,0.8)',fontSize:'13px',fontFamily:'Space Mono'}}>+225 {wavePhone}</span>
                  </div>
                  <div style={{padding:'14px 20px',display:'flex',justifyContent:'space-between'}}>
                    <span style={{color:'rgba(255,255,255,0.4)',fontSize:'12px'}}>Statut</span>
                    <span style={{color:'#1DC6FF',fontSize:'13px',fontWeight:700}}>✓ Escrow sécurisé</span>
                  </div>
                </div>

                <button
                  onClick={afterPayment}
                  style={{
                    width:'100%',padding:'18px',
                    background:'linear-gradient(135deg,#4144FF,#0D99FF)',
                    color:'white',border:'none',borderRadius:'16px',
                    fontSize:'16px',fontWeight:800,cursor:'pointer',
                    boxShadow:'0 8px 28px rgba(65,68,255,0.4)',
                    letterSpacing:'-0.2px',
                  }}
                >
                  Choisir le moment d'intervention →
                </button>
                <div style={{textAlign:'center',marginTop:'12px',fontSize:'11px',color:'rgba(255,255,255,0.2)'}}>
                  Réf · {missionId.slice(0,8).toUpperCase()}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
      {/* ──────────────────────────────────────────────────────────── */}

      {/* ─── MODAL SCHEDULING ─────────────────────────────────────── */}
      {showScheduling && (
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(10,14,11,0.96)',display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div style={{width:'100%',maxWidth:'480px',background:'#1A1F1B',borderRadius:'24px 24px 0 0',padding:'24px 20px 32px'}}>
            <div style={{width:'40px',height:'4px',background:'rgba(255,255,255,0.15)',borderRadius:'2px',margin:'0 auto 24px'}} />

            {schedMode === null && (
              <>
                <h2 style={{fontWeight:800,fontSize:'21px',color:'#FAFAF5',marginBottom:'6px'}}>Quand intervenir ?</h2>
                <p style={{fontSize:'13px',color:'#7A7A6E',marginBottom:'24px'}}>Le devis est accepté. Choisissez le moment.</p>
                <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                  <button onClick={confirmNow} disabled={acting} style={{padding:'18px 16px',background:'#E85D26',color:'white',border:'none',borderRadius:'16px',cursor:'pointer',display:'flex',alignItems:'center',gap:'14px',textAlign:'left',opacity:acting?0.6:1}}>
                    <span style={{fontSize:'32px',lineHeight:1}}>⚡</span>
                    <div>
                      <div style={{fontWeight:700,fontSize:'15px'}}>Maintenant</div>
                      <div style={{fontSize:'12px',opacity:0.8,marginTop:'2px'}}>L'artisan part immédiatement — suivi GPS activé</div>
                    </div>
                  </button>
                  <button onClick={() => setSchedMode('later')} style={{padding:'18px 16px',background:'rgba(255,255,255,0.06)',color:'#FAFAF5',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'16px',cursor:'pointer',display:'flex',alignItems:'center',gap:'14px',textAlign:'left'}}>
                    <span style={{fontSize:'32px',lineHeight:1}}>📅</span>
                    <div>
                      <div style={{fontWeight:700,fontSize:'15px'}}>Programmer</div>
                      <div style={{fontSize:'12px',color:'#7A7A6E',marginTop:'2px'}}>Choisir une date et une heure</div>
                    </div>
                  </button>
                </div>
              </>
            )}

            {schedMode === 'later' && (
              <>
                <button onClick={() => setSchedMode(null)} style={{background:'none',border:'none',color:'#7A7A6E',fontSize:'13px',cursor:'pointer',padding:'0 0 16px',display:'flex',alignItems:'center',gap:'4px'}}>
                  ← Retour
                </button>
                <h2 style={{fontWeight:800,fontSize:'21px',color:'#FAFAF5',marginBottom:'6px'}}>Choisir la date</h2>
                <p style={{fontSize:'13px',color:'#7A7A6E',marginBottom:'20px'}}>Sélectionnez le jour et l'heure d'intervention.</p>
                <div style={{marginBottom:'16px'}}>
                  <label style={{fontSize:'11px',fontWeight:600,color:'#7A7A6E',display:'block',marginBottom:'8px',letterSpacing:'0.08em'}}>DATE ET HEURE</label>
                  <input
                    type="datetime-local"
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    onChange={e => {
                      const val = e.target.value
                      if (val) {
                        const [d, t] = val.split('T')
                        setSchedDate(d)
                        setSchedTime(t ? t.slice(0, 5) : '')
                      }
                    }}
                    style={{
                      width:'100%', padding:'14px', borderRadius:'12px', fontSize:'15px',
                      background:'rgba(255,255,255,0.09)', color:'#FAFAF5',
                      border: schedDate && schedTime ? '1px solid #E85D26' : '1px solid rgba(255,255,255,0.15)',
                      outline:'none', boxSizing:'border-box' as const,
                    }}
                  />
                  {schedDate && schedTime && (
                    <div style={{marginTop:'10px',padding:'10px 14px',background:'rgba(232,93,38,0.12)',borderRadius:'10px',fontSize:'13px',color:'#E85D26',fontWeight:600}}>
                      📅 {new Date(`${schedDate}T${schedTime}`).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} à {schedTime}
                    </div>
                  )}
                </div>
                <button
                  onClick={confirmScheduled}
                  disabled={acting}
                  style={{width:'100%',padding:'16px',background:'#E85D26',color:'white',border:'none',borderRadius:'14px',fontSize:'15px',fontWeight:700,cursor:'pointer',opacity:acting?0.6:1}}
                >
                  {acting ? 'Confirmation…' : 'Confirmer →'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/* ──────────────────────────────────────────────────────────── */}

      {/* Header */}
      <div style={{background:'#0F1410',color:'#FAFAF5',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',maxWidth:'672px',margin:'0 auto'}}>
          <Link href={isArtisan ? '/artisan-space/dashboard' : '/dashboard'} style={{color:'#FAFAF5',display:'flex',alignItems:'center',flexShrink:0}}>
            <ArrowLeft size={18} />
          </Link>
          <div style={{width:'36px',height:'36px',background:'#1A2018',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden',flexShrink:0}}>
            {mission?.artisan_pros?.users?.avatar_url
              ? <img src={mission.artisan_pros.users.avatar_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" />
              : '🔧'}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:'14px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{artisanName}</div>
            <div style={{fontSize:'11px',color:'#7A7A6E'}}>{artisanMetier}</div>
          </div>
          {/* Badge statut */}
          <span style={{fontSize:'10px',fontWeight:600,color:statusInfo.color,background:statusInfo.bg,padding:'3px 8px',borderRadius:'20px',flexShrink:0,border:`1px solid ${statusInfo.color}33`,whiteSpace:'nowrap',maxWidth:'130px',overflow:'hidden',textOverflow:'ellipsis'}}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Formulaire devis (drawer inline) */}
      {showDevis && (
        <div style={{background:'white',borderBottom:'2px solid #E85D26',padding:'16px',flexShrink:0}}>
          <div style={{maxWidth:'672px',margin:'0 auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
              <span style={{fontWeight:700,fontSize:'15px',color:'#0F1410'}}>💰 Proposer un devis</span>
              <button onClick={() => setShowDevis(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7A7A6E'}}>
                <X size={18} />
              </button>
            </div>
            <div style={{display:'flex',gap:'10px',marginBottom:'10px'}}>
              <div style={{flex:1}}>
                <label style={{fontSize:'11px',fontWeight:600,color:'#7A7A6E',display:'block',marginBottom:'4px'}}>MONTANT (FCFA)</label>
                <input
                  type="text" inputMode="numeric"
                  value={devisAmount}
                  onChange={e => setDevisAmount(e.target.value)}
                  placeholder="Ex: 45 000"
                  className="input" style={{fontWeight:700,fontSize:'16px'}}
                />
              </div>
            </div>
            <div style={{marginBottom:'12px'}}>
              <label style={{fontSize:'11px',fontWeight:600,color:'#7A7A6E',display:'block',marginBottom:'4px'}}>DESCRIPTION DU TRAVAIL</label>
              <input
                type="text"
                value={devisDesc}
                onChange={e => setDevisDesc(e.target.value)}
                placeholder="Ex: Remplacement robinet + joints cuisine"
                className="input"
              />
            </div>
            <button onClick={sendDevis} disabled={acting}
              style={{width:'100%',padding:'12px',background:'#E85D26',color:'white',border:'none',borderRadius:'12px',fontWeight:700,fontSize:'14px',cursor:'pointer',opacity:acting?0.6:1}}>
              {acting ? 'Envoi…' : 'Envoyer le devis →'}
            </button>
          </div>
        </div>
      )}

      {/* Zone messages */}
      <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
        <div style={{maxWidth:'672px',margin:'0 auto',display:'flex',flexDirection:'column',gap:'10px'}}>
          {loading ? (
            <div style={{textAlign:'center',padding:'40px'}}>
              <div style={{width:'32px',height:'32px',border:'3px solid rgba(232,93,38,0.2)',borderTop:'3px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto'}} />
            </div>
          ) : messages.length === 0 ? (
            <div style={{textAlign:'center',padding:'40px',color:'#7A7A6E',fontSize:'14px'}}>
              <p style={{fontSize:'32px',marginBottom:'12px'}}>💬</p>
              <p style={{fontWeight:600,color:'#0F1410',marginBottom:'4px'}}>Démarrez la conversation</p>
              <p style={{fontSize:'13px'}}>Discutez des détails, puis l'artisan vous enverra un devis.</p>
            </div>
          ) : messages.map((msg: any) => {
            const isMe = msg.sender_id === user?.id

            // Message système — centré neutre
            if (msg.type === 'system') {
              return (
                <div key={msg.id} style={{textAlign:'center',padding:'8px 0'}}>
                  <span style={{fontSize:'12px',color:'#7A7A6E',background:'rgba(122,122,110,0.1)',padding:'6px 14px',borderRadius:'20px',display:'inline-block'}}>
                    {msg.text}
                  </span>
                </div>
              )
            }

            // Carte devis (quotation = valeur en base, devis = legacy)
            if (msg.type === 'quotation' || msg.type === 'devis') {
              let devisData: any = {}
              try { devisData = JSON.parse(msg.text) } catch {}
              const canAct = !isMe && status !== 'en_cours' && status !== 'completed' && status !== 'cancelled'
              return (
                <div key={msg.id} style={{display:'flex',justifyContent: isMe ? 'flex-end' : 'flex-start'}}>
                  <div style={{
                    maxWidth:'85%',border:'2px solid #E85D26',borderRadius:'16px',overflow:'hidden',
                    background:'white',boxShadow:'0 4px 16px rgba(232,93,38,0.1)',
                  }}>
                    <div style={{background:'rgba(232,93,38,0.06)',padding:'12px 16px',borderBottom:'1px solid rgba(232,93,38,0.15)'}}>
                      <div style={{fontSize:'11px',fontWeight:700,color:'#E85D26',letterSpacing:'0.05em'}}>DEVIS PROPOSÉ</div>
                    </div>
                    <div style={{padding:'16px'}}>
                      {devisData.description && (
                        <div style={{fontSize:'14px',color:'#0F1410',marginBottom:'10px',lineHeight:'1.4'}}>{devisData.description}</div>
                      )}
                      <div style={{display:'flex',alignItems:'baseline',gap:'4px',marginBottom:'16px'}}>
                        <span style={{fontFamily:'Space Mono',fontSize:'28px',fontWeight:700,color:'#0F1410'}}>{(devisData.amount||0).toLocaleString()}</span>
                        <span style={{fontSize:'13px',color:'#7A7A6E'}}>FCFA</span>
                      </div>
                      {canAct && !acting && (
                        <div style={{display:'flex',gap:'8px'}}>
                          <button onClick={() => acceptDevis(devisData.amount)} style={{flex:1,padding:'10px',background:'#2B6B3E',color:'white',border:'none',borderRadius:'10px',fontWeight:700,fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
                            <CheckCircle size={14}/> Accepter & Payer
                          </button>
                          <button onClick={refuseDevis} style={{flex:1,padding:'10px',background:'none',color:'#7A7A6E',border:'1px solid #D8D2C4',borderRadius:'10px',fontWeight:600,fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
                            <X size={14}/> Refuser
                          </button>
                        </div>
                      )}
                      {isMe && (
                        <div style={{fontSize:'12px',color:'#7A7A6E',display:'flex',alignItems:'center',gap:'4px'}}>
                          <Clock size={11} />
                          {status === 'en_cours' ? 'Accepté ✓' : status === 'negotiation' ? 'En attente de réponse…' : ''}
                        </div>
                      )}
                    </div>
                    <div style={{padding:'4px 16px 10px',fontSize:'11px',color:'#7A7A6E'}}>
                      {new Date(msg.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                </div>
              )
            }

            // Message texte normal
            return (
              <div key={msg.id} style={{display:'flex',gap:'8px',flexDirection:isMe?'row-reverse':'row',alignItems:'flex-end'}}>
                {!isMe && (
                  <div style={{width:'28px',height:'28px',background:'#0F1410',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',flexShrink:0}}>🔧</div>
                )}
                <div style={{
                  maxWidth:'78%',padding:'10px 14px',borderRadius:'16px',fontSize:'14px',lineHeight:'1.5',
                  background:isMe?'#E85D26':'white',color:isMe?'white':'#0F1410',
                  borderBottomRightRadius:isMe?'4px':'16px',borderBottomLeftRadius:isMe?'16px':'4px',
                  border:isMe?'none':'1px solid #D8D2C4',
                }}>
                  {msg.text}
                  <div style={{fontSize:'10px',marginTop:'4px',opacity:0.65,textAlign:isMe?'right':'left'}}>
                    {new Date(msg.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Zone actions bas */}
      {!isClosed ? (
        <div style={{background:'white',borderTop:'1px solid #D8D2C4',padding:'10px 16px',flexShrink:0}}>
          <div style={{maxWidth:'672px',margin:'0 auto'}}>

            {/* Bouton artisan : Proposer devis (negotiation/matching) */}
            {isArtisan && (status === 'negotiation' || status === 'matching') && !showDevis && (
              <div style={{marginBottom:'8px'}}>
                <button onClick={() => setShowDevis(true)} style={{
                  width:'100%',padding:'10px',background:'rgba(232,93,38,0.08)',
                  border:'1px dashed #E85D26',borderRadius:'10px',color:'#E85D26',
                  fontWeight:600,fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',
                }}>
                  💰 Proposer un devis
                </button>
              </div>
            )}

            {/* Les deux : bandeau date programmée (scheduled) */}
            {status === 'scheduled' && (
              <div style={{marginBottom:'8px',padding:'12px 14px',background:'rgba(201,168,76,0.08)',border:'1px solid rgba(201,168,76,0.35)',borderRadius:'12px',display:'flex',alignItems:'center',gap:'10px'}}>
                <span style={{fontSize:'20px'}}>📅</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:'13px',color:'#0F1410'}}>Intervention programmée</div>
                  <div style={{fontSize:'12px',color:'#7A7A6E',marginTop:'2px'}}>
                    {mission?.scheduled_at
                      ? `${new Date(mission.scheduled_at).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} à ${new Date(mission.scheduled_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`
                      : 'Date en cours de chargement…'}
                  </div>
                </div>
              </div>
            )}

            {/* Artisan : Démarrer le suivi (scheduled) */}
            {isArtisan && status === 'scheduled' && (
              <div style={{marginBottom:'8px'}}>
                <button onClick={async () => {
                  setActing(true)
                  const { error } = await supabase.from('missions').update({ status: 'en_route' }).eq('id', missionId)
                  if (error) { toast.error('Erreur.'); setActing(false); return }
                  setMission((prev: any) => ({ ...prev, status: 'en_route' }))
                  await supabase.from('chat_history').insert({
                    mission_id: missionId, sender_id: user.id, sender_role: userRole,
                    text: "L'artisan est en route 🚗 Suivi GPS activé", type: 'system',
                  })
                  const rid = getRecipientId(mission, user.id)
                  if (rid) notifyOther("L'artisan arrive ! Suivez-le en temps réel.", rid)
                  setActing(false)
                  router.push(`/suivi/${missionId}`)
                }} disabled={acting} style={{
                  width:'100%',padding:'12px',background:'#E85D26',color:'white',
                  border:'none',borderRadius:'12px',fontWeight:700,fontSize:'14px',cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
                  opacity: acting ? 0.6 : 1,
                }}>
                  🚗 {acting ? 'Démarrage…' : "Démarrer le suivi →"}
                </button>
              </div>
            )}

            {/* Les deux : Voir le suivi (en_route) */}
            {status === 'en_route' && (
              <div style={{marginBottom:'8px'}}>
                <Link href={`/suivi/${missionId}`} style={{
                  display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
                  width:'100%',padding:'12px',background:'#E85D26',color:'white',
                  borderRadius:'12px',fontWeight:700,fontSize:'14px',textDecoration:'none',
                }}>
                  🚗 Voir le suivi en direct →
                </Link>
              </div>
            )}

            {/* Bouton artisan : Marquer terminé (en_cours) */}
            {isArtisan && status === 'en_cours' && (
              <div style={{marginBottom:'8px'}}>
                <button onClick={markDone} disabled={acting} style={{
                  width:'100%',padding:'10px',background:'rgba(43,107,62,0.1)',
                  border:'1px solid rgba(43,107,62,0.3)',borderRadius:'10px',color:'#2B6B3E',
                  fontWeight:700,fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',
                  opacity: acting ? 0.6 : 1,
                }}>
                  <CheckCircle size={15}/> {acting ? 'En cours…' : 'Marquer la mission comme terminée'}
                </button>
              </div>
            )}

            {/* Input message — toujours présent sauf si closed */}
            <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                placeholder="Votre message…" className="input" style={{flex:1}} />
              <button onClick={send} disabled={!input.trim()}
                style={{width:'44px',height:'44px',background:'#E85D26',color:'white',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',border:'none',cursor:'pointer',flexShrink:0,opacity:input.trim()?1:0.4}}>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Mission terminée — avis client */
        <div style={{background:'#F5F0E8',borderTop:'1px solid #D8D2C4',padding:'16px',flexShrink:0}}>
          <div style={{maxWidth:'672px',margin:'0 auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginBottom:'16px'}}>
              <CheckCircle size={16} color="#2B6B3E" />
              <span style={{fontWeight:700,color:'#2B6B3E',fontSize:'14px'}}>Mission terminée</span>
            </div>

            {isArtisan ? (
              <p style={{textAlign:'center',fontSize:'13px',color:'#7A7A6E'}}>Bravo ! La mission est bouclée.</p>
            ) : hasReviewed ? (
              <div style={{textAlign:'center',padding:'16px',background:'white',borderRadius:'14px',border:'1px solid #D8D2C4'}}>
                <div style={{display:'flex',justifyContent:'center',gap:'4px',marginBottom:'8px'}}>
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={18} fill={s <= rating ? '#C9A84C' : 'none'} color={s <= rating ? '#C9A84C' : '#D8D2C4'} />
                  ))}
                </div>
                <p style={{fontSize:'14px',fontWeight:600,color:'#0F1410',marginBottom:'4px'}}>Merci pour votre avis !</p>
                <p style={{fontSize:'12px',color:'#7A7A6E'}}>Votre retour est visible sur le profil de l'artisan.</p>
              </div>
            ) : (
              <div style={{background:'white',borderRadius:'16px',padding:'16px',border:'1px solid #D8D2C4'}}>
                <div style={{fontWeight:700,fontSize:'15px',color:'#0F1410',marginBottom:'4px'}}>Comment s'est passée la mission ?</div>
                <p style={{fontSize:'13px',color:'#7A7A6E',marginBottom:'16px'}}>Votre avis aide l'artisan et les futurs clients.</p>

                {/* Étoiles */}
                <div style={{display:'flex',gap:'6px',justifyContent:'center',marginBottom:'8px'}}>
                  {[1,2,3,4,5].map(s => (
                    <button key={s}
                      onClick={() => setRating(s)}
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                      style={{background:'none',border:'none',cursor:'pointer',padding:'4px',lineHeight:0}}
                    >
                      <Star size={36}
                        fill={(hoverRating || rating) >= s ? '#C9A84C' : 'none'}
                        color={(hoverRating || rating) >= s ? '#C9A84C' : '#D8D2C4'}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <div style={{textAlign:'center',fontSize:'13px',fontWeight:600,color:'#C9A84C',marginBottom:'14px'}}>
                    {['','😞 Décevant','😐 Peut mieux faire','🙂 Correct','😊 Très bien','🤩 Excellent !'][rating]}
                  </div>
                )}

                <textarea
                  value={reviewText}
                  onChange={e => setReviewText(e.target.value)}
                  placeholder="Décrivez votre expérience (optionnel)…"
                  rows={3}
                  style={{width:'100%',padding:'10px 12px',border:'1px solid #D8D2C4',borderRadius:'10px',
                    fontSize:'14px',resize:'none',fontFamily:'inherit',outline:'none',
                    boxSizing:'border-box',marginBottom:'12px',color:'#0F1410'}}
                />
                <button
                  onClick={submitReview}
                  disabled={submittingReview || rating === 0}
                  style={{width:'100%',padding:'13px',
                    background: rating > 0 ? '#E85D26' : '#D8D2C4',
                    color:'white',border:'none',borderRadius:'12px',
                    fontWeight:700,fontSize:'14px',
                    cursor: rating > 0 ? 'pointer' : 'default',
                    opacity: submittingReview ? 0.6 : 1}}
                >
                  {submittingReview ? 'Envoi…' : 'Publier mon avis →'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
