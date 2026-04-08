from fastapi import APIRouter, HTTPException
try:
    from backend.models.schemas import CrearVisitaRequest, AvanzarEstudioRequest, CambiarTipoPacienteRequest
    from backend.services.supabase_client import get_supabase
except ImportError:
    from models.schemas import CrearVisitaRequest, AvanzarEstudioRequest, CambiarTipoPacienteRequest
    from services.supabase_client import get_supabase

router = APIRouter()


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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/")
async def crear_visita(body: CrearVisitaRequest):
    """
    Crea una visita con múltiples estudios ordenados automáticamente.
    Ahora soporta tipo_paciente expandido: urgente, embarazada, adulto_mayor, etc.
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

        from datetime import datetime
        for id_estudio in body.ids_estudios:
            sb.table('colas_en_tiempo_real').upsert({
                'id_sucursal': body.id_sucursal,
                'id_estudio': id_estudio,
                'pacientes_en_espera': 1,
                'ultima_actualizacion': datetime.utcnow().isoformat()
            }, on_conflict='id_sucursal,id_estudio').execute()

        estado = sb.rpc("fn_obtener_estado_visita", {
            "p_visita_id": str(visita_id)
        }).execute()

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
    """
    try:
        sb = get_supabase()
        result = sb.rpc("fn_avanzar_estudio_visita", {
            "p_id_visita":         visita_id,
            "p_id_visita_estudio": body.id_visita_estudio,
            "p_nuevo_estatus":     body.nuevo_estatus,
            "p_nuevo_paso":        body.nuevo_paso,
            "p_nuevo_progreso":    body.nuevo_progreso
        }).execute()
        return result.data
    except Exception as e:
        raise HTTPException(500, str(e))


@router.patch("/{visita_id}/tipo-paciente")
async def cambiar_tipo_paciente(visita_id: str, body: CambiarTipoPacienteRequest):
    """
    Cambia el tipo/prioridad de un paciente.
    El operador puede marcar a alguien como urgente, embarazada, adulto mayor, etc.
    Esto afecta su posición en las colas.
    """
    try:
        sb = get_supabase()
        result = sb.table("visitas").update({
            "tipo_paciente": body.tipo_paciente
        }).eq("id", visita_id).execute()

        if not result.data:
            raise HTTPException(404, "Visita no encontrada")

        # Re-obtener estado actualizado
        estado = sb.rpc("fn_obtener_estado_visita", {
            "p_visita_id": visita_id
        }).execute()

        return {
            "mensaje": f"Prioridad cambiada a {body.tipo_paciente}",
            "estado": estado.data
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
        # Obtener ids de estudios de la visita
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
