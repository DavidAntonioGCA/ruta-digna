"""
Script para importar datos_listos.csv a Supabase.
Genera un archivo SQL listo para pegar en el SQL Editor de Supabase.

USO:
  cd ruta-digna/db
  python importar_csv.py datos_listos.csv > import_output.sql

Luego pega import_output.sql en Supabase > SQL Editor.
"""

import csv
import sys
import os
import io
from datetime import datetime

# Forzar UTF-8 en stdout (necesario en Windows)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── Mapeo Estudio (texto del CSV) → id en la tabla estudios ──────────────
ESTUDIO_ID: dict[str, int] = {
    "LABORATORIO":           2,
    "RAYOS X":               5,
    "ULTRASONIDO":           6,
    "PAPANICOLAOU":          4,
    "TOMOGRAFIA":            11,
    "TOMOGRAFÍA":            11,
    "RESONANCIA":            12,
    "RESONANCIA MAGNETICA":  12,
    "RESONANCIA MAGNÉTICA":  12,
    "DENSITOMETRIA":         1,
    "DENSITOMETRÍA":         1,
    "MASTOGRAFIA":           3,
    "MASTOGRAFÍA":           3,
    "ELECTROCARDIOGRAMA":    9,
    "ECG":                   9,
    "NUTRICION":             16,
    "NUTRICIÓN":             16,
    "AUDIOMETRIA":           7,
    "AUDIOMETRÍA":           7,
    "OPTOMETRIA":            8,
    "OPTOMETRÍA":            8,
    "ESPIROMETRIA":          10,
    "ESPIROMETRÍA":          10,
    "BIOPSIAS":              17,
    "BIOPSIAS MASTOGRAFIA":  17,
    "PET-CT":                19,
    "SALUD OCUPACIONAL":     20,
    "OPTICA":                18,
    "ÓPTICA":                18,
}

# Estudios nuevos que hay que insertar antes (no existen en el schema original)
ESTUDIOS_NUEVOS = [
    (17, "BIOPSIAS",          0, False, 30),
    (18, "OPTICA",            0, False, 20),
    (19, "PET-CT",            0, True,  60),
    (20, "SALUD OCUPACIONAL", 0, False, 25),
]

def limpiar(s: str) -> str:
    return s.strip().replace("'", "''")   # escapar comillas para SQL

