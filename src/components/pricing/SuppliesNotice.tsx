import { describeSupplies } from '../../lib/supplies'
export default function SuppliesNotice({sources=[]}:{sources?:{id?:string;source_scope?:string;url?:string}[]}) {
 const policy=describeSupplies(sources)
 return <section aria-label="Périmètre des fournitures" style={{padding:16,border:'1px solid #E1C199',borderRadius:12,background:'#FFF9EF',color:'#604426',fontSize:13,lineHeight:1.6,margin:'14px 0'}}>
 <strong>{policy.label}</strong><p style={{margin:'6px 0'}}>{policy.explanation}</p>
 {policy.evidence.map((e,i)=><p key={e.reference_id??i} style={{margin:'4px 0'}}>{e.scope}</p>)}
 </section>
}
