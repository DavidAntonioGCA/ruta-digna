-- ============================================================
-- RUTA DIGNA — Schema v2 (Opción B: múltiples estudios por visita)
-- Hackathon Talent Land 2026 · Track Salud Digna
-- Basado en datos reales + reglas de negocio del PDF oficial
--
-- ORDEN DE EJECUCIÓN: de arriba hacia abajo sin saltar secciones
-- Ejecutar en: Supabase → SQL Editor → New Query
-- ============================================================


-- ============================================================
-- EXTENSIONES
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";


-- ============================================================
-- SECCIÓN 1: CATÁLOGOS BASE
-- Sin dependencias externas — ejecutar primero
-- ============================================================

-- ------------------------------------------------------------
-- estudios
-- Fuente: CatalogoEstudios.csv + TiemposPromedio.csv + PrioridadAtencion.csv
-- id puede ser negativo (ej: -2 = Examen de la Vista)
-- ------------------------------------------------------------
create table estudios (
  id                            integer       primary key,
  nombre                        text          not null,
  orden_prioridad               integer       not null default 0,
  requiere_preparacion          boolean       not null default false,
  tiempo_espera_promedio_min    integer       not null default 20,
  tiempo_atencion_promedio_min  integer,
  tiempo_atencion_es_variable   boolean       not null default false,
  preparacion_instrucciones     text,
  requiere_cita                 boolean       not null default false,
  puntualidad_obligatoria       boolean       not null default false,
  activo                        boolean       not null default true,
  created_at                    timestamptz   not null default now(),
  updated_at                    timestamptz   not null default now(),

  constraint estudios_nombre_not_empty
    check (char_length(trim(nombre)) > 0),
  constraint estudios_tiempo_positivo
    check (tiempo_espera_promedio_min > 0)
);

comment on table  estudios                         is 'Catálogo de tipos de estudio. Fuente: CatalogoEstudios.csv + TiemposPromedio.csv';
comment on column estudios.orden_prioridad         is 'Negativo = mayor prioridad. Fuente: PrioridadAtencion.csv';
comment on column estudios.requiere_preparacion    is 'True = debe hacerse DESPUÉS de estudios sin preparación en una visita';
comment on column estudios.requiere_cita           is 'True = se busca que el paciente llegue con cita previa (Tomografía, RM)';
comment on column estudios.puntualidad_obligatoria is 'True = si llega tarde se reasigna cita (Tomografía, RM)';


-- ------------------------------------------------------------
-- subestudios
-- Fuente: Ventas.csv
-- Rayos X: 123, Laboratorio: 264, Ultrasonido: 29 subestudios
-- ------------------------------------------------------------
create table subestudios (
  id                integer     primary key,
  id_estudio        integer     not null references estudios(id) on delete restrict,
  nombre            text        not null,
  id_por_sucursal   integer,
  activo            boolean     not null default true,
  created_at        timestamptz not null default now(),

  constraint subestudios_nombre_not_empty
    check (char_length(trim(nombre)) > 0)
);

create index idx_subestudios_estudio on subestudios(id_estudio);
comment on table subestudios is 'Subestudios por tipo. Fuente: Ventas.csv';


-- ------------------------------------------------------------
-- reglas_orden_estudios
-- Codifica las reglas del PDF oficial:
--   - Papanicolaou antes de Ultrasonido transvaginal
--   - Densitometría antes de Tomografía/RM con contraste
--   - Laboratorio antes de Ultrasonido si lab requiere ayuno
--   - General: sin preparación antes que con preparación
-- ------------------------------------------------------------
create table reglas_orden_estudios (
  id                  uuid        primary key default uuid_generate_v4(),
  id_estudio_primero  integer     not null references estudios(id) on delete cascade,
  id_estudio_segundo  integer     not null references estudios(id) on delete cascade,
  motivo              text        not null,
  es_obligatorio      boolean     not null default true,
  activa              boolean     not null default true,
  created_at          timestamptz not null default now(),

  constraint reglas_orden_no_autoreferencia
    check (id_estudio_primero <> id_estudio_segundo),
  constraint reglas_orden_unique
    unique (id_estudio_primero, id_estudio_segundo)
);

create index idx_reglas_orden_primero  on reglas_orden_estudios(id_estudio_primero);
create index idx_reglas_orden_segundo  on reglas_orden_estudios(id_estudio_segundo);
comment on table reglas_orden_estudios is 'Reglas de ordenamiento entre estudios. Fuente: Reglas de negocio PDF oficial Hackathon 2026.';


-- ------------------------------------------------------------
-- restricciones_estudio
-- Validaciones específicas antes de permitir el servicio
-- Ej: Mastografía < 35 años requiere orden médica
-- ------------------------------------------------------------
create table restricciones_estudio (
  id                      uuid        primary key default uuid_generate_v4(),
  id_estudio              integer     not null references estudios(id) on delete cascade,
  tipo                    text        not null,
  descripcion             text        not null,
  requiere_orden_medica   boolean     not null default false,
  activa                  boolean     not null default true,
  created_at              timestamptz not null default now(),

  constraint restricciones_tipo_valido check (
    tipo in ('edad', 'tiempo_desde_ultimo', 'combinacion', 'puntualidad', 'otro')
  )
);

create index idx_restricciones_estudio on restricciones_estudio(id_estudio);
comment on table restricciones_estudio is 'Restricciones y validaciones por estudio. Fuente: Reglas de negocio PDF oficial.';


-- ------------------------------------------------------------
-- estatus_servicio
-- Fuente: Ventas.csv (IdEstatus, Estatus)
-- Ciclo de vida de un estudio dentro de la visita
-- ------------------------------------------------------------
create table estatus_servicio (
  id              integer     primary key,
  nombre          text        not null unique,
  descripcion     text,
  es_estado_final boolean     not null default false,
  orden_flujo     integer,
  created_at      timestamptz not null default now()
);

comment on table estatus_servicio is 'Estados del ciclo de vida de un servicio. Fuente: Ventas.csv (IdEstatus).';
comment on column estatus_servicio.orden_flujo is 'Posición en el flujo lineal. NULL si no aplica (ej: DEVOLUCION).';


-- ------------------------------------------------------------
-- sucursales
-- Fuente: ConssultoriosXClinica.csv — 287 sucursales
-- ------------------------------------------------------------
create table sucursales (
  id               integer       primary key,
  nombre           text          not null,
  direccion        text,
  ciudad           text,
  estado           text,
  latitud          numeric(10,7),
  longitud         numeric(10,7),
  telefono         text,
  horario_apertura time,
  horario_cierre   time,
  activa           boolean       not null default true,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),

  constraint sucursales_nombre_not_empty
    check (char_length(trim(nombre)) > 0),
  constraint sucursales_coordenadas_ambas_o_ninguna check (
    (latitud is null and longitud is null) or
    (latitud is not null and longitud is not null)
  ),
  constraint sucursales_latitud_rango  check (latitud  between -90  and 90),
  constraint sucursales_longitud_rango check (longitud between -180 and 180)
);

