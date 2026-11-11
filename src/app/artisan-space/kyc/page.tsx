'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Journey, { type JourneyStep } from '@/components/journey/Journey'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, CheckCircle, Clock, AlertCircle, Shield, FileText, Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const NEU_SHADOW = 'var(--ui-shadow-card)'
const NEU_SMALL  = 'var(--ui-shadow-soft)'

export default function KYCPage() {
  const router = useRouter()
  const [artisan, setArtisan] = useState<any>(null)
  const [kyc, setKyc] = useState<any>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const refs = {
    cni_front: useRef<HTMLInputElement>(null),
    cni_back: useRef<HTMLInputElement>(null),
    diplome: useRef<HTMLInputElement>(null),
    photo: useRef<HTMLInputElement>(null),
  }

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }

      const { data: artisanData } = await supabase
        .from('artisan_pros')
        .select('*')
        .eq('user_id', session.user.id)
        .single()
      if (!artisanData) { router.push('/artisan-space/register'); return }
      setArtisan(artisanData)

      // Si déjà approved → dashboard direct
      if (artisanData.kyc_status === 'approved') {
        router.push('/artisan-space/dashboard'); return
      }

      const { data: kycData } = await supabase
        .from('kyc_security')
        .select('*')
        .eq('artisan_id', artisanData.id)
        .single()
      setKyc(kycData)
      const { data: profile } = await supabase.from('users').select('avatar_url').eq('id', session.user.id).single()
      setAvatarUrl(profile?.avatar_url ?? null)
    }
    init()
  }, [])

  const uploadDoc = async (field: 'cni_front' | 'cni_back' | 'diplome' | 'photo', file: File) => {
    setUploading(field)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setMsg('Non connecté'); setUploading(null); return }
      let currentArtisan = artisan
      if (!currentArtisan) {
        const { data } = await supabase.from('artisan_pros').select('*').eq('user_id', session.user.id).single()
        if (!data) { setMsg('Profil artisan introuvable'); setUploading(null); return }
        currentArtisan = data
        setArtisan(data)
      }
      const ext = file.name.split('.').pop()
      const path = `kyc/${currentArtisan.id}/${field}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('kyc-documents')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('kyc-documents').getPublicUrl(path)

      const fieldMap: Record<string, string> = {
        cni_front: 'cni_front_url',
        cni_back: 'cni_back_url',
        photo: 'cni_front_url', // photo de profil → on update users aussi
        diplome: 'diploma_urls',
      }

      if (kyc) {
        if (field === 'diplome') {
          const existing = kyc.diploma_urls || []
          await supabase.from('kyc_security').update({ diploma_urls: [...existing, publicUrl] }).eq('id', kyc.id)
          setKyc((k: any) => ({ ...k, diploma_urls: [...(k.diploma_urls || []), publicUrl] }))
        } else {
          await supabase.from('kyc_security').update({ [fieldMap[field]]: publicUrl }).eq('id', kyc.id)
          setKyc((k: any) => ({ ...k, [fieldMap[field]]: publicUrl }))
        }
      } else {
        const insertData: any = { artisan_id: artisan.id, status: 'pending' }
        if (field === 'cni_front') insertData.cni_front_url = publicUrl
        if (field === 'cni_back') insertData.cni_back_url = publicUrl
        if (field === 'diplome') insertData.diploma_urls = [publicUrl]
        const { data: newKyc } = await supabase.from('kyc_security').insert(insertData).select().single()
        setKyc(newKyc)
      }

      // Si c'est la photo de profil → update users.avatar_url
      if (field === 'photo') {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', session.user.id)
        setAvatarUrl(publicUrl)
      }

      setMsg('✓ Document uploadé')
      setTimeout(() => setMsg(''), 3000)
    } catch (err: any) {
      setMsg('Erreur: ' + err.message)
    }
    setUploading(null)
  }

  const handleFileChange = (field: 'cni_front' | 'cni_back' | 'diplome' | 'photo') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadDoc(field, file)
  }

  const submit = async () => {
    if (!kyc || !artisan) return
    setSubmitting(true)
    const sentAt = new Date().toISOString()
    await supabase.from('kyc_security').update({ status: 'pending', submitted_at: sentAt, rejection_reason: null }).eq('id', kyc.id)
    await supabase.from('artisan_pros').update({ kyc_status: 'pending' }).eq('id', artisan.id)
    setKyc((k: any) => ({ ...k, status: 'pending', submitted_at: sentAt, rejection_reason: null }))
    setArtisan((a: any) => ({ ...a, kyc_status: 'pending' }))
    setSubmitting(false)
    setMsg('Documents envoyés ! Vérification sous 24 à 48 h.')
  }

  const hasDoc = (field: string) => {
    if (field === 'photo') return !!avatarUrl
    if (!kyc) return false
    if (field === 'cni_front') return !!kyc.cni_front_url
    if (field === 'cni_back') return !!kyc.cni_back_url
    if (field === 'diplome') return (kyc.diploma_urls || []).length > 0
    return false
  }

  const docConfig = [
    { id: 'cni_front' as const, label: 'CNI Recto', desc: "Carte Nationale d'Identité — côté face", icon: FileText, required: true },
    { id: 'cni_back' as const, label: 'CNI Verso', desc: "Carte Nationale d'Identité — côté dos", icon: FileText, required: true },
    { id: 'diplome' as const, label: 'Diplôme / Certificat', desc: 'Attestation de formation ou certificat professionnel', icon: Shield, required: false },
    { id: 'photo' as const, label: 'Photo de profil', desc: 'Photo récente, fond neutre, visage visible', icon: Camera, required: true },
  ]

  const allRequired = docConfig.filter(d => d.required).every(d => hasDoc(d.id))
  const kycStatus = artisan?.kyc_status || 'pending'
  const submitted = kycStatus === 'pending' && !!kyc?.submitted_at

  return (
    <div className="min-h-screen" style={{background:'var(--ui-canvas)'}}>
      {/* Header bar */}
      <div style={{background:'#FFFFFF',borderBottom:'1px solid var(--ui-border)',boxShadow:NEU_SMALL}}>
        <div className="page-container py-4 flex items-center gap-3 max-w-2xl">
          <Link href="/artisan-space/dashboard" style={{padding:'4px',borderRadius:'8px',display:'flex',alignItems:'center',color:'var(--ui-muted)',textDecoration:'none'}}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="font-display font-bold" style={{color:'var(--ui-ink)'}}>Vérification d'identité (KYC)</div>
            <div style={{fontSize:'12px',color:'#8B95A5'}}>Obligatoire pour recevoir des missions</div>
          </div>
          {msg && <span style={{marginLeft:'auto',fontSize:'12px',color:'#2B6B3E',background:'rgba(43,107,62,0.15)',padding:'4px 12px',borderRadius:'20px'}}>{msg}</span>}
        </div>
      </div>

      <div className="pt-8 pb-16 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Suivi guidé : où j'en suis, quoi faire, où cliquer */}
          <div style={{marginBottom:'24px'}}>
            <Journey
              title="Vérifier votre identité"
              intro="C’est obligatoire pour apparaître dans l’annuaire et recevoir des missions. Cela prend environ 5 minutes."
              steps={((): JourneyStep[] => {
                const missing = docConfig.filter(d => d.required && !hasDoc(d.id)).map(d => d.label)
                const rejected = kycStatus === 'rejected'
                const approved = kycStatus === 'approved'
                return [
                  {
                    id: 'docs',
                    title: 'Envoyer vos documents',
                    help: 'Prenez en photo votre carte d’identité (recto et verso) et une photo de vous. Le diplôme est facultatif.',
                    state: rejected ? 'problem' : approved || allRequired ? 'done' : 'current',
                    status: rejected ? 'Refusé' : approved || allRequired ? 'Envoyés' : missing.length ? `Il manque : ${missing.join(', ')}` : undefined,
                    href: '#documents',
                    cta: rejected ? 'Renvoyer mes documents' : 'Envoyer mes documents',
                  },
                  {
                    id: 'review',
                    title: 'Vérification par AfriOne',
                    help: 'Notre équipe contrôle vos documents sous 24 à 48 h ouvrées. Vous n’avez rien à faire pendant ce temps.',
                    state: approved ? 'done' : rejected ? 'problem' : submitted ? 'waiting' : allRequired ? 'current' : 'todo',
                    status: approved ? 'Terminée' : rejected ? (kyc?.rejection_reason || 'Documents à refaire') : submitted ? 'En cours (24 à 48 h)' : allRequired ? 'À envoyer' : undefined,
                    href: rejected ? '#documents' : allRequired && !submitted ? '#submit' : undefined,
                    cta: rejected ? 'Corriger mes documents' : 'Envoyer pour vérification',
                  },
                  {
                    id: 'ok',
                    title: 'Profil validé',
                    help: 'Vous apparaissez dans l’annuaire et vous recevez des demandes de clients.',
                    state: approved ? 'done' : 'todo',
                    status: approved ? 'Vous êtes en ligne' : undefined,
                  },
                ]
              })()}
            />
          </div>

          {/* Documents */}
          <h2 id="documents" style={{fontFamily:'var(--font-display)',fontSize:'18px',fontWeight:700,color:'var(--ui-ink)',margin:'0 0 4px'}}>Vos documents</h2>
          <p style={{margin:'0 0 14px',color:'var(--ui-muted)',fontSize:'14px',lineHeight:1.45}}>Touchez « Envoyer » à côté de chaque document. Une fois les documents obligatoires envoyés, la vérification démarre toute seule.</p>
          <div style={{display:'flex',flexDirection:'column',gap:'12px',marginBottom:'24px',scrollMarginTop:'80px'}}>
            {docConfig.map(doc => {
              const uploaded = hasDoc(doc.id)
              const isUploading = uploading === doc.id
              return (
                <div key={doc.id} style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'20px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
                    <div style={{width:'48px',height:'48px',background:'var(--ui-canvas)',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:NEU_SMALL}}>
                      <doc.icon size={20} style={{color:'#8B95A5'}} />
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                        <span style={{fontWeight:700,color:'var(--ui-ink)',fontSize:'15px'}}>{doc.label}</span>
                        {doc.required && <span  style={{color:'#9a3412',fontSize:'11px',background:'rgba(232,93,38,0.1)',padding:'2px 8px',borderRadius:'20px'}}>Obligatoire</span>}
                        {uploaded && <span style={{fontSize:'11px',color:'#2B6B3E',background:'rgba(43,107,62,0.1)',padding:'2px 8px',borderRadius:'20px'}}>✓ Envoyé</span>}
                      </div>
                      <p style={{fontSize:'13px',color:'var(--ui-muted)',marginTop:'2px'}}>{doc.desc}</p>
                    </div>
                    <button className="afrione-action"
                      onClick={() => refs[doc.id].current?.click()}
                      disabled={isUploading}
                      style={{
                        flexShrink:0,display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',fontWeight:500,
                        padding:'8px 16px',borderRadius:'10px',border:'1.5px solid var(--ui-border)',cursor:'pointer',
                        background: uploaded ? 'var(--ui-canvas)' : '#FFFFFF',
                        boxShadow: NEU_SMALL,
                        color: uploaded ? '#8B95A5' : 'var(--ui-ink)',
                      }}
                    >
                      {isUploading
                        ? <div style={{width:'14px',height:'14px',border:'2px solid rgba(139,149,165,0.3)',borderTop:'2px solid #8B95A5',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
                        : <Upload size={14}/>
                      }
                      {uploaded ? 'Remplacer' : 'Envoyer'}
                    </button>
                    <input ref={refs[doc.id]} type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={handleFileChange(doc.id)} />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{display:'flex',alignItems:'flex-start',gap:'12px',background:'rgba(43,107,62,0.05)',border:'1px solid rgba(43,107,62,0.2)',borderRadius:'12px',padding:'16px',marginBottom:'24px'}}>
            <Shield size={16} style={{color:'#2B6B3E',flexShrink:0,marginTop:'2px'}} />
            <p style={{fontSize:'12px',color:'var(--ui-muted)'}}>
              Vos documents sont chiffrés et stockés de façon sécurisée. Ils ne sont utilisés qu'à des fins de vérification d'identité conformément au RGPD.
            </p>
          </div>

          <button
            id="submit"
            onClick={submit}
            disabled={!allRequired || submitting || kycStatus === 'approved' || submitted}
            className={(allRequired && kycStatus !== 'approved' ? 'afrione-gradient' : '') + ' afrione-action'}
            style={{
              width:'100%',padding:'16px',borderRadius:'12px',border:'none',cursor: allRequired ? 'pointer' : 'not-allowed',
              background: allRequired && kycStatus !== 'approved' ? undefined : 'var(--ui-border)',
              color: allRequired && kycStatus !== 'approved' ? 'white' : '#8B95A5',
              fontSize:'15px',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
            }}
          >
            {submitting
              ? <><div style={{width:'16px',height:'16px',border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid white',borderRadius:'50%',animation:'spin 1s linear infinite'}} /> Envoi...</>
              : kycStatus === 'approved'
              ? '✓ Déjà vérifié'
              : submitted ? '✓ Envoyé : vérification en cours'
              : allRequired ? 'Envoyer pour vérification' : 'Envoyez tous les documents obligatoires'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
