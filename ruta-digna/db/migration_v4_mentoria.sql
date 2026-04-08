-- ============================================================
-- RUTA DIGNA — Migración v4: Cambios post-mentoría
-- Hackathon Talent Land 2026 · Track Salud Digna
--
-- CAMBIOS:
-- 1. Expandir tipo_paciente (embarazada, adulto_mayor, discapacidad)
-- 2. Tabla guias_navegacion_sucursal (wayfinding)
-- 3. Tabla alertas_sucursal (imprevistos del doctor/operador)
-- 4. Tabla categorias_estudio (agrupación libre vs bloqueada)
-- 5. Vista v_cola_priorizada (orden real de atención)
--
-- EJECUTAR EN: Supabase → SQL Editor → New Query
-- DESPUÉS de schema_ruta_digna_v3.sql
-- ============================================================


-- ============================================================
-- 1. EXPANDIR tipo_paciente EN visitas
-- Nuevo orden de prioridad:
--   urgente > embarazada > adulto_mayor > discapacidad > con_cita > sin_cita
-- ============================================================

-- Primero quitar el constraint viejo
alter table visitas drop constraint if exists visitas_tipo_paciente_valido;

-- Agregar el nuevo con más opciones
alter table visitas add constraint visitas_tipo_paciente_valido check (
  tipo_paciente in (
    'urgente',
    'embarazada',
    'adulto_mayor',
    'discapacidad',
    'con_cita',
    'sin_cita'
  )
);

-- Actualizar la vista de visitas activas para el nuevo orden
create or replace view v_visitas_activas as
select
  v.id                                          as visita_id,
  p.nombre                                      as paciente,
  s.nombre                                      as sucursal,
  v.tipo_paciente,
  v.estatus,
  v.progreso_general_pct,
  e_actual.nombre                               as estudio_actual,
  e_sig.nombre                                  as estudio_siguiente,
  fn_calcular_tiempo_espera_visita(v.id)        as tiempo_espera_total_min,
  v.timestamp_llegada,
  round(extract(epoch from (now() - v.timestamp_llegada)) / 60)::integer
                                                as minutos_en_clinica,
  (select count(*) from visita_estudios ve2
   where ve2.id_visita = v.id)::integer         as total_estudios,
  (select count(*) from visita_estudios ve2
   join estatus_servicio es2 on es2.id = ve2.id_estatus
   where ve2.id_visita = v.id and es2.es_estado_final = true
  )::integer                                    as estudios_completados
from visitas v
join pacientes p      on p.id = v.id_paciente
join sucursales s     on s.id = v.id_sucursal
left join estudios e_actual on e_actual.id = v.id_estudio_actual
left join estudios e_sig    on e_sig.id    = v.id_estudio_siguiente
where v.estatus = 'en_proceso'
order by
  case v.tipo_paciente
    when 'urgente'       then 1
    when 'embarazada'    then 2
    when 'adulto_mayor'  then 3
    when 'discapacidad'  then 4
    when 'con_cita'      then 5
    when 'sin_cita'      then 6
  end,
  v.timestamp_llegada asc;

comment on view v_visitas_activas is 'Visitas en proceso. Prioridad: urgente > embarazada > adulto_mayor > discapacidad > con_cita > sin_cita.';


-- ============================================================
-- 2. GUÍAS DE NAVEGACIÓN POR SUCURSAL (wayfinding)
-- Cada sucursal define dónde está cada área/estudio
-- ============================================================

create table if not exists guias_navegacion_sucursal (
  id              uuid        primary key default uuid_generate_v4(),
  id_sucursal     integer     not null references sucursales(id) on delete cascade,
  id_estudio      integer     not null references estudios(id) on delete restrict,
  nombre_area     text        not null,
  ubicacion       text        not null,
  piso            integer     not null default 1,
  instrucciones   text,
  referencia      text,
  activa          boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint guias_unique unique (id_sucursal, id_estudio),
  constraint guias_nombre_not_empty check (char_length(trim(nombre_area)) > 0)
);

