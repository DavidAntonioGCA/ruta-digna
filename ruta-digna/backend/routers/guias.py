from fastapi import APIRouter, HTTPException
try:
    from backend.models.schemas import GuiaNavegacionRequest
    from backend.services.supabase_client import get_supabase
except ImportError:
    from models.schemas import GuiaNavegacionRequest
    from services.supabase_client import get_supabase

router = APIRouter()


@router.get("/visita/{visita_id}")
async def get_guia_visita(visita_id: str):
    """
    Obtiene las instrucciones de navegación para todos los estudios
    de una visita, en el orden que los va a realizar.
    Cada sucursal tiene su propio layout.
    """
    try:
        sb = get_supabase()
        result = sb.rpc("fn_obtener_guia_visita", {
            "p_visita_id": visita_id
        }).execute()
        return result.data or []
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/sucursal/{id_sucursal}")
async def get_guias_sucursal(id_sucursal: int):
    """
    Obtiene todas las guías de navegación de una sucursal.
    Para el panel del operador (configuración).
    """
    try:
        sb = get_supabase()
        result = sb.table("guias_navegacion_sucursal") \
            .select("*, estudios(nombre)") \
            .eq("id_sucursal", id_sucursal) \
            .eq("activa", True) \
            .execute()
        return result.data or []
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/")
async def crear_guia(body: GuiaNavegacionRequest):
    """
    Crea o actualiza una guía de navegación para un estudio en una sucursal.
    Upsert por (id_sucursal, id_estudio).
    """
    try:
        sb = get_supabase()
        data = {
            "id_sucursal":   body.id_sucursal,
            "id_estudio":    body.id_estudio,
            "nombre_area":   body.nombre_area,
            "ubicacion":     body.ubicacion,
            "piso":          body.piso,
            "instrucciones": body.instrucciones,
            "referencia":    body.referencia,
            "activa":        True,
        }
        result = sb.table("guias_navegacion_sucursal") \
            .upsert(data, on_conflict="id_sucursal,id_estudio") \
            .execute()

        if not result.data:
            raise HTTPException(500, "No se pudo guardar la guía")

        return {"mensaje": "Guía guardada", "guia": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
