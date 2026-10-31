'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import {clientApi} from '@/lib/client-api'
import toast from 'react-hot-toast'
const labels:Record<string,string>={diagnostic:'Demande à préciser',matching:'Recherche de prestataire',negotiation:'Accord et devis',payment:'Paiement confirmé',scheduled:'Intervention programmée',en_route:'Prestataire en route',en_cours:'Travaux en cours',pending_validation:'Travaux soumis au client',disputed:'Litige — clôture suspendue',completed:'Mission validée',cancelled:'Mission annulée'}
export default function MissionWorkflow({missionId,role,onMission}:{missionId:string;role:string;onMission?:(patch:any)=>void}){
 const [data,setData]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{let active=true;let pending=false
  const load=async()=>{if(pending||document.visibilityState==='hidden')return;pending=true;try{const r=await clientApi(`/api/mission/workflow?mission_id=${missionId}`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);if(active){setData(d);setError('');onMission?.(d.mission)}}catch(e){if(active)setError(e instanceof Error?e.message:'Suivi indisponible')}finally{pending=false}}
  load();const timer=setInterval(load,10000);window.addEventListener('focus',load);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',load)}
 },[missionId,onMission])
 async function act(action:string){setBusy(true);try{
  let quote_revision:string|undefined
  if(action==='pay_test'){const r=await clientApi(`/api/quote?mission_id=${missionId}`,{cache:'no-store'});const q=await r.json();if(!r.ok||!q.total)throw Error(q.error||'Confirmez le devis');quote_revision=q.quote_revision}
  const r=await clientApi('/api/mission/workflow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mission_id:missionId,action,quote_revision})});const d=await r.json();if(!r.ok)throw Error(d.error);onMission?.(d.mission);setData((old:any)=>({...old,mission:d.mission}));toast.success('Étape enregistrée')
 }catch(e){toast.error(e instanceof Error?e.message:'Action refusée')}finally{setBusy(false)}}
 const m=data?.mission
 return <section aria-label="Suivi sécurisé de la mission" className="card" style={{marginBottom:16}}>
 <h2 style={{fontSize:18,marginBottom:10}}>Suivi de la mission</h2>
 {error&&<p role="alert">{error}</p>}{!m&&!error&&<p>Chargement…</p>}
 {m&&<><p>{labels[m.status]||m.status}</p>{m.is_test&&<p style={{color:'#B7471B'}}>MISSION DE TEST — aucun fonds réel ni intervention réelle.</p>}
 {m.status==='negotiation'&&!m.provider_accepted_at&&<p>Le prestataire doit accepter la demande avant de proposer un devis.</p>}
 {role==='artisan'&&m.status==='negotiation'&&!m.provider_accepted_at&&<div style={{display:'flex',gap:8,marginTop:12}}><button className="btn-primary afrione-action" disabled={busy} onClick={()=>act('accept_assignment')}>Accepter la demande</button><button className="afrione-action" disabled={busy} onClick={()=>act('reject_assignment')}>Refuser la demande</button></div>}
 {role==='client'&&m.status==='en_route'&&m.artisan_arrived_at&&<button className="btn-primary afrione-action" disabled={busy} onClick={()=>act('confirm_arrival')}>Je confirme que le prestataire est arrivé</button>}
 {role==='artisan'&&m.status==='en_route'&&m.artisan_arrived_at&&<p>Arrivée déclarée. Attendez la confirmation du client avant de commencer.</p>}
 {role==='client'&&m.status==='negotiation'&&m.is_test&&m.price_confirmed_version&&<button className="afrione-action" disabled={busy} onClick={()=>act('pay_test')}>Simuler le paiement pour tester le suivi</button>}
 {m.status==='disputed'&&<p>Aucune validation automatique pendant le litige. Une décision administrative motivée est nécessaire.</p>}
 {m.status==='completed'&&<p>La mission est validée. Le statut d’un versement réel doit être confirmé séparément par le prestataire de paiement.</p>}
 {['scheduled','en_route','en_cours','pending_validation'].includes(m.status)&&<p><Link href={`/suivi/${missionId}`}>Ouvrir le suivi et les preuves de travaux</Link></p>}
 <details style={{marginTop:12}}><summary>Historique des étapes</summary>{data.events?.map((e:any)=><p key={e.id} style={{fontSize:12,marginTop:8}}>{new Date(e.created_at).toLocaleString('fr')} · {e.previous_status!==e.next_status?`${labels[e.previous_status]||e.previous_status} → ${labels[e.next_status]||e.next_status}`:e.action.replaceAll('_',' ')}</p>)}</details></>}
 </section>
}
