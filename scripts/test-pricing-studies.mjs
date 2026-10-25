import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { evaluateStudies, priceMaterialObservation, composeStudyQuote, lockPricingInputs } from '../src/lib/pricing-studies/engine.mjs';
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = path.join(app, 'src/data/pricing-studies');
const read = name => JSON.parse(fs.readFileSync(path.join(data, name), 'utf8'));
const bundle = { local: read('local-v2.json'), transfer: read('transfer-v3.json'), context: read('context.json') };
const find = (r, id) => r.estimates.find(e => e.id === id);
test('empreintes des artefacts de l’étude', () => {
  for (const row of bundle.context.manifest) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.resolve(data, row.file))).digest('hex'), row.sha256);
});
test('parité des cinq prix de transfert avec les résultats Python existants', () => {
  for (const row of bundle.transfer.catalog) {
    const r = evaluateStudies(bundle, row.mission, row.heures_medianes);
    assert.ok(Math.abs(find(r, 'transfer_quantile_v3').estimate_fcfa - row.prix_modele_fcfa) < 1e-7);
    assert.equal(r.can_add_materials, false); assert.equal(r.production_allowed, false);
  }
});
test('parité Python et moteur local, médiane et régression', () => {
  const python = process.env.AFRIONE_TEST_PYTHON || '/Users/goblyemmanuel/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
  const code = `import sys,json\nsys.path.insert(0,sys.argv[1])\nfrom afrione_estimateur_runtime import estimate\nm=json.load(open(sys.argv[1]+'/afrione_estimateur.json'))\nr=[]\nfor c in m['catalog']:\n for s in ['median','regression']:\n  r.append(dict(mission=c['mission'],hours=c['duree_mediane'],strategy=s,result=estimate(c['mission'],c['duree_mediane'],strategy=s,model=m)))\nprint(json.dumps(r))`;
  const out = spawnSync(python, ['-c', code, path.join(path.dirname(app), 'outputs')], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  for (const row of JSON.parse(out.stdout)) {
    const r = find(evaluateStudies(bundle, row.mission, row.hours), row.strategy === 'median' ? 'local_median_v2' : 'local_regression_v2');
    assert.equal(r.status, row.result.status);
    if (r.estimate_fcfa !== undefined) assert.ok(Math.abs(r.estimate_fcfa - row.result.estimate_fcfa) < 1e-6);
  }
});
test('missions inconnues, plinthes ambiguës et durées hors domaine', () => {
  for (const h of [-1, 0, Infinity, NaN]) assert.equal(evaluateStudies(bundle, 'Remplacement robinet', h).status, 'devis_requis');
  assert.equal(evaluateStudies(bundle, 'Mitigeur de cuisine avec douchette', .5).status, 'devis_requis');
  assert.equal(find(evaluateStudies(bundle, 'Remplacement robinet', 500), 'transfer_quantile_v3').status, 'devis_requis');
  assert.equal(find(evaluateStudies(bundle, 'Pose de plinthes (par ml)', 8), 'local_median_v2').status, 'devis_requis');
});
test('scores Ridge/Lasso conservés avec leurs échantillons distincts', () => {
  const r = evaluateStudies(bundle, 'Remplacement robinet', .5);
  assert.deepEqual(r.validation.map(v => v.n), [24, 14]);
  assert.ok(r.validation[0].scores.some(s => s.methode === 'Ridge réglé en interne'));
  assert.equal(find(r, 'local_quantile_v3').estimate_fcfa, 5200);
});
// Fixtures fictives de tests logiciels, jamais importées dans le catalogue.
const now = Date.parse('2026-10-25T10:00:00Z');
const request = { material_id: 'fixture-only', name: 'Produit de test', quantity: 2, unit: 'unité' };
const record = { id: 'fixture-only', name: 'Produit de test', unit: 'unité', source: 'Jumia CI', price_market: 8800, web_price: 10000, source_url: 'https://example.com/fixture', last_scraped_at: '2026-10-24T10:00:00Z' };
test('prix web publié sans remise marché arbitraire', () => {
  const r = priceMaterialObservation(request, record, now);
  assert.equal(r.price_unit_fcfa, 10000); assert.equal(r.total_fcfa, 20000);
});
test('unité, fraîcheur et justificatif requis', () => {
  for (const changed of [{ unit: 'm3' }, { source_url: null }, { web_price: null }, { last_scraped_at: '2020-01-01' }, { source: 'Marché', confirmed_at: null }]) assert.equal(priceMaterialObservation(request, { ...record, ...changed }, now).status, 'devis_requis');
  assert.equal(priceMaterialObservation({ ...request, quantity: -1 }, record, now).status, 'devis_requis');
  assert.equal(priceMaterialObservation(request, null, now).total_fcfa, null);
});
test('double comptage des fournitures bloqué', () => {
  const r = composeStudyQuote(evaluateStudies(bundle, 'Remplacement robinet', .5), [priceMaterialObservation(request, record, now)]);
  assert.equal(r.materials_subtotal_fcfa, 20000); assert.equal(r.total, null); assert.equal(r.main_oeuvre, null); assert.equal(r.applied_estimator, null);
});
test('taux horaire verrouillé face aux arguments du modèle de langage', () => {
  const expected = { hours: .5, hourly_rate: 3000, quartier: 'Cocody', urgency: 'medium' };
  const locked = lockPricingInputs(expected, { hours: 500, hourly_rate: 5773, materials_total: 10000, urgency: 'emergency' });
  assert.equal(locked.hourly_rate, 3000); assert.equal(locked.hours, .5); assert.equal(locked.urgency, 'medium'); assert.equal(locked.materials_total, 10000);
});
