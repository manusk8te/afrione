import fs from 'node:fs';
import { evaluateStudies, composeStudyQuote } from '../src/lib/pricing-studies/engine.mjs';
const read = file => JSON.parse(fs.readFileSync(new URL('../src/data/pricing-studies/' + file, import.meta.url), 'utf8'));
const bundle = { local: read('local-v2.json'), transfer: read('transfer-v3.json'), context: read('context.json') };
const result = composeStudyQuote(evaluateStudies(bundle, 'Remplacement robinet', .5), []);
console.log(JSON.stringify(result, null, 2));
