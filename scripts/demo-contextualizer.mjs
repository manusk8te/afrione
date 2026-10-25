import fs from 'node:fs';
import {searchReferences,contextualizeReference} from '../src/lib/pricing-studies/contextualizer.mjs';
const model=JSON.parse(fs.readFileSync(new URL('../src/data/pricing-studies/context-v4.json',import.meta.url)));
const matches=searchReferences(model,'mitigeur');
console.log(JSON.stringify({references:matches,context:contextualizeReference(model,'FR002',.5)},null,2));
