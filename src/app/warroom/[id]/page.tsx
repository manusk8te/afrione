'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Send, CheckCircle, X, Zap, Clock, AlertCircle } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  negotiation: { label: '💬 En discussion', color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
  matching:    { label: '🔔 Nouvelle demande', color: '#E85D26', bg: 'rgba(232,93,38,0.1)' },
  en_cours:    { label: '⚡ Mission en cours', color: '#2B6B3E', bg: 'rgba(43,107,62,0.12)' },
  payment:     { label: '💳 En attente de paiement', color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
  completed:   { label: '✅ Mission terminée', color: '#2B6B3E', bg: 'rgba(43,107,62,0.1)' },
  cancelled:   { label: '✗ Annulée', color: '#7A7A6E', bg: 'rgba(122,122,110,0.1)' },
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
        .select('*, artisan_pros(id, user_id, metier, users(name, avatar_url))')
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
      sender_role: userRole, text: payload, type: 'devis',
    })
    if (error) { toast.error('Erreur envoi devis.'); setActing(false); return }
    const rid = getRecipientId(mission, user.id)
    if (rid) notifyOther(`Devis proposé : ${amount.toLocaleString()} FCFA`, rid)
    setShowDevis(false)
    setDevisAmount('')
    setDevisDesc('')
    setActing(false)
  }

  // Client accepte le devis
  const acceptDevis = async () => {
    setActing(true)
    const { error } = await supabase
      .from('missions')
      .update({ status: 'en_cours', started_at: new Date().toISOString() })
      .eq('id', missionId)
    if (error) { toast.error('Erreur.'); setActing(false); return }
    await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id,
      sender_role: userRole, text: 'Devis accepté — mission démarrée ✅', type: 'system',
    })
    const rid = getRecipientId(mission, user.id)
    if (rid) notifyOther('Le client a accepté votre devis — mission démarrée !', rid)
    toast.success('Mission démarrée !')
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

  // Artisan marque terminé
  const markDone = async () => {
    setActing(true)
    const { error } = await supabase
      .from('missions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', missionId)
    if (error) { toast.error('Erreur.'); setActing(false); return }
    await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id,
      sender_role: userRole, text: 'Mission marquée comme terminée ✅ Merci pour votre confiance !', type: 'system',
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

      {/* Header */}
      <div style={{background:'#0F1410',color:'#FAFAF5',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 16px',maxWidth:'672px',margin:'0 auto'}}>
          <Link href={isArtisan ? '/artisan-space/dashboard' : '/dashboard'} style={{color:'#FAFAF5',display:'flex',alignItems:'center'}}>
            <ArrowLeft size={18} />
          </Link>
          <div style={{width:'40px',height:'40px',background:'#1A2018',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden',flexShrink:0}}>
            {mission?.artisan_pros?.users?.avatar_url
              ? <img src={mission.artisan_pros.users.avatar_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" />
              : '🔧'}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:'15px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{artisanName}</div>
            <div style={{fontSize:'12px',color:'#7A7A6E'}}>{artisanMetier}</div>
          </div>
          {/* Badge statut */}
          <span style={{fontSize:'11px',fontWeight:600,color:statusInfo.color,background:statusInfo.bg,padding:'4px 10px',borderRadius:'20px',flexShrink:0,border:`1px solid ${statusInfo.color}33`}}>
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

            // Carte devis
            if (msg.type === 'devis') {
              let devisData: any = {}
              try { devisData = JSON.parse(msg.text) } catch {}
              const canAct = !isMe && !isArtisan && status === 'negotiation'
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
                          <button onClick={acceptDevis} style={{flex:1,padding:'10px',background:'#2B6B3E',color:'white',border:'none',borderRadius:'10px',fontWeight:700,fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
                            <CheckCircle size={14}/> Accepter
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
        /* Mission terminée — écran de clôture */
        <div style={{background:'rgba(43,107,62,0.08)',borderTop:'1px solid rgba(43,107,62,0.2)',padding:'16px',flexShrink:0,textAlign:'center'}}>
          <div style={{maxWidth:'672px',margin:'0 auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginBottom:'8px'}}>
              <CheckCircle size={18} color="#2B6B3E" />
              <span style={{fontWeight:700,color:'#2B6B3E',fontSize:'14px'}}>Mission terminée</span>
            </div>
            {!isArtisan && (
              <p style={{fontSize:'13px',color:'#7A7A6E'}}>Vous pouvez laisser un avis sur le profil de l'artisan.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