def main():
    csv_path = sys.argv[1] if len(sys.argv) > 1 else "datos_listos.csv"
    if not os.path.exists(csv_path):
        print(f"-- ERROR: No se encontró {csv_path}", file=sys.stderr)
        sys.exit(1)

    sucursales: dict[int, str] = {}         # id → nombre
    subestudios: dict[int, dict] = {}       # id_sub → {nombre, id_estudio}
    sucursal_subestudios: list[tuple] = []  # (id_sucursal, id_subestudio, id_paquete)
    estudios_faltantes: set[str] = set()

    # Detectar separador (tab o coma)
    with open(csv_path, encoding="utf-8-sig") as f:
        sample = f.read(1024)
    sep = "\t" if "\t" in sample else ","

    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=sep)
        for row in reader:
            try:
                id_suc   = int(row["IdSucursal"].strip())
                nom_suc  = limpiar(row["Sucursal"])
                estudio  = limpiar(row["Estudio"]).upper()
                id_sub   = int(row["IdSubestudio"].strip())
                nom_sub  = limpiar(row["SubEstudio"])
                id_pkg   = int(row["IdPaquete"].strip()) if row.get("IdPaquete", "").strip() else 0
            except (ValueError, KeyError) as e:
                print(f"-- WARN: fila ignorada ({e}): {dict(row)}", file=sys.stderr)
                continue

            sucursales[id_suc] = nom_suc

            id_estudio = ESTUDIO_ID.get(estudio)
            if id_estudio is None:
                estudios_faltantes.add(estudio)
                continue

            if id_sub not in subestudios:
                subestudios[id_sub] = {"nombre": nom_sub, "id_estudio": id_estudio}

            sucursal_subestudios.append((id_suc, id_sub, id_pkg))

    # ── Advertencias ──────────────────────────────────────────────────────
    if estudios_faltantes:
        print(f"-- WARN: estudios sin mapeo (ignorados): {', '.join(sorted(estudios_faltantes))}", file=sys.stderr)

    # ── Generar SQL ───────────────────────────────────────────────────────
    print(f"-- ================================================================")
    print(f"-- Generado automáticamente por importar_csv.py")
    print(f"-- Fuente: {csv_path}")
    print(f"-- Fecha:  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"-- Sucursales: {len(sucursales)}  Subestudios: {len(subestudios)}  Relaciones: {len(sucursal_subestudios)}")
    print(f"-- ================================================================\n")

    # 0. Estudios nuevos
    print("-- ── 0. Estudios nuevos del CSV ──────────────────────────────")
    for eid, enombre, eorden, ereq, etiempo in ESTUDIOS_NUEVOS:
        print(f"INSERT INTO estudios (id, nombre, orden_prioridad, requiere_preparacion, tiempo_espera_promedio_min, activo)")
        print(f"  VALUES ({eid}, '{enombre}', {eorden}, {str(ereq).lower()}, {etiempo}, TRUE)")
        print(f"  ON CONFLICT (id) DO NOTHING;")
    print()

    # 1. Patch: añadir columna id_paquete a subestudios si no existe
    print("-- ── 1. Estructura ───────────────────────────────────────────")
    print("ALTER TABLE subestudios ADD COLUMN IF NOT EXISTS id_paquete INTEGER DEFAULT 0;")
    print()
    print("""
CREATE TABLE IF NOT EXISTS sucursal_subestudios (
  id_sucursal    INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  id_subestudio  INTEGER NOT NULL REFERENCES subestudios(id) ON DELETE CASCADE,
  id_paquete     INTEGER NOT NULL DEFAULT 0,
  disponible     BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id_sucursal, id_subestudio)
);
CREATE INDEX IF NOT EXISTS idx_ss_sucursal   ON sucursal_subestudios(id_sucursal);
CREATE INDEX IF NOT EXISTS idx_ss_subestudio ON sucursal_subestudios(id_subestudio);
CREATE INDEX IF NOT EXISTS idx_ss_paquete    ON sucursal_subestudios(id_paquete) WHERE id_paquete > 0;
""")

    # 2. Sucursales
    print("-- ── 2. Sucursales ───────────────────────────────────────────")
    for id_s, nom in sorted(sucursales.items()):
        print(f"INSERT INTO sucursales (id, nombre, activa) VALUES ({id_s}, '{nom}', TRUE)")
        print(f"  ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;")
    print()

    # 3. Subestudios (upsert)
    print("-- ── 3. Subestudios ──────────────────────────────────────────")
    # Agrupar en bloques de 200 para no hacer el SQL demasiado largo
    items = sorted(subestudios.items())
    BLOCK = 200
    for i in range(0, len(items), BLOCK):
        block = items[i:i+BLOCK]
        print("INSERT INTO subestudios (id, id_estudio, nombre, activo) VALUES")
        rows = [f"  ({id_sub}, {d['id_estudio']}, '{d['nombre']}', TRUE)" for id_sub, d in block]
        print(",\n".join(rows))
        print("ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, id_estudio = EXCLUDED.id_estudio;")
        print()

    # 4. sucursal_subestudios (upsert)
    print("-- ── 4. Disponibilidad por sucursal ──────────────────────────")
    unique_ss = list({(s, sub): pkg for s, sub, pkg in sucursal_subestudios}.items())
    for i in range(0, len(unique_ss), BLOCK):
        block = unique_ss[i:i+BLOCK]
        print("INSERT INTO sucursal_subestudios (id_sucursal, id_subestudio, id_paquete, disponible) VALUES")
        rows = [f"  ({s}, {sub}, {pkg}, TRUE)" for (s, sub), pkg in block]
        print(",\n".join(rows))
        print("ON CONFLICT (id_sucursal, id_subestudio) DO UPDATE SET id_paquete = EXCLUDED.id_paquete, disponible = TRUE;")
        print()

    # 5. consultorios_por_sucursal — derivado del CSV
    print("-- ── 5. Consultorios por sucursal (nivel estudio) ────────────")
    pares_estudio = set()
    for id_s in sucursales:
        estudios_en_suc = {subestudios[sub]["id_estudio"]
                          for (s, sub, _) in sucursal_subestudios if s == id_s and sub in subestudios}
        for id_e in estudios_en_suc:
            pares_estudio.add((id_s, id_e))

    if pares_estudio:
        print("INSERT INTO consultorios_por_sucursal (id_sucursal, id_estudio, cantidad_consultorios, activos) VALUES")
        rows = [f"  ({s}, {e}, 2, 2)" for s, e in sorted(pares_estudio)]
        print(",\n".join(rows))
        print("ON CONFLICT (id_sucursal, id_estudio) DO NOTHING;")
        print()

    print("-- ── Fin del import ──────────────────────────────────────────")
    total = len(sucursales) + len(subestudios) + len(unique_ss)
    print(f"-- Total de registros generados: {total}")


if __name__ == "__main__":
    main()
