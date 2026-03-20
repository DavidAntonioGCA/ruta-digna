from fastapi import APIRouter, HTTPException
from models.schemas import CrearVisitaRequest, AvanzarEstudioRequest
from services.supabase_client import get_supabase

router = APIRouter()


@router.get("/status/{visita_id}")
async def get_visita_status(visita_id: str):
    """Estado completo de la visita con todos los estudios ordenados."""
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
    La función fn_crear_visita aplica las reglas del PDF oficial.
    """
    try:
        sb = get_supabase()
        result = sb.rpc("fn_crear_visita", {
            "p_id_paciente":    body.id_paciente,
            "p_id_sucursal":    body.id_sucursal,
            "p_ids_estudios":   body.ids_estudios,
            "p_tipo_paciente":  body.tipo_paciente,
            "p_id_reservacion_sd": body.id_reservacion_sd
        }).execute()
        visita_id = result.data

        # Obtener el estado inicial para devolverlo al frontend
        estado = sb.rpc("fn_obtener_estado_visita", {
            "p_visita_id": str(visita_id)
        }).execute()

        return {
            "visita_id":    str(visita_id),
            "estado":       estado.data
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/activas")
async def get_visitas_activas():
    """
    Lista de visitas en proceso para el dashboard del operador.
    Ordenadas por prioridad: urgente > con_cita > sin_cita, luego por llegada.
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
    Activa automáticamente el siguiente estudio cuando el actual termina.
    Usado por el dashboard del operador.

    Flujo simplificado para demo:
    1(PAGADO) → 9(INICIO_TOMA) → 10(FIN_TOMA) → 12(VERIFICADO=final)
    """
    try:
        sb = get_supabase()
        result = sb.rpc("fn_avanzar_estudio_visita", {
            "p_id_visita":         visita_id,        # del path param
            "p_id_visita_estudio": body.id_visita_estudio,
            "p_nuevo_estatus":     body.nuevo_estatus,
            "p_nuevo_paso":        body.nuevo_paso,
            "p_nuevo_progreso":    body.nuevo_progreso
        }).execute()
        return result.data
    except Exception as e:
        raise HTTPException(500, str(e))
