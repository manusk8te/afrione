/** Compatibility for the diagnostic. Lookup is read-only and now spans public suppliers. */
import {lookupMaterialOffers} from './material-sourcing/lookup'
export async function lookupItemOnJumia(item:string,_category:string){
 const result=await lookupMaterialOffers(item)
 const p=result.offers[0]
 return p?{item,found:true,price:p.price,url:p.source_url,name:p.name,source:p.source,unit:p.unit,observed_at:p.observed_at,saved:0}:{item,found:false,saved:0}
}
export async function enrichItemsWithJumia(items:string[],category:string){
 return Promise.all(items.slice(0,4).map(item=>lookupItemOnJumia(item,category)))
}
