-- ================================================================
-- HACKATHON DEMO — Reset completo + Seed de demostración
-- Ejecutar en: Supabase → SQL Editor
-- Sucursal demo: OBREGON (id = 25)
-- ================================================================
--
-- CREDENCIALES DE ACCESO (teléfono / PIN):
--
--   PACIENTE DEMO 1: 6641000001 / 1111  → Andrés Torres     (sin_cita)
--   PACIENTE DEMO 2: 6641000002 / 2222  → Laura Mendoza     (con_cita)
--   PACIENTE DEMO 3: 6641000003 / 3333  → Don Manuel Ríos   (adulto_mayor)
--   PACIENTE DEMO 4: 6641000004 / 4444  → Diana Salazar     (embarazada)
--   PACIENTE DEMO 5: 6641000005 / 5555  → Carlos Ibáñez     (discapacidad)
--   PACIENTE DEMO 6: 6641000006 / 6666  → Sofía Peña        (sin_cita) ← URGENTE en demo
--   PACIENTE DEMO 7: 6641000007 / 7777  → Javier Luna       (con_cita, multi-estudio)
--   PACIENTE DEMO 8: 6641000008 / 8888  → Elena Vargas      (adulto_mayor, multi-estudio)
--
-- ESTUDIOS DISPONIBLES EN OBREGON:
--   2  = LABORATORIO
--   5  = RAYOS X
--   6  = ULTRASONIDO
--   9  = ELECTROCARDIOGRAMA
--
-- FLUJOS DEMO:
--   1. Cola de Laboratorio con prioridades mixtas
--   2. Don Manuel marcado como URGENTE en dashboard → sube a frente
--   3. Jorge (multi-estudio: Lab → ECG) ya en toma
--   4. Diana (embarazada) con ultrasonido
--   5. Carlos (discapacidad) con Rayos X
--   6. Elena completa Lab, ahora en Ultrasonido
-- ================================================================


-- ================================================================
-- PASO 1: LIMPIAR TODO LO ANTERIOR
-- ================================================================

-- Borrar archivos de resultados en storage (Supabase limpia automáticamente
-- los registros de BD; los archivos físicos en el bucket 'resultados'
-- se eliminan manualmente desde Supabase → Storage → resultados → Delete all)
-- Si tienes acceso a la CLI de Supabase puedes ejecutar:
--   supabase storage rm resultados --recursive

-- Limpiar tablas en orden de dependencias
TRUNCATE TABLE
  historial_estados_visita_estudio,
  resultados_estudios,
  visita_estudios,
  visitas,
  alertas_sucursal,
  pacientes
RESTART IDENTITY CASCADE;

-- Resetear colas a 0
UPDATE colas_en_tiempo_real SET
  pacientes_en_espera    = 0,
  pacientes_en_atencion  = 0,
  pacientes_urgentes     = 0,
  pacientes_con_cita     = 0,
  ultima_actualizacion   = now();


-- ================================================================
-- PASO 2: PACIENTES DE DEMO
-- ================================================================

