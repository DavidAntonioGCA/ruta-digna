-- ================================================================
-- PATCH: Reparar consultorios_por_sucursal + inicializar colas
-- Aplicar en Supabase > SQL Editor
-- ================================================================

-- ── 1. Derivar consultorios_por_sucursal desde sucursal_subestudios ──
-- Asegura que cada (sucursal, estudio-categoria) tenga su fila
INSERT INTO consultorios_por_sucursal (id_sucursal, id_estudio, cantidad_consultorios, activos)
SELECT DISTINCT
  ss.id_sucursal,
  sub.id_estudio,
  2,   -- capacidad base por defecto
  2
FROM sucursal_subestudios ss
JOIN subestudios sub ON sub.id = ss.id_subestudio
WHERE ss.disponible = TRUE
ON CONFLICT (id_sucursal, id_estudio) DO NOTHING;

-- ── 2. Inicializar colas_en_tiempo_real con 0 pacientes ─────────────
-- Permite que fn_recomendar_sucursales funcione para sucursales nuevas
INSERT INTO colas_en_tiempo_real
  (id_sucursal, id_estudio,
   pacientes_en_espera, pacientes_en_atencion,
   pacientes_urgentes, pacientes_con_cita,
   tiempo_espera_estimado_min)
SELECT
  cp.id_sucursal,
  cp.id_estudio,
  0, 0, 0, 0,
  COALESCE(e.tiempo_espera_promedio_min, 20)
FROM consultorios_por_sucursal cp
JOIN estudios e ON e.id = cp.id_estudio
WHERE cp.activos > 0
ON CONFLICT (id_sucursal, id_estudio) DO NOTHING;

-- ── 3. Verificación rápida ───────────────────────────────────────────
SELECT
  'consultorios_por_sucursal' AS tabla,
  COUNT(*)                    AS total_filas,
  COUNT(DISTINCT id_sucursal) AS sucursales,
  COUNT(DISTINCT id_estudio)  AS tipos_estudio
FROM consultorios_por_sucursal

UNION ALL

SELECT
  'colas_en_tiempo_real',
  COUNT(*),
  COUNT(DISTINCT id_sucursal),
  COUNT(DISTINCT id_estudio)
FROM colas_en_tiempo_real

UNION ALL

SELECT
  'sucursal_subestudios',
  COUNT(*),
  COUNT(DISTINCT id_sucursal),
  COUNT(DISTINCT id_subestudio)
FROM sucursal_subestudios;
