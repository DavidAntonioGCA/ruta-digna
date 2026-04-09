-- ================================================================
-- RESET: Limpia todos los datos de pacientes y visitas
-- Conserva: catálogos, sucursales, estudios, especialistas, guías
-- Ejecutar en: Supabase → SQL Editor
-- ================================================================

-- Orden de borrado respeta foreign keys
TRUNCATE TABLE
  historial_estados_visita_estudio,
  resultados_estudios,
  visita_estudios,
  visitas,
  alertas_sucursal,
  pacientes
RESTART IDENTITY CASCADE;

-- Resetear contadores de colas a 0
UPDATE colas_en_tiempo_real SET
  pacientes_en_espera   = 0,
  pacientes_en_atencion = 0,
  pacientes_urgentes    = 0,
  pacientes_con_cita    = 0,
  ultima_actualizacion  = now();
