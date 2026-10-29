import {normalizeQuery} from './on-demand.mjs'
// Mission searches require a minimum specification. Exploration in admin remains explicitly separate.
export function missingMaterialSpecs(item){
 const q=normalizeQuery(item).replace(/,/g,'.');const missing=[]
 if(/\bciment\b/.test(q)){
  if(!/\b(?:cpj|cpa|cem|chf)\b/.test(q))missing.push('type de ciment (CPJ, CPA, CEM…)')
  if(!/\b(?:32\.5|42\.5|52\.5|350)(?:r|n)?\b/.test(q))missing.push('classe de résistance requise')
  if(!/\btonne\b|\b\d+\s*kg\b/.test(q))missing.push('conditionnement : poids du sac ou tonne')
 }
 if(/\brobinet\b|\bmitigeur\b/.test(q)){
  if(!/\bcuisine\b|\bevier\b|\blavabo\b|\bdouche\b|\bbaignoire\b|\barret\b|\bmachine\b|\bpuisage\b/.test(q))missing.push('usage du robinet : évier, lavabo, douche…')
  if(!/\bmitigeur\b|\bmelangeur\b|\barret\b|\bpuisage\b|\beau froide\b/.test(q))missing.push('type : mitigeur, mélangeur ou robinet simple')
 }
 if(/\biroko\b/.test(q)){
  if(!/\bplanche\b|\bavive\b|\bpanneau\b|\bgrume\b|\bchevron\b/.test(q))missing.push('forme du bois : planche, avivé, panneau…')
  if(!/\b\d+\s*(?:mm|cm|m)\b/.test(q))missing.push('dimensions nécessaires')
  if(!/\bsec\b|\bseche\b|\bkd\b|\bad\b|\bhumide\b/.test(q))missing.push('état de séchage du bois')
 }
 if(!missing.length&&q.split(' ').filter(Boolean).length<2)missing.push('type ou caractéristiques de la fourniture')
 return missing
}
