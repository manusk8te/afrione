'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, CheckCircle, Clock, AlertCircle, Shield, FileText, Camera } from 'lucide-react'

type DocStatus = 'empty' | 'uploaded' | 'approved' | 'rejected'

export default function KYCPage() {
  const [docs, setDocs] = useState<Record<string, DocStatus>>({
    cni_front: 'empty',
    cni_back: 'empty',
    diplome: 'empty',
    photo: 'empty',
  })

  const upload = (key: string) => {
    setDocs(d => ({ ...d, [key]: 'uploaded' }))
  }

  const allUploaded = Object.values(docs).every(v => v !== 'empty')

  const docConfig = [
    { id: 'cni_front', label: 'CNI Recto', desc: 'Carte Nationale d\'Identité — côté face', icon: FileText, required: true },
    { id: 'cni_back', label: 'CNI Verso', desc: 'Carte Nationale d\'Identité — côté dos', icon: FileText, required: true },
    { id: 'diplome', label: 'Diplôme / Certificat', desc: 'Attestation de formation ou certificat professionnel', icon: Shield, required: false },
    { id: 'photo', label: 'Photo de profil', desc: 'Photo récente, fond neutre, visage visible', icon: Camera, required: true },
  ]

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
        </div>
      </div>

      <div className="pt-8 pb-16 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Status banner */}
          <div className="bg-gold/10 border border-gold/20 rounded-2xl p-4 mb-8 flex items-start gap-3">
            <Clock size={18} className="text-gold flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-dark text-sm">Vérification en attente</div>
              <div className="text-xs text-muted mt-0.5">
                Envoyez vos documents pour que notre équipe valide votre profil. Délai : 24-48h ouvrées.
              </div>
            </div>
          </div>

          {/* Process steps */}
          <div className="flex gap-2 mb-8">
            {[
              { label: 'Documents envoyés', done: allUploaded },
              { label: 'Vérification en cours', done: false },
              { label: 'Profil validé', done: false },
            ].map((s, i) => (
              <div key={s.label} className="flex-1 text-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 text-sm ${
                  s.done ? 'bg-accent2 text-white' : 'bg-bg2 border border-border text-muted'
                }`}>
                  {s.done ? <CheckCircle size={16} /> : i + 1}
                </div>
                <div className="text-xs text-muted">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Documents */}
          <div className="space-y-4 mb-8">
            {docConfig.map(doc => {
              const status = docs[doc.id]
              return (
                <div key={doc.id} className="card">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-bg2 rounded-xl flex items-center justify-center flex-shrink-0">
                      <doc.icon size={20} className="text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-dark">{doc.label}</span>
                        {doc.required && <span className="badge-orange text-xs">Obligatoire</span>}
                        {status === 'uploaded' && <span className="badge-green text-xs">✓ Envoyé</span>}
                        {status === 'approved' && <span className="badge-green text-xs">✓ Approuvé</span>}
                        {status === 'rejected' && (
                          <span className="badge bg-red-100 text-red-700 text-xs">✗ Rejeté</span>
                        )}
                      </div>
                      <p className="text-sm text-muted mt-0.5">{doc.desc}</p>

                      {status === 'rejected' && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mt-3">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-600">Document illisible. Veuillez renvoyer une photo nette.</p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => upload(doc.id)}
                      className={`flex-shrink-0 flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-colors ${
                        status === 'uploaded' || status === 'approved'
                          ? 'bg-bg2 text-muted hover:bg-border'
                          : 'bg-dark text-cream hover:bg-accent'
                      }`}
                    >
                      <Upload size={14} />
                      {status === 'empty' ? 'Envoyer' : 'Remplacer'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Info */}
          <div className="flex items-start gap-3 bg-accent2/5 border border-accent2/20 rounded-xl p-4 mb-6">
            <Shield size={16} className="text-accent2 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted">
              Vos documents sont chiffrés et stockés de façon sécurisée. Ils ne sont utilisés qu'à des fins de vérification d'identité conformément au RGPD.
            </p>
          </div>

          <button
            disabled={!allUploaded}
            className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <CheckCircle size={16} />
            {allUploaded ? 'Soumettre pour vérification' : 'Envoyez tous les documents obligatoires'}
          </button>
        </div>
      </div>
    </div>
  )
}
