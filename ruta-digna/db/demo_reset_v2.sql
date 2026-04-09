-- ================================================================
-- DEMO RESET v2 — Ejecutar COMPLETO en Supabase → SQL Editor
-- Sucursal demo principal: ÁLVARO OBREGÓN CDMX (id = 25 = OBREGON)
-- ================================================================
--
-- ESPECIALISTAS (dashboard login):
--   LAB-01 / 1234  → Dra. García   — Laboratorio
--   USG-01 / 5678  → Dr. Ramírez   — Ultrasonido
--   RXX-01 / 9012  → Téc. Noriega  — Rayos X
--   ECG-01 / 3456  → Dr. Montoya   — ECG
--   ADM-01 / 0000  → Admin
--
-- PACIENTES (login en la app del paciente):
--   6641000001 / 1111  → Andrés Torres    sin_cita    — LAB  en espera (pos 4)
--   6641000002 / 2222  → Laura Mendoza    con_cita    — LAB  en espera (pos 2)
--   6641000003 / 3333  → Don Manuel Ríos  adulto_mayor— LAB  en espera (pos 1) ← MARCAR URGENTE
--   6641000004 / 4444  → Diana Salazar    embarazada  — USG  en espera (pos 1)
--   6641000005 / 5555  → Carlos Ibáñez    discapacidad— RXX  siendo atendido (INICIO_TOMA)
--   6641000006 / 6666  → Sofía Peña       sin_cita    — LAB  en espera (pos 5)
--   6641000007 / 7777  → Javier Luna      con_cita    — LAB(INICIO_TOMA 60%)→ECG pendiente
--   6641000008 / 8888  → Elena Vargas     adulto_mayor— LAB(VERIFICADO)→USG en espera
--
-- GUIÓN DE DEMO:
--   1. Abrir app → paciente nuevo → IA recomienda sucursal
--   2. Login como Javier (7777): ver pos en cola, instrucciones de Lab
--   3. Dashboard Lab → Finalizar a Javier → él pasa automáticamente a ECG
--      (su front muestra "Electrocardiograma" como estudio actual)
--   4. Dashboard Lab → Marcar urgente a Don Manuel → sube al frente
--      (Andrés, Sofía y Laura ven su posición cambiar en tiempo real)
--   5. Pantalla pública: muestra Carlos como "Llamando" en Rayos X
--   6. Dashboard RXX → Finalizar a Carlos → desaparece de pantalla
--   7. Resultados → Elena tiene Lab completo + puede subir resultado
-- ================================================================


-- ================================================================
-- PASO 1: LIMPIAR DATOS (conserva especialistas, catálogos, guías)
-- ================================================================

TRUNCATE TABLE
  historial_estados_visita_estudio,
  resultados_estudios,
  visita_estudios,
  visitas,
  alertas_sucursal,
  pacientes
RESTART IDENTITY CASCADE;

UPDATE colas_en_tiempo_real SET
  pacientes_en_espera   = 0,
  pacientes_en_atencion = 0,
  pacientes_urgentes    = 0,
  pacientes_con_cita    = 0,
  ultima_actualizacion  = now();


-- ================================================================
-- PASO 2: ESPECIALISTAS para sucursal 25 (OBREGON)
-- ================================================================

DELETE FROM especialistas WHERE id_empleado IN
  ('LAB-01','USG-01','RXX-01','ECG-01','ADM-01');

INSERT INTO especialistas (nombre, id_empleado, pin, rol, id_sucursal, id_estudio)
VALUES
  ('Dra. García',    'LAB-01', '1234', 'especialista', 25, 2),   -- Laboratorio
  ('Dr. Ramírez',    'USG-01', '5678', 'especialista', 25, 6),   -- Ultrasonido
  ('Téc. Noriega',   'RXX-01', '9012', 'especialista', 25, 5),   -- Rayos X
  ('Dr. Montoya',    'ECG-01', '3456', 'especialista', 25, 9),   -- ECG
  ('Admin Demo',     'ADM-01', '0000', 'admin',        25, 2);


