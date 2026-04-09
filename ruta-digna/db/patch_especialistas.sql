-- ================================================================
-- PATCH: Tabla de especialistas
-- Extiende el sistema de autenticación para el dashboard de especialistas.
--
-- Diseño:
--   - Un especialista pertenece a UNA sucursal y atiende UN área (estudio).
--   - Varios especialistas pueden compartir la misma sucursal+área (sin unique).
--   - id_empleado es el identificador único de inicio de sesión (número de empleado SD).
--   - PIN de 4 dígitos igual que pacientes.
--   - rol: 'especialista' | 'admin' — preparado para futura expansión.
--
-- Ejecutar en: Supabase → SQL Editor
-- ================================================================

-- ── 1. Crear tabla ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS especialistas (
  id           uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre       text          NOT NULL,
  id_empleado  text          NOT NULL UNIQUE,   -- número de empleado SD, usado para login
  pin          text          NOT NULL,
  rol          text          NOT NULL DEFAULT 'especialista',
  id_sucursal  integer       NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
  id_estudio   integer       NOT NULL REFERENCES estudios(id)   ON DELETE RESTRICT,
  activo       boolean       NOT NULL DEFAULT true,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT especialistas_rol_valido
    CHECK (rol IN ('especialista', 'admin')),
  CONSTRAINT especialistas_id_empleado_not_empty
    CHECK (char_length(trim(id_empleado)) > 0),
  CONSTRAINT especialistas_nombre_not_empty
    CHECK (char_length(trim(nombre)) > 0)
  -- Sin UNIQUE (id_sucursal, id_estudio): varios especialistas pueden
  -- trabajar en la misma área de la misma sucursal.
);

CREATE INDEX IF NOT EXISTS idx_especialistas_sucursal ON especialistas(id_sucursal);
CREATE INDEX IF NOT EXISTS idx_especialistas_estudio  ON especialistas(id_estudio);
CREATE INDEX IF NOT EXISTS idx_especialistas_activo   ON especialistas(activo) WHERE activo = true;

COMMENT ON TABLE especialistas IS
  'Personal de Salud Digna que opera el dashboard. Varios especialistas pueden compartir sucursal+área.';
COMMENT ON COLUMN especialistas.id_empleado IS
  'Número de empleado SD. Usado como identificador de login. Único en todo el sistema.';
COMMENT ON COLUMN especialistas.rol IS
  'especialista = acceso solo a su área. admin = acceso completo al dashboard.';

-- ── 2. RLS: solo el backend (service_role) puede escribir ────────
ALTER TABLE especialistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backend_especialistas"
  ON especialistas FOR ALL
  USING (auth.role() = 'service_role');

-- ── 3. Seed de demo (opcional — comentar en producción) ──────────
-- Especialista en Laboratorio, sucursal Culiacán (id=1)
-- PIN: 1234
INSERT INTO especialistas (nombre, id_empleado, pin, rol, id_sucursal, id_estudio)
VALUES
  ('Dr. Juan Pérez',     'EMP001', '1234', 'especialista', 1, 1),
  ('Dra. Laura Soto',    'EMP002', '5678', 'especialista', 1, 2),  -- Ultrasonido
  ('Téc. Mario Ruiz',    'EMP003', '9012', 'especialista', 5, 1),  -- Lab Los Mochis
  ('Admin Dashboard',    'ADMIN1', '0000', 'admin',        1, 1)
ON CONFLICT (id_empleado) DO NOTHING;
