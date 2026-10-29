'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { clientApi } from '@/lib/client-api'
import toast from 'react-hot-toast'

export function DiscussionAgreement({ missionId, role, initialScope, onDiscussion }: {
  missionId: string; role: string; initialScope: string; onDiscussion: (enabled: boolean) => void
}) {
  const [agreement, setAgreement] = useState<any>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [scope, setScope] = useState('')
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [supplies, setSupplies] = useState('excluded')
  const [discussion, setDiscussion] = useState(true)
  const [editing, setEditing] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => { setScope(previous => previous || initialScope) }, [initialScope])
  useEffect(() => { setConfirmed(false) }, [agreement?.version])
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await clientApi(`/api/warroom/agreement?mission_id=${missionId}`, { cache:'no-store' })
        if (!response.ok) throw Error()
        const result = await response.json()
        if (!cancelled) { setAgreement(result.agreement); setLoaded(true); setFailed(false); onDiscussion(result.agreement?.discussion !== false) }
      } catch { if (!cancelled) setFailed(true) }
    }
    load()
    const timer = window.setInterval(load,10000)
    return () => { cancelled=true; window.clearInterval(timer) }
  }, [missionId, onDiscussion])
  async function act(action: 'confirm'|'propose'|'accept'|'reject') {
    setBusy(true)
    try {
      const payload = action==='confirm' ? { scope, discussion } : action==='propose' ? {scope,reason,amount:Number(amount),supplies} : {}
      const response = await clientApi('/api/warroom/agreement', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mission_id:missionId,action,version:agreement?.version||0,payload})})
      const result=await response.json()
      if (!response.ok) throw Error(result.error||'Accord non enregistré')
      setAgreement(result.agreement); onDiscussion(result.agreement.discussion); setEditing(false); setConfirmed(false)
      toast.success(action==='accept'?'Rectificatif accepté. Le devis a été actualisé.':'Accord enregistré.')
    } catch(error) { toast.error(error instanceof Error?error.message:'Enregistrement impossible') }
    finally {setBusy(false)}
  }
  const field={width:'100%',padding:10,border:'1px solid #D8D2C4',borderRadius:8,color:'#273444',background:'white'}
  return <section aria-label="Périmètre et rectificatifs" style={{background:'#fff',border:'1px solid #D8D2C4',borderRadius:14,padding:16,marginBottom:14,color:'#273444'}}>
    <strong>Périmètre et accord</strong>
    <p style={{fontSize:13}}>Le diagnostic reste préliminaire. Toute prestation supplémentaire doit être décrite et acceptée avant réalisation. Un refus ne crée ni supplément gratuit ni obligation d’intervention.</p>
    {failed && <p role="alert">Impossible de charger l’accord. Les confirmations sont suspendues ; nouvelle tentative automatique.</p>}
    {!loaded && !failed && <p>Chargement de l’accord…</p>}
    {loaded && !agreement && role==='client' && <>
      <label>Travaux demandés<textarea maxLength={4000} value={scope} onChange={e=>setScope(e.target.value)} style={field}/></label>
      <fieldset><legend>Souhaitez-vous discuter avant de confirmer le devis ?</legend>
        <label><input type="radio" checked={discussion} onChange={()=>setDiscussion(true)}/> Oui, échanger avec le prestataire</label><br/>
        <label><input type="radio" checked={!discussion} onChange={()=>setDiscussion(false)}/> Non, recevoir le devis et les éventuels rectificatifs</label>
      </fieldset>
      <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Je confirme que ce périmètre décrit ma demande.</label><br/>
      <button disabled={busy||failed||!confirmed||scope.trim().length<10} onClick={()=>act('confirm')}>Confirmer ma demande</button>
    </>}
    {loaded && !agreement && role==='artisan' && <p>Le client doit d’abord confirmer sa demande.</p>}
    {agreement && <>
      <p style={{whiteSpace:'pre-wrap'}}>{agreement.scope}</p>
      <small>Version {agreement.version} · {agreement.discussion?'Discussion activée':'Sans discussion libre : devis et rectificatifs uniquement'}</small>
      {role==='artisan' && !editing && <p><button disabled={busy||failed} onClick={()=>{setScope(agreement.scope);setEditing(true)}}>Proposer un rectificatif</button></p>}
      {editing && role==='artisan' && <div>
        <label>Périmètre corrigé<textarea style={field} maxLength={4000} value={scope} onChange={e=>setScope(e.target.value)}/></label>
        <label>Constat et justification<textarea style={field} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
        <label>Nouveau montant de la prestation, FCFA<input style={field} type="number" min={1} max={100000000} value={amount} onChange={e=>setAmount(e.target.value)}/></label>
        <label>Fournitures du rectificatif<select style={field} value={supplies} onChange={e=>setSupplies(e.target.value)}><option value="excluded">Non comprises, à chiffrer séparément</option><option value="included">Comprises dans ce montant</option></select></label>
        <p>Ce montant remplace le prix de la prestation. Les produits sélectionnés comme suppléments restent séparés. Aucun ajustement ne s’applique avant acceptation.</p>
        <button disabled={busy||failed||scope.trim().length<10||reason.trim().length<10||!Number.isInteger(Number(amount))||Number(amount)<=0} onClick={()=>act('propose')}>Envoyer pour accord</button>{' '}
        <button disabled={busy} onClick={()=>setEditing(false)}>Annuler</button>
      </div>}
      {agreement.pending && <div style={{padding:12,background:'#FFF4DF',marginTop:12}}>
        <strong>Rectificatif en attente</strong><p style={{whiteSpace:'pre-wrap'}}>{agreement.pending.scope}</p><p>Justification : {agreement.pending.reason}</p>
        <p>{Number(agreement.pending.amount).toLocaleString('fr')} FCFA · fournitures {agreement.pending.supplies==='included'?'comprises':'non comprises'}</p>
        {role==='client' && <><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> J’accepte le périmètre corrigé et ce nouveau montant.</label><br/>
          <button disabled={busy||failed||!confirmed} onClick={()=>act('accept')}>Accepter le rectificatif</button>{' '}<button disabled={busy||failed} onClick={()=>act('reject')}>Refuser, conserver l’accord précédent</button></>}
      </div>}
      {role==='client' && !agreement.pending && <p><Link href={`/mode-select?mission=${missionId}`}>Voir le devis actualisé et la simulation de paiement</Link></p>}
      <details><summary>Historique des accords ({agreement.history.length})</summary>{agreement.history.map((event:any,i:number)=><p key={i}>{new Date(event.at).toLocaleString('fr')} · {{confirm:'Demande confirmée',propose:'Rectificatif proposé',accept:'Rectificatif accepté',reject:'Rectificatif refusé'}[event.action as string]}<br/>{event.payload?.reason || event.payload?.scope}{event.payload?.amount ? ` · ${event.payload.amount} FCFA` : ''}</p>)}</details>
    </>}
  </section>
}
