/** Moteur déterministe à importer dans le serveur AfriOne.
 * import { estimate } from './afrione_estimateur.mjs';
 * Charger afrione_estimateur.json côté serveur et le passer à estimate.
 * Les montants restent expérimentaux. Aucune requête réseau ni dépendance.
 */
export function estimate(model, mission, durationHours, { strategy = model.default_strategy, mode = 'simulation' } = {}) {
  const base = { currency: model.currency, version: model.version };
  const reject = reason => ({ ...base, status: 'devis_requis', reason });
  if (mode !== 'simulation') return reject('Version non validée pour la production');
  if (typeof durationHours !== 'number' || !Number.isFinite(durationHours) || durationHours <= 0) return reject('Durée positive requise');
  const row = model.catalog.find(r => r.mission === mission);
  if (!row) return reject('Mission non couverte par les observations locales');
  if (row.blocking_reason) return reject(row.blocking_reason);
  if (durationHours < row.duree_min || durationHours > row.duree_max) return reject('Durée hors domaine observé');
  if (!['median', 'regression'].includes(strategy)) return reject('Stratégie inconnue');
  const xs = model.feature_names.map(name => name === 'log_heures' ? Math.log(durationHours) : name === 'heures' ? durationHours : Number(name === 'mission:' + mission));
  const z = model.intercept + model.coefficients.reduce((s, b, i) => s + b * xs[i], 0);
  const regression = model.model_type === 'linear_log' ? Math.exp(z) : Math.max(1, z);
  return { ...base, status: 'simulation_a_valider', strategy, estimate_fcfa: strategy === 'median' ? row.mediane_declaree_fcfa : regression,
    regression_fcfa: regression, n_providers_mission: row.prestataires, scope: 'Montant déclaré ; fournitures et quantités non harmonisées',
    diagnostic_mae_regression_oof_fcfa: row.mae_oof_fcfa, production_allowed: false };
}
