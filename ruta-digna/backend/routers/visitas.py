from fastapi import APIRouter, HTTPException
from datetime import datetime
try:
    from backend.models.schemas import CrearVisitaRequest, AvanzarEstudioRequest, CambiarTipoPacienteRequest
    from backend.services.supabase_client import get_supabase
except ImportError:
    from models.schemas import CrearVisitaRequest, AvanzarEstudioRequest, CambiarTipoPacienteRequest
    from services.supabase_client import get_supabase

router = APIRouter()


def _enrich_estado(sb, estado: dict) -> dict:
    """
    Garantiza que cada elemento de 'estudios' tenga 'id_visita_estudio'.
    Si la función de BD ya lo devuelve, no hace nada. Si no, lo obtiene
    con una consulta directa a visita_estudios.
    """
    if not estado or not isinstance(estado, dict):
        return estado
    estudios = estado.get("estudios") or []
    if not estudios:
        return estado
    # ¿Ya tiene id_visita_estudio en todos los registros?
    if all(e.get("id_visita_estudio") for e in estudios):
        return estado
    # Consulta directa para obtener ve.id por visita + estudio + orden
    visita_id = estado.get("visita_id")
    if not visita_id:
        return estado
    try:
        ve_rows = sb.table("visita_estudios").select(
            "id, id_estudio, orden_atencion, es_estudio_actual"
        ).eq("id_visita", visita_id).order("orden_atencion").execute()
        ve_map = {
            (r["id_estudio"], r["orden_atencion"]): r
            for r in (ve_rows.data or [])
        }
        for e in estudios:
            key = (e.get("id_estudio"), e.get("orden"))
            row = ve_map.get(key)
            if row and not e.get("id_visita_estudio"):
                e["id_visita_estudio"] = row["id"]
    except Exception:
        pass
    return estado


def _actualizar_cola(sb, *, id_sucursal: int, id_estudio: int, delta_espera: int = 0, delta_atencion: int = 0, delta_urgentes: int = 0, delta_con_cita: int = 0):
    existing = sb.table("colas_en_tiempo_real") \
        .select("pacientes_en_espera,pacientes_en_atencion,pacientes_urgentes,pacientes_con_cita") \
        .eq("id_sucursal", id_sucursal) \
        .eq("id_estudio", id_estudio) \
        .limit(1) \
        .execute()

    row = existing.data[0] if existing.data else {}
    pacientes_en_espera = max(int(row.get("pacientes_en_espera") or 0) + delta_espera, 0)
    pacientes_en_atencion = max(int(row.get("pacientes_en_atencion") or 0) + delta_atencion, 0)
    pacientes_urgentes = max(int(row.get("pacientes_urgentes") or 0) + delta_urgentes, 0)
    pacientes_con_cita = max(int(row.get("pacientes_con_cita") or 0) + delta_con_cita, 0)

    sb.table("colas_en_tiempo_real").upsert({
        "id_sucursal": id_sucursal,
        "id_estudio": id_estudio,
        "pacientes_en_espera": pacientes_en_espera,
        "pacientes_en_atencion": pacientes_en_atencion,
        "pacientes_urgentes": pacientes_urgentes,
        "pacientes_con_cita": pacientes_con_cita,
        "ultima_actualizacion": datetime.utcnow().isoformat(),
    }, on_conflict="id_sucursal,id_estudio").execute()


def _sincronizar_colas(sb, id_sucursal: int):
    """Recalcula colas_en_tiempo_real desde los datos reales de visitas."""
    try:
        sb.rpc("fn_sincronizar_colas", {"p_id_sucursal": id_sucursal}).execute()
    except Exception:
        pass  # No bloquear operación principal si falla el sync


def _get_sucursal(sb, visita_id: str) -> int | None:
    """Obtiene id_sucursal de una visita."""
    try:
        r = sb.table("visitas").select("id_sucursal").eq("id", visita_id).execute()
        return r.data[0]["id_sucursal"] if r.data else None
    except Exception:
        return None


@router.get("/status/{visita_id}")
async def get_visita_status(visita_id: str):
    """Estado completo de la visita con todos los estudios ordenados + guía + alertas."""
    try:
        sb = get_supabase()
        result = sb.rpc("fn_obtener_estado_visita", {
            "p_visita_id": visita_id
        }).execute()
        if not result.data:
            raise HTTPException(404, f"Visita {visita_id} no encontrada")
        return _enrich_estado(sb, result.data)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/")
