'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import {clientApi} from '@/lib/client-api'
export default function Page(){const [rows,setRows]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(true)
 useEffect(()=>{let active=true;clientApi('/api/client-diagnostics').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active)setRows(d.missions)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[])
 return <><Navbar/><main style={{maxWidth:800,margin:'32px auto',padding:20}}><h1>Mes diagnostics et demandes de devis</h1><Link href="/diagnostic">Nouvelle demande</Link>{busy&&<p>Chargement…</p>}{error&&<p role="alert">{error}</p>}{!busy&&!error&&!rows.length&&<p>Aucune demande enregistrée.</p>}{rows.map(r=><article key={r.id} style={{padding:20,marginTop:16,border:'1px solid #CBD5E1',borderRadius:16}}><h2>{r.category}</h2><p>{(Array.isArray(r.diagnostics)?r.diagnostics[0]:r.diagnostics)?.ai_summary??'Diagnostic à compléter'}</p><p>{new Date(r.created_at).toLocaleDateString('fr-FR')} · {(Array.isArray(r.quote_requests)?r.quote_requests.some((q:any)=>q.status==='requested'):r.quote_requests?.status==='requested')?'Devis demandé':'Diagnostic enregistré'}</p><Link href={`/diagnostic?mission=${r.id}`}>Reprendre ce diagnostic et ses produits</Link></article>)}</main></>}
