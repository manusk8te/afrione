import test from 'node:test'
import assert from 'node:assert/strict'
import {productMatches,discoverProducts,parseLiveProduct,searchPublicMaterials,LIVE_SOURCES} from '../src/lib/material-sourcing/on-demand.mjs'
test('correspondance : usage et diamètre doivent correspondre',()=>{assert.equal(productMatches('robinet cuisine','Robinet cuisine chromé'),true);assert.equal(productMatches('robinet cuisine','Robinet douche'),false);assert.equal(productMatches('cable 2.5','Cable 25'),false)})
test('aucune URL externe, identifiant ou lien de navigation récupéré',()=>{const s=LIVE_SOURCES.find(s=>s.host==='sogep-africa.com');const h='<a href="https://evil.test/produit/robinet/">X</a><a href="https://sogep-africa.com/produit/robinet/">X</a><a href="https://sogep-africa.com/produit/robinet/?token=x">X</a>';assert.deepEqual(discoverProducts(h,s,'robinet'),['https://sogep-africa.com/produit/robinet/'])})
test('Sogep : ne prend jamais le prix des produits similaires',()=>{assert.throws(()=>parseLiveProduct('<h1>Robinet</h1><p class="price"></p><h2>Similaires</h2><span>5.000 CFA</span>','https://sogep-africa.com/produit/robinet/'));assert.equal(parseLiveProduct('<h1>Tube fluo</h1><p class="price"><span>1.200&nbsp;CFA</span></p>','https://sogep-africa.com/produit/tube-fluo/').price,1200)})
test('IvoirElite : concordance devise, montant structuré et visible',()=>{const h='<h1>Pompe</h1><meta itemprop="priceCurrency" content="XOF"><div class="current-price"><span itemprop="price" content="114000">114 000 CFA</span></div>';assert.equal(parseLiveProduct(h,'https://ivoirelite.net/categories/1-pompe.html').price,114000);assert.throws(()=>parseLiveProduct(h.replace('114000','100'),'https://ivoirelite.net/categories/1-pompe.html'))})
test('recherche publique retourne une preuve sans base de données',async()=>{const fetched=[];const fetcher=async url=>{fetched.push(url);return new Response(url.includes('?s=')?'<a href="https://sogep-africa.com/produit/tube-fluo/">Tube</a>':'<h1>Tube fluo</h1><p class="price">1.200 CFA</p>')};const r=await searchPublicMaterials('tube fluo',{sources:[LIVE_SOURCES.find(s=>s.host==='sogep-africa.com')],fetcher});assert.equal(r.found,true);assert.equal(r.offers[0].price,1200);assert.equal(r.offers[0].source_url,'https://sogep-africa.com/produit/tube-fluo/');assert.equal(r.offers[0].included_in_service_price,false);assert.equal(fetched.length,2)})
test('blocage du fournisseur : aucune valeur de remplacement',async()=>{const r=await searchPublicMaterials('tube',{sources:[LIVE_SOURCES.find(s=>s.host==='sogep-africa.com')],fetcher:async()=>new Response('',{status:403})});assert.equal(r.found,false);assert.deepEqual(r.offers,[])})
const batPage=props=>`<div data-page="${JSON.stringify({props}).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"></div>`
test('ProduitBat : uniquement les résultats de recherche, jamais les recommandations',()=>{const h=batPage({products:[{title:'Ciment hors recherche',slugProduct:'autre'}],shopProducts:{data:[{title:'Ciment la tonne',slugProduct:'ciment-tonne'}]}});assert.deepEqual(discoverProducts(h,LIVE_SOURCES.find(s=>s.host==='produitbat.ci'),'ciment'),['https://produitbat.ci/detail/produit/ciment-tonne'])})
test('ProduitBat : tonne explicite, prix nul ou variante refusés',()=>{const p={title:'Ciment la tonne',slugProduct:'ciment-tonne',price:85000,QteStock:10,variantes:[],promotion:null};const url='https://produitbat.ci/detail/produit/ciment-tonne';const r=parseLiveProduct(batPage({product:p}),url);assert.equal(r.price,85000);assert.equal(r.unit,'tonne');assert.throws(()=>parseLiveProduct(batPage({product:{...p,price:0}}),url));assert.throws(()=>parseLiveProduct(batPage({product:{...p,variantes:[{id:1}]}}),url))})
import {missingMaterialSpecs} from '../src/lib/material-sourcing/needs.mjs'
test('mission : ne pas chercher un ciment ou un robinet générique',()=>{assert.ok(missingMaterialSpecs('ciment').length>=3);assert.ok(missingMaterialSpecs('robinet').length>=2);assert.deepEqual(missingMaterialSpecs('Ciment CPJ 32.5R la tonne'),[]);assert.deepEqual(missingMaterialSpecs('robinet mitigeur cuisine'),[])})
test('ciment demandé : robinet et mauvaise classe refusés',()=>{assert.equal(productMatches('ciment CPJ 42.5','robinet mitigeur cuisine'),false);assert.equal(productMatches('ciment CPJ 42.5','Ciment CPJ 32.5'),false);assert.equal(productMatches('robinet mitigeur cuisine','robinet mitigeur douche'),false)})

test('carrelage 60×60 : correspond à la fiche 60/60 et conserve le prix au m²', async () => {
 const query = 'Carrelage 60×60'
 const title = 'Carreau vitrifié Good Will 60/60'
 const url = 'https://quinkashop.com/produit/carreau-vitrifie-good-will-6060'
 assert.equal(productMatches(query, title), true)
 assert.equal(productMatches('carrelage 60×120', title), false)
 const result = await searchPublicMaterials(query, {
  fetcher: async requested => requested === url
   ? new Response(`<h1>${title}</h1><span class="text-4xl">5 500 FCFA</span><span>/ m2</span>`)
   : new Response('', {status: 404}),
 })
 assert.equal(result.offers.length, 1)
 assert.equal(result.offers[0].price, 5500)
 assert.equal(result.offers[0].unit, 'm²')
 assert.equal(result.offers[0].source_url, url)
})

test('une vis à bois générique retourne un repère par boîte, sans autoriser sa sélection', async () => {
 const url = 'https://www.dunya.ci/produits/produit/786/'
 const fiche = '<h1>LIVRAISON GRATUITE</h1><h1 class="fs-5 fw-normal">Vis à Bois Ø 3.5 x 50 mm</h1><div class="flash-price">5 500 FCFA</div><div class="flash-old-price">10 000 FCFA</div><p>Une boîte de 500 vis.</p>'
 const fetcher = async requested => requested === url ? new Response(fiche) : new Response('', {status: 404})
 const result = await searchPublicMaterials('Vis à bois adaptées', {fetcher})
 assert.deepEqual(result.offers.map(o=>[o.price,o.unit,o.reference_only]), [[5500,'boîte de 500 vis',true]])
 const otherSize = await searchPublicMaterials('Vis à bois 4 x 60 mm', {fetcher})
 assert.deepEqual(otherSize.offers, [])
})
