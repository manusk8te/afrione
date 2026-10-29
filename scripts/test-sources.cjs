const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({module:'commonjs',moduleResolution:'node'});require('ts-node/register/transpile-only');
let role='artisan',signed=true,written;
const original=Module._load;
Module._load=function(request,...args){
 if(request==='@/lib/mission-auth')return {authenticate:async()=>signed?{userId:'actual-user'}:null};
 if(request==='@/lib/supabase')return {supabaseAdmin:{from:table=>{const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:table==='users'?{role}:{id:'12345678-1234-4234-8234-123456789abc',name:'Test store',is_partner:false}}),insert:payload=>{written=payload;return {select:()=>({single:async()=>({data:{id:'fixture',...payload},error:null})})}}};return q}}};
 return original.call(this,request,...args);
};
const {POST}=require('../src/app/api/sources/route.ts');Module._load=original;
const valid={action:'add_material',source_id:'12345678-1234-4234-8234-123456789abc',name:'Produit test',category:'Plomberie',unit:'unité',price_observed:6000,observed_quantity:2,observed_at:new Date().toISOString(),evidence_url:'https://merchant.example/receipt'};
const req=body=>({json:async()=>body});
test('aucune contribution anonyme',async()=>{signed=false;assert.equal((await POST(req(valid))).status,401);signed=true});
test('un artisan ne peut ni valider ni déclarer un partenariat',async()=>{for(const action of ['verify_source','confirm_material','set_partner'])assert.equal((await POST(req({...valid,action}))).status,403)});
test('prix, quantité et date obligatoires',async()=>{for(const change of [{price_observed:0},{price_observed:-100},{observed_quantity:0},{observed_at:'invalid'}])assert.equal((await POST(req({...valid,...change}))).status,400)});
test('nouvelle déclaration : identité serveur, prix par unité et revue obligatoire',async()=>{written=null;const response=await POST(req({...valid,added_by:null,confirmed_at:'2026-10-29',price_provenance:'partner_catalogue'}));assert.equal(response.status,200);assert.equal(written.added_by,'actual-user');assert.equal(written.confirmed_at,null);assert.equal(written.price_provenance,'artisan_declaration');assert.equal(written.price_market,3000);assert.equal(written.price_min,3000);assert.equal(written.observed_price_total,6000)});
