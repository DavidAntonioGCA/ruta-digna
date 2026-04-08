-- ================================================================
-- PATCH: Incluir posicion_en_cola en fn_obtener_estado_visita
-- Ejecutar en Supabase → SQL Editor
-- ================================================================

create or replace function fn_obtener_estado_visita(p_visita_id uuid)
returns jsonb language plpgsql stable as $$
declare
  v_resultado   jsonb;
  v_id_sucursal integer;
begin
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
    -- Posición real en la cola del estudio actual
    'posicion_en_cola', (
      select fn_posicion_en_cola(v.id, ve_pos.id_estudio)
      from   visita_estudios ve_pos
      where  ve_pos.id_visita         = v.id
        and  ve_pos.es_estudio_actual = true
      limit 1
    ),
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
