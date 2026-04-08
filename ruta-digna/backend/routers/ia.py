from fastapi import APIRouter, HTTPException
try:
    from backend.models.schemas import RecomendarRequest, ChatRequest, ExplicarRequest, IAResponse
    from backend.services.claude_service import (
        ClaudeAPIError,
        PROMPT_ASISTENTE,
        PROMPT_EXPLICADOR,
        PROMPT_EXTRACTOR,
        call_claude,
    )
    from backend.services.supabase_client import get_supabase
except ImportError:
    from models.schemas import RecomendarRequest, ChatRequest, ExplicarRequest, IAResponse
    from services.claude_service import (
        ClaudeAPIError,
        PROMPT_ASISTENTE,
        PROMPT_EXPLICADOR,
        PROMPT_EXTRACTOR,
        call_claude,
    )
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
        
        # Limpiar respuesta raw de Claude por si envía backticks de markdown
        raw_clean = raw.strip()
        if raw_clean.startswith("```json"):
            raw_clean = raw_clean[7:]
        elif raw_clean.startswith("```"):
            raw_clean = raw_clean[3:]
        if raw_clean.endswith("```"):
            raw_clean = raw_clean[:-3]
        raw_clean = raw_clean.strip()
        
        print("Respuesta raw de Claude limpia:", raw_clean) # <-- DEBUG
        
        try:
            extraccion = json.loads(raw_clean)
        except json.JSONDecodeError:
            extraccion = {"estudios_mencionados": [], "zona_o_referencia": None}

        estudios_detectados = extraccion.get("estudios_mencionados", [])
        print("Estudios extraídos (lista):", estudios_detectados) # <-- DEBUG
        ids_estudios = []

        # Paso 2: Buscar IDs en Python (para evitar crasheos de ilike en Supabase)
        res_estudios = sb.table("estudios").select("id,nombre,preparacion_instrucciones,requiere_preparacion").execute()
        todos_los_estudios = res_estudios.data or []
        
        for nombre in estudios_detectados:
            nombre_limpio = nombre.strip().upper()
            
            # Buscar coincidencia exacta o substring en memoria
            encontrado_en_bd = False
            for est in todos_los_estudios:
                if nombre_limpio in est["nombre"].upper():
                    ids_estudios.append(est["id"])
                    encontrado_en_bd = True
                    break
            
            if not encontrado_en_bd:
                # Fallback por palabras clave si no hay coincidencia exacta (ilike)
                # "glucosa" -> LABORATORIO, "lab" -> LABORATORIO, etc.
                palabras_clave = {
                    "GLUCOSA": "LABORATORIO",
                    "SANGRE": "LABORATORIO",
                    "LAB": "LABORATORIO",
                    "ORINA": "LABORATORIO",
                    "EGO": "LABORATORIO",
                    "BH": "LABORATORIO",
                    "BIOMETRIA": "LABORATORIO",
                    "QUIMICA SANGUINEA": "LABORATORIO",
                    "RAYOS": "RAYOS X",
                    "RADIOGRAFIA": "RAYOS X",
                    "RADIOGRAFÍA": "RAYOS X",
                    "ECO": "ULTRASONIDO",
                    "ECOGRAFIA": "ULTRASONIDO",
                    "ECOGRAFÍA": "ULTRASONIDO",
                    "TAC": "TOMOGRAFÍA",
                    "TOMOGRAFIA": "TOMOGRAFÍA",
                    "RESONANCIA": "RESONANCIA MAGNÉTICA",
                    "RM": "RESONANCIA MAGNÉTICA",
                    "VISTA": "EXAMEN DE LA VISTA",
                    "LENTES": "EXAMEN DE LA VISTA",
                    "PAPA": "PAPANICOLAOU",
                    "ELECTRO": "ELECTROCARDIOGRAMA",
                    "ECG": "ELECTROCARDIOGRAMA"
                }
                
                encontrado = False
                for clave, estudio_oficial in palabras_clave.items():
                    if clave in nombre_limpio:
                        res_clave = sb.table("estudios").select("id").eq("nombre", estudio_oficial).execute()
                        if res_clave.data:
                            ids_estudios.append(res_clave.data[0]["id"])
                            encontrado = True
                            break
                            
                # Si de plano no encuentra nada y el id -2 existe (examen vista)
                if not encontrado and ("VISTA" in nombre_limpio or "LENTES" in nombre_limpio):
                    res_vista = sb.table("estudios").select("id").eq("id", -2).execute()
                    if res_vista.data:
                        ids_estudios.append(-2)

        if not ids_estudios:
            # Fallback: si no hay estudios, forzamos Laboratorio (ID 2)
            ids_estudios = [2]
            estudios_detectados = ["Laboratorio General (Predeterminado)"]

        # Paso 3: Recomendar sucursales con score REAL desde la DB
        # - tiempo_total_min usa fn_calcular_tiempo_espera (colas + consultorios + históricos)
        # - score combina tiempo (0.6) + distancia (0.4)
        rec = sb.rpc("fn_recomendar_sucursales", {
            "p_ids_estudios": ids_estudios,
            "p_lat_usuario": body.lat,
            "p_lon_usuario": body.lon,
            "p_limite": 5
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
    except ClaudeAPIError as e:
        raise HTTPException(502, f"Claude falló ({e.status_code}): {e.message}")
    except Exception as e:
        import traceback
        print("\n" + "="*50)
        print("ERROR EN EL BACKEND:")
        traceback.print_exc()
        
        # Si es error de Supabase, tratar de imprimir el detalle real
        if hasattr(e, 'details'):
            print("DETALLES SUPABASE:", e.details)
        if hasattr(e, 'message'):
            print("MENSAJE SUPABASE:", e.message)
            
        print("="*50 + "\n")
        raise HTTPException(500, f"{type(e).__name__}: {e}")


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

    except ClaudeAPIError as e:
        raise HTTPException(502, f"Claude falló ({e.status_code}): {e.message}")
    except Exception as e:
        raise HTTPException(500, f"{type(e).__name__}: {e}")


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

    except ClaudeAPIError as e:
        raise HTTPException(502, f"Claude falló ({e.status_code}): {e.message}")
    except Exception as e:
        raise HTTPException(500, f"{type(e).__name__}: {e}")