create index idx_guias_sucursal on guias_navegacion_sucursal(id_sucursal);
comment on table guias_navegacion_sucursal is 'Instrucciones de navegación dentro de cada sucursal. Cada sucursal tiene su propio layout.';

-- RLS: lectura pública, escritura solo backend
alter table guias_navegacion_sucursal enable row level security;
create policy "pub_read_guias" on guias_navegacion_sucursal for select using (activa = true);
create policy "backend_guias"  on guias_navegacion_sucursal for all using (auth.role() = 'service_role');


-- Datos semilla: Sucursal Culiacán (id=1)
insert into guias_navegacion_sucursal
  (id_sucursal, id_estudio, nombre_area, ubicacion, piso, instrucciones, referencia)
values
  (1, 2,  'Toma de sangre',    'Sala 1, planta baja',     1,
   'Desde recepción, camina por el pasillo principal a la derecha. La sala de toma de sangre está al fondo, junto a la ventanilla de pagos.',
   'Al lado de la ventanilla de pagos'),
  (1, 6,  'Ultrasonido',       'Sala 3, planta baja',     1,
   'Desde recepción, toma el pasillo izquierdo. Ultrasonido es la tercera puerta a la derecha.',
   'Frente al área de espera principal'),
  (1, 5,  'Rayos X',           'Sala 2, planta baja',     1,
   'Desde recepción, camina por el pasillo principal. Rayos X está señalizado con letrero azul a la izquierda.',
   'Al lado de Densitometría'),
  (1, 1,  'Densitometría',     'Sala 2-B, planta baja',   1,
   'Junto a Rayos X, en la misma ala izquierda del pasillo principal.',
   'Al lado de Rayos X'),
  (1, 3,  'Mastografía',       'Sala 4, planta baja',     1,
   'Desde recepción, pasillo izquierdo hasta el fondo. Última puerta a la derecha.',
   'Al fondo del pasillo izquierdo'),
  (1, 4,  'Papanicolaou',      'Consultorio 5, planta baja', 1,
   'Desde recepción, pasillo derecho. Segundo consultorio a la izquierda.',
   'Segundo consultorio pasillo derecho'),
  (1, 9,  'Electrocardiograma','Consultorio 3, planta baja', 1,
   'Desde recepción, pasillo derecho. Primer consultorio a la derecha.',
   'Primer consultorio pasillo derecho'),
  (1, 11, 'Tomografía',        'Área de imagen, planta baja', 1,
   'Al fondo del pasillo principal, área restringida señalizada. Presentarte en el mostrador de imagen.',
   'Área de imagen al fondo'),
  (1, 12, 'Resonancia Magnética','Área de imagen, planta baja', 1,
   'Mismo pasillo que Tomografía, al fondo. Señalización de RM visible.',
   'Junto a Tomografía'),
  (1, 16, 'Nutrición',         'Consultorio 7, primer piso', 2,
   'Sube las escaleras o usa el elevador. Consultorio 7, segundo pasillo a la izquierda.',
   'Primer piso, segundo pasillo');

-- Datos semilla: Sucursal Los Mochis (id=5) — layout diferente
insert into guias_navegacion_sucursal
  (id_sucursal, id_estudio, nombre_area, ubicacion, piso, instrucciones, referencia)
values
  (5, 2,  'Laboratorio',       'Planta baja, ala norte',  1,
   'Al entrar gira a la izquierda. Laboratorio está al final del pasillo norte.',
   'Ala norte, al fondo'),
  (5, 5,  'Rayos X',           'Planta baja, ala sur',    1,
   'Al entrar gira a la derecha. Rayos X es la segunda puerta.',
   'Ala sur, segunda puerta'),
  (5, 6,  'Ultrasonido',       'Planta baja, ala sur',    1,
   'Mismo pasillo que Rayos X, tercera puerta.',
   'Ala sur, tercera puerta'),
  (5, 9,  'Electrocardiograma','Planta baja, ala norte',  1,
   'Junto a Laboratorio, primera puerta antes del fondo.',
   'Ala norte, junto a Lab');