INSERT INTO pacientes (
  id, nombre, primer_apellido, segundo_apellido,
  telefono, pin, fecha_nacimiento, sexo,
  nacionalidad, residencia, discapacidad, tipo_base, sd_registrado
) VALUES

  -- Demo 1: Andrés Torres — sin cita, laboratorio
  ('d0000000-0000-0000-0000-000000000001',
   'Andrés','Torres','Vargas','6641000001','1111',
   '1990-06-15','M','Mexicano','Culiacán, Sinaloa',
   FALSE,'sin_cita',TRUE),

  -- Demo 2: Laura Mendoza — con cita, laboratorio (paciente conocida del sistema)
  ('d0000000-0000-0000-0000-000000000002',
   'Laura','Mendoza','Ríos','6641000002','2222',
   '1985-03-22','F','Mexicana','Los Mochis, Sinaloa',
   FALSE,'con_cita',TRUE),

  -- Demo 3: Don Manuel Ríos — adulto mayor, laboratorio
  -- *** CANDIDATO A MARCAR URGENTE EN LA DEMO ***
  ('d0000000-0000-0000-0000-000000000003',
   'Manuel','Ríos','Morales','6641000003','3333',
   '1948-09-10','M','Mexicano','Mazatlán, Sinaloa',
   FALSE,'adulto_mayor',TRUE),

  -- Demo 4: Diana Salazar — embarazada, ultrasonido (prioridad alta)
  ('d0000000-0000-0000-0000-000000000004',
   'Diana','Salazar','Fuentes','6641000004','4444',
   '1997-12-05','F','Mexicana','Culiacán, Sinaloa',
   FALSE,'embarazada',TRUE),

  -- Demo 5: Carlos Ibáñez — discapacidad, rayos X
  ('d0000000-0000-0000-0000-000000000005',
   'Carlos','Ibáñez','Ponce','6641000005','5555',
   '1979-04-28','M','Mexicano','Obregón, Sonora',
   TRUE,'discapacidad',TRUE),

  -- Demo 6: Sofía Peña — sin cita, laboratorio (la última en la cola)
  ('d0000000-0000-0000-0000-000000000006',
   'Sofía','Peña','Castro','6641000006','6666',
   '2002-07-19','F','Mexicana','Culiacán, Sinaloa',
   FALSE,'sin_cita',TRUE),

  -- Demo 7: Javier Luna — con cita, multi-estudio Lab → ECG
  ('d0000000-0000-0000-0000-000000000007',
   'Javier','Luna','Estrada','6641000007','7777',
   '1972-01-30','M','Mexicano','Hermosillo, Sonora',
   FALSE,'con_cita',TRUE),

  -- Demo 8: Elena Vargas — adulto mayor, completó Lab, ahora en Ultrasonido
  ('d0000000-0000-0000-0000-000000000008',
   'Elena','Vargas','Quiroz','6641000008','8888',
   '1952-11-14','F','Mexicana','Los Mochis, Sinaloa',
   FALSE,'adulto_mayor',TRUE);


-- ================================================================
-- PASO 3: VISITAS (todas en OBREGON = id 25)
-- ================================================================

INSERT INTO visitas (
  id, id_paciente, id_sucursal, estatus, tipo_paciente,
  id_estudio_actual, progreso_general_pct, timestamp_llegada
) VALUES

  -- Andrés: Laboratorio (esperando — llegó hace 20 min)
  ('e0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001', 25,
   'en_proceso','sin_cita', 2, 0, NOW() - INTERVAL '20 minutes'),

  -- Laura: Laboratorio (esperando — con cita, llegó hace 30 min)
  ('e0000000-0000-0000-0000-000000000002',
   'd0000000-0000-0000-0000-000000000002', 25,
   'en_proceso','con_cita', 2, 0, NOW() - INTERVAL '30 minutes'),

  -- Don Manuel: Laboratorio (esperando — adulto mayor, 40 min de espera)
  -- *** MARCAR URGENTE EN LA DEMO PARA SUBIR AL FRENTE ***
  ('e0000000-0000-0000-0000-000000000003',
   'd0000000-0000-0000-0000-000000000003', 25,
   'en_proceso','adulto_mayor', 2, 0, NOW() - INTERVAL '40 minutes'),

  -- Diana: Ultrasonido (embarazada, esperando — llegó hace 12 min)
  ('e0000000-0000-0000-0000-000000000004',
   'd0000000-0000-0000-0000-000000000004', 25,
   'en_proceso','embarazada', 6, 0, NOW() - INTERVAL '12 minutes'),

  -- Carlos: Rayos X (discapacidad — en diagnóstico activo)
  ('e0000000-0000-0000-0000-000000000005',
   'd0000000-0000-0000-0000-000000000005', 25,
   'en_proceso','discapacidad', 5, 0, NOW() - INTERVAL '55 minutes'),

  -- Sofía: Laboratorio (sin cita, última en cola — llegó hace 5 min)
  ('e0000000-0000-0000-0000-000000000006',
   'd0000000-0000-0000-0000-000000000006', 25,
   'en_proceso','sin_cita', 2, 0, NOW() - INTERVAL '5 minutes'),

  -- Javier: Laboratorio → ECG (con cita, en toma de laboratorio activa)
  ('e0000000-0000-0000-0000-000000000007',
   'd0000000-0000-0000-0000-000000000007', 25,
   'en_proceso','con_cita', 2, 0, NOW() - INTERVAL '60 minutes'),

  -- Elena: completó Laboratorio, ahora en Ultrasonido (esperando)
  ('e0000000-0000-0000-0000-000000000008',
   'd0000000-0000-0000-0000-000000000008', 25,
   'en_proceso','adulto_mayor', 6, 0, NOW() - INTERVAL '90 minutes');


