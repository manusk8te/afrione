const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs', moduleResolution: 'node', target: 'es2020' });
require('ts-node/register/transpile-only');
const originalLoad = Module._load;
let calls = [];
Module._load = function (request, ...args) {
  if (request === '@/lib/supplies') return require('../src/lib/supplies.ts');
  if (request === '@/lib/mission-auth') return {authenticate:async()=>({userId:'fixture-user'})};
  if (request === '@/lib/supabase') return {};
  if (request === '@/lib/pricing-agent') return { runPricingAgent: async input => { calls.push(input); if (input.description === 'Besoin de surface') throw new Error('informations_requises: Quelle surface en m² ?'); return { total: 1234, calculation_source: 'calculate_final_price' }; } };
  if (request === '@/lib/pricing-studies') return { getPriceContext: () => ({ status: 'fixture' }), previewStudyQuote: async () => ({ status: 'fixture' }) };
  return originalLoad.call(this, request, ...args);
};
const { POST } = require('../src/app/api/pricing-agent/route.ts');
Module._load = originalLoad;
const valid = { category: 'Plomberie', description: 'Remplacement de robinet', hours_estimate: .5, items_needed: [] };
const request = body => ({ json: async () => body });

test('les demandes incomplètes ou incohérentes ne déclenchent aucun appel agent', async () => {
  calls = [];
  for (const body of [{ ...valid, hours_estimate: -1 }, { ...valid, description: '' }, { ...valid, hours_estimate: '2' }, { ...valid, items_needed: [{ name: 'robinet' }] }, { ...valid, total: 100 }]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal(calls.length, 0);
});
test('la demande valide transmet uniquement les données normalisées au SDK existant', async () => {
  calls = [];
  const response = await POST(request({ ...valid, description: '  Remplacement de robinet  ' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).calculation_source, 'calculate_final_price');
  assert.deepEqual(calls, [{ ...valid, quartier: 'Cocody', urgency: 'medium' }]);
});

test('la précision demandée par l’agent revient sans prix ni erreur serveur', async () => {
 const response=await POST(request({...valid,description:'Besoin de surface'}));
 assert.equal(response.status,422);
 const result=await response.json();
 assert.equal(result.total,null);
 assert.equal(result.status,'informations_requises');
 assert.equal(result.error,'Quelle surface en m² ?');
});
