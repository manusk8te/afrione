export type SupplyStatus = 'included' | 'excluded' | 'partial' | 'unknown'
type Source = { id?: string; source_scope?: string; scope?: string; description?: string; url?: string }
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
export function classifySupplyScope(source: Source): SupplyStatus {
 const text=norm([source.source_scope ?? source.scope ?? '', source.description ?? ''].join(' '))
 const included=/fournitures et pose|materiel inclus|fournitures incluses/.test(text)
 const excluded=/fourniture exclue|pose seule|fourni par le client|courses client/.test(text)
 const partial=/accessoires inclus|decorati\w* exclu|pieces exclues|consommables a confirmer|climatiseur exclu/.test(text)
 if(partial || (included && excluded))return 'partial'
 if(included)return 'included'
 if(excluded || /mitigeur exclu|wc exclu/.test(text))return 'excluded'
 return 'unknown'
}
export function describeSupplies(sources: Source[] = []) {
 const statuses=sources.map(classifySupplyScope)
 const status:SupplyStatus=!statuses.length || statuses.includes('unknown')?'unknown':new Set(statuses).size===1?statuses[0]:'partial'
 const labels:Record<SupplyStatus,string>={included:'Fournitures comprises dans la référence',excluded:'Fournitures non comprises dans la référence',partial:'Certaines fournitures seulement sont comprises ou exclues',unknown:'Fournitures à confirmer'}
 return {status,label:labels[status],basis:'published_reference',confirmed_for_local_quote:false,
  explanation:'Le périmètre ci-dessous est celui du tarif source. Le contenu exact du devis ivoirien reste à confirmer avec le prestataire. Aucun achat de fournitures n’est ajouté automatiquement au prix affiché.',
  evidence:sources.map(s=>({reference_id:s.id??null,scope:s.source_scope??s.scope??'Non précisé',url:s.url??null})),
 }
}
export function materialObservationUsable(row:{price_market?:number;confirmed_at?:string|null;added_by?:string|null;last_scraped_at?:string|null;observed_at?:string|null;source_url?:string|null;price_provenance?:string|null;evidence_url?:string|null},now=Date.now()) {
 const date=Date.parse(row.observed_at || row.last_scraped_at || '')
 return typeof row.price_market==='number' && Number.isFinite(row.price_market) && row.price_market>0 && Number.isFinite(date) && now-date>=-86400000 && now-date<=30*86400000 &&
  (Boolean(row.confirmed_at && (row.source_url || row.evidence_url)) || (!row.added_by && Boolean(row.source_url) && row.price_provenance==='web_observation'))
}

export function observationLabel(value?:string|null){return ({artisan_declaration:'Déclaré par un artisan',internal_declaration:'Relevé interne AfriOne',web_observation:'Prix publié sur un site',partner_catalogue:'Tarif transmis par un partenaire'} as Record<string,string>)[value??'']??'Origine à contrôler'}
