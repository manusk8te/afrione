"""
Supabase REST client async — lit price_materials, labor_rates,
service_fees, artisan_pros, quotations pour calibrage conformal.
"""
import os
import numpy as np
import httpx
from typing import Optional

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

_HEADERS = {
    'apikey':        SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type':  'application/json',
}

# Tarifs de fallback (quand Supabase injoignable)
_FALLBACK_LABOR: dict[str, dict] = {
    'Plombier':     {'tarif_horaire': 3000, 'majoration_urgence': 50},
    'Électricien':  {'tarif_horaire': 3500, 'majoration_urgence': 50},
    'Peintre':      {'tarif_horaire': 2500, 'majoration_urgence': 40},
    'Maçon':        {'tarif_horaire': 2800, 'majoration_urgence': 45},
    'Menuisier':    {'tarif_horaire': 3000, 'majoration_urgence': 45},
    'Climaticien':  {'tarif_horaire': 4000, 'majoration_urgence': 60},
    'Serrurier':    {'tarif_horaire': 3000, 'majoration_urgence': 50},
    'Carreleur':    {'tarif_horaire': 2800, 'majoration_urgence': 40},
}
_DEFAULT_LABOR   = {'tarif_horaire': 3000, 'majoration_urgence': 50, 'majoration_nuit': 30}
_DEFAULT_FEE     = {'commission_pct': 10.0, 'assurance_sav_pct': 2.0, 'artisan_share_pct': 88.0}
_URGENCY_FEE     = {'commission_pct': 12.0, 'assurance_sav_pct': 3.0, 'artisan_share_pct': 85.0}


class SupabaseClient:
    def __init__(self):
        self._http = httpx.AsyncClient(
            base_url=SUPABASE_URL,
            headers=_HEADERS,
            timeout=8.0,
        )

    async def get_labor_rate(self, metier: str) -> dict:
        try:
            r = await self._http.get('/rest/v1/labor_rates', params={
                'metier': f'eq.{metier}', 'limit': '1',
            })
            data = r.json()
            if data:
                return data[0]
        except Exception:
            pass
        return _FALLBACK_LABOR.get(metier, _DEFAULT_LABOR)

    async def get_materials(self, items: list[str], category: str) -> list[dict]:
        results = []
        for item in items[:10]:
            try:
                r = await self._http.get('/rest/v1/price_materials', params={
                    'name': f'ilike.*{item}*', 'limit': '1',
                })
                data = r.json()
                if data:
                    m = data[0]
                    results.append({
                        'price_market': m['price_market'],
                        'price_min':    m['price_min'],
                        'price_max':    m['price_max'],
                        'qty':          1,
                        'category':     m.get('category', category),
                    })
                    continue
            except Exception:
                pass
            # Fallback générique par catégorie
            results.append(_category_fallback_material(item, category))
        return results

    async def get_service_fee(self, urgency: str) -> dict:
        cat = 'urgence' if urgency in ('high', 'emergency') else 'default'
        try:
            r = await self._http.get('/rest/v1/service_fees', params={
                'category': f'eq.{cat}', 'limit': '1',
            })
            data = r.json()
            if data:
                return data[0]
        except Exception:
            pass
        return _URGENCY_FEE if cat == 'urgence' else _DEFAULT_FEE

    async def get_artisan(self, artisan_id: str) -> Optional[dict]:
        try:
            r = await self._http.get('/rest/v1/artisan_pros', params={
                'id': f'eq.{artisan_id}', 'limit': '1',
                'select': 'zone_gps,years_experience,tarif_min',
            })
            data = r.json()
            return data[0] if data else None
        except Exception:
            return None

    async def get_diagnostic(self, diagnostic_id: str) -> Optional[dict]:
        try:
            r = await self._http.get('/rest/v1/diagnostics', params={
                'id': f'eq.{diagnostic_id}', 'limit': '1',
            })
            data = r.json()
            return data[0] if data else None
        except Exception:
            return None

    async def get_historical_residuals(self, category: str) -> Optional[np.ndarray]:
        """
        Récupère les devis acceptés → residuals pour conformal prediction.
        residual_i = (price_i − median) / median
        """
        try:
            r = await self._http.get('/rest/v1/quotations', params={
                'status': 'eq.accepted',
                'select': 'total_price',
                'limit':  '300',
                'order':  'created_at.desc',
            })
            data = r.json()
            if not data or len(data) < 30:
                return None
            prices = np.array([d['total_price'] for d in data], dtype=float)
            median = np.median(prices)
            if median == 0:
                return None
            return (prices - median) / median
        except Exception:
            return None

    async def aclose(self):
        await self._http.aclose()


def _category_fallback_material(item: str, category: str) -> dict:
    _ranges: dict[str, tuple[int, int, int]] = {
        'Plomberie':    (3000, 2000, 5000),
        'Électricité':  (4000, 2500, 7000),
        'Peinture':     (3500, 2500, 5500),
        'Maçonnerie':   (6000, 4500, 9000),
        'Carrelage':    (8000, 6000, 12000),
        'Climatisation':(8000, 5000, 15000),
        'Menuiserie':   (5000, 3500, 8000),
        'Serrurerie':   (4000, 3000, 6000),
    }
    mid, lo, hi = _ranges.get(category, (4000, 2500, 7000))
    return {'price_market': mid, 'price_min': lo, 'price_max': hi, 'qty': 1, 'category': category}
