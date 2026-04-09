-- ================================================================
-- SEED DEMO — Flujo completo de sucursal OBREGON (id = 25)
-- Ejecutar en: Supabase → SQL Editor
-- ================================================================
--
-- PACIENTES Y PINS FÁCILES:
--   6671234567 / PIN: 4567  → María González        (adulto mayor)
--   6672345678 / PIN: 5678  → Roberto Martínez      (adulto mayor)
--   6673456789 / PIN: 6789  → Carmen Herrera        (adulto mayor)
--   6674567890 / PIN: 7890  → Luis Ramírez          (discapacidad)
--   6675678901 / PIN: 8901  → Ana Soto              (discapacidad)
--   6676789012 / PIN: 9012  → Sofía Castillo        (sin cita)
--   6677890123 / PIN: 0123  → Valeria Flores        (sin cita)
--   6678901234 / PIN: 1234  → Jorge Mendoza         (con cita)
--
-- ESTUDIOS EN OBREGON:
--   2  = LABORATORIO
--   5  = RAYOS X
--   6  = ULTRASONIDO
--   9  = ELECTROCARDIOGRAMA
--
-- ESTADOS (id_estatus):
--   1 = PAGADO          → en espera en cola
--   2 = ENTRO A DIAGNOSTICO → en atención con especialista
--   3 = SALIO DE DIAGNOSTICO → esperando entrega de resultados
--
-- TIPO_PACIENTE (prioridad):
--   discapacidad > adulto_mayor > embarazada > con_cita > sin_cita
--
-- ================================================================

-- 0. Limpiar datos previos de estos teléfonos (idempotente)
DELETE FROM visitas
WHERE id_paciente IN (
  SELECT id FROM pacientes
  WHERE telefono IN (
    '6671234567','6672345678','6673456789','6674567890',
    '6675678901','6676789012','6677890123','6678901234'
  )
);
DELETE FROM pacientes
WHERE telefono IN (
  '6671234567','6672345678','6673456789','6674567890',
  '6675678901','6676789012','6677890123','6678901234'
);

-- ================================================================
-- 1. PACIENTES
-- ================================================================

INSERT INTO pacientes (id, nombre, primer_apellido, segundo_apellido, telefono, pin,
  fecha_nacimiento, sexo, nacionalidad, residencia, discapacidad, tipo_base, sd_registrado)
VALUES
  -- Adultos mayores (máxima prioridad por edad)
  ('a1000000-0000-0000-0000-000000000001',
   'María','González','López','6671234567','4567',
   '1955-03-12','F','Mexicana','Culiacán, Sinaloa',FALSE,'adulto_mayor',TRUE),

  ('a1000000-0000-0000-0000-000000000002',
   'Roberto','Martínez','Ruiz','6672345678','5678',
   '1950-07-22','M','Mexicano','Culiacán, Sinaloa',FALSE,'adulto_mayor',TRUE),

  ('a1000000-0000-0000-0000-000000000003',
   'Carmen','Herrera','Vega','6673456789','6789',
   '1948-11-05','F','Mexicana','Mazatlán, Sinaloa',FALSE,'adulto_mayor',TRUE),

  -- Pacientes con discapacidad (alta prioridad)
  ('a1000000-0000-0000-0000-000000000004',
   'Luis','Ramírez','Torres','6674567890','7890',
   '1985-05-18','M','Mexicano','Los Mochis, Sinaloa',TRUE,'discapacidad',TRUE),

  ('a1000000-0000-0000-0000-000000000005',
   'Ana','Soto','Medina','6675678901','8901',
   '1992-09-30','F','Mexicana','Culiacán, Sinaloa',TRUE,'discapacidad',TRUE),

  -- Sin cita (prioridad normal)
  ('a1000000-0000-0000-0000-000000000006',
   'Sofía','Castillo','Moreno','6676789012','9012',
   '1998-02-14','F','Mexicana','Culiacán, Sinaloa',FALSE,'sin_cita',TRUE),

  ('a1000000-0000-0000-0000-000000000007',
   'Valeria','Flores','Cruz','6677890123','0123',
   '1995-08-22','F','Mexicana','Mazatlán, Sinaloa',FALSE,'sin_cita',TRUE),

  -- Con cita (paciente conocido)
  ('a1000000-0000-0000-0000-000000000008',
   'Jorge','Mendoza','Silva','6678901234','1234',
   '1978-12-01','M','Mexicano','Tijuana, Baja California',FALSE,'con_cita',TRUE);


-- ================================================================
-- 2. VISITAS  (todas en OBREGON = id 25, en_proceso)
-- ================================================================

