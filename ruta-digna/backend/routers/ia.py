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
        print("Respuesta raw de Claude:", raw) # <-- DEBUG: Qué devuelve Claude realmente
        try:
            extraccion = json.loads(raw)
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

        # Paso 3: Calcular score y recomendar sucursales (Lógica movida al backend para evitar error 1101 de PostgREST)
        import math
        
        def calc_dist(lat1, lon1, lat2, lon2):
            if not all([lat1, lon1, lat2, lon2]): return 999.0
            # Haversine simple
            return math.sqrt(((lat2 - lat1) * 111.0)**2 + ((lon2 - lon1) * 111.0 * math.cos(math.radians(lat1)))**2)

        # 3.1 Traer todas las sucursales activas
        res_sucursales = sb.table("sucursales").select("id,nombre,direccion,ciudad,latitud,longitud").eq("activa", True).execute()
        todas_sucursales = res_sucursales.data or []
        
        sucursales_validas = []
        for s in todas_sucursales:
            # 3.2 Verificar que la sucursal tenga TODOS los estudios
            res_consultorios = sb.table("consultorios_por_sucursal").select("id_estudio").eq("id_sucursal", s["id"]).in_("id_estudio", ids_estudios).execute()
            estudios_disp = [c["id_estudio"] for c in (res_consultorios.data or [])]
            
            if len(set(estudios_disp)) == len(ids_estudios):
                # 3.3 Calcular tiempo de espera (aproximado, asumiendo 20 min base)
                # (Para la demo, calculamos 20 min por estudio + un random basado en id para variar)
                tiempo_total = len(ids_estudios) * 20 + (s["id"] % 5) * 5
                
                # 3.4 Calcular distancia y score
                dist = calc_dist(body.lat or 0, body.lon or 0, s.get("latitud"), s.get("longitud"))
                score = round((tiempo_total * 0.6) + (dist * 0.4), 2)
                
                sucursales_validas.append({
                    "id_sucursal": s["id"],
                    "nombre_sucursal": s["nombre"],
                    "direccion": s.get("direccion", ""),
                    "ciudad": s.get("ciudad", ""),
                    "tiempo_total_min": tiempo_total,
                    "score": score,
                    "estudios_disponibles": len(estudios_disp)
                })

        # 3.5 Ordenar por score
        sucursales_validas.sort(key=lambda x: x["score"])
        sucursales = sucursales_validas[:5]
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