create index idx_sucursales_activa       on sucursales(activa) where activa = true;
create index idx_sucursales_coordenadas  on sucursales(latitud, longitud) where latitud is not null;
comment on table sucursales is '287 sucursales de Salud Digna. Fuente: ConssultoriosXClinica.csv';


-- ------------------------------------------------------------
-- consultorios_por_sucursal
-- Fuente: ConssultoriosXClinica.csv (2047 registros)
-- ------------------------------------------------------------
create table consultorios_por_sucursal (
  id                    uuid        primary key default uuid_generate_v4(),
  id_sucursal           integer     not null references sucursales(id) on delete cascade,
  id_estudio            integer     not null references estudios(id) on delete restrict,
  cantidad_consultorios integer     not null default 1,
  activos               integer     not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint consultorios_unique
    unique (id_sucursal, id_estudio),
  constraint consultorios_cantidad_positiva
    check (cantidad_consultorios > 0),
  constraint consultorios_activos_validos
    check (activos >= 0 and activos <= cantidad_consultorios)
);

create index idx_consultorios_sucursal on consultorios_por_sucursal(id_sucursal);
create index idx_consultorios_estudio  on consultorios_por_sucursal(id_estudio);
comment on table consultorios_por_sucursal is 'Capacidad instalada por sucursal y estudio. Fuente: ConssultoriosXClinica.csv';


-- ============================================================
-- SECCIÓN 2: TABLAS OPERATIVAS EN TIEMPO REAL
-- ============================================================

-- ------------------------------------------------------------
-- colas_en_tiempo_real
-- Estado actual de cada área en cada sucursal
-- Se recalcula en cada cambio de estado de un estudio en visita
-- ------------------------------------------------------------
create table colas_en_tiempo_real (
  id                        uuid        primary key default uuid_generate_v4(),
  id_sucursal               integer     not null references sucursales(id) on delete cascade,
  id_estudio                integer     not null references estudios(id) on delete restrict,
  pacientes_en_espera       integer     not null default 0,
  pacientes_en_atencion     integer     not null default 0,
  pacientes_urgentes        integer     not null default 0,
  pacientes_con_cita        integer     not null default 0,
  tiempo_espera_estimado_min integer    not null default 0,
  ultima_actualizacion      timestamptz not null default now(),

  constraint colas_unique
    unique (id_sucursal, id_estudio),
  constraint colas_espera_no_negativa
    check (pacientes_en_espera >= 0),
  constraint colas_atencion_no_negativa
    check (pacientes_en_atencion >= 0),
  constraint colas_urgentes_no_negativa
    check (pacientes_urgentes >= 0),
  constraint colas_tiempo_no_negativo
    check (tiempo_espera_estimado_min >= 0)
);

create index idx_colas_sucursal            on colas_en_tiempo_real(id_sucursal);
create index idx_colas_ultima_actualizacion on colas_en_tiempo_real(ultima_actualizacion desc);
comment on table colas_en_tiempo_real is 'Estado actual de colas. Incluye urgentes y con cita para el cálculo de prioridad de ultrasonido.';
comment on column colas_en_tiempo_real.pacientes_urgentes  is 'Prioridad 1 en ultrasonido (ej: sangrado, necesidad urgente)';
comment on column colas_en_tiempo_real.pacientes_con_cita  is 'Prioridad 2 en ultrasonido';


-- ------------------------------------------------------------
-- promedios_espera_historicos
-- Fuente: PromediosEspera.csv (253 sucursales, enero 2026)
-- ------------------------------------------------------------
create table promedios_espera_historicos (
  id           uuid        primary key default uuid_generate_v4(),
  id_sucursal  integer     not null references sucursales(id) on delete cascade,
  id_estudio   integer     not null references estudios(id) on delete restrict,
  promedio_min integer     not null,
  fecha        date        not null,
  created_at   timestamptz not null default now(),

  constraint promedios_unique
    unique (id_sucursal, id_estudio, fecha),
  constraint promedios_positivo
    check (promedio_min >= 0)
);

create index idx_promedios_sucursal_estudio on promedios_espera_historicos(id_sucursal, id_estudio);
create index idx_promedios_fecha            on promedios_espera_historicos(fecha desc);
comment on table promedios_espera_historicos is 'Tiempos promedio históricos reales. Fuente: PromediosEspera.csv';


-- ============================================================
-- SECCIÓN 3: PACIENTES, VISITAS Y ESTUDIOS POR VISITA
-- El cambio central de la v2: visita (1 llegada) → N estudios
-- ============================================================

-- ------------------------------------------------------------
-- pacientes
-- Solo identificación y contacto — sin datos médicos
-- ------------------------------------------------------------
create table pacientes (
  id         uuid        primary key default uuid_generate_v4(),
  nombre     text        not null,
  email      text        unique,
  telefono   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pacientes_nombre_not_empty
    check (char_length(trim(nombre)) > 0),
  constraint pacientes_email_formato check (
    email is null or
    email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'
  )
);

create index idx_pacientes_email on pacientes(email) where email is not null;
comment on table pacientes is 'Pacientes de Ruta Digna. Sin datos clínicos ni resultados médicos.';


-- ------------------------------------------------------------
-- visitas
-- Una visita = una llegada del paciente a una sucursal
-- Puede contener N estudios (visita_estudios)
-- Es la entidad que el frontend trackea con el ticket_id
-- ------------------------------------------------------------
create table visitas (
  id                          uuid        primary key default uuid_generate_v4(),
  id_paciente                 uuid        not null references pacientes(id) on delete restrict,
  id_sucursal                 integer     not null references sucursales(id) on delete restrict,

  -- Estado general de la visita
  estatus                     text        not null default 'en_proceso',

  -- Estudio actual que está siendo atendido
  id_estudio_actual           integer     references estudios(id),
  id_estudio_siguiente        integer     references estudios(id),

  -- Progreso general (0-100, calculado sobre todos los estudios)
  progreso_general_pct        integer     not null default 0,

  -- Tipo de paciente (afecta prioridad en ultrasonido)
  tipo_paciente               text        not null default 'sin_cita',

  -- Tiempos
  timestamp_llegada           timestamptz not null default now(),
  timestamp_fin_visita        timestamptz,
  tiempo_espera_total_min integer,

  -- Referencias sistema Salud Digna
  id_reservacion_sd           bigint,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint visitas_estatus_valido check (
    estatus in ('en_proceso', 'completada', 'cancelada', 'no_presentado')
  ),
  constraint visitas_tipo_paciente_valido check (
    tipo_paciente in ('urgente', 'con_cita', 'sin_cita')
  ),
  constraint visitas_progreso_rango
    check (progreso_general_pct between 0 and 100),
  constraint visitas_fin_coherente check (
    timestamp_fin_visita is null or
    timestamp_fin_visita >= timestamp_llegada
  )
);

create index idx_visitas_paciente   on visitas(id_paciente);
create index idx_visitas_sucursal   on visitas(id_sucursal);
create index idx_visitas_estatus    on visitas(estatus) where estatus = 'en_proceso';
create index idx_visitas_llegada    on visitas(timestamp_llegada desc);