-- Datos semilla: Sucursal Mazatlán (id=6)
insert into guias_navegacion_sucursal
  (id_sucursal, id_estudio, nombre_area, ubicacion, piso, instrucciones, referencia)
values
  (6, 2,  'Laboratorio',       'Sala A, planta baja',     1,
   'Entra y sigue derecho por el pasillo central. Laboratorio es la primera sala a la derecha.',
   'Primera sala pasillo central'),
  (6, 3,  'Mastografía',       'Sala B, planta baja',     1,
   'Pasillo central, segunda puerta a la izquierda.',
   'Segunda puerta izquierda'),
  (6, 5,  'Rayos X',           'Sala C, planta baja',     1,
   'Al fondo del pasillo central, señalización visible.',
   'Al fondo'),
  (6, 6,  'Ultrasonido',       'Sala D, planta baja',     1,
   'Junto a Rayos X, al fondo del pasillo central.',
   'Junto a Rayos X');


-- ============================================================
-- 3. ALERTAS DE SUCURSAL (imprevistos)
-- El doctor/operador registra problemas que afectan colas
-- ============================================================

create table if not exists alertas_sucursal (
  id              uuid        primary key default uuid_generate_v4(),
  id_sucursal     integer     not null references sucursales(id) on delete cascade,
  id_estudio      integer     references estudios(id) on delete set null,
  tipo_alerta     text        not null,
  titulo          text        not null,
  descripcion     text,
  severidad       text        not null default 'media',
  impacto_tiempo_min integer not null default 0,
  activa          boolean     not null default true,
  creada_por      text        not null default 'operador',
  resuelta_por    text,
  timestamp_inicio timestamptz not null default now(),
  timestamp_resolucion timestamptz,
  created_at      timestamptz not null default now(),

  constraint alertas_tipo_valido check (
    tipo_alerta in (
      'equipo_averiado',
      'personal_ausente',
      'emergencia_medica',
      'retraso_general',
      'cierre_temporal',
      'saturacion',
      'otro'
    )
  ),
  constraint alertas_severidad_valida check (
    severidad in ('baja', 'media', 'alta', 'critica')
  )
);

create index idx_alertas_sucursal       on alertas_sucursal(id_sucursal);
create index idx_alertas_activas        on alertas_sucursal(id_sucursal, activa) where activa = true;
create index idx_alertas_estudio        on alertas_sucursal(id_estudio) where id_estudio is not null;
comment on table alertas_sucursal is 'Alertas de imprevistos registradas por el operador. Afectan tiempos estimados y notificaciones.';

-- RLS
alter table alertas_sucursal enable row level security;
create policy "pub_read_alertas"  on alertas_sucursal for select using (true);
create policy "backend_alertas"   on alertas_sucursal for all using (auth.role() = 'service_role');

-- Alerta de prueba
insert into alertas_sucursal
  (id_sucursal, id_estudio, tipo_alerta, titulo, descripcion, severidad, impacto_tiempo_min)
values
  (1, 6, 'equipo_averiado', 'Ultrasonido Sala 3 en mantenimiento',
   'El equipo de ultrasonido de la sala 3 está en mantenimiento preventivo. Se atiende solo en sala 2.',
   'media', 15);


-- ============================================================
-- 4. FUNCIÓN: obtener guía de navegación para una visita
-- Retorna instrucciones de wayfinding para cada estudio
-- ============================================================

create or replace function fn_obtener_guia_visita(p_visita_id uuid)
returns jsonb language plpgsql stable as $$
declare
  v_id_sucursal integer;
  v_resultado   jsonb;