-- ================================================================
-- PASO 3: PACIENTES
-- ================================================================

INSERT INTO pacientes (
  id, nombre, primer_apellido, segundo_apellido,
  telefono, pin, fecha_nacimiento, sexo,
  nacionalidad, residencia, discapacidad, tipo_base, sd_registrado
) VALUES

  -- 1. Andrés Torres — sin cita, Lab, esperando
  ('d0000000-0000-0000-0000-000000000001',
   'Andrés','Torres','Vargas','6641000001','1111',
   '1990-06-15','M','Mexicano','Obregón, Sonora',
   FALSE,'sin_cita',TRUE),

  -- 2. Laura Mendoza — con cita, Lab, prioridad media
  ('d0000000-0000-0000-0000-000000000002',
   'Laura','Mendoza','Ríos','6641000002','2222',
   '1985-03-22','F','Mexicana','Obregón, Sonora',
   FALSE,'con_cita',TRUE),

  -- 3. Don Manuel Ríos — adulto mayor, Lab
  --    DEMO: marcar como urgente → sube al frente de la cola
  ('d0000000-0000-0000-0000-000000000003',
   'Manuel','Ríos','Morales','6641000003','3333',
   '1948-09-10','M','Mexicano','Obregón, Sonora',
   FALSE,'adulto_mayor',TRUE),

  -- 4. Diana Salazar — embarazada, Ultrasonido
  ('d0000000-0000-0000-0000-000000000004',
   'Diana','Salazar','Fuentes','6641000004','4444',
   '1997-12-05','F','Mexicana','Obregón, Sonora',
   FALSE,'embarazada',TRUE),

  -- 5. Carlos Ibáñez — discapacidad, Rayos X (ya siendo atendido)
  ('d0000000-0000-0000-0000-000000000005',
   'Carlos','Ibáñez','Ponce','6641000005','5555',
   '1979-04-28','M','Mexicano','Obregón, Sonora',
   TRUE,'discapacidad',TRUE),

  -- 6. Sofía Peña — sin cita, Lab, última en cola
  ('d0000000-0000-0000-0000-000000000006',
   'Sofía','Peña','Castro','6641000006','6666',
   '2002-07-19','F','Mexicana','Obregón, Sonora',
   FALSE,'sin_cita',TRUE),

  -- 7. Javier Luna — con cita, multi-estudio LAB(en toma)→ECG(pendiente)
  ('d0000000-0000-0000-0000-000000000007',
   'Javier','Luna','Estrada','6641000007','7777',
   '1972-01-30','M','Mexicano','Obregón, Sonora',
   FALSE,'con_cita',TRUE),

  -- 8. Elena Vargas — adulto mayor, LAB(completado)→USG(esperando)
  ('d0000000-0000-0000-0000-000000000008',
   'Elena','Vargas','Quiroz','6641000008','8888',
   '1952-11-14','F','Mexicana','Obregón, Sonora',
   FALSE,'adulto_mayor',TRUE);


-- ================================================================
-- PASO 4: VISITAS (todas en OBREGON = id 25)
-- Estatus de visita: 'en_proceso'
-- Estatus de estudios: 1=PAGADO  9=INICIO_TOMA  12=VERIFICADO
-- ================================================================

