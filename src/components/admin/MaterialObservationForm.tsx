'use client'
import {useState} from 'react'
import {clientApi} from '@/lib/client-api'
type Source={id:string;name:string;is_partner?:boolean}
export default function MaterialObservationForm({sources,onSaved}:{sources:Source[];onSaved:()=>void}){
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false)
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const data=new FormData(form);setBusy(true)
  try{const source=sources.find(s=>s.id===data.get('source_id'));const response=await clientApi('/api/sources',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add_material',source_id:data.get('source_id'),name:data.get('name'),category:data.get('category'),unit:data.get('unit'),price_observed:Number(data.get('price')),observed_quantity:Number(data.get('quantity')),observed_at:data.get('date'),evidence_url:data.get('evidence')||undefined,source_url:data.get('url')||undefined,price_provenance:source?.is_partner?'partner_catalogue':'web_observation'})});const result=await response.json();if(!response.ok)throw Error(result.error);setMessage('Relevé enregistré, en attente de contrôle.');form.reset();onSaved()}catch(err){setMessage(err instanceof Error?err.message:'Enregistrement impossible')}finally{setBusy(false)}
 }
 return <details style={{padding:18,background:'white',borderRadius:14,marginBottom:20,border:'1px solid #D7DFE8'}}><summary>Enregistrer un prix de site ou de magasin partenaire</summary><p>Relevé réel uniquement : article exact, unité, quantité, date et justificatif. Les prix restent soumis au contrôle AfriOne.</p><form onSubmit={submit} style={{display:'grid',gap:10,maxWidth:580}}>
 <label>Source <select className="afrione-field" name="source_id" required defaultValue=""><option value="" disabled>Choisir</option>{sources.map(s=><option key={s.id} value={s.id}>{s.name}{s.is_partner?' — partenaire confirmé':''}</option>)}</select></label>
 <label>Article / référence exacte <input className="afrione-field" name="name" required maxLength={180}/></label>
 <label>Catégorie <input className="afrione-field" name="category" required placeholder="Plomberie"/></label><label>Unité <input className="afrione-field" name="unit" required placeholder="unité, kg, litre, sac…"/></label>
 <label>Quantité couverte par le prix <input className="afrione-field" name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" required/></label>
 <label>Prix total observé (FCFA) <input className="afrione-field" name="price" type="number" min="1" step="1" required/></label>
 <label>Date du relevé <input className="afrione-field" name="date" type="date" required/></label>
 <label>Lien de la fiche produit <input className="afrione-field" name="url" type="url" placeholder="https://…"/></label>
 <label>Justificatif (photo d’étiquette ou devis) <input className="afrione-field" name="evidence" type="url" placeholder="https://…"/></label>
 <button className="afrione-action" disabled={busy}>{busy?'Enregistrement…':'Soumettre le relevé'}</button>{message&&<p role="status">{message}</p>}
 </form></details>
}
export function PartnerRegistration({sources,onSaved}:{sources:Source[];onSaved:()=>void}){
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false)
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const data=new FormData(e.currentTarget);setBusy(true);try{const response=await clientApi('/api/sources',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set_partner',id:data.get('source'),is_partner:true,partnership_reference:data.get('reference')})});const result=await response.json();if(!response.ok)throw Error(result.error);setMessage('Partenariat existant enregistré. Les prix restent soumis au contrôle.');onSaved()}catch(err){setMessage(err instanceof Error?err.message:'Enregistrement impossible')}finally{setBusy(false)}}
 return <details style={{padding:18,background:'white',borderRadius:14,marginBottom:20,border:'1px solid #D7DFE8'}}><summary>Enregistrer un magasin partenaire confirmé</summary><p>À utiliser uniquement lorsqu’un accord existe déjà. Un site référencé ou un magasin vérifié n’est pas automatiquement partenaire.</p><form onSubmit={submit} style={{display:'grid',gap:10,maxWidth:580}}><label>Magasin <select className="afrione-field" name="source" required defaultValue=""><option value="" disabled>Choisir</option>{sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Référence interne de l’accord existant <input className="afrione-field" name="reference" minLength={5} maxLength={200} required/></label><button className="afrione-action" disabled={busy}>Enregistrer le partenariat existant</button>{message&&<p role="status">{message}</p>}</form></details>
}
