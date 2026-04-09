-- ================================================================
-- PATCH COMPLETO — Ejecutar en Supabase → SQL Editor
-- Incluye: posición en cola, tiempos por posición real, vista especialista
-- ================================================================


-- ── 1. fn_sincronizar_colas ──────────────────────────────────────
create or replace function fn_sincronizar_colas(p_id_sucursal integer)
returns void language plpgsql volatile as $$
begin
  update colas_en_tiempo_real cr set
    pacientes_en_espera = (
      select count(distinct ve.id_visita)
      from   visita_estudios ve
      join   visitas v on v.id = ve.id_visita
      join   estatus_servicio es on es.id = ve.id_estatus
      where  v.id_sucursal = p_id_sucursal and ve.id_estudio = cr.id_estudio
        and  es.es_estado_final = false and v.estatus = 'en_proceso'
    ),
    pacientes_en_atencion = (
      select count(distinct ve.id_visita)
      from   visita_estudios ve
      join   visitas v on v.id = ve.id_visita
      where  v.id_sucursal = p_id_sucursal and ve.id_estudio = cr.id_estudio
        and  ve.es_estudio_actual = true and v.estatus = 'en_proceso'
    ),
    pacientes_urgentes = (
      select count(distinct ve.id_visita)
      from   visita_estudios ve
      join   visitas v on v.id = ve.id_visita
      join   estatus_servicio es on es.id = ve.id_estatus
      where  v.id_sucursal = p_id_sucursal and ve.id_estudio = cr.id_estudio
        and  es.es_estado_final = false and v.estatus = 'en_proceso'
        and  v.tipo_paciente in ('urgente','embarazada','adulto_mayor','discapacidad')
    ),
    pacientes_con_cita = (
      select count(distinct ve.id_visita)
      from   visita_estudios ve
      join   visitas v on v.id = ve.id_visita
      join   estatus_servicio es on es.id = ve.id_estatus
      where  v.id_sucursal = p_id_sucursal and ve.id_estudio = cr.id_estudio
        and  es.es_estado_final = false and v.estatus = 'en_proceso'
        and  v.tipo_paciente = 'con_cita'
    ),
    ultima_actualizacion = now()
  where cr.id_sucursal = p_id_sucursal;

  insert into colas_en_tiempo_real
    (id_sucursal, id_estudio,
     pacientes_en_espera, pacientes_en_atencion,
     pacientes_urgentes, pacientes_con_cita, ultima_actualizacion)
  select
    p_id_sucursal, cp.id_estudio,
    coalesce((
      select count(distinct ve.id_visita) from visita_estudios ve
      join visitas v on v.id = ve.id_visita join estatus_servicio es on es.id = ve.id_estatus
      where v.id_sucursal = p_id_sucursal and ve.id_estudio = cp.id_estudio
        and es.es_estado_final = false and v.estatus = 'en_proceso'
    ), 0),
    coalesce((
      select count(distinct ve.id_visita) from visita_estudios ve
      join visitas v on v.id = ve.id_visita
      where v.id_sucursal = p_id_sucursal and ve.id_estudio = cp.id_estudio
        and ve.es_estudio_actual = true and v.estatus = 'en_proceso'
    ), 0),
    coalesce((
      select count(distinct ve.id_visita) from visita_estudios ve
      join visitas v on v.id = ve.id_visita join estatus_servicio es on es.id = ve.id_estatus
      where v.id_sucursal = p_id_sucursal and ve.id_estudio = cp.id_estudio
        and es.es_estado_final = false and v.estatus = 'en_proceso'
        and v.tipo_paciente in ('urgente','embarazada','adulto_mayor','discapacidad')
    ), 0),
    coalesce((
      select count(distinct ve.id_visita) from visita_estudios ve
      join visitas v on v.id = ve.id_visita join estatus_servicio es on es.id = ve.id_estatus
      where v.id_sucursal = p_id_sucursal and ve.id_estudio = cp.id_estudio
        and es.es_estado_final = false and v.estatus = 'en_proceso'
        and v.tipo_paciente = 'con_cita'
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


-- ── 2. fn_posicion_en_cola (VOLATILE — siempre recalcula) ─────────
create or replace function fn_posicion_en_cola(
  p_id_visita  uuid,
  p_id_estudio integer
)
returns integer language plpgsql volatile as $$
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

  select count(distinct v2.id) + 1
  into   v_posicion
  from   visita_estudios ve2
  join   visitas v2           on v2.id   = ve2.id_visita
  join   estatus_servicio es2 on es2.id  = ve2.id_estatus
  where  v2.id_sucursal       = v_id_sucursal
    and  ve2.id_estudio        = p_id_estudio
    and  es2.es_estado_final   = false
    and  v2.estatus            = 'en_proceso'
    and  v2.id                != p_id_visita
    and  (
      case v2.tipo_paciente
        when 'urgente'      then 1 when 'embarazada'   then 2
        when 'adulto_mayor' then 3 when 'discapacidad' then 4
        when 'con_cita'     then 5 else 6 end
      <
      case v_tipo_paciente
        when 'urgente'      then 1 when 'embarazada'   then 2
        when 'adulto_mayor' then 3 when 'discapacidad' then 4
        when 'con_cita'     then 5 else 6 end
      or (
        case v2.tipo_paciente
          when 'urgente' then 1 when 'embarazada' then 2
          when 'adulto_mayor' then 3 when 'discapacidad' then 4
          when 'con_cita' then 5 else 6 end
        =
        case v_tipo_paciente
          when 'urgente' then 1 when 'embarazada' then 2
          when 'adulto_mayor' then 3 when 'discapacidad' then 4
          when 'con_cita' then 5 else 6 end
        and v2.timestamp_llegada < v_llegada
      )
    );

  return coalesce(v_posicion, 1);
end;
$$;


-- ── 3. fn_calcular_tiempo_espera_visita — usa posición real (VOLATILE)
create or replace function fn_calcular_tiempo_espera_visita(
  p_id_visita uuid
)
returns integer language plpgsql volatile as $$
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
    join   visitas v           on v.id   = ve.id_visita
    join   estatus_servicio es on es.id  = ve.id_estatus
    where  ve.id_visita        = p_id_visita
      and  es.es_estado_final  = false
    order  by ve.orden_atencion
  loop
    v_pos := fn_posicion_en_cola(p_id_visita, v_rec.id_estudio);

    select coalesce(activos, 1) into v_cons
    from   consultorios_por_sucursal
    where  id_sucursal = v_rec.id_sucursal and id_estudio = v_rec.id_estudio;
    if not found then v_cons := 1; end if;

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
      ceil((v_pos::numeric / greatest(v_cons, 1)) * v_tiempo)::integer, 0
    );
  end loop;

  return v_total;
end;
$$;


-- ── 4. fn_obtener_estado_visita — incluye posicion_en_cola (VOLATILE)
create or replace function fn_obtener_estado_visita(p_visita_id uuid)
returns jsonb language plpgsql volatile as $$
declare
  v_resultado jsonb;
begin
  select jsonb_build_object(
    'visita_id',               v.id,
    'paciente',                p.nombre,
    'sucursal',                s.nombre,
    'ciudad',                  s.ciudad,
    'estatus',                 v.estatus,
    'tipo_paciente',           v.tipo_paciente,
    'progreso_general_pct',    v.progreso_general_pct,
    'tiempo_espera_total_min', fn_calcular_tiempo_espera_visita(v.id),
    'timestamp_llegada',       v.timestamp_llegada,
    'posicion_en_cola', (
      select fn_posicion_en_cola(v.id, ve_pos.id_estudio)
      from   visita_estudios ve_pos
      where  ve_pos.id_visita = v.id and ve_pos.es_estudio_actual = true
      limit  1
    ),
    'estudio_actual', (
      select jsonb_build_object(
        'id_estudio',  ve.id_estudio,
        'nombre',      e.nombre,
        'paso_actual', ve.paso_actual,
        'progreso_pct',ve.progreso_pct,
        'estatus',     es.nombre,
        'guia', jsonb_build_object(
          'nombre_area',   coalesce(g.nombre_area, e.nombre),
          'ubicacion',     coalesce(g.ubicacion, 'Consulta en recepción'),
          'piso',          coalesce(g.piso, 1),
          'instrucciones', coalesce(g.instrucciones, 'Pregunta en recepción'),
          'referencia',    g.referencia
        )
      )
      from visita_estudios ve
      join estudios e on e.id = ve.id_estudio
      join estatus_servicio es on es.id = ve.id_estatus
      left join guias_navegacion_sucursal g
        on g.id_sucursal = v.id_sucursal and g.id_estudio = ve.id_estudio and g.activa = true
      where ve.id_visita = v.id and ve.es_estudio_actual = true
      limit 1
    ),
    'estudios', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'orden',             ve.orden_atencion,
          'id_estudio',        ve.id_estudio,
          'id_visita_estudio', ve.id,
          'nombre',            e.nombre,
          'estatus',           es.nombre,
          'es_estado_final',   es.es_estado_final,
          'es_actual',         ve.es_estudio_actual,
          'progreso_pct',      ve.progreso_pct,
          'tiempo_espera_min', fn_calcular_tiempo_espera(v.id_sucursal, ve.id_estudio),
          'preparacion',       e.preparacion_instrucciones,
          'guia', jsonb_build_object(
            'nombre_area',   coalesce(g.nombre_area, e.nombre),
            'ubicacion',     coalesce(g.ubicacion, 'Consulta en recepción'),
            'piso',          coalesce(g.piso, 1),
            'instrucciones', coalesce(g.instrucciones, 'Pregunta en recepción'),
            'referencia',    g.referencia
          )
        ) order by ve.orden_atencion
      ), '[]'::jsonb)
      from visita_estudios ve
      join estudios e on e.id = ve.id_estudio
      join estatus_servicio es on es.id = ve.id_estatus
      left join guias_navegacion_sucursal g
        on g.id_sucursal = v.id_sucursal and g.id_estudio = ve.id_estudio and g.activa = true
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


