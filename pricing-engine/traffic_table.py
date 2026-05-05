BASE_RATE_PER_KM = 600  # FCFA/km — coût moto-taxi + temps artisan

# Centroides GPS des quartiers d'Abidjan (lat, lng)
QUARTIER_GPS: dict[str, tuple[float, float]] = {
    'Adjamé':         (5.3667, -4.0167),
    'Plateau':        (5.3167, -4.0167),
    'Cocody':         (5.3467, -3.9894),
    'Treichville':    (5.3000, -4.0000),
    'Marcory':        (5.2833, -3.9833),
    'Yopougon':       (5.3500, -4.0667),
    'Abobo':          (5.4167, -4.0333),
    'Koumassi':       (5.2833, -3.9500),
    'Port-Bouët':     (5.2500, -3.9333),
    'Bingerville':    (5.3667, -3.9000),
    'Riviera':        (5.3700, -3.9500),
    'Deux-Plateaux':  (5.3800, -3.9700),
    'Zone 4':         (5.2950, -3.9750),
    'Angré':          (5.3900, -3.9500),
    'Williamsville':  (5.3600, -4.0100),
    'Attécoubé':      (5.3500, -4.0300),
}

# Multiplicateurs trafic par quartier et créneau horaire
# morning_rush: 6-9h | daytime: 9-16h | evening_rush: 16-20h | night: 20-6h
TRAFFIC_TABLE: dict[str, dict[str, float]] = {
    'Adjamé':        {'morning_rush': 2.8, 'daytime': 1.5, 'evening_rush': 3.0, 'night': 0.8},
    'Plateau':       {'morning_rush': 2.5, 'daytime': 1.6, 'evening_rush': 2.8, 'night': 0.7},
    'Yopougon':      {'morning_rush': 3.2, 'daytime': 1.4, 'evening_rush': 3.0, 'night': 0.9},
    'Abobo':         {'morning_rush': 3.5, 'daytime': 1.6, 'evening_rush': 3.2, 'night': 1.0},
    'Cocody':        {'morning_rush': 2.2, 'daytime': 1.3, 'evening_rush': 2.5, 'night': 0.7},
    'Treichville':   {'morning_rush': 2.0, 'daytime': 1.4, 'evening_rush': 2.2, 'night': 0.8},
    'Marcory':       {'morning_rush': 1.8, 'daytime': 1.2, 'evening_rush': 2.0, 'night': 0.7},
    'Koumassi':      {'morning_rush': 2.0, 'daytime': 1.3, 'evening_rush': 2.2, 'night': 0.8},
    'Port-Bouët':    {'morning_rush': 1.5, 'daytime': 1.1, 'evening_rush': 1.8, 'night': 0.7},
    'Bingerville':   {'morning_rush': 1.8, 'daytime': 1.2, 'evening_rush': 2.0, 'night': 0.7},
    'Riviera':       {'morning_rush': 2.3, 'daytime': 1.3, 'evening_rush': 2.5, 'night': 0.7},
    'Deux-Plateaux': {'morning_rush': 2.0, 'daytime': 1.3, 'evening_rush': 2.2, 'night': 0.7},
    'Zone 4':        {'morning_rush': 2.2, 'daytime': 1.4, 'evening_rush': 2.5, 'night': 0.8},
    'Angré':         {'morning_rush': 2.3, 'daytime': 1.3, 'evening_rush': 2.3, 'night': 0.8},
    'Williamsville': {'morning_rush': 2.6, 'daytime': 1.4, 'evening_rush': 2.7, 'night': 0.8},
    'Attécoubé':     {'morning_rush': 2.5, 'daytime': 1.4, 'evening_rush': 2.5, 'night': 0.8},
    'default':       {'morning_rush': 2.0, 'daytime': 1.3, 'evening_rush': 2.2, 'night': 0.8},
}

def time_slot(hour: int) -> str:
    if 6 <= hour < 9:
        return 'morning_rush'
    elif 9 <= hour < 16:
        return 'daytime'
    elif 16 <= hour < 20:
        return 'evening_rush'
    return 'night'

def traffic_coeff(quartier: str, hour: int) -> float:
    slot = time_slot(hour)
    table = TRAFFIC_TABLE.get(quartier, TRAFFIC_TABLE['default'])
    return table[slot]
