-- ================================================================
-- PATCH: Sincronización en tiempo real de colas y tiempos
-- Ejecutar en Supabase → SQL Editor
-- ================================================================


-- ── 1. fn_sincronizar_colas ──────────────────────────────────────
-- Recalcula colas_en_tiempo_real desde los datos reales de visitas.
-- Llamar después de: crear visita, avanzar estudio, cambiar prioridad.
-- ----------------------------------------------------------------
create or replace function fn_sincronizar_colas(p_id_sucursal integer)
returns void language plpgsql as $$
begin
  -- Actualizar filas existentes
  update colas_en_tiempo_real cr set
    pacientes_en_espera = (
      select count(distinct ve.id_visita)
      from   visita_estudios ve
      join   visitas v          on v.id   = ve.id_visita
      join   estatus_servicio es on es.id = ve.id_estatus
      where  v.id_sucursal       = p_id_sucursal
        and  ve.id_estudio        = cr.id_estudio
        and  es.es_estado_final   = false
        and  v.estatus            = 'en_proceso'
    ),
    pacientes_en_atencion = (
      select count(distinct ve.id_visita)
      from   visita_estudios ve
      join   visitas v on v.id = ve.id_visita
      where  v.id_sucursal     = p_id_sucursal
        and  ve.id_estudio      = cr.id_estudio
        and  ve.es_estudio_actual = true
        and  v.estatus           = 'en_proceso'
    ),
    pacientes_urgentes = (
      select count(distinct ve.id_visita)
      from   visita_estudios ve
      join   visitas v          on v.id   = ve.id_visita
      join   estatus_servicio es on es.id = ve.id_estatus
      where  v.id_sucursal       = p_id_sucursal
        and  ve.id_estudio        = cr.id_estudio
        and  es.es_estado_final   = false
        and  v.estatus            = 'en_proceso'
        and  v.tipo_paciente in ('urgente','embarazada','adulto_mayor','discapacidad')
    ),
    pacientes_con_cita = (
      select count(distinct ve.id_visita)
      from   visita_estudios ve
      join   visitas v          on v.id   = ve.id_visita
      join   estatus_servicio es on es.id = ve.id_estatus
      where  v.id_sucursal       = p_id_sucursal
        and  ve.id_estudio        = cr.id_estudio
        and  es.es_estado_final   = false
        and  v.estatus            = 'en_proceso'
        and  v.tipo_paciente      = 'con_cita'
    ),
    ultima_actualizacion = now()
  where cr.id_sucursal = p_id_sucursal;

  -- Insertar filas faltantes (estudios sin fila en la tabla)
  insert into colas_en_tiempo_real
    (id_sucursal, id_estudio,
     pacientes_en_espera, pacientes_en_atencion,
     pacientes_urgentes, pacientes_con_cita, ultima_actualizacion)
  select
    p_id_sucursal,
    cp.id_estudio,
    coalesce((
      select count(distinct ve.id_visita)
      from   visita_estudios ve
      join   visitas v          on v.id   = ve.id_visita
      join   estatus_servicio es on es.id = ve.id_estatus
      where  v.id_sucursal = p_id_sucursal and ve.id_estudio = cp.id_estudio
        and  es.es_estado_final = false and v.estatus = 'en_proceso'
    ), 0),
    coalesce((
      select count(distinct ve.id_visita)
      from   visita_estudios ve
      join   visitas v on v.id = ve.id_visita
      where  v.id_sucursal = p_id_sucursal and ve.id_estudio = cp.id_estudio
        and  ve.es_estudio_actual = true and v.estatus = 'en_proceso'
    ), 0),
    coalesce((
      select count(distinct ve.id_visita)
      from   visita_estudios ve
      join   visitas v          on v.id   = ve.id_visita
      join   estatus_servicio es on es.id = ve.id_estatus
      where  v.id_sucursal = p_id_sucursal and ve.id_estudio = cp.id_estudio
        and  es.es_estado_final = false and v.estatus = 'en_proceso'
        and  v.tipo_paciente in ('urgente','embarazada','adulto_mayor','discapacidad')
    ), 0),
    coalesce((
      select count(distinct ve.id_visita)
      from   visita_estudios ve
      join   visitas v          on v.id   = ve.id_visita
      join   estatus_servicio es on es.id = ve.id_estatus
      where  v.id_sucursal = p_id_sucursal and ve.id_estudio = cp.id_estudio
        and  es.es_estado_final = false and v.estatus = 'en_proceso'
        and  v.tipo_paciente = 'con_cita'
    ), 0),
    now()
  from  consultorios_por_sucursal cp
  where cp.id_sucursal = p_id_sucursal
    and not exists (
      select 1 from colas_en_tiempo_real cr
      where cr.id_sucursal = p_id_sucursal and cr.id_estudio = cp.id_estudio
    );
