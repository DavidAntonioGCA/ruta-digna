from fastapi import APIRouter, HTTPException
from models.schemas import RecomendarRequest, ChatRequest, ExplicarRequest, IAResponse
from services.claude_service import call_claude, PROMPT_EXTRACTOR, PROMPT_ASISTENTE, PROMPT_EXPLICADOR
from services.supabase_client import get_supabase
import json

router = APIRouter()


@router.post("/recomendar")
async def recomendar_sucursal(body: RecomendarRequest):
    """
    Módulo 2: El paciente escribe en lenguaje natural.
    La IA extrae estudios y zona, el backend calcula el score por sucursal.
    score = (tiempo_espera × 0.6) + (distancia_km × 0.4)
    """
    try:
        sb = get_supabase()

        # Paso 1: Claude extrae estudios y zona del texto libre
        raw = await call_claude(PROMPT_EXTRACTOR, body.mensaje, max_tokens=300)
        try:
            extraccion = json.loads(raw)
        except json.JSONDecodeError:
            extraccion = {"estudios_mencionados": [], "zona_o_referencia": None}

        estudios_detectados = extraccion.get("estudios_mencionados", [])
        ids_estudios = []

        # Paso 2: Buscar IDs en Supabase por nombre (ilike + strip para tildes y espacios)
        for nombre in estudios_detectados:
            nombre_limpio = nombre.strip().upper()
            result = sb.table("estudios").select(
                "id,nombre,preparacion_instrucciones,requiere_preparacion"
            ).ilike("nombre", f"%{nombre_limpio}%").execute()
            if result.data:
                ids_estudios.append(result.data[0]["id"])

        if not ids_estudios:
            # Fallback: devolver todas las sucursales activas sin filtro de estudio
            result = sb.table("sucursales").select(
                "id,nombre,direccion,ciudad"
            ).eq("activa", True).limit(5).execute()
            return {
                "sucursal_recomendada": result.data[0] if result.data else None,
                "alternativas":         result.data[1:] if result.data else [],
                "estudios_detectados":  estudios_detectados,
                "ids_estudios_detectados": [],
                "orden_sugerido":       [],
                "advertencia":          "No pude identificar los estudios. Mostrando clínicas cercanas."
            }

        # Paso 3: fn_recomendar_sucursales calcula score real
        rec = sb.rpc("fn_recomendar_sucursales", {
            "p_ids_estudios": ids_estudios,
            "p_lat_usuario":  body.lat or 0.0,
            "p_lon_usuario":  body.lon or 0.0,
            "p_limite":       5
        }).execute()

        sucursales = rec.data or []
        if not sucursales:
            raise HTTPException(404, "No hay sucursales disponibles para esos estudios")

        # Paso 4: Calcular orden sugerido para mostrar al paciente
        orden = sb.rpc("fn_calcular_orden_optimo_estudios", {
            "p_ids_estudios": ids_estudios
        }).execute()

        orden_con_nombres = []
        for item in (orden.data or []):
            est = sb.table("estudios").select(
                "nombre,requiere_preparacion,preparacion_instrucciones"
            ).eq("id", item["id_estudio"]).single().execute()
            if est.data:
                orden_con_nombres.append({
                    "orden":                item["orden_calculado"],
                    "nombre":               est.data["nombre"],
                    "requiere_preparacion": est.data["requiere_preparacion"],
                    "preparacion":          est.data["preparacion_instrucciones"]
                })

        return {
            "sucursal_recomendada":      sucursales[0],
            "alternativas":              sucursales[1:],
            "estudios_detectados":       estudios_detectados,
            "ids_estudios_detectados":   ids_estudios,
            "orden_sugerido":            orden_con_nombres
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/chat", response_model=IAResponse)
async def chat_asistente(body: ChatRequest):
    """
    Módulo 3: Asistente conversacional con contexto del estado real de la visita.
    """
    try:
        sb = get_supabase()

        # Obtener estado real de la visita para inyectarlo en el prompt
        estado = sb.rpc("fn_obtener_estado_visita", {
            "p_visita_id": body.visita_id
        }).execute()

        estado_json = json.dumps(estado.data, ensure_ascii=False, default=str)
        system = PROMPT_ASISTENTE.replace("{estado_visita}", estado_json)

        reply = await call_claude(system, body.mensaje, historial=body.historial)
        return IAResponse(reply=reply)

    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/explicar-resultados", response_model=IAResponse)
async def explicar_resultados(body: ExplicarRequest):
    """
    Módulo 4: Explica resultados médicos en lenguaje simple.
    Acepta imagen (base64) O texto. Si llegan los dos, usa la imagen.
    NO almacena nada — procesa en memoria y descarta.
    """
    if not body.imagen_base64 and not body.resultados:
        raise HTTPException(400, "Se requiere imagen_base64 o resultados")

    try:
        if body.imagen_base64:
            # Mensaje con imagen para Claude
            mensaje = {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type":       "base64",
                            "media_type": body.media_type or "image/jpeg",
                            "data":       body.imagen_base64,
                        }
                    },
                    {
                        "type": "text",
                        "text": "Por favor explica estos resultados de laboratorio."
                    }
                ]
            }
        else:
            # Mensaje de texto plano
            mensaje = body.resultados

        reply = await call_claude(PROMPT_EXPLICADOR, mensaje)
        return IAResponse(reply=reply)

    except Exception as e:
        raise HTTPException(500, str(e))