-- ================================================================
-- PASO 4: VISITA_ESTUDIOS
-- ================================================================

-- ── Andrés: LABORATORIO (espera) ────────────────────────────────
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus,
  orden_atencion, es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('f0000000-0000-0000-0000-000000000001',
   'e0000000-0000-0000-0000-000000000001', 2, 1,
   1, TRUE, 'espera', 0, FALSE);

-- ── Laura: LABORATORIO (espera, con cita) ───────────────────────
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus,
  orden_atencion, es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('f0000000-0000-0000-0000-000000000002',
   'e0000000-0000-0000-0000-000000000002', 2, 1,
   1, TRUE, 'espera', 0, FALSE);

-- ── Don Manuel: LABORATORIO (espera, adulto mayor) ──────────────
-- *** DEMO: el especialista puede marcar este turno como URGENTE ***
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus,
  orden_atencion, es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('f0000000-0000-0000-0000-000000000003',
   'e0000000-0000-0000-0000-000000000003', 2, 1,
   1, TRUE, 'espera', 0, FALSE);

-- ── Diana: ULTRASONIDO (espera, embarazada) ──────────────────────
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus,
  orden_atencion, es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('f0000000-0000-0000-0000-000000000004',
   'e0000000-0000-0000-0000-000000000004', 6, 1,
   1, TRUE, 'espera', 0, FALSE);

-- ── Carlos: RAYOS X (en diagnóstico activo — es_estatus=2) ──────
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus,
  orden_atencion, es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('f0000000-0000-0000-0000-000000000005',
   'e0000000-0000-0000-0000-000000000005', 5, 2,
   1, TRUE, 'inicio_toma', 40, FALSE);

-- ── Sofía: LABORATORIO (espera, última en cola) ──────────────────
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus,
  orden_atencion, es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('f0000000-0000-0000-0000-000000000006',
   'e0000000-0000-0000-0000-000000000006', 2, 1,
   1, TRUE, 'espera', 0, FALSE);

-- ── Javier: LABORATORIO (en toma activa, 65%) → ECG (pendiente) ─
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus,
  orden_atencion, es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('f0000000-0000-0000-0000-000000000007',
   'e0000000-0000-0000-0000-000000000007', 2, 2,
   1, TRUE,  'inicio_toma', 65, FALSE),
  ('f0000000-0000-0000-0000-000000000008',
   'e0000000-0000-0000-0000-000000000007', 9, 1,
   2, FALSE, 'espera', 0, FALSE);

-- ── Elena: LABORATORIO (completado) → ULTRASONIDO (espera) ──────
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus,
  orden_atencion, es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('f0000000-0000-0000-0000-000000000009',
   'e0000000-0000-0000-0000-000000000008', 2, 3,
   1, FALSE, 'completado', 100, FALSE),
  ('f0000000-0000-0000-0000-000000000010',
   'e0000000-0000-0000-0000-000000000008', 6, 1,
   2, TRUE,  'espera', 0, FALSE);


-- ================================================================
-- PASO 5: COLAS EN TIEMPO REAL — OBREGON (id=25)
-- ================================================================

INSERT INTO colas_en_tiempo_real
  (id_sucursal, id_estudio, pacientes_en_espera, pacientes_en_atencion,
   pacientes_urgentes, pacientes_con_cita, tiempo_espera_estimado_min,
   ultima_actualizacion)
VALUES
  -- LABORATORIO: Andrés, Don Manuel, Laura, Sofía esperando | Javier en toma
  (25, 2, 4, 1, 0, 1, 45, NOW()),
  -- RAYOS X: Carlos en diagnóstico activo
  (25, 5, 0, 1, 0, 0, 15, NOW()),
  -- ULTRASONIDO: Diana y Elena esperando
  (25, 6, 2, 0, 0, 0, 30, NOW()),
  -- ELECTROCARDIOGRAMA: Javier llega después del lab
  (25, 9, 1, 0, 0, 1, 20, NOW())