comment on table visitas is 'Una visita = una llegada del paciente a una sucursal. Puede tener N estudios.';
comment on column visitas.tipo_paciente is 'urgente > con_cita > sin_cita. Determina prioridad en cola de ultrasonido según reglas del PDF.';
comment on column visitas.id_estudio_actual is 'Estudio que se está realizando ahora. NULL si está en registro/pago.';
comment on column visitas.id_estudio_siguiente is 'Próximo estudio calculado por fn_calcular_orden_optimo.';


-- ------------------------------------------------------------
-- visita_estudios
-- Un registro por cada estudio dentro de una visita
-- Tiene su propio estado, orden y timestamps
-- Este es el nivel de granularidad del tracking real
-- ------------------------------------------------------------
create table visita_estudios (
  id                      uuid        primary key default uuid_generate_v4(),
  id_visita               uuid        not null references visitas(id) on delete cascade,
  id_estudio              integer     not null references estudios(id) on delete restrict,
  id_subestudio           integer     references subestudios(id) on delete set null,
  id_estatus              integer     not null references estatus_servicio(id) default 1,

  -- Orden en el que debe atenderse (calculado por fn_calcular_orden_optimo)
  orden_atencion          integer     not null,

  -- Es el estudio activo ahora en esta visita?
  es_estudio_actual       boolean     not null default false,

  -- Paso dentro de este estudio específico
  -- Valores posibles: espera|registro|pago|inicio_toma|fin_toma|diagnostico|finalizado|devolucion
  paso_actual             text        not null default 'espera',
  progreso_pct            integer     not null default 0,

  -- Prioridad en cola (afecta ultrasonido)
  es_urgente              boolean     not null default false,

  -- Tiempos de este estudio específico
  timestamp_inicio_espera timestamptz not null default now(),
  timestamp_inicio_atencion timestamptz,
  timestamp_fin_atencion  timestamptz,
  tiempo_espera_real_min  integer,  -- calculado al finalizar

  -- Referencia Salud Digna
  id_servicio_sd          bigint,
  id_paquete_sd           integer,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint visita_estudios_unique
    unique (id_visita, id_estudio),
  constraint visita_estudios_orden_positivo
    check (orden_atencion > 0),
  constraint visita_estudios_progreso_rango
    check (progreso_pct between 0 and 100),
  constraint visita_estudios_tiempos_coherentes check (
    timestamp_inicio_atencion is null or
    timestamp_inicio_atencion >= timestamp_inicio_espera
  ),
  constraint visita_estudios_fin_coherente check (
    timestamp_fin_atencion is null or (
      timestamp_inicio_atencion is not null and
      timestamp_fin_atencion >= timestamp_inicio_atencion
    )
  )
);

create index idx_ve_visita          on visita_estudios(id_visita);
create index idx_ve_estudio         on visita_estudios(id_estudio);
create index idx_ve_estatus         on visita_estudios(id_estatus);
create index idx_ve_actual          on visita_estudios(id_visita, es_estudio_actual)
  where es_estudio_actual = true;
create index idx_ve_orden           on visita_estudios(id_visita, orden_atencion);

comment on table visita_estudios is 'Un registro por estudio dentro de una visita. Tracking granular por estudio individual.';
comment on column visita_estudios.orden_atencion is 'Calculado por fn_calcular_orden_optimo_estudios al crear la visita.';
comment on column visita_estudios.es_urgente     is 'Prioridad máxima en cola de ultrasonido. Ej: paciente con sangrado.';


-- ------------------------------------------------------------
-- historial_estados_visita_estudio
-- Log inmutable de cada cambio de estado en visita_estudios
-- Permite auditoría y cálculo de tiempos reales por etapa
-- ------------------------------------------------------------
create table historial_estados_visita_estudio (
  id                    uuid        primary key default uuid_generate_v4(),
  id_visita_estudio     uuid        not null references visita_estudios(id) on delete cascade,
  id_estatus_anterior   integer     references estatus_servicio(id),
  id_estatus_nuevo      integer     not null references estatus_servicio(id),
  cambiado_por          text        not null default 'sistema',
  notas                 text,
  timestamp_cambio      timestamptz not null default now()
);

create index idx_historial_ve_id        on historial_estados_visita_estudio(id_visita_estudio);
create index idx_historial_ve_timestamp on historial_estados_visita_estudio(timestamp_cambio desc);
comment on table historial_estados_visita_estudio is 'Log inmutable de cambios de estado por estudio en visita. Para auditoría y análisis de tiempos.';


-- ------------------------------------------------------------
-- ventas_historicas
-- Fuente: Ventas.csv (~1M registros, Feb 2026)
-- Solo para análisis de patrones — no se usa en tiempo real
-- ------------------------------------------------------------
create table ventas_historicas (
  id                        bigint      primary key,
  id_estatus                integer     not null references estatus_servicio(id),
  id_sucursal               integer     not null references sucursales(id),
  id_servicio               bigint      not null,
  id_reservacion            bigint,
  id_estudio                integer     not null references estudios(id),
  id_subestudio             integer     references subestudios(id),
  id_paquete                integer,
  id_paciente_sd            integer,
  fecha_servicio            date        not null,
  id_subestudio_por_sucursal integer,
  created_at                timestamptz not null default now()
);

create index idx_ventas_sucursal       on ventas_historicas(id_sucursal);
create index idx_ventas_estudio        on ventas_historicas(id_estudio);
create index idx_ventas_fecha          on ventas_historicas(fecha_servicio desc);
create index idx_ventas_sucursal_fecha on ventas_historicas(id_sucursal, fecha_servicio desc);
comment on table ventas_historicas is 'Histórico de servicios. Fuente: Ventas.csv (~1M filas Feb 2026). Solo para análisis.';


-- ============================================================
-- SECCIÓN 4: FUNCIONES Y TRIGGERS
-- ============================================================

-- ------------------------------------------------------------
-- fn_actualizar_updated_at
-- ------------------------------------------------------------
create or replace function fn_actualizar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_estudios_updated_at
  before update on estudios
  for each row execute function fn_actualizar_updated_at();

create trigger trg_sucursales_updated_at
  before update on sucursales
  for each row execute function fn_actualizar_updated_at();

create trigger trg_consultorios_updated_at
  before update on consultorios_por_sucursal
  for each row execute function fn_actualizar_updated_at();

create trigger trg_pacientes_updated_at
  before update on pacientes
  for each row execute function fn_actualizar_updated_at();

create trigger trg_visitas_updated_at
  before update on visitas
  for each row execute function fn_actualizar_updated_at();

create trigger trg_visita_estudios_updated_at
  before update on visita_estudios
  for each row execute function fn_actualizar_updated_at();


-- ------------------------------------------------------------
-- fn_registrar_cambio_estado_ve
-- Trigger: al cambiar estado de un visita_estudio
-- - Registra en historial
-- - Actualiza timestamps
-- - Calcula tiempo_espera_real al finalizar
-- ------------------------------------------------------------
create or replace function fn_registrar_cambio_estado_ve()
returns trigger language plpgsql as $$
declare
  v_es_final boolean;
