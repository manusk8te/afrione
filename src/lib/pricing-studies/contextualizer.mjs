/** Outil de contexte économique. L'IA choisit la référence ; aucun nom de tâche dans la régression. */
const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function searchReferences(model, query) {
  const tokens = normalize(query).split(/[^a-z0-9]+/).filter(t => t.length > 2);
  if (!tokens.length) return [];
  return model.sources.map(source => {
    const text = normalize(source.trade + ' ' + source.description + ' ' + source.suggested_mission);
    return { source, score: tokens.filter(t => text.includes(t)).length };
  }).filter(r => r.score > 0).sort((a,b) => b.score - a.score || a.source.id.localeCompare(b.source.id))
    .slice(0,10).map(({source}) => ({ ...source, local_calibration_available: model.training_reference_ids.includes(source.id) }));
}
export function contextualizeReference(model, referenceId, hours) {
  const base = { version: model.version, currency: 'XOF', reference_id: referenceId,
    production_allowed: false, can_add_materials: false, scope: model.scope };
  const reference = model.sources.find(r => r.id === referenceId);
  if (!reference) return { ...base, status: 'devis_requis', reason: 'Référence publiée inconnue' };
  const ids = reference.context_bundle ?? [reference.id];
  const sources = ids.map(id => model.sources.find(r => r.id === id));
  if (sources.some(s => !s)) throw new Error('Catalogue de références incohérent');
  const normalized = sources.map(s => {
    const point = s.price_high === null ? s.price_low : (s.price_low + s.price_high)/2;
    return { id: s.id, country: s.country, url: s.url, currency: s.currency, unit: s.unit,
      price_low: s.price_low, price_high: s.price_high, source_scope: s.scope,
      derived_reference: point, normalized_reference_fcfa: point*s.ppp_ci/s.ppp };
  });
  const numbers = normalized.map(r => r.normalized_reference_fcfa).sort((a,b) => a-b);
  const middle = Math.floor(numbers.length/2);
  const R = numbers.length%2 ? numbers[middle] : (numbers[middle-1]+numbers[middle])/2;
  const context = { ...base, sources: normalized, normalized_reference_fcfa: R,
    normalization: 'Prix source × PPA consommation CI / PPA source, année 2025. Valeur dérivée, pas prix ivoirien observé.',
    technical_match: 'à confirmer par les caractéristiques de la prestation',
  };
  if (!model.training_reference_ids.includes(referenceId)) {
    return { ...context, status: 'contexte_non_valide', reason: 'Aucune calibration locale sur cette référence. La normalisation seule ne constitue pas un estimateur validé.',
      central_estimate_fcfa: null, candidate_price_fcfa: null, D: null };
  }
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0 ||
      hours < model.domain.min_hours || hours > model.domain.max_hours ||
      R < model.domain.min_reference_fcfa - .001 || R > model.domain.max_reference_fcfa + .001) {
    return { ...context, status: 'devis_requis', reason: 'Durée ou référence hors domaine du pilote', central_estimate_fcfa: null, candidate_price_fcfa: null, D: null };
  }
  const central = R*(model.coefficients[0]+model.coefficients[1]*Math.log1p(hours));
  const lower = central*model.calibration_multiplier;
  return { ...context, status: 'contextualisation_experimentale', hours,
    duration_status: 'estimation fournie, à confirmer',
    central_estimate_fcfa: central, candidate_price_fcfa: lower, D: model.D,
    discount_learned_from: 'Ratios prix CI / prédiction centrale hors apprentissage ; quantile 20 %',
    lower_than_central: lower < central,
    local_market_guarantee: false,
    cost_viability_verified: false,
    validation: model.validation,
    warning: '14 réponses, 6 prestataires, 5 tâches. Périmètres non harmonisés. D global et non une preuve de réduction économiquement viable.',
  };
}

/** Application indicative : extrapolation explicitement distincte de la validation scientifique. */
export function estimateByAnalogy(model, referenceId, hours, quantity, matchReason) {
  const reference = model.sources.find(r => r.id === referenceId);
  const strict = contextualizeReference(model, referenceId, hours);
  const blocked = reason => ({ ...strict, status: 'devis_requis', reason, candidate_price_fcfa: null, central_estimate_fcfa: null });
  if (!reference) return blocked('Référence publiée inconnue');
  if (typeof matchReason !== 'string' || matchReason.trim().length < 15) return blocked('Justifier la comparabilité technique');
  if (!Number.isFinite(hours) || hours < model.domain.min_hours || hours > model.domain.max_hours) return blocked('Durée hors domaine ; devis nécessaire');
  if (!Number.isFinite(quantity) || quantity <= 0) return blocked('Quantité et unité de la prestation à préciser');
  // Un tarif horaire est ramené à la durée, sans appliquer une deuxième fois log(1+h).
  const R = strict.normalized_reference_fcfa;
  if (!Number.isFinite(R) || R <= 0) return blocked('Référence inexploitable');
  const hourly = reference.unit === 'heure';
  if (hourly && Math.abs(quantity - hours) > .001) return blocked('La quantité horaire doit correspondre à la durée');
  if (reference.unit === 'contrat annuel') return blocked('Contrat annuel : durée et périmètre spécifiques à confirmer par devis');
  const central = hourly
    ? R * quantity * (model.coefficients[0] + model.coefficients[1] * Math.log1p(1))
    : R * quantity * (model.coefficients[0] + model.coefficients[1] * Math.log1p(hours / quantity));
  const candidate = central * model.calibration_multiplier;
  return { ...strict, status: 'contextualisation_experimentale', reason: undefined, hours,
    central_estimate_fcfa: central, candidate_price_fcfa: candidate, D: model.D,
    quantity, unit: reference.unit, reference_description: reference.description,
    technical_match: matchReason.trim(), match_type: 'analogy',
    locally_calibrated: model.training_reference_ids.includes(referenceId),
    extrapolation: !model.training_reference_ids.includes(referenceId) || quantity !== 1,
    production_allowed: false, requires_provider_confirmation: true, can_add_materials: false,
    warning: 'Estimation indicative par analogie. Calibration locale limitée à 5 tâches ; généralisation non validée. Fournitures et frais non ventilés : aucun ajout automatique.',
    local_market_guarantee: false, cost_viability_verified: false,
  };
}
