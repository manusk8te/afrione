'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Send, Phone, MapPin, Clock, CheckCircle, Zap, FileText, Camera, X, Shield } from 'lucide-react'

type Msg = {
  id: string
  sender: 'client' | 'artisan' | 'system'
  text?: string
  type: 'text' | 'devis' | 'system'
  time: string
  devis?: { items: { label: string; qty: number; prix: number }[]; total: number; duree: string }
}

const INIT_MSGS: Msg[] = [
  {
    id: '1', sender: 'system', type: 'system',
    text: 'Kouadio Brou Emmanuel a accepté votre demande. Discutez du devis avant paiement.',
    time: '14:32',
  },
  {
    id: '2', sender: 'artisan', type: 'text',
    text: 'Bonjour ! J\'ai bien reçu votre demande concernant la fuite sous l\'évier. Pouvez-vous m\'envoyer une photo du problème ?',
    time: '14:33',
  },
  {
    id: '3', sender: 'client', type: 'text',
    text: 'Bonjour ! Voici une photo. L\'eau coule depuis ce matin, ça empire.',
    time: '14:35',
  },
  {
    id: '4', sender: 'artisan', type: 'text',
    text: 'Je vois, c\'est le joint du siphon qui est usé. Je peux intervenir aujourd\'hui à 17h. Voici mon devis :',
    time: '14:37',
  },
  {
    id: '5', sender: 'artisan', type: 'devis',
    time: '14:37',
    devis: {
      items: [
        { label: 'Main d\'œuvre (2h)', qty: 1, prix: 12000 },
        { label: 'Joint d\'étanchéité', qty: 2, prix: 1500 },
        { label: 'Siphon PVC', qty: 1, prix: 4500 },
      ],
      total: 19500,
      duree: '1h30 – 2h',
    },
  },
]