ON CONFLICT (id_sucursal, id_estudio) DO UPDATE SET
  pacientes_en_espera        = EXCLUDED.pacientes_en_espera,
  pacientes_en_atencion      = EXCLUDED.pacientes_en_atencion,
  pacientes_urgentes         = EXCLUDED.pacientes_urgentes,
  pacientes_con_cita         = EXCLUDED.pacientes_con_cita,
  tiempo_espera_estimado_min = EXCLUDED.tiempo_espera_estimado_min,
  ultima_actualizacion       = NOW();


-- ================================================================
-- PASO 6: ALERTA DEMO (opcional — activa en dashboard)
-- ================================================================

INSERT INTO alertas_sucursal (
  id_sucursal, id_estudio, tipo_alerta, titulo, descripcion,
  severidad, impacto_tiempo_min, activa, creada_por
) VALUES (
  25, 2,
  'saturacion',
  'Laboratorio con alta demanda',
  'Se registra afluencia elevada en laboratorio. Los tiempos de espera pueden ser mayores a lo habitual.',
  'media', 15, TRUE, 'operador'
);


-- ================================================================
-- PASO 7: PACIENTES Y VISITAS EN SUCURSALES CDMX
-- (Para que la recomendación muestre múltiples sucursales)
-- IDs: CUAJIMALPA=151 | ALVARO OBREGON=148 | AO PORTALES=283
--      HUIXQUILUCAN=153 | MIGUEL HIDALGO=80
-- ================================================================

INSERT INTO pacientes (
  id, nombre, primer_apellido, segundo_apellido,
  telefono, pin, fecha_nacimiento, sexo,
  nacionalidad, residencia, discapacidad, tipo_base, sd_registrado
) VALUES
  ('d0000000-0000-0000-0000-000000000011',
   'Ricardo','Fuentes','Mora','6641000011','1111',
   '1988-04-12','M','Mexicano','Cuajimalpa, CDMX',FALSE,'sin_cita',TRUE),
  ('d0000000-0000-0000-0000-000000000012',
   'Gabriela','Ruiz','Soria','6641000012','2222',
   '1993-08-25','F','Mexicana','Álvaro Obregón, CDMX',FALSE,'con_cita',TRUE),
  ('d0000000-0000-0000-0000-000000000013',
   'Héctor','Ávila','Reyes','6641000013','3333',
   '1975-11-30','M','Mexicano','Huixquilucan, Edo. Mex.',FALSE,'sin_cita',TRUE),
  ('d0000000-0000-0000-0000-000000000014',
   'Patricia','Jiménez','Luna','6641000014','4444',
   '1965-02-18','F','Mexicana','Miguel Hidalgo, CDMX',FALSE,'adulto_mayor',TRUE),
  ('d0000000-0000-0000-0000-000000000015',
   'Rodrigo','Salinas','Peña','6641000015','5555',
   '1985-07-09','M','Mexicano','Álvaro Obregón, CDMX',FALSE,'sin_cita',TRUE),
  -- Pacientes extra para densidad de cola
  ('d0000000-0000-0000-0000-000000000016',
   'Mónica','Delgado','Vega','6641000016','6666',
   '1990-03-14','F','Mexicana','Cuajimalpa, CDMX',FALSE,'sin_cita',TRUE),
  ('d0000000-0000-0000-0000-000000000017',
   'Ernesto','Campos','Ibarra','6641000017','7777',
   '1979-09-22','M','Mexicano','Huixquilucan, Edo. Mex.',FALSE,'con_cita',TRUE),
  ('d0000000-0000-0000-0000-000000000018',
   'Claudia','Torres','Medina','6641000018','8888',
   '1983-06-05','F','Mexicana','Miguel Hidalgo, CDMX',FALSE,'sin_cita',TRUE);

-- Visitas en CDMX

-- CUAJIMALPA (id=151) — ~25 min espera (sucursal recomendada en demo)
INSERT INTO visitas (id, id_paciente, id_sucursal, estatus, tipo_paciente,
  id_estudio_actual, progreso_general_pct, timestamp_llegada)
