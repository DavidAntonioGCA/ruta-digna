from fastapi import APIRouter, HTTPException
from datetime import datetime
try:
    from backend.models.schemas import CrearVisitaRequest, AvanzarEstudioRequest, CambiarTipoPacienteRequest
    from backend.services.supabase_client import get_supabase
except ImportError:
    from models.schemas import CrearVisitaRequest, AvanzarEstudioRequest, CambiarTipoPacienteRequest
    from services.supabase_client import get_supabase

router = APIRouter()

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
        return result.data
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
            "estado":    estado.data
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


@router.patch("/{visita_id}/avanzar")
async def avanzar_estudio(visita_id: str, body: AvanzarEstudioRequest):
    """
    Avanza el estado de un estudio en la visita.
    Flujo demo: 1(PAGADO) → 9(INICIO_TOMA) → 10(FIN_TOMA) → 12(VERIFICADO)
    Sincroniza las colas tras el avance.
    """
    try:
        sb = get_supabase()

        # Obtener sucursal antes de avanzar
        id_sucursal = _get_sucursal(sb, visita_id)

        result = sb.rpc("fn_avanzar_estudio_visita", {
            "p_id_visita":         visita_id,
            "p_id_visita_estudio": body.id_visita_estudio,
            "p_nuevo_estatus":     body.nuevo_estatus,
            "p_nuevo_paso":        body.nuevo_paso,
            "p_nuevo_progreso":    body.nuevo_progreso
        }).execute()

        # Sincronizar colas: el avance puede completar un estudio
        if id_sucursal:
            _sincronizar_colas(sb, id_sucursal)

        return result.data
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