export default function WarRoomPage() {
  const params = useParams()
  const [msgs, setMsgs] = useState<Msg[]>(INIT_MSGS)
  const [input, setInput] = useState('')
  const [devisAccepted, setDevisAccepted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  const send = () => {
    if (!input.trim()) return
    const newMsg: Msg = {
      id: Date.now().toString(), sender: 'client', type: 'text',
      text: input.trim(), time: new Date().toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' }),
    }
    setMsgs(m => [...m, newMsg])
    setInput('')

    // Simulated artisan response
    setTimeout(() => {
      setMsgs(m => [...m, {
        id: (Date.now() + 1).toString(), sender: 'artisan', type: 'text',
        text: 'Bien reçu, je prends note. Je serai là à 17h précises.',
        time: new Date().toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' }),
      }])
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col" style={{ height: '100dvh' }}>

      {/* Header */}
      <div className="bg-dark text-cream border-b border-border/20 flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <Link href="/matching" className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="w-10 h-10 bg-dark2 rounded-xl flex items-center justify-center text-xl border border-border/30">🔧</div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold truncate">Kouadio Brou Emmanuel</div>
            <div className="flex items-center gap-1 text-xs text-accent2">
              <span className="w-1.5 h-1.5 bg-accent2 rounded-full animate-pulse-soft" />
              En ligne · Plombier
            </div>
          </div>
          <div className="flex gap-2">
            <button className="w-9 h-9 bg-accent2/20 rounded-xl flex items-center justify-center hover:bg-accent2/30 transition-colors">
              <Phone size={16} className="text-accent2" />
            </button>
            <Link
              href={`/suivi/${params.id}`}
              className="flex items-center gap-1.5 text-xs bg-accent px-3 py-2 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
            >
              <MapPin size={12} /> Suivi GPS
            </Link>
          </div>
        </div>
      </div>

      {/* Mission status bar */}
      <div className="bg-gold/10 border-b border-gold/20 px-4 py-2.5 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex items-center gap-3 text-sm">
          <Clock size={14} className="text-gold flex-shrink-0" />
          <span className="text-dark font-medium">Mission #AF-2847 · Intervention prévue aujourd'hui à 17h00</span>
          <span className="ml-auto flex items-center gap-1 text-xs text-muted">
            <Shield size={12} className="text-accent2" /> Paiement sécurisé
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {msgs.map(msg => (
            <div key={msg.id}>
              {/* System message */}
              {msg.type === 'system' && (
                <div className="text-center">
                  <span className="text-xs text-muted bg-bg2 border border-border px-3 py-1.5 rounded-full">
                    {msg.text}
                  </span>
                </div>
              )}

              {/* Chat message */}
              {msg.type === 'text' && (
                <div className={`flex gap-2 ${msg.sender === 'client' ? 'flex-row-reverse' : ''}`}>
                  {msg.sender === 'artisan' && (
                    <div className="w-8 h-8 bg-dark rounded-xl flex items-center justify-center text-sm flex-shrink-0 mt-1">🔧</div>
                  )}
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === 'client'
                      ? 'bg-accent text-white rounded-tr-sm'
                      : 'bg-white border border-border text-dark rounded-tl-sm'
                  }`}>
                    {msg.text}
                    <div className={`text-xs mt-1 ${msg.sender === 'client' ? 'text-white/60' : 'text-muted'}`}>
                      {msg.time}
                    </div>
                  </div>
                </div>
              )}

              {/* Devis card */}
              {msg.type === 'devis' && msg.devis && (
                <div className="flex gap-2">
                  <div className="w-8 h-8 bg-dark rounded-xl flex items-center justify-center text-sm flex-shrink-0 mt-1">🔧</div>
                  <div className="flex-1 max-w-sm">
                    <div className="bg-white border border-border rounded-2xl rounded-tl-sm overflow-hidden shadow-sm">
                      <div className="bg-dark px-4 py-3 flex items-center gap-2">
                        <FileText size={14} className="text-accent" />
                        <span className="text-cream text-sm font-semibold">Devis proposé</span>
                        <span className="text-muted text-xs ml-auto">{msg.time}</span>
                      </div>
                      <div className="p-4">
                        <div className="space-y-2 mb-3">
                          {msg.devis.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-muted">{item.label}</span>
                              <span className="font-medium text-dark">{(item.qty * item.prix).toLocaleString()} FCFA</span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-border pt-3 flex justify-between items-center">
                          <div>
                            <div className="font-mono text-xs text-muted">TOTAL</div>
                            <div className="font-display text-2xl font-bold text-dark">{msg.devis.total.toLocaleString()} FCFA</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-xs text-muted">DURÉE</div>
                            <div className="text-sm font-semibold text-dark">{msg.devis.duree}</div>
                          </div>
                        </div>

                        {!devisAccepted ? (
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => setDevisAccepted(true)}
                              className="flex-1 bg-accent2 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                            >
                              <CheckCircle size={14} /> Accepter
                            </button>
                            <button className="flex-1 border border-border text-muted text-sm font-semibold py-2.5 rounded-xl hover:bg-bg2 transition-colors flex items-center justify-center gap-1">
                              <X size={14} /> Négocier
                            </button>
                          </div>
                        ) : (
                          <div className="mt-4">
                            <div className="flex items-center gap-2 text-accent2 text-sm font-medium mb-3">
                              <CheckCircle size={16} /> Devis accepté
                            </div>
                            <Link
                              href={`/paiement/${params.id}`}
                              className="block w-full bg-dark text-cream text-sm font-semibold py-3 rounded-xl hover:bg-accent transition-colors text-center flex items-center justify-center gap-2"
                            >
                              <Zap size={14} /> Procéder au paiement
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-border px-4 py-3 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <button className="w-10 h-10 flex items-center justify-center text-muted hover:text-dark hover:bg-bg2 rounded-xl transition-colors flex-shrink-0">
            <Camera size={20} />
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Votre message..."
            className="input flex-1"
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="w-10 h-10 bg-accent text-white rounded-xl flex items-center justify-center hover:bg-orange-600 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
