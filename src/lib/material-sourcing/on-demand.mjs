import {parseProduct} from './public-catalogues.mjs'
// Only public search endpoints verified for these suppliers. URLs from callers are never fetched.
export const LIVE_SOURCES = [
 {name:'ProduitBat',host:'produitbat.ci',path:'/detail/produit/',search:q=>`https://produitbat.ci/recherche?q=${encodeURIComponent(q)}`},
 {name:'Sogep Africa',host:'sogep-africa.com',path:'/produit/',search:q=>`https://sogep-africa.com/?s=${encodeURIComponent(q)}&post_type=product`},
 {name:'Quincaillerie Konaté & Frères',host:'quincaillerie-kf.com',path:'/produit/',search:q=>`https://quincaillerie-kf.com/?s=${encodeURIComponent(q)}&post_type=product`},
 {name:'IvoirElite',host:'ivoirelite.net',path:'.html',search:q=>`https://ivoirelite.net/recherche?controller=search&s=${encodeURIComponent(q)}`},
]
const clean=s=>String(s).replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()
export const normalizeQuery=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9., -]/g,' ').replace(/\s+/g,' ').trim().slice(0,120)
const tokens=s=>normalizeQuery(s).replace(/,/g,'.').match(/[a-z]+|\d+(?:\.\d+)?/g)?.filter(t=>!['de','du','des','la','le','les','un','une','pour','avec','en','a','et'].includes(t))??[]
export function productMatches(query,title){const wanted=tokens(query),actual=tokens(title);return wanted.length>0&&wanted.every(t=>actual.includes(t))}
function produitBatProps(html){
 const encoded=html.match(/data-page="([^"]+)"/)?.[1];if(!encoded)throw Error('Catalogue ProduitBat absent')
 const decoded=encoded.replace(/&quot;/g,'"').replace(/&#039;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
 return JSON.parse(decoded).props
}
export function discoverProducts(html,source,query){
 if(source.host==='produitbat.ci'){
  const rows=produitBatProps(html).shopProducts?.data
  if(!Array.isArray(rows))return []
  return rows.filter(p=>productMatches(query,p.title)&&typeof p.slugProduct==='string'&&/^[a-zA-Z0-9-]+$/.test(p.slugProduct)).slice(0,3).map(p=>`https://produitbat.ci/detail/produit/${p.slugProduct}`)
 }
 const urls=[]
 for(const m of html.matchAll(/href=["']([^"']+)["']/gi)){
  try{const u=new URL(m[1].replace(/&amp;/g,'&'),`https://${source.host}`);if(u.protocol!=='https:'||u.hostname!==source.host||u.port||u.username||u.password||u.search||u.hash)continue
   if(source.path==='.html'?!/^\/[^?#]*\/\d+-[^/]+\.html$/.test(u.pathname):!u.pathname.startsWith(source.path))continue
   if(productMatches(query,decodeURIComponent(u.pathname.replace(/-/g,' ')))&&!urls.includes(u.href))urls.push(u.href)
  }catch{}
 }
 return urls.slice(0,3)
}
function visiblePrice(text){const m=clean(text).match(/^(\d{1,3}(?:[.\s]\d{3})+|\d+)\s*(?:F\s*)?CFA$/i);if(!m)throw Error('Montant FCFA unique absent');const price=Number(m[1].replace(/[.\s]/g,''));if(!Number.isSafeInteger(price)||price<=0)throw Error('Prix invalide');return price}
export function parseLiveProduct(html,url){
 const host=new URL(url).hostname
 if(host==='produitbat.ci'){
  const p=produitBatProps(html).product
  if(!p||new URL(url).pathname!==`/detail/produit/${p.slugProduct}`||typeof p.title!=='string')throw Error('Fiche ProduitBat différente')
  if(p.promotion||(p.variantes?.length??0)>0)throw Error('Promotion ou variante à préciser')
  const price=Number(p.price);if(!Number.isSafeInteger(price)||price<=0)throw Error('Prix ProduitBat absent')
  return {name:p.title,price,currency:'XOF',unit:/\bla tonne\b/i.test(p.title)?'tonne':'article vendu (conditionnement à confirmer)',stock_status:Number(p.QteStock)>0?'available':'unavailable',url,extraction:'public_storefront_product_data_fcfa'}
 }
 const after=html.slice(html.search(/<h1\b/i));const name=clean(after.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]??'');if(!name)throw Error('Titre absent')
 if(host==='sogep-africa.com'){
  const section=after.match(/^([\s\S]*?)<p\b[^>]*class=["']price["'][^>]*>([\s\S]*?)<\/p>/i)?.[2]
  if(!section||/\bdel\b|\bins\b|data-product_variations/.test(section)||after.slice(0,12000).includes('variations_form'))throw Error('Prix absent ou variante à préciser')
  return {name,price:visiblePrice(section),currency:'XOF',stock_status:'unknown',url,extraction:'primary_product_price_cfa'}
 }
 if(host==='ivoirelite.net'){
  const primary=after.match(/<div\b[^>]*class=["']current-price["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]??''
  const priceTag=primary.match(/<span\b(?=[^>]*itemprop=["']price["'])(?=[^>]*content=["'](\d+)["'])[^>]*>([\s\S]*?)<\/span>/i)
  if(!priceTag||!/<meta\b[^>]*itemprop=["']priceCurrency["'][^>]*content=["']XOF["']/i.test(after.slice(0,12000)))throw Error('Prix structuré XOF absent')
  const price=visiblePrice(priceTag[2]);if(price!==Number(priceTag[1]))throw Error('Prix affiché différent')
  return {name,price,currency:'XOF',stock_status:/schema.org\/OutOfStock/.test(after.slice(0,12000))?'unavailable':'unknown',url,extraction:'primary_microdata_and_visible_price'}
 }
 return parseProduct(html,url)
}
/** @param {string} query @param {any} options */
export async function searchPublicMaterials(query,options={}){
 const fetcher=options.fetcher??fetch;const sources=options.sources??LIVE_SOURCES;const signal=AbortSignal.timeout(12000)
 async function page(url){const r=await fetcher(url,{signal,redirect:'manual',cache:'no-store',headers:{'User-Agent':'AfriOne-PriceLookup/1.0','Accept':'text/html'}});if(!r.ok)throw Error(`HTTP ${r.status}`);if(Number(r.headers.get('content-length')??0)>2000000)throw Error('Page trop volumineuse');const h=await r.text();if(h.length>2000000)throw Error('Page trop volumineuse');return h}
 const reports=await Promise.all(sources.map(async source=>{
  try{const html=await page(source.search(query));const urls=discoverProducts(html,source,query)
   const results=await Promise.allSettled(urls.map(async url=>{const p=parseLiveProduct(await page(url),url);if(!productMatches(query,p.name)||p.stock_status==='unavailable')throw Error('Produit non comparable ou indisponible');return {...p,source:source.name,source_url:url,unit:p.unit??'article vendu (conditionnement à confirmer)',observed_at:new Date().toISOString(),included_in_service_price:false,shipping_and_tax:'à confirmer',match_status:'title_tokens_match'}}))
   return {source:source.name,status:'checked',offers:results.flatMap(r=>r.status==='fulfilled'?[r.value]:[])}
  }catch{return {source:source.name,status:'unavailable',offers:[]}}
 }))
 const comparison_references=productMatches('iroko',query)?[
  {source:'Alibaba — annonce fournie',url:'https://french.alibaba.com/product-detail/Premium-West-African-Iroko-Sawn-Timber-12000002758386.html',market:'international',price_usable:false,note:'Contrôle du 29/10/2026 : minimum 20 m³, origine déclarée Cameroun, vendeur au Royaume-Uni. Prix affiché et sous-total incohérents ; devis fournisseur nécessaire.'},
  {source:'BDCI — fournisseur ivoirien',url:'https://bdci-ci.com/product/iroko/',market:'Côte d’Ivoire',price_usable:false,note:'Fiche iroko, fournisseur à Abidjan ; aucun prix public constaté au contrôle du 29/10/2026.'}
 ]:[]
 const offers=reports.flatMap(r=>r.offers)
 return {query,found:offers.length>0,offers,comparison_references,sources_checked:reports.map(({source,status})=>({source,status})),checked_at:new Date().toISOString(),note:'Prix du produit vendu, correspondance et conditionnement à confirmer. Livraison et pose non ajoutées.'}
}