end;
$$;


-- ── 2. fn_posicion_en_cola ───────────────────────────────────────
-- Devuelve cuántos pacientes van ANTES que este paciente
-- en la cola de un estudio específico, respetando prioridad y llegada.
-- ----------------------------------------------------------------
create or replace function fn_posicion_en_cola(
  p_id_visita  uuid,
  p_id_estudio integer
)
returns integer language plpgsql stable as $$
declare
  v_id_sucursal   integer;
  v_tipo_paciente text;
  v_llegada       timestamptz;
  v_posicion      integer;
begin
  select id_sucursal, tipo_paciente, timestamp_llegada
  into   v_id_sucursal, v_tipo_paciente, v_llegada
  from   visitas where id = p_id_visita;

  if not found then return 1; end if;

  -- Contar pacientes con mayor prioridad o misma prioridad + llegada anterior
  select count(distinct v2.id) + 1
  into   v_posicion
  from   visita_estudios ve2
  join   visitas v2          on v2.id   = ve2.id_visita
  join   estatus_servicio es2 on es2.id = ve2.id_estatus
  where  v2.id_sucursal      = v_id_sucursal
    and  ve2.id_estudio       = p_id_estudio
    and  es2.es_estado_final  = false
    and  v2.estatus           = 'en_proceso'
    and  v2.id               != p_id_visita
    and  (
      -- Prioridad mayor
      case v2.tipo_paciente
        when 'urgente'      then 1
        when 'embarazada'   then 2
        when 'adulto_mayor' then 3
        when 'discapacidad' then 4
        when 'con_cita'     then 5
        when 'sin_cita'     then 6
        else 6
      end
      <
      case v_tipo_paciente
        when 'urgente'      then 1
        when 'embarazada'   then 2
        when 'adulto_mayor' then 3
        when 'discapacidad' then 4
        when 'con_cita'     then 5
        when 'sin_cita'     then 6
        else 6
      end
      -- Misma prioridad + llegó antes
      or (
        case v2.tipo_paciente
          when 'urgente'      then 1
          when 'embarazada'   then 2
          when 'adulto_mayor' then 3
          when 'discapacidad' then 4
          when 'con_cita'     then 5
          when 'sin_cita'     then 6
          else 6
        end
        =
        case v_tipo_paciente
          when 'urgente'      then 1
          when 'embarazada'   then 2
          when 'adulto_mayor' then 3
          when 'discapacidad' then 4
          when 'con_cita'     then 5
          when 'sin_cita'     then 6
          else 6
        end
        and v2.timestamp_llegada < v_llegada
      )
    );

  return coalesce(v_posicion, 1);
end;
$$;


-- ── 3. fn_calcular_tiempo_espera_visita (actualizado) ───────────
-- Ahora usa la posición real de la visita en cada cola,
-- no el total genérico de la fila. Si un urgente llega después,
-- los demás ven su tiempo aumentar automáticamente.
-- ----------------------------------------------------------------
create or replace function fn_calcular_tiempo_espera_visita(
  p_id_visita uuid
)
returns integer language plpgsql stable as $$
declare
  v_total  integer := 0;
  v_rec    record;
  v_pos    integer;
  v_cons   integer;
  v_tiempo integer;
begin
  for v_rec in
    select ve.id_estudio, v.id_sucursal
    from   visita_estudios ve
    join   visitas v          on v.id   = ve.id_visita
    join   estatus_servicio es on es.id = ve.id_estatus
    where  ve.id_visita       = p_id_visita
      and  es.es_estado_final = false
    order  by ve.orden_atencion
  loop
    -- Posición real de este paciente en la cola de ese estudio
    v_pos := fn_posicion_en_cola(p_id_visita, v_rec.id_estudio);

    -- Consultorios activos
    select coalesce(activos, 1)
    into   v_cons
    from   consultorios_por_sucursal
    where  id_sucursal = v_rec.id_sucursal
      and  id_estudio  = v_rec.id_estudio;

    if not found then v_cons := 1; end if;

    -- Tiempo de atención (histórico > catálogo > fallback)
    select coalesce(
      (select promedio_min from promedios_espera_historicos
       where id_sucursal = v_rec.id_sucursal and id_estudio = v_rec.id_estudio
       order by fecha desc limit 1),
      (select tiempo_atencion_promedio_min from estudios
       where id = v_rec.id_estudio and not tiempo_atencion_es_variable),
      (select tiempo_espera_promedio_min from estudios where id = v_rec.id_estudio),
      20
    ) into v_tiempo;

    v_total := v_total + greatest(
      ceil((v_pos::numeric / greatest(v_cons, 1)) * v_tiempo)::integer,
      0
    );
  end loop;

  return v_total;
end;
$$;
