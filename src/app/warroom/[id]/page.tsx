'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Send, Phone, Shield } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function WarRoomPage() {
  const params = useParams()
  const router = useRouter()
  const missionId = params.id as string
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('client')
  const [mission, setMission] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  usePushNotifications(user?.id || null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      setUser(session.user)
      const { data: userData } = await supabase.from('users').select('role').eq('id', session.user.id).single()
      setUserRole(userData?.role ?? session.user.user_metadata?.role ?? 'client')
      const { data: missionData } = await supabase
        .from('missions').select('*, artisan_pros(*, users(name))').eq('id', missionId).single()
      setMission(missionData)
      const { data: msgs } = await supabase
        .from('chat_history').select('*, users(name)').eq('mission_id', missionId).order('created_at', { ascending: true })
      setMessages(msgs || [])
      setLoading(false)
    }
    init()
    const channel = supabase.channel(`mission-${missionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_history', filter: `mission_id=eq.${missionId}` },
        payload => setMessages(prev => [...prev, payload.new]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [missionId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!input.trim() || !user) return
    const text = input.trim()
    setInput('')
    const { error: sendError } = await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id,
      sender_role: userRole, text, type: 'text',
    })
    if (sendError) {
      console.error('Erreur envoi message:', sendError)
      toast.error('Message non envoyé. Réessayez.')
      setInput(text)
      return
    }

    // Notifier l'autre partie
    if (mission) {
      const recipientId = user.id === mission.client_id
        ? mission.artisan_pros?.user_id
        : mission.client_id
      if (recipientId) {
        fetch('/api/push-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: recipientId,
            title: 'Nouveau message AfriOne',
            body: text.length > 50 ? text.substring(0, 50) + '...' : text,
            url: `https://afrione-sepia.vercel.app/warroom/${missionId}`,
          }),
        }).catch(() => {})
      }
    }
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:'#F5F0E8'}}>
      <div style={{background:'#0F1410',color:'#FAFAF5',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 16px',maxWidth:'672px',margin:'0 auto'}}>
          <Link href={userRole === 'artisan' ? '/artisan-space/dashboard' : '/dashboard'} style={{color:'#FAFAF5',display:'flex'}}><ArrowLeft size={18} /></Link>
          <div style={{width:'40px',height:'40px',background:'#1A2018',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',border:'1px solid rgba(255,255,255,0.1)'}}>🔧</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:'15px'}}>{mission?.artisan_pros?.users?.name || 'Artisan'}</div>
            <div style={{fontSize:'12px',color:'#2B6B3E',display:'flex',alignItems:'center',gap:'4px'}}>
              <span style={{width:'6px',height:'6px',background:'#2B6B3E',borderRadius:'50%',display:'inline-block'}} /> En ligne
            </div>
          </div>
          <button style={{width:'36px',height:'36px',background:'rgba(43,107,62,0.2)',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',border:'none',cursor:'pointer'}}>
            <Phone size={16} color="#2B6B3E" />
          </button>
        </div>
      </div>

      <div style={{background:'rgba(201,168,76,0.1)',borderBottom:'1px solid rgba(201,168,76,0.2)',padding:'10px 16px',flexShrink:0}}>
        <div style={{maxWidth:'672px',margin:'0 auto',display:'flex',alignItems:'center',gap:'8px',fontSize:'13px'}}>
          <Shield size={14} color="#2B6B3E" />
          <span style={{color:'#0F1410',fontWeight:500}}>Mission · Paiement sécurisé Wave</span>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
        <div style={{maxWidth:'672px',margin:'0 auto',display:'flex',flexDirection:'column',gap:'12px'}}>
          {loading ? (
            <div style={{textAlign:'center',padding:'40px'}}>
              <div style={{width:'32px',height:'32px',border:'3px solid rgba(232,93,38,0.2)',borderTop:'3px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto'}} />
            </div>
          ) : messages.length === 0 ? (
            <div style={{textAlign:'center',padding:'40px',color:'#7A7A6E',fontSize:'14px'}}>
              <p style={{fontSize:'32px',marginBottom:'12px'}}>💬</p>
              <p>Démarrez la conversation</p>
            </div>
          ) : messages.map((msg: any) => {
            const isMe = msg.sender_id === user?.id
            return (
              <div key={msg.id} style={{display:'flex',gap:'8px',flexDirection:isMe?'row-reverse':'row'}}>
                {!isMe && <div style={{width:'32px',height:'32px',background:'#0F1410',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',flexShrink:0,marginTop:'4px'}}>🔧</div>}
                <div style={{maxWidth:'80%',padding:'12px 16px',borderRadius:'16px',fontSize:'14px',lineHeight:'1.5',
                  background:isMe?'#E85D26':'white',color:isMe?'white':'#0F1410',
                  borderTopRightRadius:isMe?'4px':'16px',borderTopLeftRadius:isMe?'16px':'4px',
                  border:isMe?'none':'1px solid #D8D2C4'}}>
                  {msg.text}
                  <div style={{fontSize:'11px',marginTop:'4px',opacity:0.7,textAlign:isMe?'right':'left'}}>
                    {new Date(msg.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <div style={{background:'white',borderTop:'1px solid #D8D2C4',padding:'12px 16px',flexShrink:0}}>
        <div style={{maxWidth:'672px',margin:'0 auto',display:'flex',gap:'12px',alignItems:'center'}}>
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Votre message..." className="input" style={{flex:1}} />
          <button onClick={send} disabled={!input.trim()}
            style={{width:'44px',height:'44px',background:'#E85D26',color:'white',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',border:'none',cursor:'pointer',flexShrink:0,opacity:input.trim()?1:0.4}}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
