#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Asigna coordenadas a todas las sucursales de Salud Digna usando un
diccionario embebido de ciudades mexicanas.

Sin dependencias externas de red. Ejecutar con el venv del backend activado.

Uso:
  cd ruta-digna/backend
  venv/Scripts/python ../db/geocodificar_sucursales.py
"""

import os
import sys
from pathlib import Path

# ── Cargar .env del backend ──────────────────────────────────────────────────
env_path = Path(__file__).parent.parent / "backend" / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

try:
    from supabase import create_client
except ImportError:
    print("ERROR: Ejecuta desde ruta-digna/backend/ con el venv activado.")
    sys.exit(1)

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
if not url or not key:
    print("ERROR: SUPABASE_URL y SUPABASE_KEY no estan definidas.")
    sys.exit(1)

sb = create_client(url, key)

# ── Coordenadas por ciudad (lat, lon) ────────────────────────────────────────
# Precision de ciudad — suficiente para filtrar radio de 80 km por estado.

COORDS_CIUDAD: dict[str, tuple[float, float]] = {
    # Sinaloa
    "CULIACAN":             (24.7994, -107.3880),
    "LOS MOCHIS":          (25.7906, -108.9931),
    "MAZATLAN":            (23.2494, -106.4111),
    "GUASAVE":             (25.5677, -108.4574),
    "NAVOLATO":            (24.7661, -107.6988),
    "GUAMUCHIL":           (25.4594, -108.0803),
    # Baja California
    "MEXICALI":            (32.6245, -115.4523),
    "TIJUANA":             (32.5027, -117.0037),
    "ENSENADA":            (31.8676, -116.5961),
    "ROSARITO":            (32.3362, -117.0394),
    # Sonora
    "OBREGON":             (27.4863, -109.9309),
    "HERMOSILLO":          (29.0887, -110.9601),
    "NAVOJOA":             (27.0769, -109.4444),
    "NOGALES":             (31.3200, -110.9386),
    "SAN LUIS RIO COLORADO": (32.4532, -114.7892),
    # Jalisco
    "GUADALAJARA":         (20.6597, -103.3496),
    "ZAPOPAN":             (20.6844, -103.4023),
    "TONALA":              (20.6244, -103.2342),
    "TLAQUEPAQUE":         (20.6522, -103.2978),
    "TLAJOMULCO":          (20.4731, -103.4457),
    "PUERTO VALLARTA":     (20.6534, -105.2253),
    "ZAPOTLANEJO":         (20.6280, -103.0654),
    "EL SALTO":            (20.5413, -103.2002),
    # Guanajuato
    "LEON":                (21.1221, -101.6823),
    "IRAPUATO":            (20.6735, -101.3541),
    "CELAYA":              (20.5231, -100.8166),
    "SALAMANCA":           (20.5698, -101.1940),
    "SILAO":               (20.9407, -101.4389),
    "SAN FRANCISCO DEL RINCON": (21.0153, -101.8610),
    "MOROLEON":            (20.1244, -101.1917),
    # Aguascalientes
    "AGUASCALIENTES":      (21.8818, -102.2916),
    # Queretaro
    "QUERETARO":           (20.5881, -100.3899),
    "SAN JUAN DEL RIO":    (20.3858, -99.9858),
    "CORREGIDORA":         (20.5028, -100.4497),
    # Nuevo Leon
    "MONTERREY":           (25.6714, -100.3089),
    "SAN NICOLAS DE LOS GARZA": (25.7333, -100.3005),
    "GUADALUPE":           (25.6763, -100.2568),
    "SANTA CATARINA":      (25.6768, -100.4553),
    "APODACA":             (25.7814, -100.1873),
    "ESCOBEDO":            (25.8003, -100.3275),
    "GARCIA":              (25.8160, -100.5912),
    "SAN PEDRO GARZA GARCIA": (25.6545, -100.4069),
    "CADEREYTA JIMENEZ":   (25.5917, -99.9986),
    # Coahuila
    "SALTILLO":            (25.4232, -101.0053),
    "TORREON":             (25.5428, -103.4068),
    "GOMEZ PALACIO":       (25.5619, -103.4952),  # Durango pero conurbado
    # Chihuahua
    "CHIHUAHUA":           (28.6328, -106.0691),
    "CIUDAD JUAREZ":       (31.7381, -106.4870),
    "DELICIAS":            (28.1867, -105.4728),
    "CUAUHTEMOC":          (28.4000, -106.8667),
    # Tamaulipas
    "TAMPICO":             (22.2551, -97.8686),
    "REYNOSA":             (26.0922, -98.2784),
    "MATAMOROS":           (25.8697, -97.5026),
    "NUEVO LAREDO":        (27.4784, -99.5067),
    "CIUDAD VICTORIA":     (23.7369, -99.1478),
    # San Luis Potosi
    "SAN LUIS POTOSI":     (22.1565, -100.9855),
    "CIUDAD VALLES":       (21.9978, -99.0150),
    # Zacatecas
    "ZACATECAS":           (22.7709, -102.5832),
    # Durango
    "DURANGO":             (24.0227, -104.6533),
    # Nayarit
    "TEPIC":               (21.5028, -104.8956),
    # Colima
    "COLIMA":              (19.2452, -103.7242),
    "MANZANILLO":          (19.0516, -104.3176),
    # Michoacan
    "MORELIA":             (19.7067, -101.1950),
    "URUAPAN":             (19.4195, -102.0628),
    "ZAMORA":              (19.9822, -102.2841),
    # Guerrero
    "ACAPULCO":            (16.8634, -99.8825),
    # Puebla
    "PUEBLA":              (19.0413, -98.2062),
    "TEHUACAN":            (18.4621, -97.3927),
    "SAN ANDRES CHOLULA":  (19.0518, -98.2952),
    "SAN PEDRO CHOLULA":   (19.0649, -98.3012),
    "SAN MARTIN TEXMELUCAN": (19.2835, -98.4359),
    # Tlaxcala
    "TLAXCALA":            (19.3182, -98.2375),
    # Hidalgo
    "PACHUCA":             (20.1011, -98.7591),
    # Morelos
    "CUERNAVACA":          (18.9261, -99.2344),
    "CUAUTLA":             (18.8160, -98.9513),
    # Estado de Mexico
    "TOLUCA":              (19.2826, -99.6557),
    "METEPEC":             (19.2541, -99.6043),
    "NAUCALPAN":           (19.4786, -99.2393),
    "TLALNEPANTLA":        (19.5306, -99.2050),
    "ECATEPEC":            (19.6011, -99.0318),
    "ATIZAPAN DE ZARAGOZA": (19.5628, -99.2510),
    "TECAMAC":             (19.7204, -98.9745),
    "IXTAPALUCA":          (19.3165, -98.8831),
    "CHIMALHUACAN":        (19.4316, -98.9570),
    "CHALCO":              (19.2615, -98.9001),
    "COACALCO":            (19.6256, -99.0946),
    "TULTITLAN":           (19.6473, -99.1704),
    "CUAUTITLAN":          (19.6861, -99.1736),
    "CUAUTITLAN IZCALLI":  (19.7088, -99.2108),
    "LOS REYES-LA PAZ":    (19.3504, -98.9590),
    "TEXCOCO":             (19.5150, -98.8830),
    "NICOLAS ROMERO":      (19.6297, -99.3049),
    "HUIXQUILUCAN":        (19.3733, -99.3499),
    "LERMA":               (19.2840, -99.8882),
    "CHICOLOAPAN":         (19.4043, -98.9016),
    "VALLE DE CHALCO":     (19.2722, -98.9600),
    "SAN MARTIN TEXMELUCAN": (19.2835, -98.4359),
    # CDMX - alcaldias
    "COYOACAN":            (19.3505, -99.1617),
    "AZCAPOTZALCO":        (19.4870, -99.1848),
    "IZTAPALAPA":          (19.3547, -99.0640),
    "TLALPAN":             (19.3015, -99.1613),
    "MIGUEL HIDALGO":      (19.4270, -99.1900),
    "CUAUHTEMOC CDMX":     (19.4378, -99.1460),
    "GUSTAVO A MADERO":    (19.4975, -99.1065),
    "XOCHIMILCO":          (19.2645, -99.0942),
    "IZTACALCO":           (19.3908, -99.1014),
    "ALVARO OBREGON":      (19.3592, -99.1942),
    "CUAJIMALPA":          (19.3620, -99.2870),
    "BENITO JUAREZ":       (19.3984, -99.1590),
    "NEZAHUALCOYOTL":      (19.4030, -99.0139),
    # Veracruz
    "VERACRUZ":            (19.1738, -96.1342),
    "BOCA DEL RIO":        (19.0974, -96.1203),
    "XALAPA":              (19.5438, -96.9102),
    "CORDOBA":             (18.8943, -96.9248),
    "COATZACOALCOS":       (18.1500, -94.4424),
    "POZA RICA":           (20.5391, -97.4536),
    # Oaxaca
    "OAXACA":              (17.0600, -96.7220),
    "JUCHITAN":            (16.4338, -95.0224),
    # Chiapas
    "TUXTLA GUTIERREZ":    (16.7516, -93.1151),
    "SAN CRISTOBAL DE LAS CASAS": (16.7369, -92.6376),
    "TAPACHULA":           (14.9087, -92.2625),
    # Tabasco
    "VILLAHERMOSA":        (17.9894, -92.9475),
    "CARDENAS":            (18.0000, -93.3679),
    # Campeche
    "CAMPECHE":            (19.8301, -90.5349),
    # Yucatan
    "MERIDA":              (20.9674, -89.5926),
    # Quintana Roo
    "CANCUN":              (21.1619, -86.8515),
    "PLAYA DEL CARMEN":    (20.6296, -87.0739),
    # Baja California Sur
    "LA PAZ":              (24.1426, -110.3128),
}


def resolver_coords(nombre: str) -> tuple[float, float] | None:
    """
    Encuentra coordenadas para un nombre de sucursal buscando coincidencias
    con ciudades conocidas. Prioriza coincidencias mas largas.
    """
    n = nombre.upper().strip()

    # Mapeos especiales por prefijo/patron
    ALIAS = {
        "GUADALAJARA": "GUADALAJARA",
        "ZAPOPAN": "ZAPOPAN",
        "TONALA": "TONALA",
        "TLAQUEPAQUE": "TLAQUEPAQUE",
        "TLAJOMULCO": "TLAJOMULCO",
        "GUADALUPE": "GUADALUPE",
        "MONTERREY": "MONTERREY",
        "SAN NICOLAS": "SAN NICOLAS DE LOS GARZA",
        "CULIACAN": "CULIACAN",
        "LOS MOCHIS": "LOS MOCHIS",
        "TIJUANA": "TIJUANA",
        "MEXICALI": "MEXICALI",
        "HERMOSILLO": "HERMOSILLO",
        "CIUDAD JUAREZ": "CIUDAD JUAREZ",
        "JUAREZ": "CIUDAD JUAREZ",
        "CHIHUAHUA": "CHIHUAHUA",
        "CUAUHTEMOC INSURGENTES": "CUAUHTEMOC",  # CDMX no Chihuahua
        "CUAUHTEMOC": "CUAUHTEMOC",
        "PUEBLA": "PUEBLA",
        "QUERETARO": "QUERETARO",
        "LEON": "LEON",
        "TORREON": "TORREON",
        "SALTILLO": "SALTILLO",
        "AGUASCALIENTES": "AGUASCALIENTES",
        "MORELIA": "MORELIA",
        "ACAPULCO": "ACAPULCO",
        "VERACRUZ": "VERACRUZ",
        "BOCA DEL RIO": "BOCA DEL RIO",
        "XALAPA": "XALAPA",
        "OAXACA": "OAXACA",
        "TUXTLA GUTIERREZ": "TUXTLA GUTIERREZ",
        "MERIDA": "MERIDA",
        "CANCUN": "CANCUN",
        "DURANGO": "DURANGO",
        "ZACATECAS": "ZACATECAS",
        "SAN LUIS POTOSI": "SAN LUIS POTOSI",
        "IZTAPALAPA": "IZTAPALAPA",
        "ECATEPEC": "ECATEPEC",
        "TLALNEPANTLA": "TLALNEPANTLA",
        "NAUCALPAN": "NAUCALPAN",
        "COYOACAN": "COYOACAN",
        "ALVARO OBREGON": "ALVARO OBREGON",
        "MIGUEL HIDALGO": "MIGUEL HIDALGO",
        "GUSTAVO A. MADERO": "GUSTAVO A MADERO",
        "GUSTAVO A MADERO": "GUSTAVO A MADERO",
        "AZCAPOTZALCO": "AZCAPOTZALCO",
        "TLALPAN": "TLALPAN",
        "BENITO JUAREZ": "BENITO JUAREZ",
        "IZTACALCO": "IZTACALCO",
        "CUAJIMALPA": "CUAJIMALPA",
        "XOCHIMILCO": "XOCHIMILCO",
        "NEZAHUALCOYOTL": "NEZAHUALCOYOTL",
        "NEZAHUALCÓYOTL": "NEZAHUALCOYOTL",
        "CIUDAD AZTECA": "ECATEPEC",
        "RIO DE LOS REMEDIOS": "ECATEPEC",
        "LOS REYES-LA PAZ": "LOS REYES-LA PAZ",
        "CHIMALHUACAN": "CHIMALHUACAN",
        "CHALCO": "CHALCO",
        "COACALCO": "COACALCO",
        "TULTITLAN": "TULTITLAN",
        "CUAUTITLAN IZCALLI": "CUAUTITLAN IZCALLI",
        "CUAUTITLAN": "CUAUTITLAN",
        "TECAMAC": "TECAMAC",
        "IXTAPALUCA": "IXTAPALUCA",
        "ATIZAPAN": "ATIZAPAN DE ZARAGOZA",
        "HUIXQUILUCAN": "HUIXQUILUCAN",
        "LERMA": "LERMA",
        "CHICOLOAPAN": "CHICOLOAPAN",
        "VALLE DE CHALCO": "VALLE DE CHALCO",
        "TEXCOCO": "TEXCOCO",
        "NICOLAS ROMERO": "NICOLAS ROMERO",
        "TOLUCA": "TOLUCA",
        "METEPEC": "METEPEC",
        "VISTA HERMOSA": "CUAUHTEMOC CDMX",
        "CEC-VALLE DE MEXICO": "ECATEPEC",
        "CAMPUS CSI": "ECATEPEC",
        "PET-CT PATRIOTISMO": "MIGUEL HIDALGO",
        "PET-CT PUEBLA": "PUEBLA",
        "PET-CT GUADALAJARA": "GUADALAJARA",
        "IRAPUATO": "IRAPUATO",
        "CELAYA": "CELAYA",
        "SALAMANCA": "SALAMANCA",
        "SILAO": "SILAO",
        "MOROLEON": "MOROLEON",
        "SAN FRANCISCO DEL RINCON": "SAN FRANCISCO DEL RINCON",
        "ZAPOTLANEJO": "ZAPOTLANEJO",
        "EL SALTO": "EL SALTO",
        "CORREGIDORA": "CORREGIDORA",
        "SAN JUAN DEL RIO": "SAN JUAN DEL RIO",
        "TEPIC": "TEPIC",
        "OBREGON": "OBREGON",
        "NAVOJOA": "NAVOJOA",
        "NOGALES": "NOGALES",
        "SAN LUIS RIO COLORADO": "SAN LUIS RIO COLORADO",
        "GUASAVE": "GUASAVE",
        "GUAMUCHIL": "GUAMUCHIL",
        "NAVOLATO": "NAVOLATO",
        "MAZATLAN": "MAZATLAN",
        "ENSENADA": "ENSENADA",
        "ROSARITO": "ROSARITO",
        "LA PAZ": "LA PAZ",
        "TAMPICO": "TAMPICO",
        "REYNOSA": "REYNOSA",
        "MATAMOROS": "MATAMOROS",
        "NUEVO LAREDO": "NUEVO LAREDO",
        "CIUDAD VICTORIA": "CIUDAD VICTORIA",
        "CIUDAD VALLES": "CIUDAD VALLES",
        "SAN MARTIN TEXMELUCAN": "SAN MARTIN TEXMELUCAN",
        "CADEREYTA": "CADEREYTA JIMENEZ",
        "SANTA CATARINA": "SANTA CATARINA",
        "APODACA": "APODACA",
        "ESCOBEDO": "ESCOBEDO",
        "GARCIA": "GARCIA",
        "ACAPULCO": "ACAPULCO",
        "VILLAHERMOSA": "VILLAHERMOSA",
        "CARDENAS": "CARDENAS",
        "CAMPECHE": "CAMPECHE",
        "COLIMA": "COLIMA",
        "MANZANILLO": "MANZANILLO",
        "MORELIA": "MORELIA",
        "URUAPAN": "URUAPAN",
        "ZAMORA": "ZAMORA",
        "CUERNAVACA": "CUERNAVACA",
        "CUAUTLA": "CUAUTLA",
        "PACHUCA": "PACHUCA",
        "TLAXCALA": "TLAXCALA",
        "TEHUACAN": "TEHUACAN",
        "SAN ANDRES CHOLULA": "SAN ANDRES CHOLULA",
        "SAN PEDRO CHOLULA": "SAN PEDRO CHOLULA",
        "PLAYA DEL CARMEN": "PLAYA DEL CARMEN",
        "SAN CRISTOBAL DE LAS CASAS": "SAN CRISTOBAL DE LAS CASAS",
        "TAPACHULA": "TAPACHULA",
        "COATZACOALCOS": "COATZACOALCOS",
        "POZA RICA": "POZA RICA",
        "CORDOBA": "CORDOBA",
        "JUCHITAN": "JUCHITAN",
        "OAXACA": "OAXACA",
        "DELICIAS": "DELICIAS",
        "GOMEZ PALACIO": "GOMEZ PALACIO",
        "AGUASCALIENTES": "AGUASCALIENTES",
        "DURANGO": "DURANGO",
        "SALTILLO": "SALTILLO",
        "ZACATECAS": "ZACATECAS",
    }

    # Buscar por alias (prefijo mas largo primero)
    for alias in sorted(ALIAS.keys(), key=len, reverse=True):
        if n.startswith(alias) or alias in n:
            ciudad = ALIAS[alias]
            if ciudad in COORDS_CIUDAD:
                return COORDS_CIUDAD[ciudad]

    # Busqueda directa en el diccionario
    for ciudad, coords in sorted(COORDS_CIUDAD.items(), key=lambda x: len(x[0]), reverse=True):
        if n.startswith(ciudad) or ciudad in n:
            return coords

    return None


def main():
    res = (
        sb.table("sucursales")
        .select("id, nombre")
        .eq("activa", True)
        .is_("latitud", "null")
        .execute()
    )
    sin_coords = res.data or []

    if not sin_coords:
        print("Todas las sucursales activas ya tienen coordenadas.")
        return

    print(f"Sucursales sin coordenadas: {len(sin_coords)}\n")

    ok = fail = 0
    sin_match = []

    for s in sin_coords:
        sid    = s["id"]
        nombre = s["nombre"]
        coords = resolver_coords(nombre)

        if coords:
            lat, lon = coords
            sb.table("sucursales").update({
                "latitud":  lat,
                "longitud": lon,
            }).eq("id", sid).execute()
            print(f"  OK  [{sid:>3}] {nombre}")
            ok += 1
        else:
            print(f"  --  [{sid:>3}] {nombre}  (sin match)")
            sin_match.append(nombre)
            fail += 1

    print(f"\nListo: {ok} actualizadas, {fail} sin match.")
    if sin_match:
        print("\nSin coordenadas asignadas:")
        for nm in sin_match:
            print(f"  - {nm}")


if __name__ == "__main__":
    main()