begin
  if old.id_estatus is distinct from new.id_estatus then

    -- Registrar en historial
    insert into historial_estados_visita_estudio (
      id_visita_estudio, id_estatus_anterior, id_estatus_nuevo, cambiado_por
    ) values (
      new.id, old.id_estatus, new.id_estatus, 'sistema'
    );

    -- Marcar inicio de atención
    if new.paso_actual in ('atencion', 'inicio_toma') and
       old.paso_actual not in ('atencion', 'inicio_toma') then
      new.timestamp_inicio_atencion = now();
    end if;

    -- Verificar si es estado final
    select es_estado_final into v_es_final
    from estatus_servicio where id = new.id_estatus;

    if v_es_final then
      new.timestamp_fin_atencion = now();
      -- Calcular tiempo de espera real en minutos
      if new.timestamp_inicio_atencion is not null then
        new.tiempo_espera_real_min = extract(
          epoch from (new.timestamp_inicio_atencion - new.timestamp_inicio_espera)
        )::integer / 60;
      end if;
    end if;

  end if;
  return new;
end;
$$;

create trigger trg_visita_estudios_cambio_estado
  before update of id_estatus on visita_estudios
  for each row execute function fn_registrar_cambio_estado_ve();


-- ------------------------------------------------------------
-- fn_calcular_orden_optimo_estudios
-- Aplica las reglas del PDF para ordenar los estudios de una visita
--
-- Reglas aplicadas (en orden de prioridad):
-- 1. Reglas explícitas de la tabla reglas_orden_estudios (es_obligatorio=true)
-- 2. Estudios sin preparacion ANTES que con preparacion
-- 3. Dentro de cada grupo: orden_prioridad del catálogo (más negativo = antes)
--
-- Retorna tabla con id_estudio y orden_calculado
-- ------------------------------------------------------------
create or replace function fn_calcular_orden_optimo_estudios(
  p_ids_estudios integer[]
)
returns table (id_estudio integer, orden_calculado integer)
language plpgsql stable as $$
declare
  v_count       integer;
  i             integer;
  j             integer;
  v_swap        boolean;
  v_temp        integer;
  v_ids         integer[];
  v_scores      integer[];
  v_tiene_regla boolean;
  v_id_actual   integer;   -- variable intermedia para evitar ambigüedad de parseo [i]
  v_score_calc  integer;
begin
  -- Trabajar con copia del array
  v_ids := p_ids_estudios;
  v_count := array_length(v_ids, 1);

  if v_count is null or v_count = 0 then
    return;
  end if;

  if v_count = 1 then
    return query select v_ids[1], 1;
    return;
  end if;

  -- Calcular score base por estudio:
  -- requiere_preparacion=false → score más bajo (va primero)
  -- orden_prioridad más negativo → va antes dentro del mismo grupo
  -- Fórmula: (requiere_preparacion::int * 1000) + (orden_prioridad + 100)
  -- FIX: usar v_id_actual como variable intermedia para que PostgreSQL
  -- no confunda el [i] del array con subscript de la expresión aritmética
  v_scores := array_fill(0, array[v_count]);
  for i in 1..v_count loop
    v_id_actual := v_ids[i];
    select (case when requiere_preparacion then 1000 else 0 end)
           + (orden_prioridad + 100)
    into v_score_calc
    from estudios
    where id = v_id_actual;
    v_scores[i] := coalesce(v_score_calc, 0);
  end loop;

  -- Bubble sort con override de reglas explícitas
  -- INVARIANTE DE SEGURIDAD: las reglas explícitas de reglas_orden_estudios
  -- SOLO se aplican cuando ambos estudios son del mismo grupo (ambos con prep
  -- o ambos sin prep), o cuando la regla es de un sin-prep antes que otro sin-prep.
  -- Las reglas semilla del PDF son todas seguras (Lab+Ultra, Pap+Ultra, Densi+Tomo, Densi+RM).
  -- Si alguien agrega una regla que ponga un estudio CON prep antes que uno SIN prep,
  -- esa regla SOLO se aplica si ambos están en el mismo grupo de preparación.
  -- Esto protege la regla general: sin preparación SIEMPRE antes que con preparación.
  for i in 1..v_count-1 loop
    for j in 1..v_count-i loop
      v_swap := false;

      -- Verificar si hay regla explícita obligatoria que indique orden
      -- SOLO aplicar si la regla NO viola la regla general (sin-prep antes que con-prep)
      select exists(
        select 1 from reglas_orden_estudios roe
        join estudios e1 on e1.id = roe.id_estudio_primero
        join estudios e2 on e2.id = roe.id_estudio_segundo
        where roe.id_estudio_primero = v_ids[j+1]
          and roe.id_estudio_segundo = v_ids[j]
          and roe.es_obligatorio = true
          and roe.activa = true
          -- Garantía de consistencia: no aplicar regla si viola la regla general
          -- (es decir, si el estudio "primero" requiere prep y el "segundo" no)
          and not (e1.requiere_preparacion = true and e2.requiere_preparacion = false)
      ) into v_tiene_regla;

      if v_tiene_regla then
        -- La regla dice que v_ids[j+1] debe ir ANTES que v_ids[j] → swap
        v_swap := true;
      elsif v_scores[j] > v_scores[j+1] then
        -- Score más alto va después (sin-prep tiene score < con-prep por diseño)
        v_swap := true;
      end if;

      if v_swap then
        v_temp := v_ids[j];
        v_ids[j] := v_ids[j+1];
        v_ids[j+1] := v_temp;

        v_temp := v_scores[j];
        v_scores[j] := v_scores[j+1];
        v_scores[j+1] := v_temp;
      end if;
    end loop;
  end loop;

  -- Devolver resultado ordenado
  for i in 1..v_count loop
    id_estudio      := v_ids[i];
    orden_calculado := i;
    return next;
  end loop;
end;
$$;

comment on function fn_calcular_orden_optimo_estudios is
'Ordena estudios de una visita aplicando reglas del PDF oficial:
 1) reglas_orden_estudios explícitas obligatorias — SOLO si no violan la regla general
 2) sin preparación SIEMPRE antes que con preparación (regla general inviolable)
 3) orden_prioridad del catálogo como desempate dentro del mismo grupo
 PROTECCIÓN: una regla explícita que intente poner un estudio CON preparación
 antes que uno SIN preparación es ignorada automáticamente.';


-- ------------------------------------------------------------
-- fn_calcular_tiempo_espera
-- Tiempo estimado para un estudio en una sucursal
-- Usa históricos reales como fuente principal
-- ------------------------------------------------------------
create or replace function fn_calcular_tiempo_espera(
  p_id_sucursal integer,
  p_id_estudio  integer
)
returns integer language plpgsql stable as $$
declare
  v_pacientes_espera     integer;
  v_consultorios_activos integer;
  v_tiempo_atencion      integer;
  v_tiene_urgentes       boolean;