INSERT INTO visitas (
  id, id_paciente, id_sucursal, estatus, tipo_paciente,
  id_estudio_actual, progreso_general_pct, timestamp_llegada
) VALUES

  -- Andrés: Lab (pos 4 en cola — llegó hace 15 min)
  ('e0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001', 25,
   'en_proceso','sin_cita', 2, 0, NOW() - INTERVAL '15 minutes'),

  -- Laura: Lab con cita (pos 2 — llegó hace 35 min)
  ('e0000000-0000-0000-0000-000000000002',
   'd0000000-0000-0000-0000-000000000002', 25,
   'en_proceso','con_cita', 2, 0, NOW() - INTERVAL '35 minutes'),

  -- Don Manuel: Lab adulto mayor (pos 1 — llegó hace 45 min)
  -- DEMO: marcar urgente → pasa al frente de todos
  ('e0000000-0000-0000-0000-000000000003',
   'd0000000-0000-0000-0000-000000000003', 25,
   'en_proceso','adulto_mayor', 2, 0, NOW() - INTERVAL '45 minutes'),

  -- Diana: Ultrasonido embarazada (pos 1 — llegó hace 10 min)
  ('e0000000-0000-0000-0000-000000000004',
   'd0000000-0000-0000-0000-000000000004', 25,
   'en_proceso','embarazada', 6, 0, NOW() - INTERVAL '10 minutes'),

  -- Carlos: Rayos X en INICIO_TOMA (siendo llamado en pantalla)
  ('e0000000-0000-0000-0000-000000000005',
   'd0000000-0000-0000-0000-000000000005', 25,
   'en_proceso','discapacidad', 5, 0, NOW() - INTERVAL '55 minutes'),

  -- Sofía: Lab sin cita (pos 5 — llegó hace 3 min)
  ('e0000000-0000-0000-0000-000000000006',
   'd0000000-0000-0000-0000-000000000006', 25,
   'en_proceso','sin_cita', 2, 0, NOW() - INTERVAL '3 minutes'),

  -- Javier: Lab→ECG (con cita, en toma de Lab al 60%)
  ('e0000000-0000-0000-0000-000000000007',
   'd0000000-0000-0000-0000-000000000007', 25,
   'en_proceso','con_cita', 2, 0, NOW() - INTERVAL '65 minutes'),

  -- Elena: Lab(completado)→USG (adulto mayor, Lab ya verificado)
  ('e0000000-0000-0000-0000-000000000008',
   'd0000000-0000-0000-0000-000000000008', 25,
   'en_proceso','adulto_mayor', 6, 50, NOW() - INTERVAL '90 minutes');


-- ================================================================
-- PASO 5: VISITA_ESTUDIOS
-- id_estatus VÁLIDOS: 1=PAGADO  9=INICIO_TOMA  10=FIN_TOMA  12=VERIFICADO
-- ================================================================

-- ── Andrés: LABORATORIO (espera, PAGADO) ────────────────────────
INSERT INTO visita_estudios
  (id, id_visita, id_estudio, id_estatus, orden_atencion, es_estudio_actual, paso_actual, progreso_pct)
VALUES
  ('f0000000-0000-0000-0000-000000000001',
   'e0000000-0000-0000-0000-000000000001', 2, 1,
   1, TRUE, 'espera', 0);

-- ── Laura: LABORATORIO (espera, PAGADO, con cita) ───────────────
INSERT INTO visita_estudios
  (id, id_visita, id_estudio, id_estatus, orden_atencion, es_estudio_actual, paso_actual, progreso_pct)
VALUES
  ('f0000000-0000-0000-0000-000000000002',
   'e0000000-0000-0000-0000-000000000002', 2, 1,
   1, TRUE, 'espera', 0);

-- ── Don Manuel: LABORATORIO (espera, PAGADO) ────────────────────
-- *** DEMO: especialista marca urgente → sube al frente ***
INSERT INTO visita_estudios
  (id, id_visita, id_estudio, id_estatus, orden_atencion, es_estudio_actual, paso_actual, progreso_pct)
VALUES
  ('f0000000-0000-0000-0000-000000000003',
   'e0000000-0000-0000-0000-000000000003', 2, 1,
   1, TRUE, 'espera', 0);

-- ── Diana: ULTRASONIDO (espera, PAGADO, embarazada) ─────────────
INSERT INTO visita_estudios
  (id, id_visita, id_estudio, id_estatus, orden_atencion, es_estudio_actual, paso_actual, progreso_pct)
VALUES
  ('f0000000-0000-0000-0000-000000000004',
   'e0000000-0000-0000-0000-000000000004', 6, 1,
   1, TRUE, 'espera', 0);

