'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, CheckCircle, Clock, AlertCircle, Shield, FileText, Camera } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
    }
    init()
  }, [])

  const uploadDoc = async (field: 'cni_front' | 'cni_back' | 'diplome' | 'photo', file: File) => {
    if (!artisan) return
    setUploading(field)
    try {
      const ext = file.name.split('.').pop()
      const path = `kyc/${artisan.id}/${field}.${ext}`
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
    await supabase.from('kyc_security').update({ status: 'pending' }).eq('id', kyc.id)
    await supabase.from('artisan_pros').update({ kyc_status: 'pending' }).eq('id', artisan.id)
    setSubmitting(false)
    setMsg('Documents soumis ! En attente de validation (24-48h)')
  }

  const hasDoc = (field: string) => {
    if (!kyc) return false
    if (field === 'cni_front') return !!kyc.cni_front_url
    if (field === 'cni_back') return !!kyc.cni_back_url
    if (field === 'diplome') return (kyc.diploma_urls || []).length > 0
    if (field === 'photo') return !!kyc.cni_front_url
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

  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-dark text-cream">
        <div className="page-container py-4 flex items-center gap-3 max-w-2xl">
          <Link href="/artisan-space/dashboard" className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="font-display font-bold">Vérification d'identité (KYC)</div>
            <div className="text-xs text-muted">Obligatoire pour recevoir des missions</div>
          </div>
          {msg && <span style={{marginLeft:'auto',fontSize:'12px',color:'#2B6B3E',background:'rgba(43,107,62,0.15)',padding:'4px 12px',borderRadius:'20px'}}>{msg}</span>}
        </div>
      </div>

      <div className="pt-8 pb-16 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Status banner */}
          <div style={{
            background: kycStatus === 'approved' ? 'rgba(43,107,62,0.1)' : kycStatus === 'rejected' ? 'rgba(220,38,38,0.1)' : 'rgba(201,168,76,0.1)',
            border: `1px solid ${kycStatus === 'approved' ? 'rgba(43,107,62,0.3)' : kycStatus === 'rejected' ? 'rgba(220,38,38,0.3)' : 'rgba(201,168,76,0.3)'}`,
            borderRadius:'16px',padding:'16px',marginBottom:'32px',display:'flex',alignItems:'flex-start',gap:'12px'
          }}>
            <Clock size={18} style={{color: kycStatus === 'approved' ? '#2B6B3E' : '#C9A84C',flexShrink:0,marginTop:'2px'}} />
            <div>
              <div style={{fontWeight:600,color:'#0F1410',fontSize:'14px'}}>
                {kycStatus === 'approved' ? '✓ Profil vérifié' : kycStatus === 'rejected' ? '✗ Documents rejetés' : 'Vérification en attente'}
              </div>
              <div style={{fontSize:'12px',color:'#7A7A6E',marginTop:'4px'}}>
                {kycStatus === 'approved'
                  ? 'Votre identité a été vérifiée. Vous pouvez recevoir des missions.'
                  : kycStatus === 'rejected'
                  ? kyc?.rejection_reason || 'Certains documents ont été rejetés. Veuillez les renvoyer.'
                  : 'Envoyez vos documents pour que notre équipe valide votre profil. Délai : 24-48h ouvrées.'}
              </div>
            </div>
          </div>

          {/* Steps */}
          <div style={{display:'flex',gap:'8px',marginBottom:'32px'}}>
            {[
              { label: 'Documents envoyés', done: allRequired },
              { label: 'Vérification en cours', done: kycStatus !== 'pending' },
              { label: 'Profil validé', done: kycStatus === 'approved' },
            ].map((s, i) => (
              <div key={s.label} style={{flex:1,textAlign:'center'}}>
                <div style={{
                  width:'32px',height:'32px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                  margin:'0 auto 8px',fontSize:'13px',
                  background: s.done ? '#2B6B3E' : '#F5F3EE',
                  border: s.done ? 'none' : '1px solid #D8D2C4',
                  color: s.done ? 'white' : '#7A7A6E',
                }}>
                  {s.done ? <CheckCircle size={16}/> : i+1}
                </div>
                <div style={{fontSize:'11px',color:'#7A7A6E'}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Documents */}
          <div style={{display:'flex',flexDirection:'column',gap:'16px',marginBottom:'32px'}}>
            {docConfig.map(doc => {
              const uploaded = hasDoc(doc.id)
              const isUploading = uploading === doc.id
              return (
                <div key={doc.id} className="card">
                  <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
                    <div style={{width:'48px',height:'48px',background:'#F5F3EE',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <doc.icon size={20} style={{color:'#7A7A6E'}} />
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                        <span style={{fontWeight:700,color:'#0F1410',fontSize:'15px'}}>{doc.label}</span>
                        {doc.required && <span style={{fontSize:'11px',color:'#E85D26',background:'rgba(232,93,38,0.1)',padding:'2px 8px',borderRadius:'20px'}}>Obligatoire</span>}
                        {uploaded && <span style={{fontSize:'11px',color:'#2B6B3E',background:'rgba(43,107,62,0.1)',padding:'2px 8px',borderRadius:'20px'}}>✓ Envoyé</span>}
                      </div>
                      <p style={{fontSize:'13px',color:'#7A7A6E',marginTop:'2px'}}>{doc.desc}</p>
                    </div>
                    <button
                      onClick={() => refs[doc.id].current?.click()}
                      disabled={isUploading}
                      style={{
                        flexShrink:0,display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',fontWeight:500,
                        padding:'8px 16px',borderRadius:'10px',border:'1px solid #D8D2C4',cursor:'pointer',
                        background: uploaded ? '#F5F3EE' : '#0F1410',
                        color: uploaded ? '#7A7A6E' : '#FAFAF5',
                      }}
                    >
                      {isUploading
                        ? <div style={{width:'14px',height:'14px',border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid white',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
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
            <p style={{fontSize:'12px',color:'#7A7A6E'}}>
              Vos documents sont chiffrés et stockés de façon sécurisée. Ils ne sont utilisés qu'à des fins de vérification d'identité conformément au RGPD.
            </p>
          </div>

          <button
            onClick={submit}
            disabled={!allRequired || submitting || kycStatus === 'approved'}
            style={{
              width:'100%',padding:'16px',borderRadius:'12px',border:'none',cursor: allRequired ? 'pointer' : 'not-allowed',
              background: allRequired && kycStatus !== 'approved' ? '#E85D26' : '#D8D2C4',
              color:'white',fontSize:'15px',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
            }}
          >
            {submitting
              ? <><div style={{width:'16px',height:'16px',border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid white',borderRadius:'50%',animation:'spin 1s linear infinite'}} /> Envoi...</>
              : kycStatus === 'approved'
              ? '✓ Déjà vérifié'
              : allRequired ? 'Soumettre pour vérification' : 'Envoyez tous les documents obligatoires'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
