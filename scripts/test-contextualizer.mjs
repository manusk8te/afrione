import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { contextualizeReference, searchReferences } from '../src/lib/pricing-studies/contextualizer.mjs';
const model=JSON.parse(fs.readFileSync(new URL('../src/data/pricing-studies/context-v4.json',import.meta.url)));
test('le catalogue France/Sénégal comporte les références publiées existantes',()=>{
 assert.equal(model.sources.length,55);assert.deepEqual(model.source_countries,['FRA','SEN']);
 assert.equal(new Set(model.sources.map(r=>r.id)).size,55);
 assert.ok(model.sources.every(r=>r.url.startsWith('https://') && r.price_low>0));
});
test('la recherche aide l’agent sans inventer un prix ni diagnostiquer la mission',()=>{
 const rows=searchReferences(model,'mitigeur');assert.ok(rows.some(r=>r.id==='FR002'));
 assert.ok(rows.every(r=>model.sources.some(s=>s.id===r.id)));
 assert.deepEqual(searchReferences(model,''),[]);
});
test('les 14 exemples de calcul reproduisent le Python de contextualisation',()=>{
 assert.equal(model.final_examples.length,14);
 for(const e of model.final_examples){
  const r=contextualizeReference(model,e.reference_id,e.hours);
  assert.ok(Math.abs(r.central_estimate_fcfa-e.central)<1e-7);
  assert.ok(Math.abs(r.candidate_price_fcfa-e.candidate)<1e-7);
  assert.equal(r.D,model.D);assert.equal(r.production_allowed,false);assert.equal(r.can_add_materials,false);
 }
});
test('une référence sénégalaise ou française du même groupe donne le même contexte',()=>{
 const a=contextualizeReference(model,'FR001',1),b=contextualizeReference(model,'AF039',1);
 assert.equal(a.normalized_reference_fcfa,b.normalized_reference_fcfa);
 assert.equal(a.candidate_price_fcfa,b.candidate_price_fcfa);
 assert.equal(a.sources.length,2);
});
test('les références sans calibration locale ne deviennent pas des prix CI prétendument appris',()=>{
 const r=contextualizeReference(model,'FR046',1);
 assert.equal(r.status,'contexte_non_valide');assert.equal(r.candidate_price_fcfa,null);
 assert.ok(r.normalized_reference_fcfa>0);
 assert.equal(contextualizeReference(model,'invented-id',1).status,'devis_requis');
});
test('durée invalide et extrapolation refusées',()=>{
 for(const h of [0,-1,NaN,Infinity,1000])assert.equal(contextualizeReference(model,'FR002',h).status,'devis_requis');
});
test('D négatif reste négatif : aucun rabais positif fabriqué',()=>{
 const changed={...model,calibration_multiplier:1.1,D:-.1};
 const r=contextualizeReference(changed,'FR002',.5);
 assert.equal(r.D,-.1);assert.equal(r.lower_than_central,false);
});
test('la régression n’emploie aucun nom de tâche et garde la fonction concave',()=>{
 assert.deepEqual(model.feature_names,['const','log1p_hours']);
 const values=[.2,.3,.4,.5,.6].map(h=>contextualizeReference(model,'FR002',h).candidate_price_fcfa);
 for(let i=1;i<values.length;i++)assert.ok(values[i]>=values[i-1]);
 for(let i=2;i<values.length;i++)assert.ok(values[i]-2*values[i-1]+values[i-2]<=1e-8);
});