INSERT INTO visitas (id, id_paciente, id_sucursal, estatus, tipo_paciente,
  id_estudio_actual, progreso_general_pct, timestamp_llegada)
VALUES
  -- María: LABORATORIO → ULTRASONIDO (primera en espera en lab)
  ('b2000000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001', 25, 'en_proceso', 'adulto_mayor',
   2, 0, NOW() - INTERVAL '35 minutes'),

  -- Roberto: RAYOS X (ya en atención con especialista)
  ('b2000000-0000-0000-0000-000000000002',
   'a1000000-0000-0000-0000-000000000002', 25, 'en_proceso', 'adulto_mayor',
   5, 0, NOW() - INTERVAL '50 minutes'),

  -- Carmen: LABORATORIO (en espera, esta es la que el doctor puede marcar urgente)
  ('b2000000-0000-0000-0000-000000000003',
   'a1000000-0000-0000-0000-000000000003', 25, 'en_proceso', 'adulto_mayor',
   2, 0, NOW() - INTERVAL '25 minutes'),

  -- Luis: LABORATORIO → RAYOS X (con discapacidad, 2do en espera)
  ('b2000000-0000-0000-0000-000000000004',
   'a1000000-0000-0000-0000-000000000004', 25, 'en_proceso', 'discapacidad',
   2, 0, NOW() - INTERVAL '20 minutes'),

  -- Ana: ULTRASONIDO (en espera, discapacidad)
  ('b2000000-0000-0000-0000-000000000005',
   'a1000000-0000-0000-0000-000000000005', 25, 'en_proceso', 'discapacidad',
   6, 0, NOW() - INTERVAL '15 minutes'),

  -- Sofía: LABORATORIO (en espera, sin cita)
  ('b2000000-0000-0000-0000-000000000006',
   'a1000000-0000-0000-0000-000000000006', 25, 'en_proceso', 'sin_cita',
   2, 0, NOW() - INTERVAL '10 minutes'),

  -- Valeria: RAYOS X → ULTRASONIDO (en espera rayos x)
  ('b2000000-0000-0000-0000-000000000007',
   'a1000000-0000-0000-0000-000000000007', 25, 'en_proceso', 'sin_cita',
   5, 0, NOW() - INTERVAL '8 minutes'),

  -- Jorge: LABORATORIO → ELECTROCARDIOGRAMA (ya en atención en lab, con cita)
  ('b2000000-0000-0000-0000-000000000008',
   'a1000000-0000-0000-0000-000000000008', 25, 'en_proceso', 'con_cita',
   2, 0, NOW() - INTERVAL '45 minutes');


-- ================================================================
-- 3. VISITA_ESTUDIOS
-- ================================================================

-- ── María: LABORATORIO (espera) → ULTRASONIDO (pendiente) ──────
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus, orden_atencion,
  es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('c3000000-0000-0000-0000-000000000001',
   'b2000000-0000-0000-0000-000000000001', 2, 1, 1, TRUE,  'espera', 0, FALSE),
  ('c3000000-0000-0000-0000-000000000002',
   'b2000000-0000-0000-0000-000000000001', 6, 1, 2, FALSE, 'espera', 0, FALSE);

-- ── Roberto: RAYOS X (ya en diagnóstico — "en atención") ───────
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus, orden_atencion,
  es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('c3000000-0000-0000-0000-000000000003',
   'b2000000-0000-0000-0000-000000000002', 5, 2, 1, TRUE, 'inicio_toma', 40, FALSE);

-- ── Carmen: LABORATORIO (espera) ───────────────────────────────
-- *** ESTE paciente es el candidato a marcar como URGENTE en la demo ***
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus, orden_atencion,
  es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('c3000000-0000-0000-0000-000000000004',
   'b2000000-0000-0000-0000-000000000003', 2, 1, 1, TRUE, 'espera', 0, FALSE);

-- ── Luis: LABORATORIO (espera) → RAYOS X (pendiente) ──────────
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus, orden_atencion,
  es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('c3000000-0000-0000-0000-000000000005',
   'b2000000-0000-0000-0000-000000000004', 2, 1, 1, TRUE,  'espera', 0, FALSE),
  ('c3000000-0000-0000-0000-000000000006',
   'b2000000-0000-0000-0000-000000000004', 5, 1, 2, FALSE, 'espera', 0, FALSE);

-- ── Ana: ULTRASONIDO (espera) ──────────────────────────────────
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus, orden_atencion,
  es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('c3000000-0000-0000-0000-000000000007',
   'b2000000-0000-0000-0000-000000000005', 6, 1, 1, TRUE, 'espera', 0, FALSE);

