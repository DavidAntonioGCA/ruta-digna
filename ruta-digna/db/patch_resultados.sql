-- ═══════════════════════════════════════════════════════════
--  PATCH: Resultados de estudios + historial del paciente
--  Aplicar en Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Tabla de resultados
CREATE TABLE IF NOT EXISTS resultados_estudios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_visita        UUID REFERENCES visitas(id) ON DELETE CASCADE,
  id_paciente      UUID,
  nombre_archivo   TEXT NOT NULL,
  url_archivo      TEXT NOT NULL,
  tipo_estudio     TEXT DEFAULT '',
  interpretacion_ia TEXT,
  subido_por       TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resultados_visita   ON resultados_estudios(id_visita);
CREATE INDEX IF NOT EXISTS idx_resultados_paciente ON resultados_estudios(id_paciente);

-- 2. Política RLS: lectura pública (la URL ya es el control de acceso via Storage)
ALTER TABLE resultados_estudios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resultados_read_all"  ON resultados_estudios FOR SELECT USING (true);
CREATE POLICY "resultados_insert_all" ON resultados_estudios FOR INSERT WITH CHECK (true);

-- ───────────────────────────────────────────────────────────
--  DESPUÉS DE EJECUTAR ESTE SQL:
--  Ir a Supabase > Storage > New Bucket
--  Nombre: resultados
--  Marcar como PUBLIC (para que los pacientes puedan descargar)
-- ───────────────────────────────────────────────────────────