begin
  select coalesce(pacientes_en_espera, 0),
         pacientes_urgentes > 0
  into   v_pacientes_espera, v_tiene_urgentes
  from   colas_en_tiempo_real
  where  id_sucursal = p_id_sucursal and id_estudio = p_id_estudio;

  if not found then v_pacientes_espera := 0; end if;

  select coalesce(activos, 1)
  into   v_consultorios_activos
  from   consultorios_por_sucursal
  where  id_sucursal = p_id_sucursal and id_estudio = p_id_estudio;

  if not found then v_consultorios_activos := 1; end if;

  -- Prioridad 1: promedio histórico real de esa sucursal
  -- Prioridad 2: tiempo_atencion_promedio_min del catálogo
  -- Prioridad 3: tiempo_espera_promedio_min del catálogo
  -- Fallback: 20 minutos
  select coalesce(
    (select promedio_min from promedios_espera_historicos
     where  id_sucursal = p_id_sucursal and id_estudio = p_id_estudio
     order  by fecha desc limit 1),
    (select tiempo_atencion_promedio_min from estudios
     where  id = p_id_estudio and not tiempo_atencion_es_variable),
    (select tiempo_espera_promedio_min from estudios where id = p_id_estudio),
    20
  ) into v_tiempo_atencion;

  return greatest(
    ceil((v_pacientes_espera::numeric / greatest(v_consultorios_activos, 1))
         * v_tiempo_atencion)::integer,
    0
  );
end;
$$;


-- ------------------------------------------------------------
-- fn_calcular_tiempo_espera_visita
-- Tiempo total estimado para completar TODOS los estudios pendientes
-- de una visita, sumando esperas por área
-- ------------------------------------------------------------
create or replace function fn_calcular_tiempo_espera_visita(
  p_id_visita uuid
)
returns integer language plpgsql stable as $$
declare
  v_total integer := 0;
  v_rec   record;
begin
  for v_rec in
    select ve.id_estudio, ve.id_sucursal
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


-- ------------------------------------------------------------
-- fn_score_recomendacion_sucursal
-- Score para recomendar sucursal dado un array de estudios
-- Considera todos los estudios de la visita, no solo uno
-- Score = suma(tiempo_espera por estudio × 0.6) + (distancia × 0.4)
-- ------------------------------------------------------------
create or replace function fn_score_recomendacion_sucursal(
  p_id_sucursal  integer,
  p_ids_estudios integer[],
  p_lat_usuario  numeric,
  p_lon_usuario  numeric
)
returns numeric language plpgsql stable as $$
declare
  v_tiempo_total  integer := 0;
  v_distancia_km  numeric;
  v_lat           numeric;
  v_lon           numeric;
  v_id_estudio    integer;
begin
  -- Sumar tiempo estimado por cada estudio
  foreach v_id_estudio in array p_ids_estudios loop
    v_tiempo_total := v_tiempo_total +
      fn_calcular_tiempo_espera(p_id_sucursal, v_id_estudio);
  end loop;

  -- Obtener coordenadas de la sucursal
  select latitud, longitud into v_lat, v_lon
  from   sucursales where id = p_id_sucursal and activa = true;

  -- Calcular distancia aproximada (Haversine simplificada)
  if v_lat is not null and p_lat_usuario is not null then
    v_distancia_km := sqrt(
      pow((v_lat - p_lat_usuario) * 111.0, 2) +
      pow((v_lon - p_lon_usuario) * 111.0 * cos(radians(p_lat_usuario)), 2)
    );
  else
    v_distancia_km := 999;
  end if;

  return round((v_tiempo_total * 0.6) + (v_distancia_km * 0.4), 2);
end;
$$;


-- ------------------------------------------------------------
-- fn_calcular_tiempo_espera_visita_sim
-- Helper: simula tiempo total para una sucursal y lista de estudios
-- DEBE definirse ANTES de fn_recomendar_sucursales que la llama
-- ------------------------------------------------------------
create or replace function fn_calcular_tiempo_espera_visita_sim(
  p_id_sucursal  integer,
  p_ids_estudios integer[]
)
returns integer language plpgsql stable as $$
declare
  v_total      integer := 0;
  v_id_estudio integer;
begin
  foreach v_id_estudio in array p_ids_estudios loop
    v_total := v_total + fn_calcular_tiempo_espera(p_id_sucursal, v_id_estudio);
  end loop;
  return v_total;
end;
$$;


-- ------------------------------------------------------------
-- fn_recomendar_sucursales
-- Devuelve sucursales ordenadas por score para un array de estudios
-- Verifica que la sucursal tenga consultorios para TODOS los estudios
-- ------------------------------------------------------------
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
      coalesce(p_lat_usuario, 0),
      coalesce(p_lon_usuario, 0)
    ),
    (
      select count(*)::integer
      from   consultorios_por_sucursal cp
      where  cp.id_sucursal = s.id
        and  cp.id_estudio = any(p_ids_estudios)
    )
  from sucursales s
  where s.activa = true
    and (
      -- La sucursal debe tener consultorios para TODOS los estudios solicitados
      select count(*)
      from   consultorios_por_sucursal cp
      where  cp.id_sucursal = s.id
        and  cp.id_estudio = any(p_ids_estudios)
    ) = array_length(p_ids_estudios, 1)
  order by fn_score_recomendacion_sucursal(
    s.id, p_ids_estudios,
    coalesce(p_lat_usuario, 0),
    coalesce(p_lon_usuario, 0)
  ) asc
  limit p_limite;
end;
$$;



-- ------------------------------------------------------------
-- fn_obtener_estado_visita
-- Devuelve el estado completo de la visita para el tracking
-- Incluye todos los estudios con su orden, estado e instrucciones
-- Usado por GET /visita/status/{visita_id}
-- ------------------------------------------------------------
create or replace function fn_obtener_estado_visita(p_visita_id uuid)
returns jsonb language plpgsql stable as $$
declare
  v_resultado jsonb;
begin
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
    'estudio_actual',       (
      select jsonb_build_object(
        'id_estudio',     e.id,
        'nombre',         e.nombre,
        'paso_actual',    ve.paso_actual,
        'progreso_pct',   ve.progreso_pct,
        'estatus',        es.nombre
      )
      from visita_estudios ve
      join estudios e          on e.id  = ve.id_estudio
      join estatus_servicio es on es.id = ve.id_estatus
      where ve.id_visita = v.id and ve.es_estudio_actual = true
      limit 1
    ),
    'estudios',             (
      select jsonb_agg(
        jsonb_build_object(
          'orden',          ve.orden_atencion,
          'id_estudio',     e.id,
          'nombre',         e.nombre,
          'estatus',        es.nombre,
          'es_estado_final', es.es_estado_final,
          'es_actual',      ve.es_estudio_actual,
          'progreso_pct',   ve.progreso_pct,
          'tiempo_espera_min', fn_calcular_tiempo_espera(v.id_sucursal, e.id),
          'preparacion',    e.preparacion_instrucciones
        ) order by ve.orden_atencion
      )
      from visita_estudios ve
      join estudios e          on e.id  = ve.id_estudio
      join estatus_servicio es on es.id = ve.id_estatus
      where ve.id_visita = v.id
    )
  )
  into v_resultado
  from visitas v
  join pacientes p  on p.id = v.id_paciente
  join sucursales s on s.id = v.id_sucursal
  where v.id = p_visita_id;

  if not found then
    raise exception 'Visita % no encontrada', p_visita_id;
  end if;

  return v_resultado;