-- ── Carlos: RAYOS X (INICIO_TOMA — aparece en pantalla como "Llamando") ─
INSERT INTO visita_estudios
  (id, id_visita, id_estudio, id_estatus, orden_atencion, es_estudio_actual, paso_actual, progreso_pct)
VALUES
  ('f0000000-0000-0000-0000-000000000005',
   'e0000000-0000-0000-0000-000000000005', 5, 9,
   1, TRUE, 'inicio_toma', 50);

-- ── Sofía: LABORATORIO (espera, PAGADO, última en cola) ─────────
INSERT INTO visita_estudios
  (id, id_visita, id_estudio, id_estatus, orden_atencion, es_estudio_actual, paso_actual, progreso_pct)
VALUES
  ('f0000000-0000-0000-0000-000000000006',
   'e0000000-0000-0000-0000-000000000006', 2, 1,
   1, TRUE, 'espera', 0);

-- ── Javier: LAB(INICIO_TOMA 60%) → ECG(pendiente) ───────────────
-- Estudio 1: Lab — siendo atendido ahora
-- Estudio 2: ECG — esperará cuando Lab termine
INSERT INTO visita_estudios
  (id, id_visita, id_estudio, id_estatus, orden_atencion, es_estudio_actual, paso_actual, progreso_pct)
VALUES
  ('f0000000-0000-0000-0000-000000000007',
   'e0000000-0000-0000-0000-000000000007', 2, 9,
   1, TRUE,  'inicio_toma', 60),
  ('f0000000-0000-0000-0000-000000000008',
   'e0000000-0000-0000-0000-000000000007', 9, 1,
   2, FALSE, 'espera', 0);

-- ── Elena: LAB(VERIFICADO) → USG(espera, PAGADO) ────────────────
-- Estudio 1: Lab — ya terminó (VERIFICADO, es_estudio_actual=FALSE)
-- Estudio 2: USG — ahora es el actual
INSERT INTO visita_estudios
  (id, id_visita, id_estudio, id_estatus, orden_atencion, es_estudio_actual, paso_actual, progreso_pct)
VALUES
  ('f0000000-0000-0000-0000-000000000009',
   'e0000000-0000-0000-0000-000000000008', 2, 12,
   1, FALSE, 'finalizado', 100),
  ('f0000000-0000-0000-0000-000000000010',
   'e0000000-0000-0000-0000-000000000008', 6, 1,
   2, TRUE,  'espera', 0);


-- ================================================================
-- PASO 6: COLAS EN TIEMPO REAL — OBREGON (id=25)
-- ================================================================

INSERT INTO colas_en_tiempo_real
  (id_sucursal, id_estudio, pacientes_en_espera, pacientes_en_atencion,
   pacientes_urgentes, pacientes_con_cita, ultima_actualizacion)
VALUES
  -- LABORATORIO: Andrés, Laura, Don Manuel, Sofía esperan | Javier en toma
  (25, 2, 4, 1, 0, 1, NOW()),
  -- RAYOS X: Carlos en INICIO_TOMA (aparece en pantalla)
  (25, 5, 0, 1, 0, 0, NOW()),
  -- ULTRASONIDO: Diana y Elena esperando
  (25, 6, 2, 0, 0, 0, NOW()),
  -- ECG: Javier llega cuando termine Lab
  (25, 9, 1, 0, 0, 1, NOW())
ON CONFLICT (id_sucursal, id_estudio) DO UPDATE SET
  pacientes_en_espera   = EXCLUDED.pacientes_en_espera,
  pacientes_en_atencion = EXCLUDED.pacientes_en_atencion,
  pacientes_urgentes    = EXCLUDED.pacientes_urgentes,
  pacientes_con_cita    = EXCLUDED.pacientes_con_cita,
  ultima_actualizacion  = NOW();


-- ================================================================
-- PASO 7: ALERTA activa en Laboratorio (para mostrar en dashboard)
-- ================================================================

