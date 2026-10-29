import {missingMaterialSpecs} from './needs.mjs'
import {unstable_cache} from 'next/cache'
import {normalizeQuery,searchPublicMaterials} from './on-demand.mjs'
// Next Data Cache, separate from the business database; original observation dates are preserved.
const cachedSearch=unstable_cache(async(query:string)=>searchPublicMaterials(query),['afrione-material-search-v2'],{revalidate:3600})
export async function lookupMaterialOffers(item:string, purpose:'mission'|'explore'='mission'){
 const query=normalizeQuery(item)
 if(query.length<2)return {query,found:false,offers:[],comparison_references:[],note:'Précisez la fourniture.'}
 const missing=purpose==='mission'?missingMaterialSpecs(query):[]
 if(missing.length)return {query,found:false,offers:[],comparison_references:[],status:'specifications_required',missing_specs:missing,note:`Avant de rechercher un produit adapté, précisez : ${missing.join(' ; ')}. Aucun produit choisi par défaut.`}
 const result=await cachedSearch(query)
 const offers=result.offers.filter(p=>Date.now()-Date.parse(p.observed_at)<=3600000)
 return {...result,offers,found:offers.length>0,cache_max_age_seconds:3600,note:offers.length?result.note:'Aucun prix récent exploitable. Fourniture à confirmer.'}
}
