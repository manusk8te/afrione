import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { estimateByAnalogy, contextualizeReference } from '../src/lib/pricing-studies/contextualizer.mjs';
const model = JSON.parse(fs.readFileSync(new URL('../src/data/pricing-studies/context-v4.json', import.meta.url)));
const reason = 'Prestation comparable, une seule unité explicitement demandée.';
test('parité V4 sur une intervention unitaire calibrée', () => {
  const a = estimateByAnalogy(model, 'FR002', .5, 1, reason);
  const b = contextualizeReference(model, 'FR002', .5);
  assert.equal(a.candidate_price_fcfa, b.candidate_price_fcfa);
});
test('tous les métiers ont des références exploitables, avec extrapolation signalée', () => {
  const trades = new Set();
  for (const ref of model.sources) {
    if (ref.unit === 'contrat annuel') continue;
    const r = estimateByAnalogy(model, ref.id, 1, 1, reason);
    assert.ok(r.candidate_price_fcfa > 0, ref.id);
    assert.equal(r.production_allowed, false);
    assert.equal(r.can_add_materials, false);
    trades.add(ref.trade);
  }
  assert.equal(trades.size, 10);
});
test('quantité manquante, référence inventée et durée excessive ne donnent aucun prix', () => {
  for (const [id,h,q] of [['FR016',2,null], ['FAKE',1,1], ['FR002',1000,1]]) {
    assert.equal(estimateByAnalogy(model,id,h,q,reason).candidate_price_fcfa,null);
  }
});
test('le tarif horaire ne compte pas deux fois la durée', () => {
  const a=estimateByAnalogy(model,'FR026',1,1,reason);
  const b=estimateByAnalogy(model,'FR026',4,4,reason);
  assert.equal(b.candidate_price_fcfa,a.candidate_price_fcfa*4);
  assert.equal(estimateByAnalogy(model,'FR026',4,1,reason).candidate_price_fcfa,null);
});
test('surface : quantité explicite et prix marginal décroissant à quantité fixe', () => {
  const a=estimateByAnalogy(model,'FR016',2,10,reason);
  const b=estimateByAnalogy(model,'FR016',4,10,reason);
  assert.equal(a.quantity,10);
  assert.ok(b.candidate_price_fcfa>a.candidate_price_fcfa);
  assert.ok(b.candidate_price_fcfa<2*a.candidate_price_fcfa);
});
