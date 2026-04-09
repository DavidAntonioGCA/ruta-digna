-- ═══════════════════════════════════════════════════════════
--  PATCH: Datos completos de paciente + sistema de PIN
--  Aplicar en Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════

ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS primer_apellido TEXT;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS segundo_apellido TEXT;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS sexo CHAR(1);
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS nacionalidad TEXT DEFAULT 'Mexicana';
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS residencia TEXT;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS pin TEXT;           -- 4 dígitos
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS discapacidad BOOLEAN DEFAULT FALSE;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS tipo_base TEXT DEFAULT 'sin_cita';
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS sd_registrado BOOLEAN DEFAULT FALSE; -- encontrado en SD
