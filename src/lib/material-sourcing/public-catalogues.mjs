/** Small, explicit pilot. No login, paid proxy, guessed price or currency conversion. */
export const CATALOGUES = {
 'quincaillerie.ci': {name:'Quincaillerie.ci',base:'https://quincaillerie.ci/',products:[
  ['https://quincaillerie.ci/product/robinet-de-douche','Plomberie','unité'],
  ['https://quincaillerie.ci/product/lavabo-mural-vega-45-cm','Plomberie','unité'],
  ['https://quincaillerie.ci/product/pommeau-de-douche-1-jet-flexible-robinet-de-douche','Plomberie','article'],
  ['https://quincaillerie.ci/product/ciment-belier-cpj-425r-socimat-tonne','Maçonnerie','tonne'],
  ['https://quincaillerie.ci/product/bois-blanc-fromager-4000-x-80-x-40-mm','Menuiserie','article'],
  ['https://quincaillerie.ci/product/fer-a-beton-ha-fe-500-o8mm-botte-21-barres-12m','Maçonnerie','botte'],
 ]},
 'quincaillerie-kf.com': {name:'Quincaillerie Konaté & Frères',base:'https://quincaillerie-kf.com/',products:[
  ['https://quincaillerie-kf.com/produit/abattant-delux-1er/','Plomberie','unité'],
  ['https://quincaillerie-kf.com/produit/abattant-leger/','Plomberie','unité'],
  ['https://quincaillerie-kf.com/produit/bouchon-galva-1-2-ch/','Plomberie','unité'],
  ['https://quincaillerie-kf.com/produit/automatique-soupresseur-14-20/','Plomberie','unité'],
 ]},
 'quinkashop.com': {name:'QuinkaShop',base:'https://quinkashop.com/',products:[
  ['https://quinkashop.com/produit/carreau-vitrifie-good-will-6060','Carrelage','m²'],
 ]},
}
function objects(value){if(!value||typeof value!=='object')return [];return [value,...Object.values(value).flatMap(v=>Array.isArray(v)?v.flatMap(objects):objects(v))]}
const clean=s=>String(s).replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#039;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim()
export function parseProduct(html,url){
 const h1=clean(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]??'')
 if(!h1)throw Error('Titre produit absent')
 const products=[]
 for(const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let value;try{value=JSON.parse(match[1])}catch{continue}
  products.push(...objects(value).filter(o=>o['@type']==='Product'&&clean(o.name)===h1))
 }
 if(products.length===1){
  const p=products[0];const offers=Array.isArray(p.offers)?p.offers:[p.offers]
  if(offers.length!==1||!offers[0])throw Error('Offres ou variantes ambiguës')
  const offer=offers[0];const price=Number(offer.price)
  if(offer.priceCurrency!=='XOF'||!Number.isSafeInteger(price)||price<=0)throw Error('Prix FCFA explicite absent')
  const currencyText=html.replace(/<script\b[\s\S]*?<\/script>/gi,'')
  const visibleText=clean(currencyText.slice(currencyText.search(/<h1\b/i)))
  const firstPrice=visibleText.match(/\b(\d[\d\s,\u00a0\u202f]*?)\s*(?:F\s*)?CFA\b/)
  const visiblePrice=firstPrice?Number(firstPrice[1].replace(/[\s,\u00a0\u202f]/g,'')):null
  if(visiblePrice!==price)throw Error('Prix structuré différent du premier prix affiché sur la fiche')
  return {name:h1,price,currency:'XOF',sku:p.sku??null,stock_status:/OutOfStock/i.test(offer.availability??'')?'unavailable':/InStock/i.test(offer.availability??'')?'available':'unknown',extraction:'jsonld_product_and_visible_price',url}
 }
 // Site-specific fallback, verified against its visible product template.
 if(new URL(url).hostname==='quinkashop.com'){
  const match=html.match(/<span[^>]+class=["'][^"']*text-4xl[^"']*["'][^>]*>([\d\s\u00a0\u202f,]+)\s*FCFA<\/span>\s*<span[^>]*>\s*\/\s*([^<]+)<\/span>/i)
  if(!match)throw Error('Prix ou unité visibles absents')
  const price=Number(match[1].replace(/[\s\u00a0\u202f,]/g,''));if(!Number.isSafeInteger(price)||price<=0)throw Error('Prix invalide')
  return {name:h1,price,currency:'XOF',unit:clean(match[2]).toLowerCase()==='m2'?'m²':clean(match[2]),stock_status:'unknown',extraction:'visible_product_heading_price_and_unit',url}
 }
 throw Error('Structure produit non prise en charge')
}
export async function collectCatalogue(host){
 const catalogue=CATALOGUES[host];if(!catalogue)throw Error('Source non prise en charge')
 const observations=[],failures=[]
 for(const [url,category,unit]of catalogue.products){
  try{
   if(new URL(url).hostname!==host)throw Error('Origine inattendue')
   const response=await fetch(url,{signal:AbortSignal.timeout(12000),redirect:'manual',headers:{'User-Agent':'AfriOne-PriceReview/1.0','Accept':'text/html'}})
   if(!response.ok)throw Error(`HTTP ${response.status}`)
   if(Number(response.headers.get('content-length')??0)>2000000)throw Error('Page trop volumineuse')
   const html=await response.text();if(html.length>2000000)throw Error('Page trop volumineuse')
   const product=parseProduct(html,url)
   if(product.unit && product.unit!==unit)throw Error('Unité publiée différente du paramétrage')
   observations.push({...product,category,unit,observed_quantity:1,observed_at:new Date().toISOString(),source:catalogue.name,shipping_and_tax:'non vérifiés',review_status:'pending_review'})
  }catch(error){failures.push({url,reason:error instanceof Error?error.message:'Erreur de collecte'})}
 }
 return {source:catalogue.name,base:catalogue.base,observations,failures}
}