end;
$$;

comment on function fn_obtener_estado_visita is
'Estado completo de la visita con todos los estudios ordenados, tiempos y preparaciones.
 Usado por GET /visita/status/{visita_id}';


-- ------------------------------------------------------------
-- fn_crear_visita
-- Crea una visita completa con sus estudios en el orden correcto
-- Llama internamente a fn_calcular_orden_optimo_estudios
-- Usado por POST /visitas
-- ------------------------------------------------------------
create or replace function fn_crear_visita(
  p_id_paciente    uuid,
  p_id_sucursal    integer,
  p_ids_estudios   integer[],
  p_tipo_paciente  text    default 'sin_cita',
  p_id_reservacion_sd bigint  default null
)
returns uuid language plpgsql as $$
declare
  v_id_visita       uuid;
  v_primer_estudio  integer;
  v_rec             record;
begin
  -- Validar que haya al menos un estudio
  if array_length(p_ids_estudios, 1) is null then
    raise exception 'Se requiere al menos un estudio para crear la visita';
  end if;

  -- Crear la visita
  insert into visitas (
    id_paciente, id_sucursal, tipo_paciente, id_reservacion_sd
  ) values (
    p_id_paciente, p_id_sucursal, p_tipo_paciente, p_id_reservacion_sd
  ) returning id into v_id_visita;

  -- Calcular orden óptimo y crear visita_estudios
  for v_rec in
    select id_estudio, orden_calculado
    from fn_calcular_orden_optimo_estudios(p_ids_estudios)
  loop
    insert into visita_estudios (
      id_visita, id_estudio, orden_atencion,
      es_estudio_actual, paso_actual, progreso_pct
    ) values (
      v_id_visita, v_rec.id_estudio, v_rec.orden_calculado,
      v_rec.orden_calculado = 1, -- el primero es el actual
      'espera', 0
    );
  end loop;

  -- Marcar el primer estudio como actual en la visita
  select id_estudio into v_primer_estudio
  from fn_calcular_orden_optimo_estudios(p_ids_estudios)
  order by orden_calculado limit 1;

  update visitas set
    id_estudio_actual   = v_primer_estudio,
    id_estudio_siguiente = (
      select id_estudio
      from fn_calcular_orden_optimo_estudios(p_ids_estudios)
      order by orden_calculado limit 1 offset 1
    )
  where id = v_id_visita;

  return v_id_visita;
end;
$$;

comment on function fn_crear_visita is
'Crea visita y visita_estudios con orden óptimo calculado automáticamente.
 Usado por POST /visitas';


-- ------------------------------------------------------------
-- fn_avanzar_estudio_visita
-- Avanza al siguiente estudio de la visita
-- Actualiza es_estudio_actual, progreso_general y estudio_siguiente
-- Usado por PATCH /visitas/{id}/avanzar (operador dashboard)
-- ------------------------------------------------------------
create or replace function fn_avanzar_estudio_visita(
  p_id_visita          uuid,
  p_id_visita_estudio  uuid,
  p_nuevo_estatus      integer,
  p_nuevo_paso         text,
  p_nuevo_progreso     integer
)
returns jsonb language plpgsql as $$
declare
  v_orden_actual    integer;
  v_orden_siguiente integer;
  v_id_ve_siguiente uuid;
  v_id_est_siguiente integer;
  v_total_estudios  integer;
  v_completados     integer;
  v_progreso_general integer;
  v_es_final        boolean;
begin
  -- Actualizar el estudio actual
  update visita_estudios set
    id_estatus      = p_nuevo_estatus,
    paso_actual     = p_nuevo_paso,
    progreso_pct    = p_nuevo_progreso
  where id = p_id_visita_estudio
  returning orden_atencion into v_orden_actual;

  -- Verificar si el nuevo estado es final
  select es_estado_final into v_es_final
  from estatus_servicio where id = p_nuevo_estatus;

  if v_es_final then
    -- Desmarcar como actual y activar el siguiente
    update visita_estudios set es_estudio_actual = false
    where id = p_id_visita_estudio;

    v_orden_siguiente := v_orden_actual + 1;

    select id, id_estudio into v_id_ve_siguiente, v_id_est_siguiente
    from visita_estudios
    where id_visita = p_id_visita and orden_atencion = v_orden_siguiente;

    if found then
      update visita_estudios set es_estudio_actual = true
      where id = v_id_ve_siguiente;
    end if;

    -- Calcular progreso general
    select count(*), count(*) filter (where es2.es_estado_final = true)
    into v_total_estudios, v_completados
    from visita_estudios ve2
    join estatus_servicio es2 on es2.id = ve2.id_estatus
    where ve2.id_visita = p_id_visita;

    v_progreso_general := round((v_completados::numeric / v_total_estudios) * 100);

    -- Actualizar visita
    update visitas set
      progreso_general_pct  = v_progreso_general,
      id_estudio_actual     = v_id_est_siguiente,
      id_estudio_siguiente  = (
        select id_estudio from visita_estudios
        where id_visita = p_id_visita
          and orden_atencion = v_orden_siguiente + 1
        limit 1
      ),
      estatus = case when v_id_ve_siguiente is null then 'completada' else 'en_proceso' end
    where id = p_id_visita;
  end if;

  return fn_obtener_estado_visita(p_id_visita);
end;
$$;

comment on function fn_avanzar_estudio_visita is
'Avanza el estado de un estudio en la visita y actualiza el progreso general.
 Activa automáticamente el siguiente estudio en el orden calculado.
 IMPORTANTE para el backend FastAPI:
   - p_id_visita viene del PATH PARAM de la URL: /visitas/{visita_id}/avanzar
   - p_id_visita_estudio, p_nuevo_estatus, p_nuevo_paso, p_nuevo_progreso vienen del BODY
   - Ejemplo FastAPI:
       @app.patch("/visitas/{visita_id}/avanzar")
       async def avanzar(visita_id: str, body: AvanzarBody):
           supabase.rpc("fn_avanzar_estudio_visita", {
               "p_id_visita": visita_id,
               "p_id_visita_estudio": body.id_visita_estudio,
               ...
           })';


-- ============================================================
-- SECCIÓN 5: VISTAS
-- ============================================================

create or replace view v_dashboard_sucursal as
select
  s.id                                    as id_sucursal,
  s.nombre                                as sucursal,
  s.ciudad,
  e.id                                    as id_estudio,
  e.nombre                                as estudio,
  coalesce(c.pacientes_en_espera, 0)      as pacientes_en_espera,
  coalesce(c.pacientes_en_atencion, 0)    as pacientes_en_atencion,
  coalesce(c.pacientes_urgentes, 0)       as pacientes_urgentes,
  coalesce(c.pacientes_con_cita, 0)       as pacientes_con_cita,
  fn_calcular_tiempo_espera(s.id, e.id)   as tiempo_espera_estimado_min,
  coalesce(cp.activos, 1)                 as consultorios_activos,
  coalesce(cp.cantidad_consultorios, 1)   as consultorios_totales,
  c.ultima_actualizacion
