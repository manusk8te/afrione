const test=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({module:'commonjs',moduleResolution:'node'});require('ts-node/register/transpile-only');
const {NextResponse}=require('next/server');const original=Module._load;
let auth='client',rpcError=null,received=null;
Module._load=function(name,...args){
 if(name==='./mission-auth')return {resolveMissionViewer:async()=>auth==='none'?{ok:false,res:NextResponse.json({error:'Non authentifié'},{status:401})}:{ok:true,viewer:{userId:auth==='client'?'owner':'stranger',mission:{client_id:'owner'}}}};
 if(name==='./supabase')return {supabaseAdmin:{rpc:async(name,args)=>{received={name,args};return {data:rpcError?null:{id:'receipt',amount:4200},error:rpcError}}}};
 return original.call(this,name,...args);
};
const {simulatePayment}=require('../src/lib/payment-simulation.ts');Module._load=original;
const valid={mission_id:'12345678-1234-4234-8234-123456789abc',amount:4200};
const req=body=>({json:async()=>body});
test('simulation : authentification obligatoire',async()=>{auth='none';assert.equal((await simulatePayment(req(valid))).status,401)});
test('simulation : seul le propriétaire peut poursuivre',async()=>{auth='other';received=null;assert.equal((await simulatePayment(req(valid))).status,403);assert.equal(received,null)});
test('montants invalides refusés avant toute écriture',async()=>{auth='client';for(const amount of [-1,0,Infinity,'4200',.5])assert.equal((await simulatePayment(req({...valid,amount}))).status,400)});
test('seule la RPC isolée est appelée avec l’identité vérifiée',async()=>{auth='client';rpcError=null;const response=await simulatePayment(req(valid));assert.equal(response.status,200);assert.equal((await response.json()).simulation,true);assert.equal(received.name,'simulate_client_payment');assert.equal(received.args.p_client_id,'owner')});
test('échec base ou devis modifié : jamais de faux succès',async()=>{auth='client';rpcError={message:'quote_changed'};assert.equal((await simulatePayment(req(valid))).status,409);rpcError={message:'database unavailable'};assert.equal((await simulatePayment(req(valid))).status,500);rpcError=null});