INSERT INTO alertas_sucursal (
  id_sucursal, id_estudio, tipo_alerta, titulo, descripcion,
  severidad, impacto_tiempo_min, activa, creada_por
) VALUES (
  25, 2,
  'saturacion',
  'Alta demanda en Laboratorio',
  'Afluencia mayor a lo habitual. Los tiempos de espera pueden extenderse 15 min adicionales.',
  'media', 15, TRUE, 'demo'
);


-- ================================================================
-- PASO 8: PACIENTES CDMX (para demo de recomendación de sucursal)
-- Muestra varias sucursales con distinta carga al recomendar
-- ================================================================

INSERT INTO pacientes (
  id, nombre, primer_apellido, segundo_apellido,
  telefono, pin, fecha_nacimiento, sexo,
  nacionalidad, residencia, discapacidad, tipo_base, sd_registrado
) VALUES
  ('d0000000-0000-0000-0000-000000000011','Ricardo','Fuentes','Mora',
   '6641000011','1111','1988-04-12','M','Mexicano','Cuajimalpa, CDMX',FALSE,'sin_cita',TRUE),
  ('d0000000-0000-0000-0000-000000000012','Gabriela','Ruiz','Soria',
   '6641000012','2222','1993-08-25','F','Mexicana','Álvaro Obregón, CDMX',FALSE,'con_cita',TRUE),
  ('d0000000-0000-0000-0000-000000000013','Héctor','Ávila','Reyes',
   '6641000013','3333','1975-11-30','M','Mexicano','Huixquilucan, EdoMex',FALSE,'sin_cita',TRUE),
  ('d0000000-0000-0000-0000-000000000014','Patricia','Jiménez','Luna',
   '6641000014','4444','1965-02-18','F','Mexicana','Miguel Hidalgo, CDMX',FALSE,'adulto_mayor',TRUE),
  ('d0000000-0000-0000-0000-000000000015','Rodrigo','Salinas','Peña',
   '6641000015','5555','1985-07-09','M','Mexicano','Álvaro Obregón, CDMX',FALSE,'sin_cita',TRUE),
  ('d0000000-0000-0000-0000-000000000016','Mónica','Delgado','Vega',
   '6641000016','6666','1990-03-14','F','Mexicana','Cuajimalpa, CDMX',FALSE,'sin_cita',TRUE),
  ('d0000000-0000-0000-0000-000000000017','Ernesto','Campos','Ibarra',
   '6641000017','7777','1979-09-22','M','Mexicano','Huixquilucan, EdoMex',FALSE,'con_cita',TRUE),
  ('d0000000-0000-0000-0000-000000000018','Claudia','Torres','Medina',
   '6641000018','8888','1983-06-05','F','Mexicana','Miguel Hidalgo, CDMX',FALSE,'sin_cita',TRUE);

-- Visitas CDMX (Lab id=2, para que la recomendación tenga variación de tiempos)
INSERT INTO visitas (id, id_paciente, id_sucursal, estatus, tipo_paciente,
  id_estudio_actual, progreso_general_pct, timestamp_llegada)
VALUES
  -- CUAJIMALPA (id=151): 2 pacientes, ~25 min → sucursal más rápida
  ('e0000000-0000-0000-0000-000000000011','d0000000-0000-0000-0000-000000000011',
   151,'en_proceso','sin_cita',2,0,NOW() - INTERVAL '10 minutes'),
  ('e0000000-0000-0000-0000-000000000016','d0000000-0000-0000-0000-000000000016',
   151,'en_proceso','sin_cita',2,0,NOW() - INTERVAL '5 minutes'),
  -- ALVARO OBREGON (id=148): 4 pacientes, ~40 min
  ('e0000000-0000-0000-0000-000000000012','d0000000-0000-0000-0000-000000000012',
   148,'en_proceso','con_cita',2,0,NOW() - INTERVAL '25 minutes'),
  ('e0000000-0000-0000-0000-000000000015','d0000000-0000-0000-0000-000000000015',
   148,'en_proceso','sin_cita',2,0,NOW() - INTERVAL '15 minutes'),
  -- HUIXQUILUCAN (id=153): 1 paciente, ~20 min
  ('e0000000-0000-0000-0000-000000000013','d0000000-0000-0000-0000-000000000013',
   153,'en_proceso','sin_cita',2,0,NOW() - INTERVAL '8 minutes'),
  -- MIGUEL HIDALGO (id=80): 3 pacientes, ~45 min
  ('e0000000-0000-0000-0000-000000000014','d0000000-0000-0000-0000-000000000014',
   80,'en_proceso','adulto_mayor',2,0,NOW() - INTERVAL '35 minutes'),
  ('e0000000-0000-0000-0000-000000000017','d0000000-0000-0000-0000-000000000017',
   80,'en_proceso','con_cita',2,0,NOW() - INTERVAL '20 minutes'),
  ('e0000000-0000-0000-0000-000000000018','d0000000-0000-0000-0000-000000000018',
   80,'en_proceso','sin_cita',2,0,NOW() - INTERVAL '12 minutes');