VALUES
  ('e0000000-0000-0000-0000-000000000011',
   'd0000000-0000-0000-0000-000000000011', 151,
   'en_proceso','sin_cita', 2, 0, NOW() - INTERVAL '10 minutes'),
  ('e0000000-0000-0000-0000-000000000016',
   'd0000000-0000-0000-0000-000000000016', 151,
   'en_proceso','sin_cita', 2, 0, NOW() - INTERVAL '5 minutes');

INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus,
  orden_atencion, es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('f0000000-0000-0000-0000-000000000021',
   'e0000000-0000-0000-0000-000000000011', 2, 1, 1, TRUE, 'espera', 0, FALSE),
  ('f0000000-0000-0000-0000-000000000022',
   'e0000000-0000-0000-0000-000000000016', 2, 1, 1, TRUE, 'espera', 0, FALSE);

-- ALVARO OBREGON (id=148) — ~40 min espera
INSERT INTO visitas (id, id_paciente, id_sucursal, estatus, tipo_paciente,
  id_estudio_actual, progreso_general_pct, timestamp_llegada)
VALUES
  ('e0000000-0000-0000-0000-000000000012',
   'd0000000-0000-0000-0000-000000000012', 148,
   'en_proceso','con_cita', 2, 0, NOW() - INTERVAL '25 minutes'),
  ('e0000000-0000-0000-0000-000000000015',
   'd0000000-0000-0000-0000-000000000015', 148,
   'en_proceso','sin_cita', 2, 0, NOW() - INTERVAL '15 minutes');

INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus,
  orden_atencion, es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('f0000000-0000-0000-0000-000000000023',
   'e0000000-0000-0000-0000-000000000012', 2, 2, 1, TRUE, 'inicio_toma', 30, FALSE),
  ('f0000000-0000-0000-0000-000000000024',
   'e0000000-0000-0000-0000-000000000015', 2, 1, 1, TRUE, 'espera', 0, FALSE);

-- ALVARO OBREGON PORTALES (id=283) — ~40 min espera
INSERT INTO visitas (id, id_paciente, id_sucursal, estatus, tipo_paciente,
  id_estudio_actual, progreso_general_pct, timestamp_llegada)
VALUES
  ('e0000000-0000-0000-0000-000000000017',
   'd0000000-0000-0000-0000-000000000017', 283,
   'en_proceso','con_cita', 2, 0, NOW() - INTERVAL '30 minutes');

INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus,
  orden_atencion, es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('f0000000-0000-0000-0000-000000000025',
   'e0000000-0000-0000-0000-000000000017', 2, 2, 1, TRUE, 'inicio_toma', 55, FALSE);

-- HUIXQUILUCAN (id=153) — ~41 min espera
INSERT INTO visitas (id, id_paciente, id_sucursal, estatus, tipo_paciente,
  id_estudio_actual, progreso_general_pct, timestamp_llegada)
VALUES
  ('e0000000-0000-0000-0000-000000000013',
   'd0000000-0000-0000-0000-000000000013', 153,
   'en_proceso','sin_cita', 2, 0, NOW() - INTERVAL '20 minutes');

INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus,
  orden_atencion, es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('f0000000-0000-0000-0000-000000000026',
   'e0000000-0000-0000-0000-000000000013', 2, 1, 1, TRUE, 'espera', 0, FALSE);

-- MIGUEL HIDALGO (id=80) — ~46 min espera
INSERT INTO visitas (id, id_paciente, id_sucursal, estatus, tipo_paciente,
  id_estudio_actual, progreso_general_pct, timestamp_llegada)
VALUES
  ('e0000000-0000-0000-0000-000000000014',
   'd0000000-0000-0000-0000-000000000014', 80,
   'en_proceso','adulto_mayor', 2, 0, NOW() - INTERVAL '35 minutes'),
  ('e0000000-0000-0000-0000-000000000018',
   'd0000000-0000-0000-0000-000000000018', 80,
   'en_proceso','sin_cita', 2, 0, NOW() - INTERVAL '18 minutes');

INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus,
  orden_atencion, es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('f0000000-0000-0000-0000-000000000027',
   'e0000000-0000-0000-0000-000000000014', 2, 2, 1, TRUE, 'inicio_toma', 20, FALSE),
  ('f0000000-0000-0000-0000-000000000028',
   'e0000000-0000-0000-0000-000000000018', 2, 1, 1, TRUE, 'espera', 0, FALSE);

