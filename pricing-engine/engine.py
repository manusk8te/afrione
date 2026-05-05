"""
AfriOne Pricing Engine v3.0
P = Labor + Materials + Transport + Premium
10 000 Monte Carlo runs — NumPy vectorized
"""
import numpy as np
from scipy.stats import norm, lognorm
from typing import Optional

from traffic_table import QUARTIER_GPS, BASE_RATE_PER_KM, traffic_coeff, time_slot

N = 10_000   # simulations


# ── Haversine ────────────────────────────────────────────────────────────────

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = np.sin(dlat / 2) ** 2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2) ** 2
    return float(2 * R * np.arcsin(np.sqrt(a)))


# ── Duration parser ──────────────────────────────────────────────────────────

def parse_duration(duration_str: str) -> float:
    """'2 à 4 heures' → 3.0"""
    import re
    nums = re.findall(r'\d+(?:\.\d+)?', duration_str)
    if not nums:
        return 2.0
    values = list(map(float, nums))
    return sum(values) / len(values)


# ── Core engine ──────────────────────────────────────────────────────────────

class PricingEngine:
    def compute(
        self,
        labor_rate: dict,
        duration_hours: float,
        years_experience: int,
        materials: list[dict],
        distance_km: float,
        hour: int,
        quartier: str,
        urgency: str,
        service_fee: dict,
        historical_residuals: Optional[np.ndarray] = None,
        seed: Optional[int] = None,
    ) -> dict:
        rng = np.random.default_rng(seed)

        # ── 1. LABOR (Gamma) ──────────────────────────────────────────────
        markup_pct = self._urgency_markup(urgency, labor_rate)
        effective_labor = labor_rate['tarif_horaire'] * duration_hours * (1 + markup_pct / 100)

        # shape ↑ avec expérience → distribution plus concentrée
        shape_l = max(2.0, years_experience * 0.35 + 2.0)
        scale_l = effective_labor / shape_l
        labor_s = rng.standard_gamma(shape_l, N) * scale_l

        # ── 2. MATERIALS (Log-normal + Copula gaussienne) ─────────────────
        material_s = self._materials_copula(materials, rng) if materials else np.zeros(N)

        # ── 3. TRANSPORT (d^1.3 physique) ────────────────────────────────
        transport_s = self._transport_model(distance_km, hour, quartier, rng)

        # ── 4. PREMIUM (commission + assurance) ──────────────────────────
        subtotal_s = labor_s + material_s + transport_s
        fee_rate = (service_fee['commission_pct'] + service_fee['assurance_sav_pct']) / 100
        premium_s = subtotal_s * fee_rate
        total_s = subtotal_s + premium_s

        # ── 5. Quantiles Monte Carlo ──────────────────────────────────────
        q025 = int(np.quantile(total_s, 0.025))
        q50  = int(np.quantile(total_s, 0.500))
        q975 = int(np.quantile(total_s, 0.975))

        # ── 6. Conformal Prediction (split-conformal, coverage ≥ 95%) ────
        if historical_residuals is not None and len(historical_residuals) >= 30:
            q_hat = float(np.quantile(np.abs(historical_residuals), 0.95))
            conf_low  = max(0, int(q50 * (1 - q_hat)))
            conf_high = int(q50 * (1 + q_hat))
            coverage  = 0.95
        else:
            conf_low, conf_high, coverage = q025, q975, 0.95

        # ── 7. Artisan share ──────────────────────────────────────────────
        artisan_share_pct = service_fee.get('artisan_share_pct', 88.0) / 100
        artisan_share = int(q50 * artisan_share_pct)

        return {
            'estimate':   q50,
            'interval':   {'low': conf_low, 'high': conf_high, 'coverage': coverage},
            'decomposition': self._decompose(labor_s, material_s, transport_s, premium_s, total_s),
            'uncertainty_breakdown': self._uncertainty(labor_s, material_s, transport_s),
            'quantiles':  {'q025': q025, 'q50': q50, 'q975': q975},
            'simulations': N,
            'distance_km': round(distance_km, 2),
            'artisan_share': artisan_share,
        }

    # ── Labor markup ─────────────────────────────────────────────────────────

    def _urgency_markup(self, urgency: str, labor_rate: dict) -> float:
        base = labor_rate.get('majoration_urgence', 50)
        return {
            'low':       0,
            'medium':    0,
            'high':      base,
            'emergency': base * 1.5,
        }.get(urgency, 0)

    # ── Gaussian Copula pour les matériaux ───────────────────────────────────

    def _materials_copula(self, materials: list[dict], rng) -> np.ndarray:
        n = len(materials)
        mu_list, sigma_list, categories = [], [], []

        for m in materials:
            qty = float(m.get('qty', 1))
            p_mid = m['price_market'] * qty
            p_min = m['price_min'] * qty
            p_max = m['price_max'] * qty
            # sigma = spread 4-sigma en espace log
            sigma = max(np.log(p_max / max(p_min, 1)) / 4.0, 0.05)
            mu = np.log(max(p_mid, 1)) - (sigma ** 2) / 2
            mu_list.append(mu)
            sigma_list.append(sigma)
            categories.append(m.get('category', ''))

        # Matrice de corrélation: ρ=0.7 même catégorie, ρ=0.3 cross-catégorie
        corr = np.eye(n)
        for i in range(n):
            for j in range(i + 1, n):
                rho = 0.7 if categories[i] == categories[j] else 0.3
                corr[i, j] = corr[j, i] = rho

        # Cholesky → copule → log-normal
        L = np.linalg.cholesky(corr)
        Z = rng.standard_normal((N, n)) @ L.T
        U = norm.cdf(Z)

        total = np.zeros(N)
        for i in range(n):
            total += lognorm.ppf(np.clip(U[:, i], 1e-6, 1 - 1e-6),
                                 s=sigma_list[i],
                                 scale=np.exp(mu_list[i]))
        return total

    # ── Transport physique d^1.3 ─────────────────────────────────────────────

    def _transport_model(self, distance_km: float, hour: int, quartier: str, rng) -> np.ndarray:
        tc = traffic_coeff(quartier, hour)
        base_cost = max(BASE_RATE_PER_KM * (distance_km ** 1.3) * tc, 500.0)

        # Incertitude log-normale: CV ≈ 20%
        sigma_t = 0.20
        mu_t = np.log(base_cost) - (sigma_t ** 2) / 2
        return rng.lognormal(mu_t, sigma_t, N)

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _decompose(self, labor_s, material_s, transport_s, premium_s, total_s) -> dict:
        med_total = max(float(np.median(total_s)), 1)

        def stats(s):
            med = int(np.median(s))
            return {
                'median': med,
                'std':    int(np.std(s)),
                'pct':    round(med / med_total * 100, 1),
            }

        return {
            'labor':     stats(labor_s),
            'materials': stats(material_s),
            'transport': stats(transport_s),
            'premium':   stats(premium_s),
        }

    def _uncertainty(self, labor_s, material_s, transport_s) -> dict:
        cv = {
            'labor':     float(np.std(labor_s)     / max(np.mean(labor_s),     1)),
            'materials': float(np.std(material_s)  / max(np.mean(material_s),  1)),
            'transport': float(np.std(transport_s) / max(np.mean(transport_s), 1)),
        }
        dominant = max(cv, key=cv.__getitem__)
        return {
            'labor_cv':     round(cv['labor'],     3),
            'materials_cv': round(cv['materials'], 3),
            'transport_cv': round(cv['transport'], 3),
            'dominant_source': dominant,
        }
