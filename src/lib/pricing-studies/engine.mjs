import { estimate as estimateLocalV2 } from './local-v2.mjs';

/** Exécution des résultats déjà ajustés, sans apprentissage ni accès réseau. */
export function evaluateStudies(bundle, mission, hours) {
  const { local, transfer, context } = bundle;
  const base = {
    version: context.version, currency: 'XOF', mission, hours,
    production_allowed: false, can_add_materials: false,
    scope: 'mixed_or_unknown', status: 'simulation_a_valider',
    warning: 'Montants déclarés ou transférés, pas tarifs de main-d’œuvre seule. Fournitures et quantités non harmonisées.',
  };
  if (typeof mission !== 'string' || !mission.trim() ||
      typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) {
    return { ...base, status: 'devis_requis', reason: 'Mission exacte et durée positive requises', estimates: [] };
  }
  const estimates = [];
  for (const [id, strategy] of [['local_median_v2', 'median'], ['local_regression_v2', 'regression']]) {
    const result = estimateLocalV2(local, mission, hours, { strategy, mode: 'simulation' });
    estimates.push({ id, validation_group: 'ci24-v2', ...result });
  }
  const domain = context.quantile_domain[mission];
  const anchor = transfer.anchors.find(a => a.mission === mission);
  if (domain && anchor && hours >= domain.min_hours && hours <= domain.max_hours) {
    const model = transfer.model;
    if (model.coefficients.length !== model.feature_names.length || model.quantile !== .2) {
      throw new Error('Artefact de transfert incompatible : réexporter le moteur');
    }
    const features = model.feature_names.map(name => {
      if (name === 'const') return 1;
      if (name === 'log1p_heures') return Math.log1p(hours);
      if (name.startsWith('mission:')) return Number(name === 'mission:' + mission);
      throw new Error('Variable non prise en charge : ' + name);
    });
    const ratio = features.reduce((s, value, i) => s + value * model.coefficients[i], 0);
    const price = Math.max(0, anchor.ancre_ci_basse_fcfa * ratio);
    if (!Number.isFinite(price)) throw new Error('Prédiction non finie');
    estimates.push({ id: 'transfer_quantile_v3', validation_group: 'ci14-v3',
      status: 'simulation_a_valider', estimate_fcfa: price, production_allowed: false,
      alpha: model.alpha, quantile: model.quantile, scope: 'mixed_or_unknown',
      source: { country: anchor.pays, code: anchor.source_id, url: anchor.url,
        lower_price_fcfa: anchor.bi_fcfa, ppp_ratio: anchor.ratio_ppa,
        normalized_reference_fcfa: anchor.ancre_ci_basse_fcfa, comparability: anchor.comparabilite },
      domain: { min_hours: domain.min_hours, max_hours: domain.max_hours, n: domain.n },
    });
    estimates.push({ id: 'local_quantile_v3', validation_group: 'ci14-v3',
      status: 'simulation_a_valider', estimate_fcfa: domain.quantile_20_fcfa,
      production_allowed: false, quantile: .2, scope: 'mixed_or_unknown' });
  } else {
    for (const id of ['transfer_quantile_v3', 'local_quantile_v3']) {
      estimates.push({ id, validation_group: 'ci14-v3', status: 'devis_requis',
        reason: domain ? 'Durée hors domaine observé' : 'Mission non rapprochée dans V3',
        production_allowed: false });
    }
  }
  const usable = estimates.filter(e => e.status === 'simulation_a_valider');
  return { ...base, status: usable.length ? 'simulation_a_valider' : 'devis_requis', estimates,
    recommended_comparison: usable.find(e => e.id === 'local_quantile_v3')?.id ??
      usable.find(e => e.id === 'local_median_v2')?.id ?? null,
    recommendation_reason: 'Référence simple privilégiée ; gain du transfert non démontré. Les groupes de validation ne sont pas interchangeables.',
    validation: context.validation_groups.map(g => ({ id: g.id, n: g.n,
      providers: g.providers, objective: g.objective, scores: g.scores })),
  };
}

/** Une donnée manquante ou incompatible n'est jamais remplacée par un faux prix. */
export function priceMaterialObservation(request, record, nowMs = Date.now(), maxAgeDays = 30) {
  const reject = reason => ({ status: 'devis_requis', reason, item: request.name,
    quantity: request.quantity, unit: request.unit, price_unit_fcfa: null, total_fcfa: null });
  if (typeof request.quantity !== 'number' || !Number.isFinite(request.quantity) || request.quantity <= 0 ||
      typeof request.unit !== 'string' || !request.unit.trim()) return reject('Quantité et unité requises');
  if (!record || request.material_id !== record.id) return reject('Référence matériau introuvable');
  // ID choisi pour la spécification exacte : aucune médiane de produits hétérogènes.
  if (request.unit !== record.unit) return reject('Unité différente : conversion documentée nécessaire');
  if (typeof record.source_url !== 'string' || !/^https?:\/\//.test(record.source_url)) return reject('Justificatif source manquant');
  const isWeb = record.source === 'Jumia CI';
  if (!isWeb && !record.confirmed_at) return reject('Prix terrain non confirmé');
  const observedAt = isWeb ? record.last_scraped_at : record.confirmed_at;
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp) || timestamp > nowMs ||
      nowMs - timestamp > maxAgeDays * 86400000) return reject('Prix périmé ou date invalide');
  // web_price est le montant publié : ne pas utiliser la remise marché arbitraire de l'ancien catalogue.
  const price = isWeb ? record.web_price : record.price_market;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return reject('Prix source absent');
  const total = Math.round(price * request.quantity);
  if (!Number.isSafeInteger(total)) return reject('Montant hors limites');
  return { status: 'reference_documentee', item: request.name, product_name: record.name,
    quantity: request.quantity, unit: request.unit, price_unit_fcfa: price, total_fcfa: total,
    source: record.source, source_url: record.source_url, observed_at: observedAt,
    shipping_included: false, note: 'Prix affiché ou confirmé ; adéquation technique du produit à vérifier.' };
}

/** Blocage du double comptage : les artefacts actuels ne sont pas des modèles de MO seule. */
export function composeStudyQuote(evaluation, materials) {
  const complete = materials.every(m => m.status === 'reference_documentee');
  return { pricing_mode: 'study', currency: 'XOF', status: 'devis_requis', total: null,
    main_oeuvre: null, materials,
    materials_subtotal_fcfa: complete ? materials.reduce((s, m) => s + m.total_fcfa, 0) : null,
    study: evaluation, applied_estimator: null,
    reason: evaluation.can_add_materials === false
      ? 'Le périmètre des estimateurs existants mélange potentiellement fournitures et main-d’œuvre. Addition automatique bloquée.'
      : 'Aucun estimateur validé pour ce devis.',
    excluded_costs: ['transport', 'course achat', 'commission', 'assurance'],
  };
}

/** Le modèle de langage ne peut pas transformer un prix statistique total en taux horaire. */
export function lockPricingInputs(context, args) {
  return context ? { ...args, ...context } : args;
}
