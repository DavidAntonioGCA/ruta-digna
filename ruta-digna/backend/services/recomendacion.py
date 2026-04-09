"""
Lógica pura de recomendación de sucursales.

Desacoplada de FastAPI y Supabase — recibe datos simples, devuelve datos simples.
Permite al frontend explicar al usuario por qué se recomienda una sucursal específica,
incluso si es más lejana (compensada por menor tiempo de espera).

Fórmula:
  tiempo_total = tiempo_traslado_min + tiempo_espera_min
  tiempo_traslado = (distancia_km / velocidad_promedio_kmh) * 60

Velocidad promedio urbana México: 25 km/h (considera tráfico, semáforos, estacionamiento).
Score final (menor = mejor): tiempo_total * 0.6 + distancia_km * 0.4
  → El peso 0.6 al tiempo asegura que una sucursal lejana con poco tiempo de espera
    puede ganar a una cercana con mucha espera.
"""

import math
from dataclasses import dataclass
from typing import Optional


# ── Constantes ──────────────────────────────────────────────────────────────

VELOCIDAD_URBANA_KMPH = 25.0   # km/h promedio urbano México con tráfico
PESO_TIEMPO           = 0.6    # mismo peso que fn_score_recomendacion_sucursal en Supabase
PESO_DISTANCIA        = 0.4
TIEMPO_ESPERA_DEFAULT = 20     # minutos si no hay datos de cola
MAX_RADIO_KM          = 80     # radio máximo cuando se conoce la ubicación del usuario
MAX_RADIO_FALLBACK_KM = 250    # radio de emergencia si no hay nada en el principal


# ── Tipos ────────────────────────────────────────────────────────────────────

@dataclass
class DatosSucursal:
    id_sucursal:      int
    nombre_sucursal:  str
    direccion:        str
    ciudad:           str
    latitud:          Optional[float]
    longitud:         Optional[float]
    tiempo_espera_min: Optional[int]   # de colas_en_tiempo_real o histórico
    estudios_disponibles: int = 0


@dataclass
class ResultadoEvaluacion:
    id_sucursal:       int
    nombre_sucursal:   str
    direccion:         str
    ciudad:            str
    distancia_km:      Optional[float]
    tiempo_traslado_min: Optional[int]
    tiempo_espera_min:  int
    tiempo_total_min:   int
    score:              float
    estudios_disponibles: int
    # Texto listo para mostrar al usuario
    razon_recomendacion: str