begin
  select id_sucursal into v_id_sucursal
  from visitas where id = p_visita_id;

  if v_id_sucursal is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'orden',          ve.orden_atencion,
      'id_estudio',     ve.id_estudio,
      'nombre_estudio', e.nombre,
      'es_actual',      ve.es_estudio_actual,
      'nombre_area',    coalesce(g.nombre_area, e.nombre),
      'ubicacion',      coalesce(g.ubicacion, 'Consulta en recepción'),
      'piso',           coalesce(g.piso, 1),
      'instrucciones',  coalesce(g.instrucciones, 'Pregunta en recepción por la ubicación de ' || e.nombre),
      'referencia',     g.referencia
    ) order by ve.orden_atencion
  ), '[]'::jsonb) into v_resultado
  from visita_estudios ve
  join estudios e on e.id = ve.id_estudio
  left join guias_navegacion_sucursal g
    on g.id_sucursal = v_id_sucursal
    and g.id_estudio = ve.id_estudio
    and g.activa = true
  where ve.id_visita = p_visita_id;

  return v_resultado;
end;
$$;

comment on function fn_obtener_guia_visita is 'Devuelve instrucciones de navegación dentro de la sucursal para cada estudio de la visita.';


-- ============================================================
-- 5. FUNCIÓN: obtener alertas activas de una sucursal
-- ============================================================

create or replace function fn_obtener_alertas_sucursal(p_id_sucursal integer)
returns jsonb language plpgsql stable as $$
begin
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',              a.id,
        'tipo_alerta',     a.tipo_alerta,
        'titulo',          a.titulo,
        'descripcion',     a.descripcion,
        'severidad',       a.severidad,
        'impacto_tiempo_min', a.impacto_tiempo_min,
        'estudio_afectado', e.nombre,
        'id_estudio',      a.id_estudio,
        'timestamp_inicio', a.timestamp_inicio
      ) order by
        case a.severidad
          when 'critica' then 1
          when 'alta'    then 2
          when 'media'   then 3
          when 'baja'    then 4
        end
    )
    from alertas_sucursal a
    left join estudios e on e.id = a.id_estudio
    where a.id_sucursal = p_id_sucursal
      and a.activa = true
  ), '[]'::jsonb);
end;
$$;


-- ============================================================
-- 6. FUNCIÓN: estudios reordenables por el paciente
-- Devuelve cuáles estudios puede reordenar libremente
-- ============================================================

create or replace function fn_estudios_reordenables(p_ids_estudios integer[])
returns jsonb language plpgsql stable as $$
declare
  v_bloqueados jsonb := '[]'::jsonb;
  v_libres     jsonb := '[]'::jsonb;
  v_id         integer;
  v_tiene_regla boolean;
begin
  foreach v_id in array p_ids_estudios loop
    -- Verificar si este estudio tiene alguna regla que lo bloquee
    select exists(
      select 1 from reglas_orden_estudios r
      where r.activa = true
        and r.es_obligatorio = true
        and (r.id_estudio_primero = v_id or r.id_estudio_segundo = v_id)
        and (r.id_estudio_primero = any(p_ids_estudios)
             and r.id_estudio_segundo = any(p_ids_estudios))
    ) into v_tiene_regla;

    if v_tiene_regla then
      v_bloqueados := v_bloqueados || jsonb_build_object(
        'id_estudio', v_id,
        'nombre', (select nombre from estudios where id = v_id),
        'reordenable', false,
        'motivo', 'Tiene dependencia con otro estudio de tu visita'
      );
    else
      v_libres := v_libres || jsonb_build_object(
        'id_estudio', v_id,
        'nombre', (select nombre from estudios where id = v_id),
        'reordenable', true
      );
    end if;
  end loop;

  return jsonb_build_object(
    'bloqueados', v_bloqueados,
    'libres', v_libres,
    'nota', 'Los estudios bloqueados tienen un orden obligatorio. Los libres puedes hacerlos en el orden que prefieras.'
  );
