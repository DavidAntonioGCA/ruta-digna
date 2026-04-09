from fastapi import APIRouter, HTTPException
from datetime import datetime
try:
    from backend.models.schemas import CrearAlertaRequest, ResolverAlertaRequest
    from backend.services.supabase_client import get_supabase
except ImportError:
    from models.schemas import CrearAlertaRequest, ResolverAlertaRequest
    from services.supabase_client import get_supabase

router = APIRouter()


@router.get("/{id_sucursal}")
async def get_alertas_sucursal(id_sucursal: int, id_estudio: int | None = None):
    """
    Obtiene alertas activas de una sucursal.
    Si se pasa id_estudio, filtra solo las generales (id_estudio=NULL)
    y las específicas de ese estudio.
    """
    try:
        sb = get_supabase()
        result = sb.rpc("fn_obtener_alertas_sucursal", {
            "p_id_sucursal": id_sucursal
        }).execute()
        alertas = result.data or []

        if id_estudio is not None:
            alertas = [
                a for a in alertas
                if a.get("id_estudio") is None or a.get("id_estudio") == id_estudio
            ]

        return alertas
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/")
async def crear_alerta(body: CrearAlertaRequest):
    """
    Crea una nueva alerta de imprevisto.
    El operador/doctor reporta un problema que afecta tiempos de espera.
    """
    try:
        sb = get_supabase()
        data = {
            "id_sucursal":        body.id_sucursal,
            "id_estudio":         body.id_estudio,
            "tipo_alerta":        body.tipo_alerta,
            "titulo":             body.titulo,
            "descripcion":        body.descripcion,
            "severidad":          body.severidad,
            "impacto_tiempo_min": body.impacto_tiempo_min,
            "activa":             True,
            "creada_por":         "operador",
        }
        result = sb.table("alertas_sucursal").insert(data).execute()

        if not result.data:
            raise HTTPException(500, "No se pudo crear la alerta")

        return {
            "id": result.data[0]["id"],
            "mensaje": "Alerta creada exitosamente",
            "alerta": result.data[0]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.patch("/{alerta_id}/resolver")
async def resolver_alerta(alerta_id: str, body: ResolverAlertaRequest):
    """
    Marca una alerta como resuelta.
    """
    try:
        sb = get_supabase()
        result = sb.table("alertas_sucursal").update({
            "activa":               False,
            "resuelta_por":         body.resuelta_por,
            "timestamp_resolucion": datetime.utcnow().isoformat(),
        }).eq("id", alerta_id).execute()

        if not result.data:
            raise HTTPException(404, "Alerta no encontrada")

        return {"mensaje": "Alerta resuelta", "alerta": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/{id_sucursal}/historial")
async def get_historial_alertas(id_sucursal: int, limit: int = 20):
    """
    Historial de alertas (activas + resueltas) para auditoría.
    """
    try:
        sb = get_supabase()
        result = sb.table("alertas_sucursal") \
            .select("*") \
            .eq("id_sucursal", id_sucursal) \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        return result.data or []
    except Exception as e:
        raise HTTPException(500, str(e))
