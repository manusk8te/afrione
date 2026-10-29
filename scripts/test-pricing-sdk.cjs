// Tests SDK hors ligne : aucun appel modèle, Supabase, Jumia ou trace réseau.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs', moduleResolution: 'node', target: 'es2020' });
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-only-not-a-real-key';
require('ts-node/register/transpile-only');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(__dirname, '../src', request.slice(2));
  return resolve.call(this, request, parent, ...rest);
};
const sdk = require('@openai/agents');
sdk.setTracingDisabled(true);
let runWorkflow;
test.before(async () => {
  // Charger le véritable module ESM avant le pont CommonJS de ts-node.
  const filename = path.join(__dirname, '../src/lib/pricing-studies/engine.mjs');
  for (const name of [filename, path.join(__dirname, '../src/lib/pricing-studies/contextualizer.mjs'), path.join(__dirname, '../src/lib/material-sourcing/public-catalogues.mjs'), path.join(__dirname, '../src/lib/material-sourcing/on-demand.mjs')]) {
    const exports = await import(require('node:url').pathToFileURL(name).href);
    const cached = new Module(name);
    cached.filename = name;
    cached.loaded = true;
    cached.exports = exports;
    require.cache[name] = cached;
  }
  ({ runWorkflow } = require('../src/lib/pricing-agent.ts'));
});
const context = { hours: .5, hourly_rate: 3000, urgency: 'medium', quartier: 'Cocody' };
async function selectReference(agent, id = 'FR002') {
  return agent.tools.find(t => t.name === 'contextualize_reference_price').invoke(new sdk.RunContext(), JSON.stringify({ reference_id: id, hours: 50, quantity: 1, match_reason: 'Une seule intervention demandée ; remplacement de mitigeur comparable, fournitures à confirmer.' }));
}
async function executeCalculation(agent) {
  const response = await agent.tools.find(t => t.name === 'calculate_final_price').invoke(
    new sdk.RunContext(), JSON.stringify({ hours: 100, hourly_rate: 999999, materials_total: 0, urgency: 'emergency', quartier: 'autre quartier' })
  );
  return typeof response === 'string' ? JSON.parse(response) : response;
}
const originalRun = sdk.Runner.prototype.run;
test.after(() => { sdk.Runner.prototype.run = originalRun; Module._resolveFilename = resolve; });

test('le vrai outil SDK retourne les résultats de l’étude et verrouille la durée', async () => {
  sdk.Runner.prototype.run = async function (agent) {
    assert.equal(agent.name, 'afrione');
    const study = agent.tools.find(t => t.name === 'estimate_service_price');
    assert.ok(study);
    const response = await study.invoke(new sdk.RunContext(), JSON.stringify({ mission: 'Remplacement robinet', hours: 50 }));
    const r = typeof response === 'string' ? JSON.parse(response) : response;
    assert.equal(r.hours, .5);
    assert.equal(r.estimates.find(e => e.id === 'local_quantile_v3').estimate_fcfa, 5200);
    await selectReference(agent);
    await executeCalculation(agent);
    return { finalOutput: { test_fixture: true }, newItems: [] };
  };
  const result = await runWorkflow({ input_as_text: 'Test logiciel, pas une vraie mission' }, .5, context);
  assert.equal(result.study.hours, .5);
  assert.equal(result.study.production_allowed, false);
});
test('un run qui ignore les études ne valide pas silencieusement un résultat', async () => {
  sdk.Runner.prototype.run = async function () { return { finalOutput: { test_fixture: true }, newItems: [] }; };
  await assert.rejects(() => runWorkflow({ input_as_text: 'Test' }, .5, context), /Études non consultées/);
});
test('deux exécutions SDK ne mélangent pas leurs missions', async () => {
  sdk.Runner.prototype.run = async function (agent, messages) {
    const mission = messages[0].content[0].text;
    await agent.tools.find(t => t.name === 'estimate_service_price').invoke(new sdk.RunContext(), JSON.stringify({ mission, hours: 1 }));
    await selectReference(agent);
    await executeCalculation(agent);
    return { finalOutput: { test_fixture: true }, newItems: [] };
  };
  const [a,b] = await Promise.all([
    runWorkflow({ input_as_text: 'Remplacement robinet' }, .5, context),
    runWorkflow({ input_as_text: 'Installation WC' }, 12, { ...context, hours: 12 }),
  ]);
  assert.equal(a.study.mission, 'Remplacement robinet');
  assert.equal(b.study.mission, 'Installation WC');
  assert.equal(b.study.hours, 12);
});

test('l’agent choisit une référence puis le vrai outil fournit le contexte V4', async () => {
  sdk.Runner.prototype.run = async function (agent) {
    const finder=agent.tools.find(t=>t.name==='search_price_reference');
    const found=await finder.invoke(new sdk.RunContext(),JSON.stringify({query:'mitigeur'}));
    const rows=typeof found==='string'?JSON.parse(found):found;
    assert.ok(rows.matches.some(r=>r.id==='FR002'));
    const contextTool=agent.tools.find(t=>t.name==='contextualize_reference_price');
    await contextTool.invoke(new sdk.RunContext(),JSON.stringify({reference_id:'FR002',hours:10,quantity:1,match_reason:'Une intervention de changement de mitigeur de cuisine, fourniture exclue.'}));
    await selectReference(agent);
    await executeCalculation(agent);
    return {finalOutput:{test_fixture:true},newItems:[]};
  };
  const r=await runWorkflow({input_as_text:'Test de branchement hors ligne'},.5,context);
  assert.equal(r.study,null);
  assert.equal(r.price_context.reference_id,'FR002');
  assert.equal(r.price_context.hours,.5);
  assert.ok(r.price_context.candidate_price_fcfa>0);
  assert.equal(r.price_context.production_allowed,false);
});


