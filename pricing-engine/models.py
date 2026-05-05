from pydantic import BaseModel, Field
from typing import Optional


class PricingRequest(BaseModel):
    metier: str                                   # 'Plombier', 'Électricien'…
    category: str                                 # 'Plomberie', 'Électricité'…
    duration_hours: float = Field(2.0, gt=0)
    quartier: str = 'Cocody'
    urgency: str = 'medium'                       # low|medium|high|emergency
    items_needed: Optional[list[str]] = None
    artisan_id: Optional[str] = None
    diagnostic_id: Optional[str] = None          # auto-remplissage depuis BDD
    hour_override: Optional[int] = None           # pour les tests (0-23)


class ComponentStats(BaseModel):
    median: int
    std: int
    pct: float   # % du total


class Decomposition(BaseModel):
    labor: ComponentStats
    materials: ComponentStats
    transport: ComponentStats
    premium: ComponentStats


class Interval(BaseModel):
    low: int
    high: int
    coverage: float


class UncertaintyBreakdown(BaseModel):
    labor_cv: float
    materials_cv: float
    transport_cv: float
    dominant_source: str


class PricingResponse(BaseModel):
    estimate: int
    interval: Interval
    decomposition: Decomposition
    uncertainty_breakdown: UncertaintyBreakdown
    quantiles: dict[str, int]
    simulations: int
    distance_km: float
    artisan_share: int              # ce que reçoit l'artisan (hors commission)
    explanation_human: str
