-- ================================================================
-- SEED: Pacientes de demo para el hackathon
-- Ejecutar en Supabase SQL Editor
-- Sucursal 1 = Culiacán Centro
-- ================================================================

-- ── Pacientes ────────────────────────────────────────────────────
insert into pacientes (id, nombre, email, telefono) values
('00000000-0000-0000-0000-000000000002', 'Carlos Ramírez',    'carlos@demo.com',   '6672345678'),
('00000000-0000-0000-0000-000000000003', 'Ana Martínez',      'ana@demo.com',      '6673456789'),
('00000000-0000-0000-0000-000000000004', 'Roberto López',     'roberto@demo.com',  '6674567890'),
('00000000-0000-0000-0000-000000000005', 'Sofía Herrera',     'sofia@demo.com',    '6675678901'),
('00000000-0000-0000-0000-000000000006', 'Jorge Mendoza',     'jorge@demo.com',    '6676789012'),
('00000000-0000-0000-0000-000000000007', 'Lucía Flores',      'lucia@demo.com',    '6677890123'),
('00000000-0000-0000-0000-000000000008', 'Miguel Castillo',   'miguel@demo.com',   '6678901234'),
('00000000-0000-0000-0000-000000000009', 'Patricia Vega',     'patricia@demo.com', '6679012345')
on conflict (id) do nothing;

-- ── Visitas ──────────────────────────────────────────────────────
-- Estudios disponibles en Culiacán (sucursal 1):
--   2=LABORATORIO, 5=RAYOS X, 6=ULTRASONIDO, 9=ELECTROCARDIOGRAMA
--   1=DENSITOMETRÍA, 3=MASTOGRAFÍA, 4=PAPANICOLAOU, 11=TOMOGRAFÍA, 12=RESONANCIA, 16=NUTRICIÓN

-- Urgente: Laboratorio + Electrocardiograma
select fn_crear_visita(
  '00000000-0000-0000-0000-000000000002'::uuid,
  1, ARRAY[2, 9], 'urgente'
);

-- Embarazada: Ultrasonido + Laboratorio (sistema reordena: Lab primero)
select fn_crear_visita(
  '00000000-0000-0000-0000-000000000003'::uuid,
  1, ARRAY[6, 2], 'embarazada'
);

-- Adulto mayor: Rayos X + Densitometría
select fn_crear_visita(
  '00000000-0000-0000-0000-000000000004'::uuid,
  1, ARRAY[5, 1], 'adulto_mayor'
);

-- Con cita: Papanicolaou + Ultrasonido (sistema reordena: Papa primero)
select fn_crear_visita(
  '00000000-0000-0000-0000-000000000005'::uuid,
  1, ARRAY[6, 4], 'con_cita'
);

-- Discapacidad: Laboratorio + Rayos X
select fn_crear_visita(
  '00000000-0000-0000-0000-000000000006'::uuid,
  1, ARRAY[2, 5], 'discapacidad'
);

-- Sin cita: solo Laboratorio
select fn_crear_visita(
  '00000000-0000-0000-0000-000000000007'::uuid,
  1, ARRAY[2], 'sin_cita'
);

-- Sin cita: Ultrasonido + Electrocardiograma + Nutrición
select fn_crear_visita(
  '00000000-0000-0000-0000-000000000008'::uuid,
  1, ARRAY[6, 9, 16], 'sin_cita'
);

-- Con cita: Densitometría + Tomografía (sistema reordena: Densito primero)
select fn_crear_visita(
  '00000000-0000-0000-0000-000000000009'::uuid,
  1, ARRAY[11, 1], 'con_cita'
);
