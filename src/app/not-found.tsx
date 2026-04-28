import Link from 'next/link'
import { ArrowLeft, Zap } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="font-display text-[120px] font-bold text-accent/20 leading-none mb-4">404</div>
        <Link href="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-xl text-cream">AFRI<span className="text-accent">ONE</span></span>
        </Link>
        <h1 className="font-display text-3xl font-bold text-cream mb-3">Page introuvable</h1>
        <p className="text-muted mb-8 leading-relaxed">
          Cette page n'existe pas ou a été déplacée. Revenez à l'accueil pour continuer.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="btn-primary flex items-center justify-center gap-2">
            <ArrowLeft size={16} /> Retour à l'accueil
          </Link>
          <Link href="/diagnostic" className="bg-white/10 border border-white/20 text-cream font-semibold px-6 py-3 rounded-xl hover:bg-white/20 transition-all text-center">
            Décrire mon besoin
          </Link>
        </div>
      </div>
    </div>
  )
}
