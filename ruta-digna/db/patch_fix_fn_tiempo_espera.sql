-- ----------------------------------------------------------------
-- PATCH: fix fn_calcular_tiempo_espera_visita
-- Bug: ve.id_sucursal → v.id_sucursal
-- visita_estudios (ve) no tiene id_sucursal; la tiene visitas (v)
-- ----------------------------------------------------------------
create or replace function fn_calcular_tiempo_espera_visita(
  p_id_visita uuid
)
returns integer language plpgsql stable as $$
declare
  v_total integer := 0;
  v_rec   record;
begin
  for v_rec in
    select ve.id_estudio, v.id_sucursal
    from   visita_estudios ve
    join   visitas v on v.id = ve.id_visita
    join   estatus_servicio es on es.id = ve.id_estatus
    where  ve.id_visita = p_id_visita
      and  es.es_estado_final = false
    order  by ve.orden_atencion
  loop
    v_total := v_total + fn_calcular_tiempo_espera(v_rec.id_sucursal, v_rec.id_estudio);
  end loop;

  return v_total;
end;
$$;