INSERT INTO visita_estudios
  (id, id_visita, id_estudio, id_estatus, orden_atencion, es_estudio_actual, paso_actual, progreso_pct)
VALUES
  ('f0000000-0000-0000-0000-000000000021','e0000000-0000-0000-0000-000000000011',2,1,1,TRUE,'espera',0),
  ('f0000000-0000-0000-0000-000000000022','e0000000-0000-0000-0000-000000000016',2,1,1,TRUE,'espera',0),
  ('f0000000-0000-0000-0000-000000000023','e0000000-0000-0000-0000-000000000012',2,9,1,TRUE,'inicio_toma',40),
  ('f0000000-0000-0000-0000-000000000024','e0000000-0000-0000-0000-000000000015',2,1,1,TRUE,'espera',0),
  ('f0000000-0000-0000-0000-000000000025','e0000000-0000-0000-0000-000000000013',2,1,1,TRUE,'espera',0),
  ('f0000000-0000-0000-0000-000000000026','e0000000-0000-0000-0000-000000000014',2,9,1,TRUE,'inicio_toma',30),
  ('f0000000-0000-0000-0000-000000000027','e0000000-0000-0000-0000-000000000017',2,1,1,TRUE,'espera',0),
  ('f0000000-0000-0000-0000-000000000028','e0000000-0000-0000-0000-000000000018',2,1,1,TRUE,'espera',0);

INSERT INTO colas_en_tiempo_real
  (id_sucursal, id_estudio, pacientes_en_espera, pacientes_en_atencion,
   pacientes_urgentes, pacientes_con_cita, ultima_actualizacion)
VALUES
  (151, 2, 2, 0, 0, 0, NOW()),
  (148, 2, 1, 1, 0, 1, NOW()),
  (153, 2, 1, 0, 0, 0, NOW()),
  (80,  2, 2, 1, 0, 1, NOW())
ON CONFLICT (id_sucursal, id_estudio) DO UPDATE SET
  pacientes_en_espera   = EXCLUDED.pacientes_en_espera,
  pacientes_en_atencion = EXCLUDED.pacientes_en_atencion,
  pacientes_urgentes    = EXCLUDED.pacientes_urgentes,
  pacientes_con_cita    = EXCLUDED.pacientes_con_cita,
  ultima_actualizacion  = NOW();


-- ================================================================
-- VERIFICACIÓN FINAL
-- ================================================================

SELECT
  p.nombre,
  p.tipo_base,
  ve.id AS ve_id,
  e.nombre AS estudio,
  es.nombre AS estatus,
  ve.es_estudio_actual,
  ve.progreso_pct,
  s.nombre AS sucursal
FROM pacientes p
JOIN visitas v   ON v.id_paciente = p.id
JOIN sucursales s ON s.id = v.id_sucursal
JOIN visita_estudios ve ON ve.id_visita = v.id
JOIN estudios e    ON e.id = ve.id_estudio
JOIN estatus_servicio es ON es.id = ve.id_estatus
ORDER BY s.nombre, p.nombre, ve.orden_atencion;