end;
$$;

comment on function fn_estudios_reordenables is 'Indica cuáles estudios puede reordenar el paciente libremente y cuáles tienen orden obligatorio.';


-- ============================================================
-- 7. ACTUALIZAR fn_obtener_estado_visita para incluir
--    guía de navegación y alertas
-- ============================================================

create or replace function fn_obtener_estado_visita(p_visita_id uuid)
returns jsonb language plpgsql stable as $$
declare
  v_resultado jsonb;
  v_id_sucursal integer;
begin
  -- Obtener sucursal
  select id_sucursal into v_id_sucursal
  from visitas where id = p_visita_id;

  select jsonb_build_object(
    'visita_id',            v.id,
    'paciente',             p.nombre,
    'sucursal',             s.nombre,
    'ciudad',               s.ciudad,
    'estatus',              v.estatus,
    'tipo_paciente',        v.tipo_paciente,
    'progreso_general_pct', v.progreso_general_pct,
    'tiempo_espera_total_min', fn_calcular_tiempo_espera_visita(v.id),
    'timestamp_llegada',    v.timestamp_llegada,
    'estudio_actual', (
      select jsonb_build_object(
        'id_estudio',   ve.id_estudio,
        'nombre',       e.nombre,
        'paso_actual',  ve.paso_actual,
        'progreso_pct', ve.progreso_pct,
        'estatus',      es.nombre,
        'guia', jsonb_build_object(
          'nombre_area',    coalesce(g.nombre_area, e.nombre),
          'ubicacion',      coalesce(g.ubicacion, 'Consulta en recepción'),
          'piso',           coalesce(g.piso, 1),
          'instrucciones',  coalesce(g.instrucciones, 'Pregunta en recepción'),
          'referencia',     g.referencia
        )
      )
      from visita_estudios ve
      join estudios e on e.id = ve.id_estudio
      join estatus_servicio es on es.id = ve.id_estatus
      left join guias_navegacion_sucursal g
        on g.id_sucursal = v.id_sucursal
        and g.id_estudio = ve.id_estudio
        and g.activa = true
      where ve.id_visita = v.id and ve.es_estudio_actual = true
      limit 1
    ),
    'estudios', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'orden',              ve.orden_atencion,
          'id_estudio',         ve.id_estudio,
          'id_visita_estudio',  ve.id,
          'nombre',             e.nombre,
          'estatus',            es.nombre,
          'es_estado_final',    es.es_estado_final,
          'es_actual',          ve.es_estudio_actual,
          'progreso_pct',       ve.progreso_pct,
          'tiempo_espera_min',  fn_calcular_tiempo_espera(v.id_sucursal, ve.id_estudio),
          'preparacion',        e.preparacion_instrucciones,
          'guia', jsonb_build_object(
            'nombre_area',    coalesce(g.nombre_area, e.nombre),
            'ubicacion',      coalesce(g.ubicacion, 'Consulta en recepción'),
            'piso',           coalesce(g.piso, 1),
            'instrucciones',  coalesce(g.instrucciones, 'Pregunta en recepción'),
            'referencia',     g.referencia
          )
        ) order by ve.orden_atencion
      ), '[]'::jsonb)
      from visita_estudios ve
      join estudios e on e.id = ve.id_estudio
      join estatus_servicio es on es.id = ve.id_estatus
      left join guias_navegacion_sucursal g
        on g.id_sucursal = v.id_sucursal
        and g.id_estudio = ve.id_estudio
        and g.activa = true
      where ve.id_visita = v.id
    ),
    'alertas_sucursal', fn_obtener_alertas_sucursal(v.id_sucursal)
  ) into v_resultado
  from visitas v
  join pacientes p  on p.id = v.id_paciente
  join sucursales s on s.id = v.id_sucursal
  where v.id = p_visita_id;

  return v_resultado;
end;
$$;