-- ── 5. fn_score_recomendacion_sucursal — distancia 0 si no hay coords ──
-- Bug fix: antes usaba 999 km como fallback (igual para todos),
-- pero COALESCE(lat,0) en el llamador pasaba 0 como coordenada real
-- haciendo que Mazatlán ganara por estar levemente más cerca del (0,0).
-- Ahora: sin coordenadas de usuario → distancia = 0 para todos → ranking
-- se basa puramente en tiempo de espera.
create or replace function fn_score_recomendacion_sucursal(
  p_id_sucursal  integer,
  p_ids_estudios integer[],
  p_lat_usuario  numeric default null,
  p_lon_usuario  numeric default null
)
returns numeric language plpgsql stable as $$
declare
  v_tiempo_total  integer := 0;
  v_distancia_km  numeric;
  v_lat           numeric;
  v_lon           numeric;
  v_id_estudio    integer;
begin
  foreach v_id_estudio in array p_ids_estudios loop
    v_tiempo_total := v_tiempo_total +
      fn_calcular_tiempo_espera(p_id_sucursal, v_id_estudio);
  end loop;

  select latitud, longitud into v_lat, v_lon
  from   sucursales where id = p_id_sucursal and activa = true;

  -- Sin coordenadas del usuario → distancia 0 para todas las sucursales
  -- (ranking queda determinado solo por tiempo de espera en cola)
  if v_lat is not null and p_lat_usuario is not null
     and p_lat_usuario <> 0 and p_lon_usuario <> 0 then
    v_distancia_km := sqrt(
      pow((v_lat - p_lat_usuario) * 111.0, 2) +
      pow((v_lon - p_lon_usuario) * 111.0 * cos(radians(p_lat_usuario)), 2)
    );
  else
    v_distancia_km := 0;
  end if;

  return round((v_tiempo_total * 0.6) + (v_distancia_km * 0.4), 2);