from sucursales s
cross join estudios e
left join colas_en_tiempo_real c
  on c.id_sucursal = s.id and c.id_estudio = e.id
left join consultorios_por_sucursal cp
  on cp.id_sucursal = s.id and cp.id_estudio = e.id
where s.activa = true and e.activo = true
  and exists (
    select 1 from consultorios_por_sucursal
    where id_sucursal = s.id and id_estudio = e.id
  );

comment on view v_dashboard_sucursal is 'Vista para el dashboard del operador. Incluye urgentes y con cita para el cálculo de prioridad.';


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
    when 'urgente'   then 1
    when 'con_cita'  then 2
    when 'sin_cita'  then 3
  end,
  v.timestamp_llegada asc;

comment on view v_visitas_activas is 'Visitas en proceso ordenadas por prioridad (urgente > con_cita > sin_cita) y luego por llegada.';


-- ============================================================
-- SECCIÓN 6: ROW LEVEL SECURITY
-- ============================================================

alter table pacientes                      enable row level security;
alter table visitas                        enable row level security;
alter table visita_estudios                enable row level security;
alter table historial_estados_visita_estudio enable row level security;

-- Catálogos: lectura pública (sin datos personales)
create policy "pub_read_estudios"          on estudios              for select using (true);
create policy "pub_read_subestudios"       on subestudios           for select using (true);
create policy "pub_read_sucursales"        on sucursales            for select using (activa = true);
create policy "pub_read_colas"             on colas_en_tiempo_real  for select using (true);
create policy "pub_read_consultorios"      on consultorios_por_sucursal for select using (true);
create policy "pub_read_estatus"           on estatus_servicio      for select using (true);
create policy "pub_read_promedios"         on promedios_espera_historicos for select using (true);
create policy "pub_read_reglas"            on reglas_orden_estudios for select using (activa = true);
create policy "pub_read_restricciones"     on restricciones_estudio for select using (activa = true);

-- Datos sensibles: solo el backend (service_role) escribe
create policy "backend_pacientes"          on pacientes             for all using (auth.role() = 'service_role');
create policy "backend_visitas"            on visitas               for all using (auth.role() = 'service_role');
create policy "backend_visita_estudios"    on visita_estudios       for all using (auth.role() = 'service_role');
create policy "backend_historial"          on historial_estados_visita_estudio for all using (auth.role() = 'service_role');


-- ============================================================
-- SECCIÓN 7: DATOS SEMILLA
-- Fuente directa de los archivos CSV + PDF de reglas
-- ============================================================

-- Estudios (CatalogoEstudios + TiemposPromedio + PrioridadAtencion + PDF reglas)
insert into estudios (
  id, nombre, orden_prioridad, requiere_preparacion,
  tiempo_espera_promedio_min, tiempo_atencion_promedio_min, tiempo_atencion_es_variable,
  requiere_cita, puntualidad_obligatoria, preparacion_instrucciones
) values
(-2, 'EXAMEN DE LA VISTA',   0,  false, 20, null, true,  false, false,
  'No se requiere preparación especial. Evita conducir si recibes gotas para dilatar las pupilas.'),
(1,  'DENSITOMETRÍA',        -6, false, 20, 12,   false, false, false,
  'Evita suplementos de calcio 24 horas antes. No uses ropa con broches metálicos. Informa si estás embarazada.'),
(2,  'LABORATORIO',          -10, true, 20, 5,    false, false, false,
  'Ayuno mínimo de 8 horas (solo agua natural permitida). Evita ejercicio intenso el día anterior. Si llevas muestra de orina desde casa, no debe tener más de 2 horas de recolectada. Lleva tu orden médica.'),
(3,  'MASTOGRAFÍA',          -7, false, 20, 8,    false, false, false,
  'No uses desodorante, talco ni cremas en axilas o senos el día del estudio. Si tienes menos de 35 años o tu última mastografía fue hace menos de 6 meses, debes presentar orden médica de especialista.'),
(4,  'PAPANICOLAOU',         -4, false, 20, 8,    false, false, false,
  'Abstente de relaciones sexuales 48 horas antes. No uses óvulos, cremas vaginales ni tampones 48 horas antes. No estés en periodo menstrual.'),
(5,  'RAYOS X',              -8, false, 30, null, true,  false, false,
  'No se requiere preparación especial en la mayoría de los casos. Retira objetos metálicos de la zona a estudiar. Informa si estás embarazada.'),
(6,  'ULTRASONIDO',          -3, true,  30, null, true,  false, false,
  'Para ultrasonido abdominal: ayuno de 4-6 horas. Para ultrasonido pélvico: vejiga llena (toma 1 litro de agua 1 hora antes y no orines). Consulta tu orden para instrucciones específicas según el tipo de ultrasonido.'),
(9,  'ELECTROCARDIOGRAMA',   -5, false, 20, 7,    false, false, false,
  'Sin preparación especial. No uses cremas ni lociones en pecho, brazos y piernas. Evita actividad física intensa 30 minutos antes.'),
(11, 'TOMOGRAFÍA',           -2, true,  30, null, true,  true,  true,
  'Ayuno de 4 horas si requiere medio de contraste. Retira objetos metálicos. Informa alergias a medios de contraste y si estás embarazada. Llega puntual — si no llegas a tu hora se te asignará una nueva cita.'),
(12, 'RESONANCIA MAGNÉTICA', -1, true,  40, null, true,  true,  true,
  'Retira todos los objetos metálicos. Informa si tienes marcapasos, implantes metálicos o clips cerebrales. Ayuno de 4 horas si requiere contraste. Llega puntual — si no llegas a tu hora se te asignará una nueva cita.'),
(16, 'NUTRICIÓN',            -9, false, 20, 15,   false, false, false,
  'Lleva registros de tu alimentación de los últimos 3 días si los tienes. Informa tu peso y talla actuales si los conoces.'),
(24, 'ÓPTICA',               0,  false, 20, null, true,  false, false,
  'Sin preparación especial.'),
(52, 'SALUD OCUPACIONAL - EMPRESAS', 1, false, 20, null, true, false, false,
  'Lleva tu orden de trabajo y documentos de identificación. Ayuno de 8 horas si el paquete incluye laboratorio.');


