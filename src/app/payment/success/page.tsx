'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import SuppliesNotice from '@/components/pricing/SuppliesNotice'
import { clientApi } from '@/lib/client-api'
function Receipt() {
 const params=useSearchParams();const id=params.get('mission')
 const [receipt,setReceipt]=useState<any>(null)
 const [error,setError]=useState('')
 useEffect(()=>{let active=true
  if(!id){setError('Mission manquante');return}
  clientApi(`/api/payment?mission_id=${encodeURIComponent(id)}`).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active)setReceipt(d.receipt)}).catch(e=>{if(active)setError(e.message)})
  return()=>{active=false}
 },[id])
 return <main style={{minHeight:'100vh',background:'#F5F7FA',display:'grid',placeItems:'center',padding:24}}><section style={{maxWidth:520,width:'100%',background:'white',padding:32,borderRadius:20,color:'#253040'}}>
 <p style={{color:'#C95024',fontWeight:700}}>AfriOne · Démonstration</p>
 <h1>{receipt?'Paiement simulé confirmé':'Vérification du paiement simulé'}</h1>
 {error?<p role="alert">{error}</p>:!receipt?<p>Chargement du reçu…</p>:<><p style={{fontSize:32,fontWeight:700}}>{receipt.amount.toLocaleString('fr-FR')} FCFA</p><p>Aucun montant n’a été débité. Cette simulation ne bloque aucun fonds et ne déclenche aucune intervention.</p>{receipt.quote_snapshot?.quote&&<section><p>Prestation : {receipt.quote_snapshot.quote.service_total?.toLocaleString('fr-FR')} FCFA</p><p>Fournitures supplémentaires : {receipt.quote_snapshot.quote.materials_total?.toLocaleString('fr-FR')} FCFA</p>{receipt.quote_snapshot.quote.selected_products?.map((p:any)=><p key={p.id}><a href={p.offer.source_url} target="_blank" rel="noopener noreferrer">{p.offer.name}</a> · {p.quantity} × {p.offer.price.toLocaleString('fr-FR')} FCFA · {p.billing_mode==='additional'?'supplément':p.billing_mode==='included'?'déjà compris':'achat séparé par le client'}</p>)}</section>}<SuppliesNotice sources={receipt.quote_snapshot?.price_context?.sources} /><p>Référence du reçu : {receipt.id}</p><p>Le parcours de démonstration est terminé jusqu’au paiement. Le paiement réel sera intégré ultérieurement.</p></>}
 <Link href="/diagnostic" style={{display:'block',marginTop:24,color:'#C95024'}}>Faire une nouvelle demande</Link><Link href="/" style={{display:'block',marginTop:16}}>Retour à l’accueil</Link>
 </section></main>
}
export default function Page(){return <Suspense fallback={<p>Chargement…</p>}><Receipt/></Suspense>}