async def crear_visita(body: CrearVisitaRequest):
    """
    Crea una visita con múltiples estudios ordenados automáticamente.
    Soporta tipo_paciente: urgente, embarazada, adulto_mayor, discapacidad, con_cita, sin_cita.
    Sincroniza las colas en tiempo real tras la creación.
    """
    try:
        sb = get_supabase()
        result = sb.rpc("fn_crear_visita", {
            "p_id_paciente":       body.id_paciente,
            "p_id_sucursal":       body.id_sucursal,
            "p_ids_estudios":      body.ids_estudios,
            "p_tipo_paciente":     body.tipo_paciente,
            "p_id_reservacion_sd": body.id_reservacion_sd
        }).execute()
        visita_id = result.data

        estado = sb.rpc("fn_obtener_estado_visita", {
            "p_visita_id": str(visita_id)
        }).execute()

        # Sincronizar colas con datos reales
        _sincronizar_colas(sb, body.id_sucursal)

        return {
            "visita_id": str(visita_id),
            "estado":    _enrich_estado(sb, estado.data)
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/activas")
async def get_visitas_activas():
    """
    Visitas en proceso para el dashboard del operador.
    Ordenadas: urgente > embarazada > adulto_mayor > discapacidad > con_cita > sin_cita.
    """
    try:
        sb = get_supabase()
        result = sb.from_("v_visitas_activas").select("*").execute()
        return result.data or []
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/especialista")
async def get_visitas_especialista(estudio: str, id_sucursal: int | None = None):
    """
    Pacientes cuyo estudio ACTUAL coincide con el área del especialista.
    Si se recibe id_sucursal, filtra solo los pacientes de esa sucursal.
    Retorna datos completos (con array de estudios) para avanzar estado y cambiar prioridad.

    Usa visita_estudios.es_estudio_actual (misma fuente que la pantalla pública),
    NO visitas.id_estudio_actual, para evitar desincronización.
    """
    try:
        sb = get_supabase()

        # 1. Resolver id_estudio a partir del nombre del área (ilike, case-insensitive)
        est_r = sb.table("estudios").select("id").ilike("nombre", f"%{estudio}%").execute()
        if not est_r.data:
            return []
        id_estudios = [e["id"] for e in est_r.data]

        # 2. Buscar visita_estudios del área del especialista.
        #    Se trae id_estatus para filtrar en Python (más robusto que encadenar .neq en PostgREST).
        #    Un paciente cuyo estudio ya llegó a VERIFICADO (12) no debe aparecer en la cola activa.
        ve_r = (
            sb.table("visita_estudios")
            .select("id_visita, id_estatus, es_estudio_actual")
            .in_("id_estudio", id_estudios)
            .execute()
        )
        # Solo visitas donde el estudio es actual Y no está verificado
        visita_ids = list({
            r["id_visita"] for r in (ve_r.data or [])
            if r.get("es_estudio_actual") and r.get("id_estatus") != 12
        })

        # 3. Filtrar: solo visitas en_proceso y, si aplica, de la sucursal del especialista
        visitas_q = (
            sb.table("visitas")
            .select("id")
            .in_("id", visita_ids)
            .eq("estatus", "en_proceso")
        )
        if id_sucursal:
            visitas_q = visitas_q.eq("id_sucursal", id_sucursal)

        vis_r = visitas_q.execute()
        if not vis_r.data:
            return []

        valid_ids = [r["id"] for r in vis_r.data]

        # 4. Obtener estado completo de cada visita
        PRIO = {"urgente": 1, "embarazada": 2, "adulto_mayor": 3,
                "discapacidad": 4, "con_cita": 5, "sin_cita": 6}

        visitas = []
        for vid in valid_ids:
            try:
                estado = sb.rpc("fn_obtener_estado_visita",
                                {"p_visita_id": vid}).execute()
                if estado.data:
                    visitas.append(_enrich_estado(sb, estado.data))
            except Exception:
                pass

        visitas.sort(key=lambda v: (
            PRIO.get(v.get("tipo_paciente", "sin_cita"), 6),
            v.get("timestamp_llegada", "")
        ))
        return visitas
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/atendidos")
async def get_visitas_atendidas(estudio: str, id_sucursal: int | None = None):
    """
    Visitas donde el área del especialista ya fue VERIFICADA (id_estatus=12) hoy.
    No requiere que la visita esté 'finalizada' globalmente — basta con que
    el estudio del especialista haya sido completado.
    """
    try:
        sb = get_supabase()
        from datetime import date

        est_r = sb.table("estudios").select("id").ilike("nombre", f"%{estudio}%").execute()
        if not est_r.data:
            return []
        id_estudios = [e["id"] for e in est_r.data]

        # Buscar visita_estudios donde el estudio del especialista ya fue verificado
        # id_estatus = 12 → VERIFICADO (el especialista lo finalizó)
        ve_r = (
            sb.table("visita_estudios")
            .select("id_visita")
            .in_("id_estudio", id_estudios)
            .eq("id_estatus", 12)
            .execute()
        )
        if not ve_r.data:
            return []

        visita_ids = list({r["id_visita"] for r in ve_r.data})

        # Filtrar: visitas de hoy (por timestamp_llegada) — sin importar si la
        # visita completa está finalizada (puede tener más estudios pendientes)
        hoy_inicio = f"{date.today().isoformat()}T00:00:00"
        q = (
            sb.table("visitas")
            .select("id, id_paciente, id_sucursal, estatus, tipo_paciente, timestamp_llegada, timestamp_fin_visita")
            .in_("id", visita_ids)
            .gte("timestamp_llegada", hoy_inicio)
            .order("timestamp_llegada", desc=True)
        )
        if id_sucursal:
            q = q.eq("id_sucursal", id_sucursal)

        vis_r = q.execute()
        if not vis_r.data:
            return []

        # Enriquecer con nombre del paciente y resultados ya subidos
        visitas = []
        for v in vis_r.data:
            pac = sb.table("pacientes").select("nombre").eq("id", v["id_paciente"]).single().execute()
            res = sb.table("resultados_estudios").select("id, nombre_archivo, tipo_estudio, url_archivo, created_at, subido_por").eq("id_visita", v["id"]).order("created_at", desc=True).execute()
            visitas.append({
                "visita_id":            v["id"],
                "paciente":             pac.data["nombre"] if pac.data else "Desconocido",
                "tipo_paciente":        v["tipo_paciente"],
                "timestamp_llegada":    v["timestamp_llegada"],
                "timestamp_fin_visita": v["timestamp_fin_visita"],
                "resultados":           res.data or [],
            })

        return visitas
    except Exception as e:
        raise HTTPException(500, str(e))



@router.patch("/{visita_id}/avanzar")
async def avanzar_estudio(visita_id: str, body: AvanzarEstudioRequest):
    """
    Avanza el estado de un estudio en la visita.
    Flujo: 1(PAGADO) → 9(INICIO_TOMA) → 10(FIN_TOMA) → 12(VERIFICADO)

    Hace los updates directamente en Python para evitar depender de funciones
    de BD que puedan fallar (fn_avanzar_estudio_visita llama fn_obtener_estado_visita
    que a su vez necesita fn_obtener_alertas_sucursal — si alguna falta, rollback total).
    """
    try:
        sb = get_supabase()
        id_sucursal = _get_sucursal(sb, visita_id)

        # 1. Verificar que el visita_estudio existe y pertenece a esta visita
        ve_r = sb.table("visita_estudios").select("id, orden_atencion").eq("id", body.id_visita_estudio).eq("id_visita", visita_id).execute()
        if not ve_r.data:
            raise HTTPException(404, f"visita_estudio {body.id_visita_estudio} no encontrado en visita {visita_id}")
        orden_actual = ve_r.data[0]["orden_atencion"]

        # 2. Actualizar el estudio
        sb.table("visita_estudios").update({
            "id_estatus":   body.nuevo_estatus,
            "paso_actual":  body.nuevo_paso,
            "progreso_pct": body.nuevo_progreso,
        }).eq("id", body.id_visita_estudio).execute()

        # 3. Si el estatus es final (VERIFICADO=12), activar el siguiente estudio
        es_final_r = sb.table("estatus_servicio").select("es_estado_final").eq("id", body.nuevo_estatus).single().execute()
        es_final = bool(es_final_r.data and es_final_r.data.get("es_estado_final"))

        if es_final:
            # Desmarcar actual
            sb.table("visita_estudios").update({"es_estudio_actual": False}).eq("id", body.id_visita_estudio).execute()

            # Buscar siguiente estudio en la secuencia
            next_r = sb.table("visita_estudios").select("id, id_estudio").eq("id_visita", visita_id).gt("orden_atencion", orden_actual).order("orden_atencion").limit(1).execute()

            if next_r.data:
                # Activar siguiente
                siguiente_ve = next_r.data[0]
                sb.table("visita_estudios").update({"es_estudio_actual": True}).eq("id", siguiente_ve["id"]).execute()

                # Recalcular progreso general
                todos_r = sb.table("visita_estudios").select("id_estatus").eq("id_visita", visita_id).execute()
                final_ids_r = sb.table("estatus_servicio").select("id").eq("es_estado_final", True).execute()
                final_ids = {r["id"] for r in (final_ids_r.data or [])}
                total = len(todos_r.data or [])
                completados = sum(1 for r in (todos_r.data or []) if r["id_estatus"] in final_ids)
                progreso = round((completados / total) * 100) if total else 0

                sb.table("visitas").update({
                    "id_estudio_actual":    siguiente_ve["id_estudio"],
                    "progreso_general_pct": progreso,
                    "estatus":              "en_proceso",
                }).eq("id", visita_id).execute()
            else:
                # No hay más estudios — visita completada
                sb.table("visitas").update({
                    "id_estudio_actual":    None,
                    "progreso_general_pct": 100,
                    "estatus":              "completada",
                    "timestamp_fin_visita": datetime.utcnow().isoformat(),
                }).eq("id", visita_id).execute()

        # 4. Sincronizar colas
        if id_sucursal:
            _sincronizar_colas(sb, id_sucursal)

        return {"ok": True, "nuevo_estatus": body.nuevo_estatus, "visita_id": visita_id}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.patch("/{visita_id}/tipo-paciente")
async def cambiar_tipo_paciente(visita_id: str, body: CambiarTipoPacienteRequest):
    """
    Cambia el tipo/prioridad de un paciente.
    El operador puede marcar a alguien como urgente, embarazada, adulto mayor, etc.
    Al cambiar la prioridad, todos los tiempos de espera se recalculan.
    """
    try:
        sb = get_supabase()

        # Obtener sucursal antes de cambiar
        id_sucursal = _get_sucursal(sb, visita_id)

        result = sb.table("visitas").update({
            "tipo_paciente": body.tipo_paciente
        }).eq("id", visita_id).execute()

        if not result.data:
            raise HTTPException(404, "Visita no encontrada")

        # Sincronizar colas: el cambio de prioridad afecta a toda la cola
        if id_sucursal:
            _sincronizar_colas(sb, id_sucursal)

        # Re-obtener estado actualizado (los tiempos ya reflejan la nueva prioridad)
        estado = sb.rpc("fn_obtener_estado_visita", {
            "p_visita_id": visita_id
        }).execute()

        return {
            "mensaje": f"Prioridad cambiada a {body.tipo_paciente}",
            "estado":  estado.data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/pantalla/{id_sucursal}")
async def get_pantalla_sucursal(id_sucursal: int):
    """
    Datos para la Pantalla Pública de Turnos proyectada en monitores de la sucursal.
    Retorna:
      - llamando: turnos en INICIO_TOMA (9) — se acaba de llamar al paciente
      - en_espera: turnos en PAGADO (1) — próximos en la fila (máx 10)
    """
    try:
        sb = get_supabase()

        # ── Nombre de la sucursal ────────────────────────────────────
        suc_r = sb.table("sucursales").select("nombre").eq("id", id_sucursal).single().execute()
        sucursal_nombre = suc_r.data["nombre"] if suc_r.data else f"Sucursal {id_sucursal}"

        # ── Visitas activas de esta sucursal (con nombre del paciente) ──
        visitas_r = (
            sb.table("visitas")
            .select("id, tipo_paciente, timestamp_llegada, pacientes:id_paciente(nombre)")
            .eq("id_sucursal", id_sucursal)
            .eq("estatus", "en_proceso")
            .order("timestamp_llegada")
            .execute()
        )
        visitas_list = visitas_r.data or []
        if not visitas_list:
            return {"sucursal": sucursal_nombre, "llamando": [], "en_espera": []}

        visita_ids  = [v["id"] for v in visitas_list]
        visitas_map = {v["id"]: v for v in visitas_list}

        # ── Estudio activo por visita: busca el primer estudio con PAGADO(1) o INICIO_TOMA(9)
        # No depende de es_estudio_actual para mayor robustez ante desincronizaciones.
        ve_r = (
            sb.table("visita_estudios")
            .select("id, id_visita, id_estudio, id_estatus, orden_atencion")
            .in_("id_visita", visita_ids)
            .in_("id_estatus", [1, 9])
            .order("orden_atencion")
            .execute()
        )
        # Por cada visita, quedarse solo con el estudio de menor orden (el actual)
        ve_map: dict[str, dict] = {}
        for ve in (ve_r.data or []):
            if ve["id_visita"] not in ve_map:
                ve_map[ve["id_visita"]] = ve

        ve_list = list(ve_map.values())

        # ── Nombres de estudios ──────────────────────────────────────
        estudio_ids = list({ve["id_estudio"] for ve in ve_list})
        estudios_r  = sb.table("estudios").select("id, nombre").in_("id", estudio_ids).execute()
        estudios_map = {e["id"]: e["nombre"] for e in (estudios_r.data or [])}

        # ── Guías de navegación para mostrar ubicación ───────────────
        guias_r = (
            sb.table("guias_navegacion_sucursal")
            .select("id_estudio, nombre_area, ubicacion, piso, instrucciones")
            .eq("id_sucursal", id_sucursal)
            .eq("activa", True)
            .execute()
        )
        guias_map = {g["id_estudio"]: g for g in (guias_r.data or [])}

        # ── Abreviaciones de turno por área (3 letras fijas) ────────
        AREA_ABREV = {
            "LABORATORIO": "LAB", "ULTRASONIDO": "ULT", "RAYOS X": "RXX",
            "TOMOGRAFÍA":  "TOM", "ELECTROCARDIOGRAMA": "ECG",
            "MASTOGRAFÍA": "MAS", "DENSITOMETRÍA": "DEN",
        }

        # ── Paso 1: asignar códigos de turno por orden de llegada (fijos) ──
        # Los números no cambian aunque la prioridad del paciente cambie después.
        estudio_counters: dict[int, int] = {}
        entries: list[dict] = []

        PRIO = {"urgente": 1, "embarazada": 2, "adulto_mayor": 3,
                "discapacidad": 4, "con_cita": 5, "sin_cita": 6}

        for visita in sorted(visitas_list, key=lambda v: v["timestamp_llegada"]):
            ve = ve_map.get(visita["id"])
            if not ve:
                continue

            id_estudio  = ve["id_estudio"]
            id_estatus  = ve["id_estatus"]

            nombre_estudio = estudios_map.get(id_estudio, "ÁREA")
            nombre_upper   = nombre_estudio.upper()
            abrev = next(
                (v for k, v in AREA_ABREV.items() if k in nombre_upper),
                nombre_upper[:3].strip() if nombre_upper else "ARE",
            )

            estudio_counters[id_estudio] = estudio_counters.get(id_estudio, 0) + 1
            seq = estudio_counters[id_estudio]
            turno_codigo = f"{abrev}-{seq:03d}"

            guia = guias_map.get(id_estudio, {})
            pac_data   = visita.get("pacientes") or {}
            pac_nombre = pac_data.get("nombre", "") if isinstance(pac_data, dict) else ""

            entries.append({
                "turno_codigo":      turno_codigo,
                "ve_id":             ve["id"],
                "nombre_paciente":   pac_nombre,
                "tipo_paciente":     visita["tipo_paciente"],
                "area":              guia.get("nombre_area") or nombre_estudio,
                "id_estudio":        id_estudio,
                "ubicacion":         guia.get("ubicacion", ""),
                "piso":              guia.get("piso"),
                "instrucciones":     guia.get("instrucciones", ""),
                "timestamp_llegada": visita["timestamp_llegada"],
                "_estatus":          id_estatus,
            })

        # ── Paso 2: ordenar por prioridad para determinar quién se atiende primero ──
        entries.sort(key=lambda e: (PRIO.get(e["tipo_paciente"], 6), e["timestamp_llegada"]))

        llamando: list[dict] = []
        en_espera: list[dict] = []
        for entry in entries:
            estatus = entry.pop("_estatus")
            if estatus == 9:
                llamando.append(entry)
            else:
                en_espera.append(entry)

        return {
            "sucursal": sucursal_nombre,
            "llamando": llamando,
            "en_espera": en_espera[:10],
        }

    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/{visita_id}/estudios-reordenables")
async def get_estudios_reordenables(visita_id: str):
    """
    Indica cuáles estudios de la visita puede reordenar el paciente
    y cuáles tienen un orden obligatorio por reglas médicas.
    """
    try:
        sb = get_supabase()
        ve_result = sb.table("visita_estudios") \
            .select("id_estudio") \
            .eq("id_visita", visita_id) \
            .execute()

        if not ve_result.data:
            raise HTTPException(404, "Visita no encontrada")

        ids = [row["id_estudio"] for row in ve_result.data]

        result = sb.rpc("fn_estudios_reordenables", {
            "p_ids_estudios": ids
        }).execute()

        return result.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