# ── Función núcleo ───────────────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Distancia en km entre dos coordenadas usando la fórmula de Haversine.
    Error máximo: ~0.5% — suficiente para recomendaciones de sucursales.
    """
    R = 6371.0  # radio de la Tierra en km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi  = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def evaluar_sucursal(
    sucursal:      DatosSucursal,
    lat_usuario:   Optional[float],
    lon_usuario:   Optional[float],
) -> ResultadoEvaluacion:
    """
    Evalúa una sucursal calculando su tiempo total y score desde la posición del usuario.

    Si no hay coordenadas (usuario o sucursal), distancia = None y el score
    se basa solo en tiempo de espera.
    """
    # ── Distancia y traslado ──────────────────────────────────────────────
    distancia_km: Optional[float] = None
    tiempo_traslado_min: Optional[int] = None

    tiene_coords = (
        lat_usuario is not None and lon_usuario is not None
        and sucursal.latitud is not None and sucursal.longitud is not None
    )
    if tiene_coords:
        distancia_km = haversine_km(lat_usuario, lon_usuario, sucursal.latitud, sucursal.longitud)
        tiempo_traslado_min = int(math.ceil((distancia_km / VELOCIDAD_URBANA_KMPH) * 60))

    # ── Espera en sucursal ────────────────────────────────────────────────
    espera = sucursal.tiempo_espera_min if sucursal.tiempo_espera_min else TIEMPO_ESPERA_DEFAULT

    # ── Tiempo total ──────────────────────────────────────────────────────
    tiempo_total = espera + (tiempo_traslado_min or 0)

    # ── Score (menor = mejor) ─────────────────────────────────────────────
    if distancia_km is not None:
        score = tiempo_total * PESO_TIEMPO + distancia_km * PESO_DISTANCIA
    else:
        score = float(tiempo_total)

    return ResultadoEvaluacion(
        id_sucursal         = sucursal.id_sucursal,
        nombre_sucursal     = sucursal.nombre_sucursal,
        direccion           = sucursal.direccion,
        ciudad              = sucursal.ciudad,
        distancia_km        = round(distancia_km, 2) if distancia_km is not None else None,
        tiempo_traslado_min = tiempo_traslado_min,
        tiempo_espera_min   = espera,
        tiempo_total_min    = tiempo_total,
        score               = round(score, 4),
        estudios_disponibles = sucursal.estudios_disponibles,
        razon_recomendacion  = "",   # se rellena abajo
    )


def seleccionar_mejor_sucursal(
    sucursales:  list[DatosSucursal],
    lat_usuario: Optional[float],
    lon_usuario: Optional[float],
) -> tuple[list[ResultadoEvaluacion], str]:
    """
    Recibe N sucursales y devuelve:
      - La lista ordenada de ResultadoEvaluacion (mejor primero)
      - El texto de explicación de por qué la primera es la recomendada

    Pura: no llama a DB ni a FastAPI.
    """
    if not sucursales:
        return [], ""

    evaluadas = [evaluar_sucursal(s, lat_usuario, lon_usuario) for s in sucursales]
    evaluadas.sort(key=lambda r: (r.score, r.tiempo_total_min))

    # ── Filtro geográfico (solo cuando hay ubicación del usuario) ─────────────
    if lat_usuario is not None and lon_usuario is not None:
        dentro_radio = [r for r in evaluadas if r.distancia_km is not None and r.distancia_km <= MAX_RADIO_KM]
        if dentro_radio:
            evaluadas = dentro_radio
        else:
            # Nada en el radio principal → ampliar al radio de emergencia
            fallback = [r for r in evaluadas if r.distancia_km is not None and r.distancia_km <= MAX_RADIO_FALLBACK_KM]
            if fallback:
                evaluadas = fallback
            else:
                # Sin coordenadas o todo fuera del radio ampliado → las 3 más cercanas
                con_coords = [r for r in evaluadas if r.distancia_km is not None]
                evaluadas = sorted(con_coords, key=lambda r: r.distancia_km)[:3] or evaluadas

    mejor    = evaluadas[0]
    resto    = evaluadas[1:]

    # ── Generar explicación legible ───────────────────────────────────────
    razon = _generar_razon(mejor, resto, lat_usuario is not None)
    mejor.razon_recomendacion = razon

    return evaluadas, razon


def _generar_razon(
    mejor:          ResultadoEvaluacion,
    alternativas:   list[ResultadoEvaluacion],
    hay_ubicacion:  bool,
) -> str:
    """
    Genera una explicación en español sencillo del porqué se recomienda `mejor`.
    Cubre los 5 escenarios principales.
    """
    if not alternativas:
        return "Es la única sucursal disponible que atiende los estudios que necesitas."

    # Datos comparativos
    tiene_datos_espera  = mejor.tiempo_espera_min != TIEMPO_ESPERA_DEFAULT
    distancias          = [a.distancia_km for a in alternativas if a.distancia_km is not None]
    esperas             = [a.tiempo_espera_min for a in alternativas]

    es_la_mas_cercana   = (
        hay_ubicacion
        and mejor.distancia_km is not None
        and distancias
        and mejor.distancia_km <= min(distancias)
    )
    tiene_menor_espera  = (
        tiene_datos_espera
        and esperas
        and mejor.tiempo_espera_min <= min(esperas)
    )

    # Diferencia de tiempo total vs la segunda opción
    diff_min = alternativas[0].tiempo_total_min - mejor.tiempo_total_min if alternativas else 0

    # ── Escenario 1: cercana Y menor espera ───────────────────────────────
    if es_la_mas_cercana and tiene_menor_espera:
        return (
            f"Es la sucursal más cercana a tu ubicación y tiene el menor tiempo de espera. "
            f"Llegarás y saldrás aproximadamente {diff_min} min antes que en cualquier otra opción."
        )

    # ── Escenario 2: más lejos pero menor espera (el caso clave) ─────────
    if not es_la_mas_cercana and tiene_menor_espera and hay_ubicacion and mejor.distancia_km:
        cercana = next((a for a in alternativas if a.distancia_km == min(distancias)), None)
        if cercana and cercana.distancia_km:
            diff_km = round(mejor.distancia_km - cercana.distancia_km, 1)
            ahorro  = cercana.tiempo_total_min - mejor.tiempo_total_min
            return (
                f"Aunque está {diff_km} km más lejos que la opción más cercana, "
                f"su tiempo de espera es considerablemente menor. "
                f"Sumando trayecto y estancia, terminarás ~{ahorro} min antes que si fueras a la más cercana."
            )

    # ── Escenario 3: más cercana pero no la de menor espera ───────────────
    if es_la_mas_cercana and not tiene_menor_espera:
        return (
            f"Es la sucursal más cercana a tu ubicación. "
            f"Aunque hay opciones con menor tiempo de espera, la distancia hace que sea la más eficiente en tiempo total."
        )

    # ── Escenario 4: sin datos de espera, solo distancia ──────────────────
    if not tiene_datos_espera and hay_ubicacion:
        return (
            "Es la sucursal más cercana con disponibilidad para los estudios que necesitas. "
            "No contamos con datos de espera en tiempo real para comparar."
        )

    # ── Escenario 5: sin coordenadas del usuario ──────────────────────────
    if not hay_ubicacion:
        return (
            "No pudimos obtener tu ubicación. Esta sucursal tiene la mayor disponibilidad "
            "de estudios y el menor tiempo de espera registrado."
        )

    # Fallback genérico
    return (
        "Esta sucursal ofrece el mejor balance entre distancia y tiempo de espera "
        "para los estudios que necesitas."
    )