-- Estatus de servicio (Ventas.csv IdEstatus)
insert into estatus_servicio (id, nombre, descripcion, es_estado_final, orden_flujo) values
(1,  'PAGADO',                 'Servicio pagado, paciente en espera',              false, 1),
(9,  'INICIO_TOMA',            'Inició la realización del estudio',                false, 2),
(10, 'FIN_TOMA',               'Finalizó la toma del estudio',                     false, 3),
(11, 'RECEPCION ESTUDIOS',     'Estudios en área de diagnóstico',                  false, 4),
(2,  'ENTRO A DIAGNOSTICO',    'En proceso de diagnóstico/lectura',                false, 5),
(6,  'ENTRO A DIAGNOSTICO 2',  'Segunda revisión diagnóstica',                     false, 6),
(3,  'SALIO DE DIAGNOSTICO',   'Resultados disponibles',                           false, 7),
(7,  'SALIO DE DIAGNOSTICO 2', 'Segunda salida del proceso de diagnóstico',        false, 8),
(12, 'VERIFICADO',             'Resultados verificados y listos para entrega',     true,  9),
(4,  'ENTREGADO AL PACIENTE',  'Resultados entregados físicamente al paciente',    true,  10),
(8,  'DEVOLUCION',             'Servicio devuelto o cancelado',                    true,  null);


-- Reglas de orden entre estudios (PDF oficial Hackathon 2026)
insert into reglas_orden_estudios
  (id_estudio_primero, id_estudio_segundo, motivo, es_obligatorio) values

-- Papanicolaou ANTES de Ultrasonido transvaginal
-- "Ultrasonido transvaginal + Papanicolaou → primero se realiza Papanicolaou"
(4, 6,
 'Papanicolaou siempre antes de Ultrasonido. Si hay combinación, el Papanicolaou va primero.',
 true),

-- Densitometría ANTES de Tomografía (con contraste)
-- "Si paciente tiene Tomografía/RM con contraste + densitometría, primero la densitometría"
(1, 11,
 'Densitometría antes de Tomografía. El medio de contraste puede afectar la densitometría.',
 true),

-- Densitometría ANTES de Resonancia Magnética (con contraste)
(1, 12,
 'Densitometría antes de Resonancia Magnética. El medio de contraste puede afectar la densitometría.',
 true),

-- Laboratorio ANTES de Ultrasonido cuando el lab requiere ayuno
-- "Puede verse afectado por estudios que requieren ayuno → primero laboratorio, después ultrasonido"
(2, 6,
 'Laboratorio antes de Ultrasonido cuando el laboratorio requiere ayuno.',
 true);


-- Restricciones por estudio (PDF oficial)
insert into restricciones_estudio
  (id_estudio, tipo, descripcion, requiere_orden_medica) values

(3, 'edad',
 'Pacientes menores de 35 años deben presentar orden médica de especialista para realizarse mastografía.',
 true),

(3, 'tiempo_desde_ultimo',
 'Si la paciente se realizó una mastografía hace menos de 6 meses, debe presentar orden médica de su médico especialista.',
 true),

(11, 'puntualidad',
 'Tomografía requiere puntualidad estricta. Si el paciente no llega a su hora programada se le asigna una nueva cita.',
 false),

(12, 'puntualidad',
 'Resonancia Magnética requiere puntualidad estricta. Si el paciente no llega a su hora programada se le asigna una nueva cita.',
 false);


-- Sucursales de prueba (datos reales del CSV)
insert into sucursales (id, nombre, direccion, ciudad, estado, latitud, longitud) values
(1,  'Culiacán Centro',  'Av. Insurgentes 100',      'Culiacán',   'Sinaloa',         24.7994, -107.3880),
(5,  'Los Mochis',       'Blvd. Castro 450',          'Los Mochis', 'Sinaloa',         25.7906, -108.9931),
(6,  'Mazatlán',         'Av. Insurgentes 2500',      'Mazatlán',   'Sinaloa',         23.2494, -106.4111),
(9,  'Mexicali',         'Calz. Justo Sierra 1200',   'Mexicali',   'Baja California', 32.6245, -115.4523),
(12, 'Tijuana',          'Blvd. Agua Caliente 8910',  'Tijuana',    'Baja California', 32.5027, -117.0037);


-- Consultorios (datos reales ConssultoriosXClinica.csv — sucursal 1)
insert into consultorios_por_sucursal (id_sucursal, id_estudio, cantidad_consultorios, activos) values
(1, 1, 1,1),(1, 2, 6,5),(1, 3, 1,1),(1, 4, 1,1),(1, 5, 2,2),
(1, 6, 4,3),(1, 9, 1,1),(1,11, 1,1),(1,12, 1,1),(1,16, 1,1),
(5, 2, 3,3),(5, 5, 1,1),(5, 6, 2,2),(5, 9, 1,1),
(6, 2, 4,4),(6, 3, 1,1),(6, 5, 2,1),(6, 6, 2,2),
(9, 2, 5,4),(9, 4, 1,1),(9, 5, 2,2),(9, 6, 3,3),(9, 9, 1,1),
(12,2, 8,7),(12,5, 3,3),(12,6, 4,4),(12,9, 2,2),(12,11,2,2),(12,12,1,1);


-- Colas iniciales simuladas para demo
insert into colas_en_tiempo_real
  (id_sucursal, id_estudio, pacientes_en_espera, pacientes_en_atencion,
   pacientes_urgentes, pacientes_con_cita) values
(1, 2,  8,5,0,2),(1, 5, 3,2,0,1),(1, 6, 5,3,1,1),(1, 9, 2,1,0,0),
(5, 2,  2,2,0,1),(5, 5, 1,1,0,0),(5, 6, 1,1,0,0),
(6, 2,  4,3,0,2),(6, 5, 2,1,0,1),(6, 6, 2,2,0,0),
(9, 2,  6,4,0,3),(9, 5, 2,2,0,1),(9, 6, 3,3,1,1),(9, 9, 1,1,0,0),
(12,2, 10,7,0,4),(12,5,4,3,0,2), (12,6,5,4,2,2), (12,9,2,1,0,1);


-- Paciente de prueba
insert into pacientes (id, nombre, email, telefono) values
('00000000-0000-0000-0000-000000000001',
 'María González', 'maria@ejemplo.com', '6671234567');


-- Visita de prueba con DOS estudios: Laboratorio + Ultrasonido
-- fn_crear_visita aplicará la regla: Laboratorio ANTES de Ultrasonido
select fn_crear_visita(
  '00000000-0000-0000-0000-000000000001'::uuid,
  1,
  ARRAY[6, 2],      -- [Ultrasonido=6, Laboratorio=2] — en orden incorrecto a propósito
  'sin_cita'        -- el sistema los reordenará: Laboratorio primero
);
-- VISITA VERIFICADA EN SUPABASE ✓
-- visita_id real: 06b8efbf-67bc-426c-9523-3059d0dec059
-- Resultado confirmado:
--   orden=1 LABORATORIO  (id=2) actual=true  estatus=PAGADO
--   orden=2 ULTRASONIDO  (id=6) actual=false estatus=PAGADO
-- La orquestación automática funcionó: ARRAY[6,2] → reordenado a Laboratorio primero
--
-- Para verificar en cualquier momento:
--   SELECT fn_obtener_estado_visita('06b8efbf-67bc-426c-9523-3059d0dec059');
--
-- Para el id del visita_estudio de Laboratorio (necesario para PATCH /avanzar):
--   SELECT id FROM visita_estudios
--   WHERE id_visita = '06b8efbf-67bc-426c-9523-3059d0dec059'
--   AND id_estudio = 2;
