import local from '@/data/pricing-studies/local-v2.json';
import transfer from '@/data/pricing-studies/transfer-v3.json';
import context from '@/data/pricing-studies/context.json';
import contextualModel from '@/data/pricing-studies/context-v4.json';
import { contextualizeReference, searchReferences } from './contextualizer.mjs';
import { evaluateStudies, priceMaterialObservation, composeStudyQuote } from './engine.mjs';
import { supabaseAdmin } from '../supabase';
import { FILTRE_CATALOGUE_VALIDE } from '../catalogue';

const bundle = { local, transfer, context };
export function getStudyEstimate(mission: string, hours: number) {
  return evaluateStudies(bundle, mission, hours);
}
export type StudyEvaluation = ReturnType<typeof getStudyEstimate>;
export function findPublishedPriceReferences(query: string) {
  return searchReferences(contextualModel, query);
}
export function getPriceContext(referenceId: string, hours: number) {
  return contextualizeReference(contextualModel, referenceId, hours);
}
export type PriceContext = ReturnType<typeof getPriceContext>;
export interface StudyMaterialRequest {
  material_id: string;
  name: string;
  quantity: number;
  unit: string;
}

export async function previewStudyQuote(mission: string, hours: number, requests: StudyMaterialRequest[]) {
  const evaluation = getStudyEstimate(mission, hours);
  if (requests.length > 20) throw new Error('Maximum 20 matériaux par simulation');
  const ids = Array.from(new Set(requests.map(r => r.material_id)));
  const records: Record<string, any> = {};
  if (ids.length) {
    const { data, error } = await supabaseAdmin.from('price_materials')
      .select('id,name,unit,price_market,web_price,source,source_url,last_scraped_at,confirmed_at')
      .or(FILTRE_CATALOGUE_VALIDE)
      .in('id', ids);
    if (error) throw new Error('Catalogue matériaux indisponible');
    for (const row of data ?? []) records[row.id] = row;
  }
  const materials = requests.map(r => priceMaterialObservation(r, records[r.material_id]));
  return composeStudyQuote(evaluation, materials);
}
