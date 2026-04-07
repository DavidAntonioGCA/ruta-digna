from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

try:
    from backend.models.schemas import RestriccionesRequest, RestriccionesResponse
    from backend.services.supabase_client import get_supabase
except ImportError:
    from models.schemas import RestriccionesRequest, RestriccionesResponse
    from services.supabase_client import get_supabase

router = APIRouter()

@router.get("/{id}/restricciones", response_model=RestriccionesResponse)
async def get_estudio_restricciones(
    id: int, 
    edad_paciente: Optional[int] = None, 
    meses_desde_ultimo: Optional[int] = None
):
    try:
        sb = get_supabase()
        
        # Consultar restricciones activas para este estudio
        result = sb.table("restricciones_estudio").select("*").eq("id_estudio", id).eq("activa", True).execute()
        
        restricciones = result.data or []
        
        tiene_restriccion = False
        requiere_orden_medica = False
        descripcion = None
        
        for rest in restricciones:
            # Evaluar restricciones simples
            if rest["tipo"] == "edad" and edad_paciente is not None:
                # Mastografía < 35 años
                if id == 52 and edad_paciente < 35: # Suponiendo ID de mastografía o evaluar dinámicamente
                    tiene_restriccion = True
                    requiere_orden_medica = rest.get("requiere_orden_medica", False)
                    descripcion = rest.get("descripcion", "Restricción de edad")
            
            elif rest["tipo"] == "tiempo_desde_ultimo" and meses_desde_ultimo is not None:
                # Mastografía < 6 meses
                if id == 52 and meses_desde_ultimo < 6:
                    tiene_restriccion = True
                    requiere_orden_medica = rest.get("requiere_orden_medica", False)
                    descripcion = rest.get("descripcion", "Restricción de tiempo desde último estudio")
                    
            elif rest["tipo"] == "puntualidad":
                # Tomografía / RM
                tiene_restriccion = True
                descripcion = rest.get("descripcion", "Requiere puntualidad estricta")
                
            # Si hay una que requiere orden médica, esa toma precedencia
            if requiere_orden_medica:
                break
                
        return RestriccionesResponse(
            tiene_restriccion=tiene_restriccion,
            requiere_orden_medica=requiere_orden_medica,
            descripcion=descripcion
        )

    except Exception as e:
        raise HTTPException(500, str(e))