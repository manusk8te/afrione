const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({module:'commonjs',moduleResolution:'node'});require('ts-node/register/transpile-only');
let signed=true,lookups=0;const original=Module._load;
Module._load=function(request,...args){
 if(request==='@/lib/mission-auth')return {authenticate:async()=>signed?{userId:'fixture'}:null};
 if(request==='@/lib/metier')return {normalizeMetier:x=>x};
 if(request==='@/lib/supplies')return {materialObservationUsable:()=>false};
 if(request==='@/lib/supabase')return {supabaseAdmin:{from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:async()=>({data:[]})};return q}}};
 if(request==='@/lib/material-sourcing/lookup')return {lookupMaterialOffers:async query=>{lookups++;return {query,found:true,offers:[{name:query,price:85000,source_url:'https://merchant.example/ciment',unit:'tonne'}],note:'fixture'}}};
 return original.call(this,request,...args)
};
const {POST,GET}=require('../src/app/api/materials/route.ts');Module._load=original;
const req=body=>({json:async()=>body});
test('sans connexion : aucun fetch fournisseur',async()=>{signed=false;lookups=0;assert.equal((await POST(req({name:'ciment'}))).status,401);assert.equal(lookups,0);signed=true});
test('recherche POST en lecture seule : lien et unité conservés, aucun accès DB',async()=>{const r=await POST(req({name:'ciment'}));assert.equal(r.status,200);const d=await r.json();assert.equal(d.offers[0].unit,'tonne');assert.equal(d.offers[0].price,85000);assert.ok(d.offers[0].source_url)});
test('requête bornée et fournitures non additionnées au prix de prestation',async()=>{const r=await GET({nextUrl:new URL('https://fixture/api/materials?items=ciment')});const d=await r.json();assert.equal(r.status,200);assert.equal(d.materials[0].offers[0].price,85000);assert.equal(d.market_reference_fcfa,null);assert.equal(d.materials[0].tiers.standard,null);const invalid=await GET({nextUrl:new URL('https://fixture/api/materials?items=a,b,c,d,e')});assert.equal(invalid.status,400)});
