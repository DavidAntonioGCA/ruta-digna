-- ================================================================
-- PATCH v2: Función de recomendación más robusta
-- Problema: la versión original exige que la sucursal tenga TODOS
-- los estudios solicitados → retorna vacío si no hay match perfecto.
-- Solución: ordenar por estudios disponibles (desc) y luego por score.
-- Aplicar en Supabase > SQL Editor
-- ================================================================

-- ── 0. Diagnóstico (ejecutar primero para ver el estado) ─────────
-- Descomenta el bloque de abajo si quieres verificar el estado:
/*
SELECT
  'consultorios_por_sucursal' AS tabla,
  COUNT(*)                    AS total_filas,
  COUNT(DISTINCT id_sucursal) AS sucursales,
  COUNT(DISTINCT id_estudio)  AS tipos_estudio
FROM consultorios_por_sucursal
UNION ALL
SELECT 'colas_en_tiempo_real', COUNT(*),
       COUNT(DISTINCT id_sucursal), COUNT(DISTINCT id_estudio)
FROM colas_en_tiempo_real
UNION ALL
SELECT 'sucursal_subestudios', COUNT(*),
       COUNT(DISTINCT id_sucursal), COUNT(DISTINCT id_subestudio)
FROM sucursal_subestudios;
*/

-- ── 1. Re-derivar consultorios desde sucursal_subestudios ────────
INSERT INTO consultorios_por_sucursal
  (id_sucursal, id_estudio, cantidad_consultorios, activos)
SELECT DISTINCT
  ss.id_sucursal,
  sub.id_estudio,
  2,
  2
FROM sucursal_subestudios ss
JOIN subestudios sub ON sub.id = ss.id_subestudio
JOIN estudios    e   ON e.id  = sub.id_estudio   -- asegura que el estudio existe
JOIN sucursales  s   ON s.id  = ss.id_sucursal   -- asegura que la sucursal existe
WHERE ss.disponible = TRUE
ON CONFLICT (id_sucursal, id_estudio) DO NOTHING;

-- ── 2. Re-inicializar colas_en_tiempo_real ───────────────────────
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

-- ── 3. Reemplazar fn_recomendar_sucursales con versión flexible ───
-- CAMBIO CLAVE: ya no requiere TODOS los estudios.
-- Ordena por (estudios_disponibles DESC, score ASC) para mostrar
-- primero la sucursal que más estudios cubre con el menor tiempo.
CREATE OR REPLACE FUNCTION fn_recomendar_sucursales(
  p_ids_estudios integer[],
  p_lat_usuario  numeric  DEFAULT NULL,
  p_lon_usuario  numeric  DEFAULT NULL,
  p_limite       integer  DEFAULT 5
)
RETURNS TABLE (
  id_sucursal          integer,
  nombre_sucursal      text,
  direccion            text,
  ciudad               text,
  tiempo_total_min     integer,
  score                numeric,
  estudios_disponibles integer
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.nombre,
    s.direccion,
    s.ciudad,
    fn_calcular_tiempo_espera_visita_sim(s.id, p_ids_estudios),
    fn_score_recomendacion_sucursal(
      s.id, p_ids_estudios,
      COALESCE(p_lat_usuario, 0),
      COALESCE(p_lon_usuario, 0)
    ),
    (
      SELECT COUNT(*)::integer
      FROM   consultorios_por_sucursal cp
      WHERE  cp.id_sucursal = s.id
        AND  cp.id_estudio  = ANY(p_ids_estudios)
    ) AS estudios_disponibles
  FROM sucursales s
  WHERE s.activa = TRUE
    AND (
      -- Al menos UN estudio solicitado está disponible en la sucursal
      SELECT COUNT(*)
      FROM   consultorios_por_sucursal cp
      WHERE  cp.id_sucursal = s.id
        AND  cp.id_estudio  = ANY(p_ids_estudios)
    ) >= 1
  ORDER BY
    -- Primero las que tienen MÁS estudios solicitados disponibles
    (
      SELECT COUNT(*)
      FROM   consultorios_por_sucursal cp
      WHERE  cp.id_sucursal = s.id
        AND  cp.id_estudio  = ANY(p_ids_estudios)
    ) DESC,
    -- Luego por score (tiempo + distancia)
    fn_score_recomendacion_sucursal(
      s.id, p_ids_estudios,
      COALESCE(p_lat_usuario, 0),
      COALESCE(p_lon_usuario, 0)
    ) ASC
  LIMIT p_limite;
END;
$$;

-- ── 4. Verificación final ────────────────────────────────────────
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
FROM colas_en_tiempo_real;
