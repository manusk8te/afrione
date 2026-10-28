const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({module:'commonjs',moduleResolution:'node',jsx:'react-jsx'});
require('ts-node/register/transpile-only');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const Card=require('../src/components/pricing/PriceContextCard.tsx').default;
let model,contextualizeReference;
test.before(async()=>{
 model=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/data/pricing-studies/context-v4.json'),'utf8'));
 ({contextualizeReference}=await import(pathToFileURL(path.join(__dirname,'../src/lib/pricing-studies/contextualizer.mjs')).href));
});
test('le repère publié affiche les montants réellement calculés et sa source',()=>{
 const context=contextualizeReference(model,'FR002',.5);
 const text=renderToStaticMarkup(React.createElement(Card,{context}));
 assert.ok(text.includes('À confirmer par un prestataire'));
 assert.ok(text.includes(Math.round(context.candidate_price_fcfa).toLocaleString('fr-FR')));
 assert.ok(text.includes(context.sources[0].url));
 assert.ok(text.includes('pas automatiquement ajouté'));
});
test('une référence sans calibration locale n’affiche aucun prix inventé',()=>{
 const context=contextualizeReference(model,'FR046',1);
 const text=renderToStaticMarkup(React.createElement(Card,{context}));
 assert.ok(text.includes('Un prestataire doit confirmer le prix'));
 assert.ok(!text.includes('FCFA'));assert.ok(!text.includes('NaN'));
});
test('un montant invalide ne devient pas un repère affiché',()=>{
 const context={status:'contextualisation_experimentale',candidate_price_fcfa:NaN,central_estimate_fcfa:1000};
 const text=renderToStaticMarkup(React.createElement(Card,{context}));
 assert.ok(!text.includes('FCFA'));assert.ok(!text.includes('NaN'));
});

test('le prix actif annonce son application et signale l’analogie',()=>{
 const context={status:'contextualisation_experimentale',candidate_price_fcfa:5000,central_estimate_fcfa:17000,extrapolation:true,quantity:1,unit:'prestation',technical_match:'Une prestation comparable de coiffure'};
 const text=renderToStaticMarkup(React.createElement(Card,{context,applied:true}));
 assert.ok(text.includes('constitue le prix indicatif proposé'));
 assert.ok(text.includes('Extrapolation non validée localement'));
 assert.ok(!text.includes('pas automatiquement ajouté'));
});
