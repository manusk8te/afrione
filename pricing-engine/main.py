"""
AfriOne Pricing Engine v3.0 — FastAPI
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
"""
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from models import PricingRequest, PricingResponse
from engine import PricingEngine, haversine, parse_duration
from supabase_client import SupabaseClient
from traffic_table import QUARTIER_GPS, time_slot

_engine = PricingEngine()
_db: Optional[SupabaseClient] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _db
    _db = SupabaseClient()
    yield
    if _db:
        await _db.aclose()


app = FastAPI(title='AfriOne Pricing Engine', version='3.0', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['GET', 'POST'],
    allow_headers=['*'],
)


# ── /price ───────────────────────────────────────────────────────────────────

@app.post('/price', response_model=PricingResponse)
async def compute_price(req: PricingRequest):
    # Auto-remplissage depuis le diagnostic si fourni
    items_needed  = req.items_needed or []
    duration_h    = req.duration_hours
    category      = req.category

    if req.diagnostic_id:
        diag = await _db.get_diagnostic(req.diagnostic_id)
        if diag:
            items_needed = diag.get('items_needed') or items_needed
            if not req.items_needed and diag.get('items_needed'):
                items_needed = diag['items_needed']
            dur_str = ''
            try:
                raw = __import__('json').loads(diag.get('raw_text') or '{}')
                dur_str = raw.get('duration_estimate', '')
            except Exception:
                pass
            if dur_str and req.duration_hours == 2.0:
                duration_h = parse_duration(dur_str)
            category = diag.get('category_detected') or category

    # Données marché
    labor_rate   = await _db.get_labor_rate(req.metier)
    materials    = await _db.get_materials(items_needed, category) if items_needed else []
    service_fee  = await _db.get_service_fee(req.urgency)
    artisan      = await _db.get_artisan(req.artisan_id) if req.artisan_id else None
    historical   = await _db.get_historical_residuals(category)

    # Distance GPS
    client_gps = QUARTIER_GPS.get(req.quartier, QUARTIER_GPS['Cocody'])
    if artisan and artisan.get('zone_gps'):
        ag = artisan['zone_gps']
        distance_km = haversine(ag['lat'], ag['lng'], client_gps[0], client_gps[1])
    else:
        distance_km = 5.0   # défaut 5 km

    years_exp = (artisan or {}).get('years_experience', 3)
    hour      = req.hour_override if req.hour_override is not None else datetime.now().hour

    result = _engine.compute(
        labor_rate=labor_rate,
        duration_hours=duration_h,
        years_experience=years_exp,
        materials=materials,
        distance_km=distance_km,
        hour=hour,
        quartier=req.quartier,
        urgency=req.urgency,
        service_fee=service_fee,
        historical_residuals=historical,
    )

    result['explanation_human'] = _explain(result, req, category, distance_km, hour)
    return result


# ── /price-from-diagnostic ───────────────────────────────────────────────────

@app.post('/price-from-diagnostic')
async def price_from_diagnostic(diagnostic_id: str, quartier: str = 'Cocody', artisan_id: Optional[str] = None):
    diag = await _db.get_diagnostic(diagnostic_id)
    if not diag:
        raise HTTPException(404, 'diagnostic non trouvé')

    metier_map = {
        'Plomberie':    'Plombier',
        'Électricité':  'Électricien',
        'Peinture':     'Peintre',
        'Maçonnerie':   'Maçon',
        'Menuiserie':   'Menuisier',
        'Climatisation':'Climaticien',
        'Serrurerie':   'Serrurier',
        'Carrelage':    'Carreleur',
    }
    category = diag.get('category_detected', 'Maçonnerie')
    metier   = metier_map.get(category, 'Maçon')
    urgency  = diag.get('urgency_level', 'medium')

    return await compute_price(PricingRequest(
        metier=metier,
        category=category,
        urgency=urgency,
        quartier=quartier,
        artisan_id=artisan_id,
        diagnostic_id=diagnostic_id,
    ))


# ── /health ──────────────────────────────────────────────────────────────────

@app.get('/health')
async def health():
    return {'status': 'ok', 'engine': 'v3.0', 'simulations': 10_000}


# ── Explication en français ───────────────────────────────────────────────────

def _explain(result: dict, req: PricingRequest, category: str, distance_km: float, hour: int) -> str:
    d  = result['decomposition']
    u  = result['uncertainty_breakdown']
    iv = result['interval']
    slot_labels = {
        'morning_rush': 'heure de pointe matin',
        'daytime':      'journée normale',
        'evening_rush': 'heure de pointe soir',
        'night':        'nuit calme',
    }
    slot = slot_labels[time_slot(hour)]

    parts = [
        f"{category} à {req.quartier} : {iv['low']:,} – {iv['high']:,} FCFA (intervalle conformal 95%).",
        f"Médiane Monte-Carlo : {result['estimate']:,} FCFA.",
        (
            f"Décomposition — MO {d['labor']['pct']}% | Matériaux {d['materials']['pct']}% "
            f"| Transport {d['transport']['pct']}% | Commission {d['premium']['pct']}%."
        ),
        f"Distance artisan→chantier : {distance_km:.1f} km ({slot}).",
        f"Incertitude dominante : {u['dominant_source']} (CV={u[u['dominant_source']+'_cv']:.0%}).",
        f"Artisan perçoit : {result['artisan_share']:,} FCFA.",
    ]
    if req.urgency in ('high', 'emergency'):
        parts.append("Majoration urgence appliquée sur main-d'œuvre.")

    return ' '.join(parts)