end;
$$;


-- ── 6. fn_recomendar_sucursales — pasa lat/lon sin coalesce ─────────
create or replace function fn_recomendar_sucursales(
  p_ids_estudios integer[],
  p_lat_usuario  numeric default null,
  p_lon_usuario  numeric default null,
  p_limite       integer default 5
)
returns table (
  id_sucursal          integer,
  nombre_sucursal      text,
  direccion            text,
  ciudad               text,
  tiempo_total_min     integer,
  score                numeric,
  estudios_disponibles integer
) language plpgsql stable as $$
begin
  return query
  select
    s.id,
    s.nombre,
    s.direccion,
    s.ciudad,
    fn_calcular_tiempo_espera_visita_sim(s.id, p_ids_estudios),
    fn_score_recomendacion_sucursal(
      s.id, p_ids_estudios,
      p_lat_usuario,   -- sin coalesce: null se propaga correctamente
      p_lon_usuario
    ),
    (
      select count(*)::integer
      from   consultorios_por_sucursal cp
      where  cp.id_sucursal = s.id and cp.id_estudio = any(p_ids_estudios)
    )
  from sucursales s
  where s.activa = true
    and (
      select count(*)
      from   consultorios_por_sucursal cp
      where  cp.id_sucursal = s.id and cp.id_estudio = any(p_ids_estudios)
    ) = array_length(p_ids_estudios, 1)
  order by fn_score_recomendacion_sucursal(
    s.id, p_ids_estudios, p_lat_usuario, p_lon_usuario
  ) asc
  limit p_limite;
end;
$$;
