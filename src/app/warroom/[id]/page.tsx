'use client'
export const dynamic = 'force-dynamic'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Send, CheckCircle, X, Zap, Clock, Star, Camera, Plus } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

function materialEmoji(name: string): string {
  const n = name.toLowerCase()
  if (/robinet|mitigeur|mélangeur/.test(n)) return '🚿'
  if (/tuyau|tube|pvc|flexible/.test(n)) return '🔧'
  if (/joint|torique/.test(n)) return '🔩'
  if (/siphon|bonde/.test(n)) return '🔧'
  if (/câble|fil électrique/.test(n)) return '⚡'
  if (/disjoncteur|différentiel|interrupteur/.test(n)) return '🔌'
  if (/prise|tableau/.test(n)) return '🔌'
  if (/ampoule|led/.test(n)) return '💡'
  if (/ciment|béton|mortier|sac/.test(n)) return '🧱'
  if (/carrelage|dalle|faïence/.test(n)) return '🟦'
  if (/peinture|laque|enduit|apprêt/.test(n)) return '🎨'
  if (/rouleau|pinceau|bâche/.test(n)) return '🖌️'
  if (/porte|fenêtre/.test(n)) return '🚪'
  if (/serrure|cadenas|verrou/.test(n)) return '🔑'
  if (/clim|climatiseur|filtre/.test(n)) return '❄️'
  if (/vis|boulon|cheville/.test(n)) return '🔩'
  if (/bois|planche/.test(n)) return '🪵'
  return '🔧'
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  negotiation: { label: '💬 En discussion',          color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
  matching:    { label: '🔔 Nouvelle demande',        color: '#E85D26', bg: 'rgba(232,93,38,0.1)'  },
  scheduled:   { label: '📅 Intervention programmée', color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
  en_route:    { label: '🚗 En route',                color: '#E85D26', bg: 'rgba(232,93,38,0.1)'  },
  en_cours:    { label: '⚡ Mission en cours',        color: '#2B6B3E', bg: 'rgba(43,107,62,0.12)' },
  payment:     { label: '💳 Paiement',               color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
  completed:   { label: '✅ Mission terminée',        color: '#2B6B3E', bg: 'rgba(43,107,62,0.1)'  },
  disputed:    { label: '⚠️ Litige en cours',         color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
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
  const [missionRole, setMissionRole] = useState<'client'|'artisan'|'admin'>('client')
  const [sending, setSending]         = useState(false)
  const [mission, setMission]         = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [acting, setActing]           = useState(false)

  // Formulaire devis
  const [showDevis, setShowDevis]     = useState(false)
  const [devisAmount, setDevisAmount] = useState('')
  const [devisDesc, setDevisDesc]     = useState('')
  const [pricingSuggestion, setPricingSuggestion] = useState<{
    estimate: number
    interval: { low: number; high: number }
    decomp: { labor: number; materials: number; transport: number; premium: number }
    market_reference_fcfa?: number
    savings_vs_market?: number
    below_market?: boolean
  } | null>(null)
  const [pricingSugLoading, setPricingSugLoading] = useState(false)

  // Proximité vendeur physique pour les matériaux (artisan side)
  const [materialsProximity, setMaterialsProximity] = useState<any[]>([])

  // Avis post-mission
  const [rating, setRating]               = useState(0)
  const [hoverRating, setHoverRating]     = useState(0)
  const [reviewText, setReviewText]       = useState('')
  const [hasReviewed, setHasReviewed]     = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)

  // Fiche technique diagnostic
  const [diagData, setDiagData]           = useState<any>(null)
  const [showDiagPanel, setShowDiagPanel] = useState(true)

  // Mise à jour matériaux achetés (artisan, mission en cours)
  const [showMatUpdate, setShowMatUpdate]     = useState(false)
  const [purchasedMats, setPurchasedMats]     = useState<{name:string;qty:number;prix_unitaire:number}[]>([])
  const [newMatName, setNewMatName]           = useState('')
  const [newMatQty, setNewMatQty]             = useState('1')
  const [newMatPrix, setNewMatPrix]           = useState('')
  const [diagChangeNote, setDiagChangeNote]   = useState('')
  const [sendingMatUpdate, setSendingMatUpdate] = useState(false)

  // Matériau non prévu — lookup IA + signal dans le chat
  const [showMatSuggest, setShowMatSuggest] = useState(false)
  const [suggestName, setSuggestName]       = useState('')
  const [suggestQty, setSuggestQty]         = useState('1')
  const [lookingUp, setLookingUp]           = useState(false)

  // Requalification du temps
  const [showTimeAdj, setShowTimeAdj]   = useState(false)
  const [adjHours, setAdjHours]         = useState('')
  const [adjReason, setAdjReason]       = useState('')

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

  const isArtisan = missionRole === 'artisan' || missionRole === 'admin'

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
        .select('*, scheduled_at, artisan_pros(id, user_id, metier, users(name, avatar_url, phone)), users!missions_client_id_fkey(name, avatar_url)')
        .eq('id', missionId)
        .single()
      setMission(missionData)

      // Role dans CETTE mission (indépendant du rôle global du profil)
      const globalRole = userData?.role ?? 'client'
      const mr: 'client'|'artisan'|'admin' =
        missionData?.artisan_pros?.user_id === session.user.id && missionData?.client_id !== session.user.id
        ? 'artisan'
        : missionData?.client_id === session.user.id
        ? 'client'
        : globalRole === 'admin'
        ? 'admin'
        : 'client'
      setMissionRole(mr)

      const { data: msgs } = await supabase
        .from('chat_history')
        .select('*, users(name, avatar_url)')
        .eq('mission_id', missionId)
        .order('created_at', { ascending: true })

      setMessages(msgs || [])

      // Charger le diagnostic : fiche pour l'artisan + résumé pré-rempli pour le client
      try {
        const diagRes = await fetch(`/api/mission-brief?mission_id=${missionId}`)
        if (diagRes.ok) {
          const diagJson = await diagRes.json()
          if (diagJson.diag) {
            const diag = diagJson.diag
            // Normalize items_needed to string[] for rendering
            if (Array.isArray(diag.items_needed)) {
              diag.items_needed = diag.items_needed.map((it: any) =>
                typeof it === 'string' ? it : it.name || String(it)
              )
            }
            setDiagData(diag)
            if (mr === 'client') {
              setInput(diag.ai_summary || '')
            }
            // Charger les liens d'achat des matériaux dès l'init (artisan uniquement)
            if (mr !== 'client' && diag.items_needed?.length) {
              const clientQ = missionData?.quartier || 'Cocody'
              fetch(`/api/materials?category=${encodeURIComponent(diag.category || 'Plomberie')}&items=${encodeURIComponent(diag.items_needed.join(','))}&client_quartier=${encodeURIComponent(clientQ)}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => { if (data?.materials) setMaterialsProximity(data.materials) })
                .catch(() => {})
            }
          }
        }
      } catch {}

      // Marquer lus
      await supabase
        .from('chat_history')
        .update({ read_at: new Date().toISOString() })
        .eq('mission_id', missionId)
        .neq('sender_id', session.user.id)
        .is('read_at', null)

      // Vérifier si le client a déjà laissé un avis pour cette mission
      if (mr !== 'artisan') {
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
    if (!input.trim() || !user || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    const { error } = await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id,
      sender_role: missionRole, text, type: 'text',
    })
    setSending(false)
    if (error) { toast.error('Message non envoyé.'); setInput(text); return }
    const rid = getRecipientId(mission, user.id)
    if (rid) notifyOther(text, rid)
  }

  // Ouvrir le formulaire devis + charger suggestion + tiers matériaux
  // Borne basse d'une durée texte : "1 à 3 heures" → 1, "30 min" → 0.5, "1h30" → 1.5
  const parseDurLow = (s: string): number => {
    if (!s) return 2
    const lower = s.toLowerCase()
    const minMatch = lower.match(/(\d+)\s*min/)
    if (minMatch && !lower.includes('heure') && !lower.match(/\d+\s*h\S*\s+\d+/))
      return Math.max(0.25, parseInt(minMatch[1]) / 60)
    const hMinMatch = lower.match(/(\d+)\s*h\S*\s*(\d+)/)
    if (hMinMatch) return parseInt(hMinMatch[1]) + parseInt(hMinMatch[2]) / 60
    const rangeMatch = lower.match(/(\d+(?:\.\d+)?)\s*[àa-]\s*(\d+(?:\.\d+)?)/)
    if (rangeMatch) return parseFloat(rangeMatch[1])   // borne basse
    const nums = s.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? []
    return nums.length ? nums[0] : 2
  }

  // Charge la suggestion de prix sans ouvrir le drawer devis
  const loadPricingSuggestion = async () => {
    if (pricingSuggestion || pricingSugLoading || !diagData) return
    setPricingSugLoading(true)

    if (diagData.items_needed?.length && !materialsProximity.length) {
      const clientQ = mission?.quartier || 'Cocody'
      fetch(`/api/materials?category=${encodeURIComponent(diagData.category || 'Plomberie')}&items=${encodeURIComponent((diagData.items_needed || []).join(','))}&client_quartier=${encodeURIComponent(clientQ)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.materials) setMaterialsProximity(data.materials) })
        .catch(() => {})
    }

    const metierMap: Record<string, string> = {
      'Plomberie':'Plombier','Électricité':'Électricien','Peinture':'Peintre',
      'Maçonnerie':'Maçon','Menuiserie':'Menuisier','Climatisation':'Climaticien',
      'Serrurerie':'Serrurier','Carrelage':'Carreleur',
    }
    try {
      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metier:         metierMap[diagData.category] || 'Maçon',
          category:       diagData.category || 'Maçonnerie',
          urgency:        diagData.urgency  || 'medium',
          duration_hours: parseDurLow(diagData.duration_estimate || '2 heures'),
          quartier:       mission?.quartier || 'Cocody',
          items_needed:   diagData.items_needed || [],
        }),
      })
      if (res.ok) {
        const d = await res.json()
        setPricingSuggestion({
          estimate: d.estimate,
          interval: d.interval,
          decomp: {
            labor:     d.decomposition.labor.median,
            materials: d.decomposition.materials.median,
            transport: d.decomposition.transport.median,
            premium:   d.decomposition.premium.median,
          },
          market_reference_fcfa: d.market_reference_fcfa,
          savings_vs_market:     d.savings_vs_market,
          below_market:          d.below_market,
        })
      }
    } catch {}
    setPricingSugLoading(false)
  }

  const openDevis = async () => {
    setShowDevis(true)
    await loadPricingSuggestion()
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
      sender_role: missionRole, text: payload, type: 'quotation',
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
      mission_id: missionId, sender_id: user.id, sender_role: missionRole,
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
      mission_id: missionId, sender_id: user.id, sender_role: missionRole,
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
      mission_id: missionId, sender_id: user.id, sender_role: missionRole,
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
      sender_role: missionRole, text: 'Devis refusé — une contre-proposition est possible.', type: 'system',
    })
    toast('Devis refusé.')
    setActing(false)
  }

  // Artisan soumet les matériaux achetés (mise à jour diagnostic)
  const addPurchasedMat = () => {
    if (!newMatName.trim() || !newMatPrix) return
    setPurchasedMats(ms => [...ms, {
      name: newMatName.trim(),
      qty: parseInt(newMatQty) || 1,
      prix_unitaire: parseInt(newMatPrix),
    }])
    setNewMatName(''); setNewMatQty('1'); setNewMatPrix('')
  }

  const sendMatUpdate = async () => {
    if (!purchasedMats.length) { toast.error('Ajoutez au moins un matériau'); return }
    setSendingMatUpdate(true)
    const laborFixed = pricingSuggestion?.decomp.labor ?? 0
    const matTotal   = purchasedMats.reduce((s, m) => s + m.qty * m.prix_unitaire, 0)
    const payload = JSON.stringify({
      labor_fixed:     laborFixed,
      materials:       purchasedMats,
      diag_change_note: diagChangeNote.trim() || null,
      total:           laborFixed + matTotal,
    })
    const { error } = await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id,
      sender_role: missionRole, text: payload, type: 'material_update',
    })
    if (error) { toast.error('Erreur envoi.'); setSendingMatUpdate(false); return }
    const rid = getRecipientId(mission, user.id)
    if (rid) notifyOther(`Mise à jour matériaux — total: ${(laborFixed + matTotal).toLocaleString('fr')} FCFA`, rid)
    setShowMatUpdate(false)
    setPurchasedMats([])
    setDiagChangeNote('')
    setSendingMatUpdate(false)
    toast.success('Matériaux mis à jour !')
  }

  // Lookup prix d'un matériau — DB d'abord puis Jumia CI on-demand (scraping réel)
  const lookupMatPrice = async (name: string): Promise<{
    price: number; web_price: number | null; source: string | null
    photo_url: string | null; source_url: string | null
    product_name: string | null; brand: string | null; from_db: boolean
  }> => {
    const cat = diagData?.category || 'Plomberie'
    try {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category: cat }),
      })
      if (!res.ok) return { price: 0, web_price: null, source: null, photo_url: null, source_url: null, product_name: null, brand: null, from_db: false }
      const d = await res.json()
      if (!d.found) return { price: 0, web_price: null, source: null, photo_url: null, source_url: null, product_name: null, brand: null, from_db: false }
      return {
        price:        d.price_market || 0,
        web_price:    d.web_price    || null,
        source:       d.source       || null,
        photo_url:    d.photo_url    || null,
        source_url:   d.source_url   || null,
        product_name: d.name         || null,
        brand:        d.brand        || null,
        from_db:      d.from_db      ?? true,
      }
    } catch { return { price: 0, web_price: null, source: null, photo_url: null, source_url: null, product_name: null, brand: null, from_db: false } }
  }

  // Artisan signale un matériau non prévu → lookup prix → message material_suggest
  const sendMatSuggest = async () => {
    if (!suggestName.trim()) return
    setLookingUp(true)
    const qty    = parseInt(suggestQty) || 1
    const lookup = await lookupMatPrice(suggestName.trim())
    const payload = JSON.stringify({
      name:         suggestName.trim(),
      product_name: lookup.product_name,   // nom exact Jumia si trouvé
      brand:        lookup.brand,
      qty,
      price_market: lookup.price,
      web_price:    lookup.web_price,       // prix Jumia (retail)
      photo_url:    lookup.photo_url,
      source_url:   lookup.source_url,
      source:       lookup.source,
      from_db:      lookup.from_db,
      total:        lookup.price * qty,
    })
    const { error } = await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id,
      sender_role: missionRole, text: payload, type: 'material_suggest',
    })
    if (!error) {
      const rid = getRecipientId(mission, user.id)
      if (rid) notifyOther(`Matériau non prévu : ${suggestName.trim()} (×${qty}) — ~${(lookup.price * qty).toLocaleString('fr')} FCFA`, rid)
    }
    setSuggestName(''); setSuggestQty('1')
    setShowMatSuggest(false)
    setLookingUp(false)
  }

  // Artisan requalifie le temps — ajuste la MO
  const sendTimeAdj = async () => {
    const extra = parseFloat(adjHours)
    if (!extra || extra <= 0) return
    const baseDur   = parseDurLow(diagData?.duration_estimate || '2 heures')
    const baseLabor = pricingSuggestion?.decomp.labor ?? 0
    const hourlyRate = baseDur > 0 ? baseLabor / baseDur : 2500
    const laborImpact = Math.round(extra * hourlyRate)
    const payload = JSON.stringify({
      extra_hours:  extra,
      reason:       adjReason.trim() || null,
      labor_impact: laborImpact,
      hourly_rate:  Math.round(hourlyRate),
    })
    const { error } = await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id,
      sender_role: missionRole, text: payload, type: 'time_adjust',
    })
    if (!error) {
      const rid = getRecipientId(mission, user.id)
      if (rid) notifyOther(`Temps ajusté +${extra}h — impact MO : +${laborImpact.toLocaleString('fr')} FCFA`, rid)
    }
    setAdjHours(''); setAdjReason('')
    setShowTimeAdj(false)
  }

  // Artisan envoie la proposition finale — construite depuis les messages accumulés
  const sendFinalProposal = async () => {
    // S'assurer que le pricing est chargé avant de construire la proposition
    if (!pricingSuggestion) await loadPricingSuggestion()
    const matSuggests = messages
      .filter(m => m.type === 'material_suggest' && m.sender_role !== 'client')
      .map(m => { try { return JSON.parse(m.text) } catch { return null } })
      .filter(Boolean)
    const timeAdjs = messages
      .filter(m => m.type === 'time_adjust' && m.sender_role !== 'client')
      .map(m => { try { return JSON.parse(m.text) } catch { return null } })
      .filter(Boolean)

    const baseEstimate    = pricingSuggestion?.estimate ?? 0
    const extraMatTotal   = matSuggests.reduce((s: number, m: any) => s + (m.total || 0), 0)
    const extraLaborTotal = timeAdjs.reduce((s: number, t: any) => s + (t.labor_impact || 0), 0)
    const total           = baseEstimate + extraMatTotal + extraLaborTotal

    const payload = JSON.stringify({
      base_estimate:     baseEstimate,
      extra_materials:   matSuggests,
      time_adjustments:  timeAdjs,
      extra_mat_total:   extraMatTotal,
      extra_labor_total: extraLaborTotal,
      total,
      decomp: pricingSuggestion?.decomp,
    })
    setActing(true)
    const { error } = await supabase.from('chat_history').insert({
      mission_id: missionId, sender_id: user.id,
      sender_role: missionRole, text: payload, type: 'price_proposal',
    })
    if (!error) {
      const rid = getRecipientId(mission, user.id)
      if (rid) notifyOther(`Proposition finale : ${total.toLocaleString('fr')} FCFA — validez pour confirmer`, rid)
      setShowDevis(false)
    }
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

  const status = mission?.status || 'negotiation'
  const statusInfo = STATUS_CONFIG[status] || STATUS_CONFIG.negotiation
  const artisanName   = mission?.artisan_pros?.users?.name   || 'Artisan'
  const artisanMetier = mission?.artisan_pros?.metier         || ''
  const artisanPhone  = mission?.artisan_pros?.users?.phone   || null
  const clientName    = mission?.users?.name || 'Client'
  // Nom et avatar de l'interlocuteur (l'autre personne, pas soi-même)
  const otherName     = isArtisan ? clientName : artisanName
  const otherAvatar   = isArtisan ? mission?.users?.avatar_url : mission?.artisan_pros?.users?.avatar_url
  const otherSub      = isArtisan ? 'Client' : artisanMetier
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
        <div onClick={() => { if (!acting) setShowScheduling(false) }} style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(10,14,11,0.96)',display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div onClick={e => e.stopPropagation()} style={{width:'100%',maxWidth:'480px',background:'#1A1F1B',borderRadius:'24px 24px 0 0',padding:'24px 20px 32px'}}>
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
            {otherAvatar
              ? <img src={otherAvatar} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" />
              : isArtisan ? '👤' : '🔧'}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:'14px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{otherName}</div>
            <div style={{fontSize:'11px',color:'#7A7A6E'}}>{otherSub}</div>
          </div>
          {/* Appel rapide artisan (client uniquement) */}
          {!isArtisan && artisanPhone && (
            <a href={`tel:${artisanPhone}`} style={{background:'rgba(43,107,62,0.15)',border:'1px solid rgba(43,107,62,0.4)',borderRadius:'8px',padding:'6px 10px',color:'#2B6B3E',fontSize:'18px',flexShrink:0,display:'flex',alignItems:'center',textDecoration:'none'}} title={`Appeler ${artisanName}`}>
              📞
            </a>
          )}
          {/* Bouton rouvrir fiche technique (artisan seulement) */}
          {isArtisan && diagData && !showDiagPanel && (
            <button onClick={() => setShowDiagPanel(true)} style={{background:'rgba(232,93,38,0.15)',border:'1px solid rgba(232,93,38,0.4)',borderRadius:'8px',padding:'4px 8px',cursor:'pointer',color:'#E85D26',fontSize:'10px',fontWeight:700,flexShrink:0,display:'flex',alignItems:'center',gap:'4px'}}>
              📋 Fiche
            </button>
          )}
          {/* Badge statut */}
          <span style={{fontSize:'10px',fontWeight:600,color:statusInfo.color,background:statusInfo.bg,padding:'3px 8px',borderRadius:'20px',flexShrink:0,border:`1px solid ${statusInfo.color}33`,whiteSpace:'nowrap',maxWidth:'130px',overflow:'hidden',textOverflow:'ellipsis'}}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Bannière mission active → suivi */}
      {(status === 'en_route' || status === 'en_cours') && (
        <Link href={`/suivi/${missionId}`} style={{
          display:'flex',alignItems:'center',justifyContent:'space-between',
          background:'#E85D26',color:'white',padding:'10px 16px',
          textDecoration:'none',flexShrink:0,
        }}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',fontWeight:700}}>
            <span>{status === 'en_route' ? '🚗' : '⚡'}</span>
            <span>Mission en cours — GPS, photos, litige</span>
          </div>
          <span style={{fontSize:'12px',fontWeight:600,opacity:0.9}}>Voir →</span>
        </Link>
      )}

      {/* ─── DRAWER : Matériau non prévu (artisan) ────────────────────── */}
      {showMatSuggest && isArtisan && (
        <div style={{background:'#FAFAF5',borderTop:'2px solid #C9A84C',padding:'14px 16px',flexShrink:0}}>
          <div style={{maxWidth:'672px',margin:'0 auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
              <span style={{fontWeight:700,fontSize:'14px',color:'#0F1410'}}>📦 Matériau non prévu</span>
              <button onClick={() => setShowMatSuggest(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7A7A6E'}}><X size={16}/></button>
            </div>
            <p style={{fontSize:'12px',color:'#7A7A6E',marginBottom:'10px',lineHeight:'1.5'}}>
              Signalez un matériau absent du diagnostic — l'IA cherche son prix de marché à Abidjan.
            </p>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'8px',marginBottom:'10px'}}>
              <input value={suggestName} onChange={e => setSuggestName(e.target.value)}
                placeholder="ex: Joint torique DN20"
                onKeyDown={e => e.key === 'Enter' && sendMatSuggest()}
                style={{padding:'10px 12px',border:'1px solid #D8D2C4',borderRadius:'10px',fontSize:'14px',outline:'none',color:'#0F1410'}} />
              <input type="number" value={suggestQty} onChange={e => setSuggestQty(e.target.value)} placeholder="Qté"
                style={{padding:'10px 12px',border:'1px solid #D8D2C4',borderRadius:'10px',fontSize:'14px',outline:'none',color:'#0F1410'}} />
            </div>
            <button onClick={sendMatSuggest} disabled={lookingUp || !suggestName.trim()}
              style={{width:'100%',padding:'10px',background:suggestName.trim()?'#C9A84C':'#D8D2C4',color:'white',border:'none',borderRadius:'10px',fontWeight:700,fontSize:'13px',cursor:suggestName.trim()?'pointer':'default',opacity:lookingUp?0.6:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
              {lookingUp ? <><div style={{width:'12px',height:'12px',border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid white',borderRadius:'50%',animation:'spin 1s linear infinite'}}/> Recherche prix…</> : '🔍 Chercher le prix & envoyer'}
            </button>
          </div>
        </div>
      )}

      {/* ─── DRAWER : Requalification du temps (artisan) ──────────────── */}
      {showTimeAdj && isArtisan && (
        <div style={{background:'#FAFAF5',borderTop:'2px solid #E85D26',padding:'14px 16px',flexShrink:0}}>
          <div style={{maxWidth:'672px',margin:'0 auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
              <span style={{fontWeight:700,fontSize:'14px',color:'#0F1410'}}>⏱ Requalifier le temps</span>
              <button onClick={() => setShowTimeAdj(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7A7A6E'}}><X size={16}/></button>
            </div>
            {pricingSuggestion && (
              <div style={{background:'rgba(232,93,38,0.06)',border:'1px solid rgba(232,93,38,0.2)',borderRadius:'8px',padding:'8px 12px',marginBottom:'10px',fontSize:'12px',color:'#7A7A6E'}}>
                Taux horaire actuel ≈ <strong style={{color:'#0F1410',fontFamily:'Space Mono'}}>
                  {Math.round(pricingSuggestion.decomp.labor / Math.max(0.25, parseDurLow(diagData?.duration_estimate || '2 heures'))).toLocaleString('fr')} FCFA/h
                </strong>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:'8px',marginBottom:'10px'}}>
              <input type="number" value={adjHours} onChange={e => setAdjHours(e.target.value)} placeholder="Heures sup."
                style={{padding:'10px 12px',border:'1px solid #D8D2C4',borderRadius:'10px',fontSize:'14px',outline:'none',color:'#0F1410'}} />
              <input value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="Raison (ex: découvert une fuite cachée)"
                style={{padding:'10px 12px',border:'1px solid #D8D2C4',borderRadius:'10px',fontSize:'14px',outline:'none',color:'#0F1410'}} />
            </div>
            {adjHours && pricingSuggestion && (
              <div style={{background:'rgba(232,93,38,0.06)',borderRadius:'8px',padding:'8px 12px',marginBottom:'10px',fontSize:'13px',color:'#0F1410'}}>
                Impact MO ≈ <strong style={{fontFamily:'Space Mono',color:'#E85D26'}}>
                  +{Math.round(parseFloat(adjHours) * pricingSuggestion.decomp.labor / Math.max(0.25, parseDurLow(diagData?.duration_estimate || '2 heures'))).toLocaleString('fr')} FCFA
                </strong>
              </div>
            )}
            <button onClick={sendTimeAdj} disabled={!adjHours || parseFloat(adjHours) <= 0}
              style={{width:'100%',padding:'10px',background:adjHours?'#E85D26':'#D8D2C4',color:'white',border:'none',borderRadius:'10px',fontWeight:700,fontSize:'13px',cursor:adjHours?'pointer':'default'}}>
              Envoyer la requalification →
            </button>
          </div>
        </div>
      )}

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
            {/* Suggestion moteur de pricing */}
            {pricingSugLoading && (
              <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 14px',background:'rgba(232,93,38,0.04)',border:'1px solid rgba(232,93,38,0.15)',borderRadius:'10px',marginBottom:'10px'}}>
                <div style={{width:'12px',height:'12px',border:'2px solid rgba(232,93,38,0.3)',borderTop:'2px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite',flexShrink:0}} />
                <span style={{fontSize:'11px',color:'#7A7A6E'}}>Calcul du moteur AfriOne…</span>
              </div>
            )}
            {!pricingSugLoading && pricingSuggestion && (
              <div style={{background:'rgba(232,93,38,0.05)',border:'1px solid rgba(232,93,38,0.2)',borderRadius:'12px',padding:'12px 14px',marginBottom:'10px'}}>
                <div style={{fontSize:'9px',fontWeight:700,color:'#E85D26',letterSpacing:'0.12em',fontFamily:'Space Mono',marginBottom:'8px'}}>SUGGESTION MOTEUR AFRIONE · MC 10K</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
                  <div>
                    <span style={{fontFamily:'Space Mono',fontSize:'22px',fontWeight:700,color:'#0F1410'}}>{pricingSuggestion.estimate.toLocaleString()}</span>
                    <span style={{fontSize:'11px',color:'#7A7A6E',marginLeft:'4px'}}>FCFA</span>
                    <div style={{fontSize:'10px',color:'#A09A8E',fontFamily:'Space Mono',marginTop:'1px'}}>
                      [{pricingSuggestion.interval.low.toLocaleString()} – {pricingSuggestion.interval.high.toLocaleString()}] IC 95%
                    </div>
                  </div>
                  <button
                    onClick={() => setDevisAmount(pricingSuggestion.estimate.toString())}
                    style={{padding:'7px 14px',background:'#E85D26',color:'white',border:'none',borderRadius:'8px',fontSize:'12px',fontWeight:700,cursor:'pointer',flexShrink:0}}
                  >
                    Utiliser
                  </button>
                </div>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                  {[
                    {label:"MO",    val: pricingSuggestion.decomp.labor},
                    {label:"Mat.",  val: pricingSuggestion.decomp.materials},
                    {label:"Tsp.",  val: pricingSuggestion.decomp.transport},
                    {label:"Com.",  val: pricingSuggestion.decomp.premium},
                  ].map(({label, val}) => (
                    <div key={label} style={{fontSize:'10px',color:'#7A7A6E',background:'rgba(0,0,0,0.04)',padding:'3px 8px',borderRadius:'6px'}}>
                      <span style={{color:'#0F1410',fontWeight:600}}>{label}</span> {val.toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matériaux demandés par le client + infos vendeur (photo, Jumia, proximité) */}
            {diagData?.items_needed?.length > 0 && (
              <div style={{marginBottom:'10px'}}>
                <div style={{fontSize:'9px',fontWeight:700,color:'#7A7A6E',letterSpacing:'0.12em',fontFamily:'Space Mono',marginBottom:'7px'}}>MATÉRIAUX (CHOIX DU CLIENT)</div>
                <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                  {diagData.items_needed.map((item: string) => {
                    const matData = materialsProximity.find((m: any) => m.name === item)
                    const std = matData?.tiers?.standard
                    const hasPhoto = std?.photo_url && std?.source === 'Jumia CI'
                    const hasVendor = !hasPhoto && std?.vendor_quartier
                    return (
                      <div key={item} style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 10px',background:'rgba(201,168,76,0.06)',border:'1px solid rgba(201,168,76,0.2)',borderRadius:'10px'}}>
                        {/* Visuel : photo Jumia cliquable ou emoji produit */}
                        {hasPhoto && std?.source_url ? (
                          <a href={std.source_url} target="_blank" rel="noreferrer" style={{flexShrink:0,display:'block',lineHeight:0}}>
                            <img src={std.photo_url} alt={item} style={{width:'36px',height:'36px',borderRadius:'6px',objectFit:'cover',background:'#EDE8DE',display:'block'}}
                              onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                          </a>
                        ) : (
                          <div style={{width:'36px',height:'36px',borderRadius:'6px',background:'rgba(201,168,76,0.1)',border:'1px solid rgba(201,168,76,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',flexShrink:0}}>
                            {materialEmoji(item)}
                          </div>
                        )}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:'11px',fontWeight:600,color:'#C9A84C',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item}</div>
                          {hasPhoto && std?.source_url && (
                            <a href={std.source_url} target="_blank" rel="noreferrer"
                              style={{fontSize:'10px',color:'#E85D26',fontWeight:600,textDecoration:'none'}}>
                              Jumia CI →
                            </a>
                          )}
                          {hasVendor && std?.km_to_client != null && (
                            <div style={{fontSize:'10px',color: std.km_to_client <= 3 ? '#2B6B3E' : '#7A7A6E',marginTop:'1px'}}>
                              📍 {std.vendor_quartier} · {std.km_to_client} km du client
                            </div>
                          )}
                          {!hasPhoto && !hasVendor && (
                            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginTop:'1px'}}>Photo à venir</div>
                          )}
                        </div>
                        {hasVendor && (
                          <span style={{fontSize:'9px',fontWeight:700,padding:'2px 7px',borderRadius:'20px',flexShrink:0,
                            background: std.km_to_client <= 3 ? 'rgba(43,107,62,0.1)' : 'rgba(201,168,76,0.1)',
                            color: std.km_to_client <= 3 ? '#2B6B3E' : '#C9A84C',
                            border: `1px solid ${std.km_to_client <= 3 ? 'rgba(43,107,62,0.25)' : 'rgba(201,168,76,0.25)'}`,
                          }}>
                            {std.km_to_client <= 3 ? 'Proche client' : 'Livraison'}
                          </span>
                        )}
                        {hasPhoto && (
                          <span style={{fontSize:'9px',fontWeight:700,padding:'2px 7px',borderRadius:'20px',flexShrink:0,background:'rgba(232,93,38,0.08)',color:'#E85D26',border:'1px solid rgba(232,93,38,0.2)'}}>
                            Jumia
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Économies vs marché */}
            {pricingSuggestion?.below_market && pricingSuggestion.savings_vs_market && pricingSuggestion.savings_vs_market > 0 && (
              <div style={{background:'rgba(43,107,62,0.06)',border:'1px solid rgba(43,107,62,0.2)',borderRadius:'10px',padding:'8px 12px',marginBottom:'10px',display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontSize:'16px'}}>💰</span>
                <div style={{fontSize:'11px',color:'#2B6B3E',fontWeight:600}}>
                  Client économise <span style={{fontFamily:'Space Mono'}}>{pricingSuggestion.savings_vs_market.toLocaleString('fr')} FCFA</span> vs marché traditionnel
                </div>
              </div>
            )}

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

      {/* ─── FICHE TECHNIQUE ARTISAN (panel, invisible pour le client) ─── */}
      {isArtisan && diagData && showDiagPanel && (
        <div style={{background:'#0F1410',borderBottom:'1px solid rgba(255,255,255,0.07)',flexShrink:0}}>
          <div style={{maxWidth:'672px',margin:'0 auto',padding:'10px 14px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'7px'}}>
                <span style={{fontSize:'13px'}}>📋</span>
                <span style={{fontSize:'10px',fontWeight:700,color:'#E85D26',letterSpacing:'0.1em',fontFamily:'Space Mono'}}>FICHE TECHNIQUE — DIAGNOSTIC CLIENT</span>
              </div>
              <button onClick={() => setShowDiagPanel(false)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.35)',padding:'2px',lineHeight:0}}>
                <X size={14} />
              </button>
            </div>

            {/* Infos clés */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'5px',marginBottom:'8px'}}>
              <div style={{background:'rgba(255,255,255,0.05)',borderRadius:'8px',padding:'7px 8px',textAlign:'center'}}>
                <div style={{fontSize:'11px',fontWeight:700,color:'#FAFAF5',marginBottom:'1px'}}>{diagData.category || '—'}</div>
                <div style={{fontSize:'9px',color:'rgba(255,255,255,0.35)',fontFamily:'Space Mono'}}>CATÉGORIE</div>
              </div>
              <div style={{background:'rgba(255,255,255,0.05)',borderRadius:'8px',padding:'7px 8px',textAlign:'center'}}>
                <div style={{fontSize:'11px',fontWeight:700,color: diagData.urgency === 'emergency' ? '#ef4444' : diagData.urgency === 'high' ? '#E85D26' : diagData.urgency === 'medium' ? '#C9A84C' : '#2B6B3E',marginBottom:'1px'}}>
                  {diagData.urgency === 'emergency' ? '🔴 URGENCE' : diagData.urgency === 'high' ? '🟠 Urgent' : diagData.urgency === 'medium' ? '🟡 Normal' : '🟢 Faible'}
                </div>
                <div style={{fontSize:'9px',color:'rgba(255,255,255,0.35)',fontFamily:'Space Mono'}}>URGENCE</div>
              </div>
              <div style={{background:'rgba(255,255,255,0.05)',borderRadius:'8px',padding:'7px 8px',textAlign:'center'}}>
                <div style={{fontSize:'10px',fontWeight:700,color:'#C9A84C',fontFamily:'Space Mono',marginBottom:'1px'}}>
                  {diagData.price_min && diagData.price_max ? `${diagData.price_min.toLocaleString()}–${diagData.price_max.toLocaleString()}` : '—'}
                </div>
                <div style={{fontSize:'9px',color:'rgba(255,255,255,0.35)',fontFamily:'Space Mono'}}>FCFA EST.</div>
              </div>
            </div>

            {/* Notes techniques */}
            {diagData.technical_notes && (
              <div style={{background:'rgba(232,93,38,0.08)',border:'1px solid rgba(232,93,38,0.2)',borderRadius:'9px',padding:'9px 11px',marginBottom:'7px'}}>
                <p style={{fontSize:'12px',color:'rgba(255,255,255,0.8)',lineHeight:'1.55',margin:0}}>{diagData.technical_notes}</p>
              </div>
            )}

            {/* Matériel probable + liens d'achat */}
            {diagData.items_needed?.length > 0 && (
              <div style={{display:'flex',flexDirection:'column',gap:'5px',marginBottom:'6px'}}>
                {diagData.items_needed.map((item: string) => {
                  const matData = materialsProximity.find((m: any) => m.name === item)
                  const std = matData?.tiers?.standard
                  const isJumia = std?.source === 'Jumia CI' && std?.source_url
                  const isPhysical = !isJumia && std?.vendor_quartier
                  const proxColor = std?.km_to_client <= 3 ? '#2B6B3E' : 'rgba(255,255,255,0.4)'
                  const proxBg    = std?.km_to_client <= 3 ? 'rgba(43,107,62,0.15)' : 'rgba(255,255,255,0.06)'
                  const proxBd    = std?.km_to_client <= 3 ? 'rgba(43,107,62,0.3)' : 'rgba(255,255,255,0.1)'
                  return (
                    <div key={item} style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',background:'rgba(255,255,255,0.04)',borderRadius:'8px'}}>
                      {/* Visuel : photo Jumia cliquable ou emoji */}
                      {isJumia && std?.photo_url ? (
                        <a href={std.source_url} target="_blank" rel="noreferrer" style={{flexShrink:0,display:'block',lineHeight:0}}>
                          <img src={std.photo_url} alt={item} style={{width:'28px',height:'28px',borderRadius:'5px',objectFit:'cover',background:'rgba(255,255,255,0.1)',display:'block'}}
                            onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                        </a>
                      ) : (
                        <div style={{width:'28px',height:'28px',borderRadius:'5px',background:'rgba(201,168,76,0.1)',border:'1px solid rgba(201,168,76,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',flexShrink:0}}>
                          {materialEmoji(item)}
                        </div>
                      )}
                      {/* Nom */}
                      <span style={{fontSize:'10px',fontWeight:600,color:'#C9A84C',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item}</span>
                      {/* Tag */}
                      {isJumia && (
                        <a href={std.source_url} target="_blank" rel="noreferrer" style={{fontSize:'9px',fontWeight:700,color:'#E85D26',textDecoration:'none',background:'rgba(232,93,38,0.1)',padding:'2px 7px',borderRadius:'20px',border:'1px solid rgba(232,93,38,0.25)',flexShrink:0}}>
                          Jumia →
                        </a>
                      )}
                      {isPhysical && (
                        <span style={{fontSize:'9px',color:proxColor,background:proxBg,padding:'2px 7px',borderRadius:'20px',border:`1px solid ${proxBd}`,flexShrink:0,whiteSpace:'nowrap'}}>
                          📍 {std.vendor_quartier}{std.km_to_client != null ? ` · ${std.km_to_client}km` : ''}
                        </span>
                      )}
                      {!isJumia && !isPhysical && (
                        <span style={{fontSize:'9px',color:'rgba(255,255,255,0.2)',flexShrink:0}}>Photo à venir</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Photos client */}
            {diagData.photos?.length > 0 && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'4px'}}>
                {diagData.photos.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" style={{display:'block',aspectRatio:'1',borderRadius:'6px',overflow:'hidden',background:'rgba(255,255,255,0.07)'}}>
                    <img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                  </a>
                ))}
              </div>
            )}

            {diagData.duration_estimate && (
              <div style={{marginTop:'6px',fontSize:'10px',color:'rgba(255,255,255,0.3)',fontFamily:'Space Mono'}}>
                ⏱ Durée estimée : {diagData.duration_estimate}
              </div>
            )}
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

            // Photos de chantier
            if (msg.type === 'proof') {
              let proofData: any = {}
              try { proofData = JSON.parse(msg.text) } catch {}
              return (
                <div key={msg.id} style={{textAlign:'center',padding:'8px 0'}}>
                  <div style={{display:'inline-block',background:'white',border:'1px solid #D8D2C4',borderRadius:'16px',padding:'14px',maxWidth:'85%',textAlign:'left'}}>
                    <div style={{fontSize:'11px',fontWeight:700,color:'#2B6B3E',marginBottom:'10px',display:'flex',alignItems:'center',gap:'5px'}}>
                      <Camera size={12}/> PHOTOS DE CHANTIER
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'6px',marginBottom: proofData.notes ? '10px' : '0'}}>
                      {(proofData.urls || []).map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" style={{display:'block',aspectRatio:'1',borderRadius:'8px',overflow:'hidden',background:'#EDE8DE'}}>
                          <img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                        </a>
                      ))}
                    </div>
                    {proofData.notes && <div style={{fontSize:'12px',color:'#7A7A6E',fontStyle:'italic'}}>{proofData.notes}</div>}
                    <div style={{fontSize:'10px',color:'#7A7A6E',marginTop:'6px'}}>{new Date(msg.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
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

            // Fiche technique (brief de diagnostic)
            if (msg.type === 'brief') {
              let brief: any = {}
              try { brief = JSON.parse(msg.text) } catch {}
              const urgencyColor: Record<string, string> = { low:'#2B6B3E', medium:'#C9A84C', high:'#E85D26', emergency:'#ef4444' }
              const urgencyIcon: Record<string, string> = { low:'🟢', medium:'🟡', high:'🟠', emergency:'🔴' }
              const urg = brief.urgency || 'medium'
              return (
                <div key={msg.id} style={{padding:'4px 0'}}>
                  <div style={{
                    background:'white',border:'1.5px solid #D8D2C4',borderRadius:'20px',
                    overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
                    maxWidth:'92%',
                  }}>
                    {/* En-tête fiche */}
                    <div style={{background:'#0F1410',padding:'14px 18px',display:'flex',alignItems:'center',gap:'10px'}}>
                      <div style={{width:'32px',height:'32px',background:'rgba(232,93,38,0.2)',borderRadius:'9px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <span style={{fontSize:'16px'}}>📋</span>
                      </div>
                      <div>
                        <div style={{fontSize:'11px',fontWeight:700,color:'#E85D26',letterSpacing:'0.1em',fontFamily:'Space Mono'}}>FICHE TECHNIQUE</div>
                        <div style={{fontSize:'12px',color:'rgba(255,255,255,0.5)',marginTop:'1px'}}>Diagnostic IA · Transmis automatiquement</div>
                      </div>
                    </div>

                    <div style={{padding:'16px 18px',display:'flex',flexDirection:'column',gap:'12px'}}>
                      {/* Infos clés */}
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
                        <div style={{background:'#F5F0E8',borderRadius:'10px',padding:'10px',textAlign:'center'}}>
                          <div style={{fontSize:'11px',fontWeight:700,color:'#0F1410',marginBottom:'2px'}}>{brief.category || '—'}</div>
                          <div style={{fontSize:'9px',color:'#7A7A6E',fontFamily:'Space Mono'}}>CATÉGORIE</div>
                        </div>
                        <div style={{background:'#F5F0E8',borderRadius:'10px',padding:'10px',textAlign:'center'}}>
                          <div style={{fontSize:'11px',fontWeight:700,color:urgencyColor[urg],marginBottom:'2px'}}>{urgencyIcon[urg]} {urg === 'low' ? 'Normal' : urg === 'medium' ? 'Modéré' : urg === 'high' ? 'Urgent' : 'URGENCE'}</div>
                          <div style={{fontSize:'9px',color:'#7A7A6E',fontFamily:'Space Mono'}}>URGENCE</div>
                        </div>
                        {(brief.price_min || brief.price_max) ? (
                          <div style={{background:'#F5F0E8',borderRadius:'10px',padding:'10px',textAlign:'center'}}>
                            <div style={{fontSize:'10px',fontWeight:700,color:'#0F1410',marginBottom:'2px',fontFamily:'Space Mono'}}>
                              {(brief.price_min||0).toLocaleString()}–{(brief.price_max||0).toLocaleString()}
                            </div>
                            <div style={{fontSize:'9px',color:'#7A7A6E',fontFamily:'Space Mono'}}>FCFA EST.</div>
                          </div>
                        ) : null}
                      </div>

                      {/* Notes techniques */}
                      {brief.technical_notes && (
                        <div style={{background:'rgba(232,93,38,0.04)',border:'1px solid rgba(232,93,38,0.15)',borderRadius:'12px',padding:'12px 14px'}}>
                          <div style={{fontSize:'9px',fontWeight:700,color:'#E85D26',letterSpacing:'0.1em',marginBottom:'6px',fontFamily:'Space Mono'}}>NOTES POUR L'ARTISAN</div>
                          <p style={{fontSize:'13px',color:'#0F1410',lineHeight:'1.5',margin:0}}>{brief.technical_notes}</p>
                        </div>
                      )}

                      {/* Matériel */}
                      {(brief.items_needed||[]).length > 0 && (
                        <div>
                          <div style={{fontSize:'9px',fontWeight:700,color:'#7A7A6E',letterSpacing:'0.1em',marginBottom:'6px',fontFamily:'Space Mono'}}>MATÉRIEL PROBABLE</div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:'5px'}}>
                            {brief.items_needed.map((item: string) => (
                              <span key={item} style={{fontSize:'11px',background:'rgba(232,93,38,0.07)',border:'1px solid rgba(232,93,38,0.2)',padding:'3px 10px',borderRadius:'20px',color:'#E85D26',fontWeight:500}}>{item}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Photos client */}
                      {(brief.photos||[]).length > 0 && (
                        <div>
                          <div style={{fontSize:'9px',fontWeight:700,color:'#7A7A6E',letterSpacing:'0.1em',marginBottom:'6px',fontFamily:'Space Mono'}}>📸 PHOTOS DU CLIENT</div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'5px'}}>
                            {brief.photos.map((url: string, i: number) => (
                              <a key={i} href={url} target="_blank" rel="noreferrer" style={{display:'block',aspectRatio:'1',borderRadius:'8px',overflow:'hidden',background:'#EDE8DE'}}>
                                <img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{fontSize:'10px',color:'#7A7A6E',textAlign:'right'}}>
                        {new Date(msg.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

            // Matériau non prévu — fiche produit complète (photo, marque, prix Jumia vs local)
            if (msg.type === 'material_suggest') {
              let d: any = {}
              try { d = JSON.parse(msg.text) } catch {}
              const localTotal = (d.price_market ?? 0) * (d.qty ?? 1)
              const webTotal   = (d.web_price ?? 0) * (d.qty ?? 1)
              const hasPrice   = localTotal > 0
              return (
                <div key={msg.id} style={{display:'flex',justifyContent:isMe?'flex-end':'flex-start'}}>
                  <div style={{maxWidth:'86%',background:'white',border:'1.5px solid rgba(201,168,76,0.45)',borderRadius:'16px',overflow:'hidden',boxShadow:'0 2px 12px rgba(201,168,76,0.08)'}}>
                    {/* Header */}
                    <div style={{background:'rgba(201,168,76,0.08)',padding:'8px 14px',display:'flex',gap:'8px',alignItems:'center',borderBottom:'1px solid rgba(201,168,76,0.12)'}}>
                      <span style={{fontSize:'14px'}}>📦</span>
                      <span style={{fontSize:'10px',fontWeight:700,color:'#C9A84C',fontFamily:'Space Mono',letterSpacing:'0.1em'}}>MATÉRIAU NON PRÉVU</span>
                      {d.source && (
                        <span style={{marginLeft:'auto',fontSize:'9px',padding:'2px 7px',borderRadius:'10px',background:'rgba(232,93,38,0.08)',color:'#E85D26',fontWeight:600,border:'1px solid rgba(232,93,38,0.2)'}}>
                          {d.source}
                        </span>
                      )}
                    </div>

                    <div style={{padding:'12px 14px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
                      {/* Photo produit */}
                      {d.photo_url ? (
                        <a href={d.source_url || '#'} target="_blank" rel="noreferrer" style={{flexShrink:0,display:'block',lineHeight:0,borderRadius:'10px',overflow:'hidden',width:'72px',height:'72px',background:'#F5F0E8'}}>
                          <img src={d.photo_url} alt={d.product_name || d.name}
                            style={{width:'72px',height:'72px',objectFit:'cover',display:'block'}}
                            onError={e => { (e.target as HTMLImageElement).parentElement!.style.display='none' }} />
                        </a>
                      ) : (
                        <div style={{width:'72px',height:'72px',borderRadius:'10px',background:'rgba(201,168,76,0.08)',border:'1px solid rgba(201,168,76,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',flexShrink:0}}>
                          {materialEmoji(d.name)}
                        </div>
                      )}

                      {/* Infos produit */}
                      <div style={{flex:1,minWidth:0}}>
                        {/* Nom artisan */}
                        <div style={{fontWeight:700,fontSize:'13px',color:'#0F1410',marginBottom:'2px'}}>
                          {d.qty > 1 ? `${d.qty}× ` : ''}{d.name}
                        </div>
                        {/* Nom produit Jumia si différent */}
                        {d.product_name && d.product_name !== d.name && (
                          <div style={{fontSize:'11px',color:'#7A7A6E',marginBottom:'4px',fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {d.product_name}
                          </div>
                        )}
                        {d.brand && (
                          <div style={{fontSize:'10px',color:'#A09A8E',marginBottom:'6px'}}>{d.brand}</div>
                        )}

                        {/* Prix */}
                        {hasPrice ? (
                          <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                            <div style={{display:'flex',alignItems:'baseline',gap:'4px'}}>
                              <span style={{fontFamily:'Space Mono',fontSize:'20px',fontWeight:700,color:'#C9A84C'}}>
                                ~{localTotal.toLocaleString('fr')}
                              </span>
                              <span style={{fontSize:'11px',color:'#7A7A6E'}}>FCFA</span>
                              <span style={{fontSize:'10px',color:'#2B6B3E',background:'rgba(43,107,62,0.08)',padding:'1px 6px',borderRadius:'4px',fontWeight:600}}>prix local</span>
                            </div>
                            {webTotal > 0 && (
                              <div style={{fontSize:'11px',color:'#7A7A6E'}}>
                                Jumia : <span style={{fontFamily:'Space Mono',fontWeight:600}}>{webTotal.toLocaleString('fr')}</span> FCFA
                                {d.qty > 1 && <span style={{color:'#A09A8E'}}> ({d.web_price?.toLocaleString('fr')}/u)</span>}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{fontSize:'12px',color:'#E85D26',fontWeight:600}}>⚠️ Prix non trouvé — à discuter</div>
                        )}
                      </div>
                    </div>

                    {/* Footer — lien Jumia */}
                    {d.source_url && (
                      <a href={d.source_url} target="_blank" rel="noreferrer"
                        style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'8px',borderTop:'1px solid rgba(201,168,76,0.12)',fontSize:'12px',fontWeight:600,color:'#E85D26',textDecoration:'none',background:'rgba(232,93,38,0.03)'}}>
                        Voir sur {d.source || 'Jumia'} →
                      </a>
                    )}
                    <div style={{padding:'4px 14px 8px',fontSize:'10px',color:'#7A7A6E'}}>{new Date(msg.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                </div>
              )
            }

            // Requalification du temps
            if (msg.type === 'time_adjust') {
              let d: any = {}
              try { d = JSON.parse(msg.text) } catch {}
              return (
                <div key={msg.id} style={{textAlign:'center',padding:'6px 0'}}>
                  <div style={{display:'inline-block',background:'rgba(232,93,38,0.06)',border:'1px solid rgba(232,93,38,0.3)',borderRadius:'12px',padding:'10px 16px',maxWidth:'88%',textAlign:'left'}}>
                    <div style={{fontSize:'10px',fontWeight:700,color:'#E85D26',fontFamily:'Space Mono',letterSpacing:'0.1em',marginBottom:'5px'}}>⏱ REQUALIFICATION DU TEMPS</div>
                    <div style={{fontSize:'14px',color:'#0F1410',fontWeight:600}}>
                      +{d.extra_hours}h
                      <span style={{fontSize:'12px',fontWeight:400,color:'#7A7A6E',marginLeft:'8px'}}>
                        → MO +<span style={{fontFamily:'Space Mono',fontWeight:600,color:'#E85D26'}}>{(d.labor_impact||0).toLocaleString('fr')} FCFA</span>
                      </span>
                    </div>
                    {d.reason && <div style={{fontSize:'12px',color:'#7A7A6E',marginTop:'3px',fontStyle:'italic'}}>{d.reason}</div>}
                    <div style={{fontSize:'10px',color:'#7A7A6E',marginTop:'5px'}}>{new Date(msg.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                </div>
              )
            }

            // Proposition finale — validation conjointe des deux parties
            if (msg.type === 'price_proposal') {
              let d: any = {}
              try { d = JSON.parse(msg.text) } catch {}
              const canValidate = !isMe && !acting && status !== 'completed' && status !== 'cancelled' && status !== 'en_cours'
              return (
                <div key={msg.id} style={{padding:'4px 0'}}>
                  <div style={{background:'white',border:'2px solid #0F1410',borderRadius:'18px',overflow:'hidden',maxWidth:'94%',boxShadow:'0 4px 20px rgba(0,0,0,0.1)'}}>
                    {/* Header */}
                    <div style={{background:'#0F1410',padding:'12px 18px',display:'flex',alignItems:'center',gap:'10px'}}>
                      <span style={{fontSize:'18px'}}>⚖️</span>
                      <div>
                        <div style={{fontSize:'10px',fontWeight:700,color:'#E85D26',fontFamily:'Space Mono',letterSpacing:'0.1em'}}>PROPOSITION FINALE · VALIDATION REQUISE</div>
                        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'1px'}}>Construit depuis diagnostic + ajustements discutés</div>
                      </div>
                    </div>
                    <div style={{padding:'16px 18px',display:'flex',flexDirection:'column',gap:'7px'}}>
                      {/* Base */}
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px'}}>
                        <span style={{color:'#7A7A6E'}}>📋 Devis diagnostic initial</span>
                        <span style={{fontFamily:'Space Mono',color:'#0F1410',fontWeight:600}}>{(d.base_estimate||0).toLocaleString('fr')} F</span>
                      </div>
                      {/* Extra materials */}
                      {(d.extra_materials||[]).map((m: any, i: number) => (
                        <div key={`em${i}`} style={{display:'flex',justifyContent:'space-between',fontSize:'12px'}}>
                          <span style={{color:'#C9A84C'}}>📦 {m.qty>1?`${m.qty}× `:''}{m.name}</span>
                          <span style={{fontFamily:'Space Mono',color:'#C9A84C',fontWeight:600}}>+{(m.total||0).toLocaleString('fr')} F</span>
                        </div>
                      ))}
                      {/* Time adjustments */}
                      {(d.time_adjustments||[]).map((t: any, i: number) => (
                        <div key={`ta${i}`} style={{display:'flex',justifyContent:'space-between',fontSize:'12px'}}>
                          <span style={{color:'#E85D26'}}>⏱ Temps +{t.extra_hours}h</span>
                          <span style={{fontFamily:'Space Mono',color:'#E85D26',fontWeight:600}}>+{(t.labor_impact||0).toLocaleString('fr')} F</span>
                        </div>
                      ))}
                      {/* Divider + Total */}
                      <div style={{borderTop:'1.5px solid #D8D2C4',paddingTop:'12px',marginTop:'4px',display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                        <span style={{fontWeight:700,fontSize:'15px',color:'#0F1410'}}>Total</span>
                        <div style={{textAlign:'right'}}>
                          <span style={{fontFamily:'Space Mono',fontSize:'26px',fontWeight:700,color:'#0F1410'}}>{(d.total||0).toLocaleString('fr')}</span>
                          <span style={{fontSize:'13px',color:'#7A7A6E',marginLeft:'4px'}}>FCFA</span>
                        </div>
                      </div>
                      {/* Action */}
                      {canValidate ? (
                        <div style={{marginTop:'4px',display:'flex',gap:'8px'}}>
                          <button onClick={() => acceptDevis(d.total)} style={{flex:1,padding:'12px',background:'#2B6B3E',color:'white',border:'none',borderRadius:'12px',fontWeight:700,fontSize:'14px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'7px'}}>
                            <CheckCircle size={15}/> Je valide & Paye
                          </button>
                          <button onClick={refuseDevis} style={{padding:'12px 14px',background:'none',color:'#7A7A6E',border:'1px solid #D8D2C4',borderRadius:'12px',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>
                            <X size={14}/>
                          </button>
                        </div>
                      ) : isMe ? (
                        <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'#7A7A6E',marginTop:'2px'}}>
                          <Clock size={12}/> En attente de validation client…
                        </div>
                      ) : null}
                    </div>
                    <div style={{padding:'0 18px 10px',fontSize:'10px',color:'#7A7A6E'}}>{new Date(msg.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                </div>
              )
            }

            // Mise à jour matériaux (artisan pendant mission)
            if (msg.type === 'material_update') {
              let upd: any = {}
              try { upd = JSON.parse(msg.text) } catch {}
              const mats: {name:string;qty:number;prix_unitaire:number}[] = upd.materials || []
              const matTotal = mats.reduce((s: number, m: any) => s + m.qty * m.prix_unitaire, 0)
              const laborFixed: number = upd.labor_fixed ?? 0
              return (
                <div key={msg.id} style={{padding:'4px 0'}}>
                  <div style={{background:'white',border:'2px solid #2B6B3E',borderRadius:'16px',overflow:'hidden',maxWidth:'92%',boxShadow:'0 2px 10px rgba(43,107,62,0.08)'}}>
                    <div style={{background:'rgba(43,107,62,0.07)',padding:'10px 16px',borderBottom:'1px solid rgba(43,107,62,0.12)',display:'flex',alignItems:'center',gap:'8px'}}>
                      <span style={{fontSize:'14px'}}>🧾</span>
                      <div>
                        <div style={{fontSize:'10px',fontWeight:700,color:'#2B6B3E',letterSpacing:'0.1em',fontFamily:'Space Mono'}}>MATÉRIAUX ACHETÉS — ARTISAN</div>
                        <div style={{fontSize:'11px',color:'#7A7A6E',marginTop:'1px'}}>Main d'œuvre fixée · seuls les matériaux sont justifiés ici</div>
                      </div>
                    </div>
                    <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:'8px'}}>
                      {upd.diag_change_note && (
                        <div style={{background:'rgba(232,93,38,0.06)',border:'1px solid rgba(232,93,38,0.2)',borderRadius:'10px',padding:'8px 12px',fontSize:'12px',color:'#0F1410',lineHeight:'1.5'}}>
                          <span style={{fontWeight:700,color:'#E85D26'}}>⚠️ Diagnostic modifié : </span>{upd.diag_change_note}
                        </div>
                      )}
                      {/* Main d'œuvre fixe */}
                      {laborFixed > 0 && (
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',background:'rgba(201,168,76,0.07)',borderRadius:'8px'}}>
                          <span style={{fontSize:'12px',color:'#7A7A6E'}}>🔧 Main d'œuvre (fixe)</span>
                          <span style={{fontFamily:'Space Mono',fontSize:'13px',fontWeight:700,color:'#C9A84C'}}>{laborFixed.toLocaleString('fr')} F</span>
                        </div>
                      )}
                      {/* Matériaux */}
                      {mats.map((m: any, i: number) => (
                        <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 10px',background:'rgba(0,0,0,0.02)',borderRadius:'8px'}}>
                          <span style={{fontSize:'12px',color:'#0F1410',flex:1}}>{m.qty > 1 ? `${m.qty}× ` : ''}{m.name}</span>
                          <span style={{fontFamily:'Space Mono',fontSize:'12px',color:'#0F1410',fontWeight:600,flexShrink:0}}>{(m.qty * m.prix_unitaire).toLocaleString('fr')} F</span>
                        </div>
                      ))}
                      {/* Total */}
                      <div style={{borderTop:'1px solid #D8D2C4',paddingTop:'8px',display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                        <span style={{fontWeight:700,fontSize:'13px',color:'#0F1410'}}>Total</span>
                        <span style={{fontFamily:'Space Mono',fontSize:'20px',fontWeight:700,color:'#0F1410'}}>{(upd.total ?? matTotal + laborFixed).toLocaleString('fr')} <span style={{fontSize:'12px',color:'#7A7A6E',fontFamily:'inherit'}}>FCFA</span></span>
                      </div>
                      <div style={{fontSize:'10px',color:'#7A7A6E'}}>{new Date(msg.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
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

      {/* ─── DRAWER MISE À JOUR MATÉRIAUX (artisan, en_cours) ──────────── */}
      {showMatUpdate && isArtisan && (
        <div style={{background:'white',borderTop:'2px solid #2B6B3E',padding:'16px',flexShrink:0,maxHeight:'70vh',overflowY:'auto'}}>
          <div style={{maxWidth:'672px',margin:'0 auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
              <span style={{fontWeight:700,fontSize:'15px',color:'#0F1410'}}>🧾 Matériaux achetés</span>
              <button onClick={() => setShowMatUpdate(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7A7A6E'}}><X size={18}/></button>
            </div>

            {/* Info règle : MO fixe */}
            <div style={{background:'rgba(201,168,76,0.08)',border:'1px solid rgba(201,168,76,0.3)',borderRadius:'10px',padding:'10px 12px',marginBottom:'12px',fontSize:'12px',color:'#7A7A6E',lineHeight:'1.6'}}>
              <strong style={{color:'#C9A84C'}}>Règle AfriOne :</strong> La main d'œuvre ({pricingSuggestion ? `${pricingSuggestion.decomp.labor.toLocaleString('fr')} FCFA` : 'calculée au diagnostic'}) est <strong>fixe et non négociable</strong>. Vous ne justifiez ici que les matériaux réellement achetés.
            </div>

            {/* Diagnostic changé ? */}
            <div style={{marginBottom:'12px'}}>
              <label style={{fontSize:'11px',fontWeight:600,color:'#7A7A6E',display:'block',marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Diagnostic modifié ? (optionnel)</label>
              <input value={diagChangeNote} onChange={e => setDiagChangeNote(e.target.value)}
                placeholder="ex: J'ai découvert une fuite supplémentaire sous l'évier"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #D8D2C4',borderRadius:'10px',fontSize:'13px',outline:'none',boxSizing:'border-box' as const,color:'#0F1410'}} />
            </div>

            {/* Liste matériaux ajoutés */}
            {purchasedMats.length > 0 && (
              <div style={{marginBottom:'12px',display:'flex',flexDirection:'column',gap:'6px'}}>
                {purchasedMats.map((m, i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 10px',background:'rgba(43,107,62,0.05)',border:'1px solid rgba(43,107,62,0.2)',borderRadius:'8px'}}>
                    <div style={{flex:1,fontSize:'13px',color:'#0F1410'}}>{m.qty > 1 ? `${m.qty}× ` : ''}{m.name}</div>
                    <div style={{fontFamily:'Space Mono',fontSize:'13px',fontWeight:600,color:'#0F1410',flexShrink:0}}>{(m.qty*m.prix_unitaire).toLocaleString('fr')} F</div>
                    <button onClick={() => setPurchasedMats(ms => ms.filter((_,j) => j !== i))} style={{background:'none',border:'none',cursor:'pointer',color:'#7A7A6E',padding:'0',lineHeight:0,flexShrink:0}}>
                      <X size={13}/>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Formulaire ajout article */}
            <div style={{background:'rgba(0,0,0,0.02)',border:'1px dashed #D8D2C4',borderRadius:'10px',padding:'10px',marginBottom:'12px'}}>
              <div style={{fontSize:'11px',fontWeight:600,color:'#7A7A6E',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Ajouter un article</div>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                <input value={newMatName} onChange={e => setNewMatName(e.target.value)} placeholder="Nom du matériau"
                  style={{padding:'8px 10px',border:'1px solid #D8D2C4',borderRadius:'8px',fontSize:'13px',outline:'none',color:'#0F1410'}} />
                <input type="number" value={newMatQty} onChange={e => setNewMatQty(e.target.value)} placeholder="Qté"
                  style={{padding:'8px 10px',border:'1px solid #D8D2C4',borderRadius:'8px',fontSize:'13px',outline:'none',color:'#0F1410'}} />
                <input type="number" value={newMatPrix} onChange={e => setNewMatPrix(e.target.value)} placeholder="Prix/u FCFA"
                  style={{padding:'8px 10px',border:'1px solid #D8D2C4',borderRadius:'8px',fontSize:'13px',outline:'none',color:'#0F1410'}} />
              </div>
              <button onClick={addPurchasedMat} disabled={!newMatName.trim() || !newMatPrix}
                style={{width:'100%',padding:'8px',background:'transparent',border:'1px dashed rgba(43,107,62,0.5)',borderRadius:'8px',color:'#2B6B3E',fontWeight:600,fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',opacity:!newMatName.trim()||!newMatPrix?0.4:1}}>
                <Plus size={13}/> Ajouter
              </button>
            </div>

            {/* Total récapitulatif */}
            {purchasedMats.length > 0 && (
              <div style={{background:'#F5F0E8',borderRadius:'10px',padding:'10px 14px',marginBottom:'12px',display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                <span style={{fontSize:'12px',color:'#7A7A6E'}}>Total matériaux + MO</span>
                <span style={{fontFamily:'Space Mono',fontSize:'18px',fontWeight:700,color:'#0F1410'}}>
                  {((pricingSuggestion?.decomp.labor ?? 0) + purchasedMats.reduce((s,m) => s+m.qty*m.prix_unitaire,0)).toLocaleString('fr')} F
                </span>
              </div>
            )}

            <button onClick={sendMatUpdate} disabled={sendingMatUpdate || !purchasedMats.length}
              style={{width:'100%',padding:'12px',background:purchasedMats.length?'#2B6B3E':'#D8D2C4',color:'white',border:'none',borderRadius:'12px',fontWeight:700,fontSize:'14px',cursor:purchasedMats.length?'pointer':'default',opacity:sendingMatUpdate?0.6:1}}>
              {sendingMatUpdate ? 'Envoi…' : '📤 Envoyer au client →'}
            </button>
          </div>
        </div>
      )}

      {/* Zone actions bas */}
      {!isClosed ? (
        <div style={{background:'white',borderTop:'1px solid #D8D2C4',padding:'10px 16px',flexShrink:0}}>
          <div style={{maxWidth:'672px',margin:'0 auto'}}>

            {/* Artisan : Actions de discussion (negotiation/matching) */}
            {isArtisan && (status === 'negotiation' || status === 'matching') && !showDevis && !showMatSuggest && !showTimeAdj && (
              <div style={{marginBottom:'8px',display:'flex',gap:'6px',flexWrap:'wrap'}}>
                {/* Matériau non prévu */}
                <button onClick={() => { setShowMatSuggest(true); setShowTimeAdj(false); loadPricingSuggestion() }} style={{
                  flex:1,minWidth:'130px',padding:'9px 10px',background:'rgba(201,168,76,0.08)',
                  border:'1px dashed #C9A84C',borderRadius:'10px',color:'#C9A84C',
                  fontWeight:600,fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',
                }}>
                  📦 Matériau non prévu
                </button>
                {/* Requalifier le temps */}
                <button onClick={() => { setShowTimeAdj(true); setShowMatSuggest(false) }} style={{
                  flex:1,minWidth:'130px',padding:'9px 10px',background:'rgba(232,93,38,0.06)',
                  border:'1px dashed rgba(232,93,38,0.6)',borderRadius:'10px',color:'#E85D26',
                  fontWeight:600,fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',
                }}>
                  ⏱ +Temps
                </button>
                {/* Proposition finale (si des ajustements existent) ou devis simple */}
                {messages.some(m => m.type === 'material_suggest' || m.type === 'time_adjust') ? (
                  <button onClick={sendFinalProposal} disabled={acting} style={{
                    width:'100%',marginTop:'4px',padding:'11px',background:'#0F1410',
                    color:'white',border:'none',borderRadius:'10px',
                    fontWeight:700,fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',
                    opacity: acting ? 0.6 : 1,
                  }}>
                    ⚖️ {acting ? 'Envoi…' : 'Lancer la proposition finale'}
                  </button>
                ) : (
                  <button onClick={openDevis} style={{
                    width:'100%',marginTop:'4px',padding:'10px',background:'rgba(232,93,38,0.08)',
                    border:'1px dashed #E85D26',borderRadius:'10px',color:'#E85D26',
                    fontWeight:600,fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',
                  }}>
                    💰 Proposer un devis
                  </button>
                )}
              </div>
            )}

            {/* Bouton artisan : Mise à jour matériaux (en_cours) */}
            {isArtisan && (status === 'en_cours' || status === 'en_route') && !showMatUpdate && (
              <div style={{marginBottom:'8px'}}>
                <button onClick={() => { setShowMatUpdate(true); loadPricingSuggestion() }} style={{
                  width:'100%',padding:'10px',background:'rgba(43,107,62,0.08)',
                  border:'1px dashed #2B6B3E',borderRadius:'10px',color:'#2B6B3E',
                  fontWeight:600,fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',
                }}>
                  🧾 Déclarer les matériaux achetés
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
                    mission_id: missionId, sender_id: user.id, sender_role: missionRole,
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

            {/* Label résumé pré-rempli (client uniquement) */}
            {!isArtisan && diagData && input === diagData.ai_summary && (
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px',padding:'6px 10px',background:'rgba(201,168,76,0.08)',border:'1px solid rgba(201,168,76,0.25)',borderRadius:'8px'}}>
                <span style={{fontSize:'11px',color:'#C9A84C',fontWeight:600,display:'flex',alignItems:'center',gap:'5px'}}>
                  📋 Résumé de votre diagnostic — envoyez-le ou modifiez-le
                </span>
                <button onClick={() => setInput('')} style={{background:'none',border:'none',cursor:'pointer',color:'#7A7A6E',padding:'0',lineHeight:0}}>
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Input message — toujours présent sauf si closed */}
            <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                placeholder="Votre message…" className="input" style={{flex:1}} />
              <button onClick={send} disabled={!input.trim() || sending}
                style={{width:'44px',height:'44px',background:'#E85D26',color:'white',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',border:'none',cursor:(!input.trim()||sending)?'not-allowed':'pointer',flexShrink:0,opacity:(input.trim()&&!sending)?1:0.4}}>
                {sending
                  ? <div style={{width:'16px',height:'16px',border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid white',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
                  : <Send size={18} />}
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
