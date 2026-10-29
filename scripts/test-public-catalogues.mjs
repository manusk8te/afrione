import test from 'node:test';import assert from 'node:assert/strict';
import {parseProduct,collectCatalogue} from '../src/lib/material-sourcing/public-catalogues.mjs';
function fixture({price='3500',currency='XOF',visible='3 500 F CFA',title='Robinet',name='Robinet',offers}={}){return `<h1>${title}</h1><p>${visible}</p><script type="application/ld+json">${JSON.stringify({'@type':'Product',name,offers:offers??{'@type':'Offer',price,priceCurrency:currency,availability:'https://schema.org/InStock'}})}</script>`}
test('prix publié : titre, devise et contenu visible concordent',()=>{const p=parseProduct(fixture(),'https://quincaillerie.ci/product/test');assert.equal(p.price,3500);assert.equal(p.currency,'XOF');assert.equal(p.stock_status,'available')});
test('devise différente, prix masqué ou variante ambiguë : pas de prix inventé',()=>{
 for(const f of [fixture({currency:'EUR'}),fixture({visible:'Prix sur demande'}),fixture({price:'0'}),fixture({name:'Autre produit'}),fixture({offers:[{price:'3500',priceCurrency:'XOF'},{price:'4500',priceCurrency:'XOF'}]})])assert.throws(()=>parseProduct(f,'https://quincaillerie.ci/product/test'));
});
test('Konaté : montant CFA visible et offre structurée unique XOF',()=>{const p=parseProduct(fixture({visible:'4 000&nbsp; CFA',price:'4000',offers:[{price:'4000',priceCurrency:'XOF'}]}),'https://quincaillerie-kf.com/produit/test/');assert.equal(p.price,4000)});
test('QuinkaShop : conserve le prix au m², sans convertir un carton arbitrairement',()=>{
 const h='<h1>Carreau</h1><span class="text-4xl font-black">5 500 FCFA</span><span>/ m2</span>';
 assert.equal(parseProduct(h,'https://quinkashop.com/produit/test').unit,'m²');
 assert.throws(()=>parseProduct(h.replace('/ m2','unité absente'),'https://quinkashop.com/produit/test'));
});
test('aucune collecte sur une origine fournie arbitrairement',async()=>{await assert.rejects(()=>collectCatalogue('localhost'),/non prise en charge/)});
