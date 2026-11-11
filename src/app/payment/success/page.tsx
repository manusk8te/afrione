'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import SuppliesNotice from '@/components/pricing/SuppliesNotice'
import { clientApi } from '@/lib/client-api'
import Brand from '@/components/brand/Brand'
function Receipt() {
 const params=useSearchParams();const id=params.get('mission')
 const [receipt,setReceipt]=useState<any>(null)
 const [error,setError]=useState('')
 useEffect(()=>{let active=true
  if(!id){setError('Mission manquante');return}
  clientApi(`/api/payment?mission_id=${encodeURIComponent(id)}`).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active)setReceipt(d.receipt)}).catch(e=>{if(active)setError(e.message)})
  return()=>{active=false}
 },[id])
 return <main className="pay-shell afrione-gradient"><section className="pay-card" style={{textAlign:'left'}}><div className="pay-brand"><Brand /></div>
 <p style={{margin:'0 0 6px',color:'#9a3412',fontWeight:700,fontSize:13,letterSpacing:'0.06em',textTransform:'uppercase'}}>Démonstration</p>
 <h1 className="pay-title">{receipt?'Paiement simulé confirmé':'Vérification du paiement simulé'}</h1>
 {error?<p role="alert">{error}</p>:!receipt?<p>Chargement du reçu…</p>:<><p className="pay-amount" style={{margin:'14px 0 0'}}>{receipt.amount.toLocaleString('fr-FR')} <small>FCFA</small></p><p>Aucun montant n’a été débité. Cette simulation ne bloque aucun fonds et ne déclenche aucune intervention.</p>{receipt.quote_snapshot?.quote&&<section><p>Prestation : {receipt.quote_snapshot.quote.service_total?.toLocaleString('fr-FR')} FCFA</p><p>Fournitures supplémentaires : {receipt.quote_snapshot.quote.materials_total?.toLocaleString('fr-FR')} FCFA</p>{receipt.quote_snapshot.quote.selected_products?.map((p:any)=><p key={p.id}><a href={p.offer.source_url} target="_blank" rel="noopener noreferrer">{p.offer.name}</a> · {p.quantity} × {p.offer.price.toLocaleString('fr-FR')} FCFA · {p.billing_mode==='additional'?'supplément':p.billing_mode==='included'?'déjà compris':'achat séparé par le client'}</p>)}</section>}<SuppliesNotice sources={receipt.quote_snapshot?.price_context?.sources} /><p>Référence du reçu : {receipt.id}</p><p>Le parcours de démonstration est terminé jusqu’au paiement. Le paiement réel sera intégré ultérieurement.</p></>}
 <div className="pay-actions"><Link className="pay-btn pay-btn--primary" href="/diagnostic">Faire une nouvelle demande</Link><Link className="pay-btn pay-btn--ghost" href="/">Retour à l’accueil</Link></div>
 </section></main>
}
export default function Page(){return <Suspense fallback={<p>Chargement…</p>}><Receipt/></Suspense>}