-- ── Sofía: LABORATORIO (espera) ────────────────────────────────
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus, orden_atencion,
  es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('c3000000-0000-0000-0000-000000000008',
   'b2000000-0000-0000-0000-000000000006', 2, 1, 1, TRUE, 'espera', 0, FALSE);

-- ── Valeria: RAYOS X (espera) → ULTRASONIDO (pendiente) ────────
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus, orden_atencion,
  es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('c3000000-0000-0000-0000-000000000009',
   'b2000000-0000-0000-0000-000000000007', 5, 1, 1, TRUE,  'espera', 0, FALSE),
  ('c3000000-0000-0000-0000-000000000010',
   'b2000000-0000-0000-0000-000000000007', 6, 1, 2, FALSE, 'espera', 0, FALSE);

-- ── Jorge: LABORATORIO (en toma — en atención) → ECG (pendiente)
INSERT INTO visita_estudios (id, id_visita, id_estudio, id_estatus, orden_atencion,
  es_estudio_actual, paso_actual, progreso_pct, es_urgente)
VALUES
  ('c3000000-0000-0000-0000-000000000011',
   'b2000000-0000-0000-0000-000000000008', 2, 2, 1, TRUE,  'inicio_toma', 50, FALSE),
  ('c3000000-0000-0000-0000-000000000012',
   'b2000000-0000-0000-0000-000000000008', 9, 1, 2, FALSE, 'espera', 0, FALSE);


-- ================================================================
-- 4. COLAS EN TIEMPO REAL — OBREGON (id=25)
-- ================================================================

INSERT INTO colas_en_tiempo_real
  (id_sucursal, id_estudio, pacientes_en_espera, pacientes_en_atencion,
   pacientes_urgentes, pacientes_con_cita, tiempo_espera_estimado_min, ultima_actualizacion)
VALUES
  -- LABORATORIO: 4 esperando (María, Carmen, Luis, Sofía), 1 en atención (Jorge)
  (25, 2, 4, 1, 0, 1, 40, NOW()),
  -- RAYOS X: 2 esperando (Valeria, el pendiente de Luis), 1 en atención (Roberto)
  (25, 5, 2, 1, 0, 0, 25, NOW()),
  -- ULTRASONIDO: 2 esperando (Ana, pendiente de María y Valeria)
  (25, 6, 2, 0, 0, 0, 30, NOW()),
  -- ELECTROCARDIOGRAMA: 1 pendiente (Jorge después del lab)
  (25, 9, 1, 0, 0, 1, 15, NOW())
ON CONFLICT (id_sucursal, id_estudio) DO UPDATE SET
  pacientes_en_espera   = EXCLUDED.pacientes_en_espera,
  pacientes_en_atencion = EXCLUDED.pacientes_en_atencion,
  pacientes_urgentes    = EXCLUDED.pacientes_urgentes,
  pacientes_con_cita    = EXCLUDED.pacientes_con_cita,
  tiempo_espera_estimado_min = EXCLUDED.tiempo_espera_estimado_min,
  ultima_actualizacion  = NOW();


-- ================================================================
-- RESUMEN DE LA DEMO
-- ================================================================
-- FLUJOS A DEMOSTRAR:
--
-- 1. COLA LABORATORIO (4 esperando):
--    Orden actual por prioridad:
--      1. María González   (adulto_mayor)  — 35 min esperando
--      2. Carmen Herrera   (adulto_mayor)  — 25 min esperando  ← MARCAR URGENTE
--      3. Luis Ramírez     (discapacidad)  — 20 min esperando
--      4. Sofía Castillo   (sin_cita)      — 10 min esperando
--    Jorge Mendoza (con_cita) ya está en toma.
--
-- 2. DEMOSTRAR URGENTE:
--    El doctor marca a Carmen (6673456789 / PIN 6789) como urgente.
--    Carmen sube al frente de la cola, adelantando a todos los que esperaban.
--    El dashboard de Laboratorio actualiza el orden en tiempo real.
--
-- 3. COLA RAYOS X:
--    Valeria espera. Roberto ya está en diagnóstico.
--    Cuando Roberto termine, Valeria pasa. Después Luis (multi-estudio).
--
-- 4. COLA ULTRASONIDO:
--    Ana espera. Cuando terminen en Lab, María y Valeria llegarán aquí.
--
-- 5. FLUJO MULTI-ESTUDIO (Jorge: Lab → ECG):
--    El dashboard muestra avance: cuando el especialista de Lab avanza
--    a Jorge, automáticamente aparece en la cola de ECG.
-- ================================================================
