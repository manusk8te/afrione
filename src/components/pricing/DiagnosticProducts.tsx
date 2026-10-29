'use client'
import {useEffect,useState} from 'react'
import {clientApi} from '@/lib/client-api'
export default function DiagnosticProducts({missionId,items}:{missionId?:string;items:{name:string}[]}){
 const names=items.map(i=>i.name).filter(Boolean).slice(0,4);const key=JSON.stringify(names)
 const [results,setResults]=useState<any[]>([]),[selected,setSelected]=useState<any[]>([]),[queries,setQueries]=useState<Record<string,string>>({})
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState<string|null>(null),[message,setMessage]=useState('')
 useEffect(()=>{let cancelled=false;setSelected([]);setResults([]);setQueries({});setMessage('');if(!missionId||!names.length)return
 setLoading(true)
 Promise.all([clientApi(`/api/materials?items=${encodeURIComponent(key)}`).then(async r=>{if(!r.ok)throw Error('Recherche de produits indisponible.');return r.json()}),clientApi(`/api/diagnostic-products?mission_id=${missionId}`).then(async r=>{if(!r.ok)throw Error('Choix enregistrés indisponibles.');return r.json()})]).then(([r,s])=>{if(!cancelled){setResults((r.materials??[]).map((row:any)=>({...row,search_query:row.name})));setSelected(s.products??[])}}).catch(e=>{if(!cancelled)setMessage(e.message)}).finally(()=>{if(!cancelled)setLoading(false)})
 return()=>{cancelled=true}
 // The serialized names identify this diagnostic's needs.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[missionId,key])
 async function search(item:string){setBusy(item);setMessage('');try{const r=await clientApi('/api/materials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:queries[item]||item})});const d=await r.json();if(!r.ok)throw Error(d.error||'Recherche impossible');setResults(rows=>rows.map(row=>row.name===item?{...d,name:item,search_query:queries[item]||item}:row))}catch(e){setMessage(e instanceof Error?e.message:'Recherche impossible')}finally{setBusy(null)}}
 async function choose(item:string,offer?:any){setBusy(item);setMessage('');try{const r=await clientApi('/api/diagnostic-products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(offer?{action:'select',mission_id:missionId,item,query:results.find(row=>row.name===item)?.search_query||item,offer_url:offer.source_url,quantity:1}:{action:'remove',mission_id:missionId,item})});const d=await r.json();if(!r.ok)throw Error(d.error||'Enregistrement impossible');setSelected(rows=>offer?[...rows.filter(row=>row.item!==item),d.product]:rows.filter(row=>row.item!==item));setMessage(offer?'Produit ajouté au diagnostic.':'Produit retiré du diagnostic.')}catch(e){setMessage(e instanceof Error?e.message:'Enregistrement impossible')}finally{setBusy(null)}}
 if(!names.length)return null
 return <section aria-label="Choix des produits" style={{background:'#FFF',border:'1px solid #E2E8F0',borderRadius:20,padding:20}}>
  <h3 style={{fontWeight:700}}>Produits à ajouter à votre diagnostic</h3>
  <p style={{fontSize:12,color:'#64748B'}}>Ouvrez la fiche pour vérifier le modèle et le conditionnement, puis ajoutez votre choix à la demande. La compatibilité reste à confirmer avec le prestataire. Cette sélection ne déclenche aucun achat ; son prix reste séparé de la prestation.</p>
  {loading&&<p role="status">Recherche de produits adaptés…</p>}
  {message&&<p role="status" style={{fontSize:13,marginTop:8}}>{message}</p>}
  {results.map(row=>{const chosen=selected.find(p=>p.item===row.name);return <div key={row.name} style={{borderTop:'1px solid #E2E8F0',marginTop:16,paddingTop:12}}>
   <strong>{row.name}</strong>
   {chosen&&<div style={{background:'#F0FDF4',padding:12,borderRadius:10,marginTop:8}}><strong>Ajouté au diagnostic</strong><p><a href={chosen.offer.source_url} target="_blank" rel="noopener noreferrer" style={{textDecoration:'underline'}}>{chosen.offer.name} — {chosen.offer.source}</a></p><p>{chosen.offer.price.toLocaleString('fr-FR')} FCFA / {chosen.offer.unit}</p><button type="button" disabled={busy===row.name} onClick={()=>choose(row.name)}>Retirer ce choix</button></div>}
   <div style={{display:'flex',gap:8,marginTop:10}}><input aria-label={`Préciser ${row.name}`} maxLength={120} value={queries[row.name]??row.name} onChange={e=>setQueries(q=>({...q,[row.name]:e.target.value}))} style={{border:'1px solid #CBD5E1',borderRadius:8,padding:8,minWidth:0,flex:1}}/><button type="button" disabled={busy===row.name} onClick={()=>search(row.name)}>Rechercher</button></div>
   {row.comparison_references?.map((ref:any)=><p key={ref.url} style={{fontSize:12}}><a href={ref.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:'underline'}}>{ref.source}</a> — {ref.note}</p>)}
   <p style={{fontSize:12,color:'#64748B'}}>{row.note}</p>
   {row.offers?.slice(0,6).map((offer:any)=><article key={offer.source_url} style={{padding:12,border:'1px solid #E2E8F0',borderRadius:10,marginTop:8}}><a href={offer.source_url} target="_blank" rel="noopener noreferrer" style={{color:'#B45309',textDecoration:'underline'}}>{offer.name} — {offer.source} ↗</a><p>{offer.price.toLocaleString('fr-FR')} FCFA / {offer.unit}</p><small>Consulté le {new Date(offer.observed_at).toLocaleString('fr-FR')} · livraison à confirmer</small><div><button type="button" disabled={busy===row.name||chosen?.offer.source_url===offer.source_url} onClick={()=>choose(row.name,offer)} style={{marginTop:8,padding:'8px 12px',borderRadius:8,background:'#E85D26',color:'white'}}>{chosen?.offer.source_url===offer.source_url?'Déjà ajouté':'Ajouter au diagnostic'}</button></div></article>)}
   {!row.offers?.length&&<p style={{fontSize:12}}>Aucun produit proposé sans caractéristiques suffisantes. Précisez la recherche ou faites confirmer la référence par le prestataire.</p>}
  </div>})}
 </section>
}
