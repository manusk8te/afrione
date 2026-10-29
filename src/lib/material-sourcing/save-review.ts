export async function saveCatalogueReview(db:any, source:{id:string;name:string},actor:string,report:{observations:any[]}){
 let saved=0,unchanged=0
 for(const row of report.observations){
  const {data:existing,error:readError}=await db.from('price_materials').select('id').eq('source_id',source.id).eq('source_url',row.url).eq('price_market',row.price).gte('observed_at',new Date(Date.now()-86400000).toISOString()).limit(1).maybeSingle()
  if(readError)throw Error('Contrôle de doublon impossible')
  if(existing){unchanged++;continue}
  const {error}=await db.from('price_materials').insert({source_id:source.id,source:source.name,source_url:row.url,evidence_url:row.url,name:row.name,category:row.category,unit:row.unit,tier:'standard',price_market:row.price,price_min:row.price,price_max:row.price,web_price:row.price,observed_price_total:row.price,observed_quantity:1,observed_at:row.observed_at,last_scraped_at:row.observed_at,stock_status:row.stock_status,price_provenance:'web_observation',added_by:actor,confirmed_at:null,confirmed_by:null})
  if(error)throw Error('Le relevé n’a pas pu être enregistré')
  saved++
 }
 return {saved,unchanged}
}
