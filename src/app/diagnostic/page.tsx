'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Zap, AlertCircle, Clock, Wrench } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type DiagStep = 'input' | 'loading' | 'result'

interface DiagResult {
  summary: string
  category: string
  urgency: 'low' | 'medium' | 'high' | 'emergency'
  price_min: number
  price_max: number
  items_needed: string[]
  duration_estimate: string
}

const URGENCY_CONFIG = {
  low: { label: 'Pas urgent', color: 'text-accent2', bg: 'bg-accent2/10', icon: '🟢' },
  medium: { label: 'Normal', color: 'text-gold', bg: 'bg-gold/10', icon: '🟡' },
  high: { label: 'Urgent', color: 'text-accent', bg: 'bg-accent/10', icon: '🟠' },
  emergency: { label: 'Urgence', color: 'text-red-600', bg: 'bg-red-50', icon: '🔴' },
}

const EXAMPLES = [
  "Ma fuite d'eau sous l'évier est de plus en plus forte depuis ce matin",
  "Le disjoncteur de ma chambre saute tout le temps quand j'allume la clim",
  "Je voudrais repeindre mon salon de 25m² en blanc cassé",
]

export default function DiagnosticPage() {
  const router = useRouter()
  const [step, setStep] = useState<DiagStep>('input')
  const [text, setText] = useState('')
  const [result, setResult] = useState<DiagResult & { mission_id?: string } | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [quartier, setQuartier] = useState<string>('')

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUserId(session.user.id)
        const { data: userData } = await supabase
          .from('users')
          .select('quartier')
          .eq('id', session.user.id)
          .single()
        if (userData?.quartier) setQuartier(userData.quartier)
      }
    }
    getUser()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setStep('loading')

    try {
      const res = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, user_id: userId, quartier }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
      setStep('result')
    } catch (err) {
      setResult({
        summary: "Problème détecté nécessitant une intervention professionnelle.",
        category: 'Plomberie',
        urgency: 'medium',
        price_min: 8000,
        price_max: 35000,
        items_needed: ['Matériaux selon diagnostic'],
        duration_estimate: '1 à 3 heures',
      })
      setStep('result')
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="mb-10">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-dark mb-6 transition-colors">
              <ArrowLeft size={16} /> Retour à l'accueil
            </Link>
            <span className="section-label block mb-2">DIAGNOSTIC IA</span>
            <h1 className="font-display text-4xl font-bold text-dark">
              Décrivez votre problème
            </h1>
            <p className="text-muted mt-2">Notre IA analyse votre besoin et estime le prix en quelques secondes</p>
          </div>

          {/* STEP: INPUT */}
          {step === 'input' && (
            <div className="animate-fade-up">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Exemple : Ma fuite d'eau sous l'évier est de plus en plus forte, il y a de l'eau qui coule depuis ce matin..."
                    className="input min-h-40 resize-none text-base leading-relaxed"
                    maxLength={1000}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted">Soyez précis : lieu, symptômes, depuis quand</span>
                    <span className="text-xs text-muted font-mono">{text.length}/1000</span>
                  </div>
                </div>

                {/* Examples */}
                <div>
                  <p className="text-xs font-mono text-muted uppercase tracking-wider mb-3">EXEMPLES</p>
                  <div className="space-y-2">
                    {EXAMPLES.map(ex => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setText(ex)}
                        className="w-full text-left text-sm text-muted bg-bg2 hover:bg-border px-4 py-3 rounded-xl transition-colors border border-border hover:border-accent/30"
                      >
                        "{ex}"
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={text.length < 10}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Zap size={18} />
                  Analyser avec l'IA
                </button>
              </form>
            </div>
          )}

          {/* STEP: LOADING */}
          {step === 'loading' && (
            <div className="animate-fade-in text-center py-16">
              <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse-soft">
                <Zap size={32} className="text-accent" />
              </div>
              <h2 className="font-display text-2xl font-bold text-dark mb-2">Analyse en cours...</h2>
              <p className="text-muted">Notre IA analyse votre problème</p>
              <div className="flex justify-center gap-2 mt-8">
                {['Lecture du problème', 'Estimation du prix', 'Préparation du devis'].map((label, i) => (
                  <div key={label} className="flex items-center gap-2 text-xs text-muted bg-bg2 px-3 py-2 rounded-full animate-pulse-soft" style={{ animationDelay: `${i * 0.3}s` }}>
                    <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP: RESULT */}
          {step === 'result' && result && (
            <div className="animate-fade-up space-y-6">
              {/* Summary card */}
              <div className="card border-l-4 border-accent2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-accent2/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap size={16} className="text-accent2" />
                  </div>
                  <div>
                    <p className="font-mono text-xs text-accent2 uppercase tracking-wider mb-1">ANALYSE IA</p>
                    <p className="text-dark font-medium leading-relaxed">{result.summary}</p>
                  </div>
                </div>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="card text-center">
                  <Wrench size={20} className="text-accent mx-auto mb-2" />
                  <div className="font-display font-bold text-dark">{result.category}</div>
                  <div className="font-mono text-xs text-muted">Catégorie</div>
                </div>
                <div className="card text-center">
                  <div className={`text-2xl mb-1`}>{URGENCY_CONFIG[(result.urgency as keyof typeof URGENCY_CONFIG) || "medium"] || URGENCY_CONFIG["medium"].icon}</div>
                  <div className={`font-display font-bold ${URGENCY_CONFIG[(result.urgency as keyof typeof URGENCY_CONFIG) || "medium"] || URGENCY_CONFIG["medium"].color}`}>
                    {URGENCY_CONFIG[(result.urgency as keyof typeof URGENCY_CONFIG) || "medium"] || URGENCY_CONFIG["medium"].label}
                  </div>
                  <div className="font-mono text-xs text-muted">Urgence</div>
                </div>
                <div className="card text-center">
                  <Clock size={20} className="text-gold mx-auto mb-2" />
                  <div className="font-display font-bold text-dark">{result.duration_estimate}</div>
                  <div className="font-mono text-xs text-muted">Durée estimée</div>
                </div>
              </div>

              {/* Price estimate */}
              <div className="card bg-dark text-cream">
                <p className="font-mono text-xs text-muted uppercase tracking-wider mb-3">ESTIMATION DE PRIX</p>
                <div className="flex items-end gap-2">
                  <span className="font-display text-4xl font-bold text-accent">
                    {result.price_min.toLocaleString()}
                  </span>
                  <span className="text-muted mb-1">–</span>
                  <span className="font-display text-4xl font-bold text-cream">
                    {result.price_max.toLocaleString()}
                  </span>
                  <span className="text-muted mb-1 font-mono text-sm">FCFA</span>
                </div>
                <p className="text-xs text-muted mt-2">Prix final confirmé par l'artisan après diagnostic sur place</p>
              </div>

              {/* Items needed */}
              {result.items_needed.length > 0 && (
                <div className="card">
                  <p className="font-mono text-xs text-muted uppercase tracking-wider mb-3">MATÉRIEL PROBABLE</p>
                  <div className="flex flex-wrap gap-2">
                    {result.items_needed.map(item => (
                      <span key={item} className="badge-orange">{item}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <Link
                  href={result?.mission_id ? `/matching?mission=${result.mission_id}&category=${encodeURIComponent(result?.category || '')}` : `/artisans?category=${encodeURIComponent(result?.category || '')}`}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
                >
                  Trouver un artisan {result?.category}
                  <ArrowRight size={18} />
                </Link>
                <button
                  onClick={() => { setStep('input'); setResult(null) }}
                  className="btn-outline w-full text-center py-3"
                >
                  Recommencer
                </button>
              </div>

              <div className="flex items-start gap-2 bg-gold/10 border border-gold/20 rounded-xl p-4">
                <AlertCircle size={16} className="text-gold flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted">
                  Cette estimation est indicative. Le prix final sera confirmé par l'artisan après diagnostic sur place. 
                  Votre paiement sera sécurisé en séquestre jusqu'à la fin des travaux.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