test('le serveur impose tous les montants du calcul même si l’IA les réécrit', async () => {
  let expected;
  sdk.Runner.prototype.run = async function (agent) {
    await agent.tools.find(t => t.name === 'estimate_service_price').invoke(new sdk.RunContext(), JSON.stringify({ mission: 'Remplacement robinet', hours: 50 }));
    await selectReference(agent);
    expected = await executeCalculation(agent);
    return { finalOutput: { total: 1, fourchette: { min: 0, max: 2 }, artisan_percoit: 1, breakdown: { main_oeuvre: 1 }, data_note: 'Texte rédigé par le modèle' }, newItems: [] };
  };
  const r = await runWorkflow({ input_as_text: 'Test de non-altération des montants' }, .5, context);
  for (const key of ['total', 'fourchette', 'artisan_percoit', 'breakdown']) assert.deepEqual(r.output[key], expected[key]);
  assert.notEqual(r.output.total, 1);
  assert.equal(r.output.data_note, 'Texte rédigé par le modèle');
  assert.equal(r.output.breakdown.urgence, null);
});

test('une étude seule ne permet pas de retourner un devis sans outil de calcul', async () => {
  sdk.Runner.prototype.run = async function (agent) {
    await agent.tools.find(t => t.name === 'estimate_service_price').invoke(new sdk.RunContext(), JSON.stringify({ mission: 'Remplacement robinet', hours: 1 }));
    return { finalOutput: { total: 1000 }, newItems: [] };
  };
  await assert.rejects(() => runWorkflow({ input_as_text: 'Test sans calcul' }, .5, context), /Calcul final non exécuté/);
});

test('la V4 modifie le total et permet une analogie hors des cinq tâches locales', async () => {
  sdk.Runner.prototype.run = async function (agent) {
    await selectReference(agent, 'FR046');
    await executeCalculation(agent);
    return { finalOutput: { total: 4200 }, newItems: [] };
  };
  const r = await runWorkflow({ input_as_text: 'Une prestation de coiffure comparable' }, .5, context);
  assert.equal(r.output.total, Math.round(r.price_context.candidate_price_fcfa));
  assert.equal(r.price_context.extrapolation, true);
  assert.equal(r.output.breakdown.main_oeuvre, null);
  assert.equal(r.output.artisan_percoit, null);
});
test('aucun ancien calcul horaire sans référence comparable', async () => {
  sdk.Runner.prototype.run = async function (agent) {
    const result = await executeCalculation(agent);
    assert.match(String(result), /Référence comparable/);
    return { finalOutput: { total: 4200 }, newItems: [] };
  };
  await assert.rejects(() => runWorkflow({ input_as_text: 'Test' }, .5, context));
});

test('la question de précision remonte sans prix', async () => {
 sdk.Runner.prototype.run = async function(agent) {
  await agent.tools.find(t=>t.name==='request_pricing_details').invoke(new sdk.RunContext(),JSON.stringify({question:'Quelle surface en m² faut-il peindre ?'}));
  return {finalOutput:{total:0},newItems:[]};
 };
 await assert.rejects(()=>runWorkflow({input_as_text:'Peindre mon salon'},2,context),/informations_requises: Quelle surface/);
});
test('changer de référence invalide le calcul précédent', async () => {
 sdk.Runner.prototype.run = async function(agent) {
  await selectReference(agent);
  await executeCalculation(agent);
  await selectReference(agent,'FR046');
  return {finalOutput:{total:999},newItems:[]};
 };
 await assert.rejects(()=>runWorkflow({input_as_text:'Test changement'},.5,context),/Calcul final non exécuté/);
});

test('la recherche fournitures ignore une ancienne ligne et utilise le relevé récent contrôlé', async () => {
 const {supabaseAdmin}=require('../src/lib/supabase.ts');const originalFrom=supabaseAdmin.from;let category;
 supabaseAdmin.from=()=>{const chain={select:()=>chain,ilike:()=>chain,eq:(key,value)=>{if(key==='category')category=value;return chain},gte:()=>chain,or:()=>chain,order:()=>chain,limit:async()=>({data:[{name:'Ancienne ligne',price_market:1500},{name:'Produit test contrôlé',price_market:7000,source:'Magasin fixture',source_url:'https://merchant.example/sku',unit:'unité',observed_at:new Date().toISOString(),added_by:'contributor',confirmed_at:new Date().toISOString(),price_provenance:'artisan_declaration',stock_status:'available'}]})};return chain};
 try{
  sdk.Runner.prototype.run=async function(agent){
   const response=await agent.tools.find(t=>t.name==='search_material_price').invoke(new sdk.RunContext(),JSON.stringify({item:'robinet',category:'Plombier',qty:1}));
   const price=typeof response==='string'?JSON.parse(response):response;
   assert.equal(price.price_unit,7000);assert.equal(price.is_fallback,false);assert.equal(category,'Plomberie');
   await selectReference(agent);await executeCalculation(agent);return {finalOutput:{test_fixture:true},newItems:[]};
  };
  await runWorkflow({input_as_text:'Test hors ligne de la base fournitures'},.5,context);
 }finally{supabaseAdmin.from=originalFrom}
});
