from fastapi import APIRouter, HTTPException
try:
    from backend.services.supabase_client import get_supabase
except ImportError:
    from services.supabase_client import get_supabase

router = APIRouter()


@router.get("/")
async def get_clinicas():
    """Lista de clínicas activas con sus colas actuales. Para el dashboard."""
    try:
        sb = get_supabase()
        result = sb.from_("v_dashboard_sucursal").select("*").execute()
        return result.data
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/{id}/estado")
async def get_clinica_estado(id: int):
    """Estado detallado de una sucursal específica. Para el selector del dashboard."""
    try:
        sb = get_supabase()
        result = sb.from_("v_dashboard_sucursal").select("*").eq(
            "id_sucursal", id
        ).execute()
        return result.data
    except Exception as e:
        raise HTTPException(500, str(e))