-- Colas CDMX
INSERT INTO colas_en_tiempo_real
  (id_sucursal, id_estudio, pacientes_en_espera, pacientes_en_atencion,
   pacientes_urgentes, pacientes_con_cita, tiempo_espera_estimado_min, ultima_actualizacion)
VALUES
  (151, 2, 2, 0, 0, 0, 25, NOW()),   -- CUAJIMALPA: ~25 min ← la más rápida
  (148, 2, 1, 1, 0, 1, 40, NOW()),   -- ALVARO OBREGON: ~40 min
  (283, 2, 0, 1, 0, 1, 40, NOW()),   -- ALVARO OBREGON PORTALES: ~40 min
  (153, 2, 1, 0, 0, 0, 41, NOW()),   -- HUIXQUILUCAN: ~41 min
  (80,  2, 1, 1, 0, 0, 46, NOW())    -- MIGUEL HIDALGO: ~46 min
ON CONFLICT (id_sucursal, id_estudio) DO UPDATE SET
  pacientes_en_espera        = EXCLUDED.pacientes_en_espera,
  pacientes_en_atencion      = EXCLUDED.pacientes_en_atencion,
  pacientes_urgentes         = EXCLUDED.pacientes_urgentes,
  pacientes_con_cita         = EXCLUDED.pacientes_con_cita,
  tiempo_espera_estimado_min = EXCLUDED.tiempo_espera_estimado_min,
  ultima_actualizacion       = NOW();

-- ================================================================
-- GUIÓN DE DEMO - HACKATHON
-- ================================================================
--
-- CREDENCIALES (para entrar como paciente en la app):
--
--   Andrés Torres    → 6641000001 / 1111  (Lab, espera normal)
--   Laura Mendoza    → 6641000002 / 2222  (Lab, con cita — prioridad media)
--   Don Manuel Ríos  → 6641000003 / 3333  (Lab, adulto mayor — MARCAR URGENTE)
--   Diana Salazar    → 6641000004 / 4444  (Ultrasonido, embarazada)
--   Carlos Ibáñez    → 6641000005 / 5555  (Rayos X, discapacidad — en toma)
--   Sofía Peña       → 6641000006 / 6666  (Lab, sin cita — última en cola)
--   Javier Luna      → 6641000007 / 7777  (Lab→ECG, multi-estudio en toma)
--   Elena Vargas     → 6641000008 / 8888  (Lab COMPLETADO → Ultrasonido)
--
-- PASOS DEL GUIÓN:
--
--  1. FLUJO PACIENTE NUEVO
--     - Abrir app como paciente nuevo, describir síntomas o estudios deseados
--     - La IA recomienda sucursal según ubicación + tiempos de espera
--     - El paciente selecciona estudios y confirma visita
--
--  2. TRACKING EN TIEMPO REAL
--     - Entrar como Javier (7777): ver que está en Laboratorio con 65% de progreso
--     - Mostrar cola de espera, posición, tiempo restante
--     - Mostrar la tarjeta "¿Dónde ir?" con instrucciones de ubicación
--
--  3. DASHBOARD DEL ESPECIALISTA (Lab)
--     - Entrar al dashboard de Laboratorio
--     - Ver la cola: Andrés (sin_cita), Don Manuel (adulto_mayor), Laura (con_cita), Sofía
--     - DEMOSTRAR URGENTE: marcar a Don Manuel como urgente
--     - Observar cómo sube al frente de la cola en tiempo real
--     - Avanzar a Javier: pasar de "inicio_toma" a "completado"
--     - Elena aparece automáticamente en la cola de Ultrasonido
--
--  4. RESULTADOS
--     - Entrar como Elena (8888)
--     - Ver en /resultados que Lab está completado
--     - Demostrar el chat IA sobre el resultado
--     - Descargar la conversación como .txt
--
--  5. ANTES DE IR
--     - Entrar como Andrés (1111) antes de llegar
--     - Ver el orden sugerido, instrucciones de preparación
--     - Tocar "¿Dónde está?" para ver ubicación de Laboratorio
-- ================================================================
