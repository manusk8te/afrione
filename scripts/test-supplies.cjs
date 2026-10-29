const test=require('node:test'),assert=require('node:assert/strict');
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({module:'commonjs',moduleResolution:'node'});require('ts-node/register/transpile-only');
const {classifySupplyScope,describeSupplies,materialObservationUsable}=require('../src/lib/supplies.ts');
test('périmètre explicite : pose seule, fournitures incluses et équipement client',()=>{
 assert.equal(classifySupplyScope({scope:'Mitigeur exclu ; déplacement séparé'}),'excluded');
 assert.equal(classifySupplyScope({scope:'Fournitures et pose'}),'included');
 assert.equal(classifySupplyScope({scope:'Luminaire fourni par le client'}),'excluded');
});
test('inclusions partielles et sources ambiguës ne deviennent jamais tout compris',()=>{
 assert.equal(classifySupplyScope({scope:'Accessoires inclus ; climatiseur exclu'}),'partial');
 assert.equal(classifySupplyScope({scope:'Fournitures non précisées'}),'unknown');
 assert.equal(describeSupplies([{scope:'Fournitures et pose'},{scope:'Conditions à confirmer'}]).status,'unknown');
 assert.equal(describeSupplies([{scope:'Fournitures et pose'},{scope:'Pose seule'}]).status,'partial');
 assert.equal(describeSupplies([{scope:'Fournitures et pose'}]).confirmed_for_local_quote,false);
});
test('prix non datés, sans preuve, non contrôlés ou anciens sont exclus',()=>{
 const now=Date.parse('2026-10-29T10:00:00Z');const fresh={price_market:5000,observed_at:'2026-10-28T10:00:00Z',source_url:'https://merchant.example/sku',price_provenance:'web_observation',added_by:null};
 assert.equal(materialObservationUsable(fresh,now),true);
 for(const override of [{observed_at:null},{observed_at:'2026-01-01'},{source_url:null},{added_by:'artisan',price_provenance:'artisan_declaration'},{price_market:-1}]) assert.equal(materialObservationUsable({...fresh,...override},now),false);
 assert.equal(materialObservationUsable({...fresh,added_by:'artisan',price_provenance:'artisan_declaration',confirmed_at:'2026-10-29'},now),true);
});
