from fastapi import APIRouter, HTTPException
try:
    from backend.models.schemas import RecomendarRequest, ChatRequest, ChatResultadoRequest, ExplicarRequest, IAResponse
    from backend.services.claude_service import (
        ClaudeAPIError,
        PROMPT_ASISTENTE,
        PROMPT_EXPLICADOR,
        PROMPT_EXTRACTOR,
        PROMPT_CHAT_RESULTADO,
        call_claude,
    )
    from backend.services.supabase_client import get_supabase
    from backend.services.recomendacion import seleccionar_mejor_sucursal, DatosSucursal
except ImportError:
    from models.schemas import RecomendarRequest, ChatRequest, ChatResultadoRequest, ExplicarRequest, IAResponse
    from services.claude_service import (
        ClaudeAPIError,
        PROMPT_ASISTENTE,
        PROMPT_EXPLICADOR,
        PROMPT_EXTRACTOR,
        PROMPT_CHAT_RESULTADO,
        call_claude,
    )
    from services.supabase_client import get_supabase
    from services.recomendacion import seleccionar_mejor_sucursal, DatosSucursal
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
        confianza_claude = extraccion.get("confianza_extraccion", "alta")  # campo nuevo del prompt
        contenido_no_medico: bool = extraccion.get("contenido_no_medico", False)
        resumen_no_medico: str | None = extraccion.get("resumen_no_medico", None)
        print("Estudios extraídos (lista):", estudios_detectados) # <-- DEBUG
        print("Contenido no médico:", contenido_no_medico, resumen_no_medico) # <-- DEBUG
        ids_estudios = []
        ids_con_coincidencia_directa: list[int] = []  # IDs encontrados sin pasar por mapeo de sinónimos

        # Construir aviso de contenido no médico (se propaga aunque haya estudios válidos)
        aviso_contenido: str | None = None
        if contenido_no_medico and resumen_no_medico:
            aviso_contenido = (
                f"Notamos que mencionaste '{resumen_no_medico}' — ese tipo de procedimiento "
                f"no está disponible en Salud Digna. "
                f"Sin embargo, detectamos estudios que sí podemos atenderte."
            )

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
                    ids_con_coincidencia_directa.append(est["id"])  # coincidencia directa
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
                    "TAC": "TOMOGRAFIA",
                    "TOMOGRAFIA": "TOMOGRAFIA",
                    "TOMOGRAFÍA": "TOMOGRAFIA",
                    "RESONANCIA": "RESONANCIA MAGNETICA",
                    "RM": "RESONANCIA MAGNETICA",
                    # Optometría / examen de la vista
                    "VISTA": "OPTOMETRIA",
                    "LENTES": "OPTOMETRIA",
                    "OPTOM": "OPTOMETRIA",
                    "OPTOMETRIA": "OPTOMETRIA",
                    "OPTOMETRÍA": "OPTOMETRIA",
                    # Nutrición
                    "NUTRICI": "NUTRICION",
                    "NUTRICION": "NUTRICION",
                    "NUTRICIÓN": "NUTRICION",
                    "DIETA": "NUTRICION",
                    # Audiometría
                    "AUDIO": "AUDIOMETRIA",
                    "AUDITIV": "AUDIOMETRIA",
                    "OIDO": "AUDIOMETRIA",
                    "OÍDO": "AUDIOMETRIA",
                    # Espirometría
                    "ESPIRO": "ESPIROMETRIA",
                    "PULMON": "ESPIROMETRIA",
                    "PULMÓN": "ESPIROMETRIA",
                    # Densitometría
                    "DENSITO": "DENSITOMETRIA",
                    "HUESO": "DENSITOMETRIA",
                    "OSTEO": "DENSITOMETRIA",
                    # Mastografía
                    "MASTO": "MASTOGRAFIA",
                    "MAMA": "MASTOGRAFIA",
                    "SENO": "MASTOGRAFIA",
                    # Electrocardiograma
                    "ELECTRO": "ELECTROCARDIOGRAMA",
                    "ECG": "ELECTROCARDIOGRAMA",
                    "CORAZON": "ELECTROCARDIOGRAMA",
                    "CORAZÓN": "ELECTROCARDIOGRAMA",
                    # Papanicolaou
                    "PAPA": "PAPANICOLAOU",
                    "PAP": "PAPANICOLAOU",
                    "CERVICAL": "PAPANICOLAOU",
                }
                
                encontrado = False
                for clave, estudio_oficial in palabras_clave.items():
                    if clave in nombre_limpio:
                        res_clave = sb.table("estudios").select("id").eq("nombre", estudio_oficial).execute()
                        if res_clave.data:
                            ids_estudios.append(res_clave.data[0]["id"])
                            encontrado = True
                            break
                            
                # Último fallback: buscar optometría por ID directo (8)
                if not encontrado and any(k in nombre_limpio for k in ("VISTA", "LENTES", "OPTOM")):
                    res_opt = sb.table("estudios").select("id").eq("id", 8).execute()
                    if res_opt.data:
                        ids_estudios.append(8)
                        encontrado = True

        if not ids_estudios:
            # Sin estudios detectados: devolver respuesta indicativa
            # Si tiene contenido no médico, ajustar el mensaje
            if contenido_no_medico and resumen_no_medico:
                mensaje_sin_estudios = (
                    f"Notamos que mencionaste '{resumen_no_medico}', que no es un servicio disponible en Salud Digna. "
                    f"Si también necesitas estudios de diagnóstico, cuéntanos cuáles son."
                )
            else:
                mensaje_sin_estudios = (
                    "No detectamos estudios médicos en tu mensaje. "
                    "¿Puedes describirnos qué síntomas o estudios necesitas? "
                    "Por ejemplo: 'laboratorio', 'ultrasonido', 'rayos X', etc."
                )
            return {
                "sin_estudios": True,
                "confianza": "baja",
                "aviso_contenido": aviso_contenido,
                "mensaje": mensaje_sin_estudios,
                "estudios_detectados": [],
                "ids_estudios_detectados": [],
                "sucursal_recomendada": None,
                "alternativas": [],
                "orden_sugerido": []
            }

        # ── Determinar confianza final ──────────────────────────────────────────────
        # Reglas del backend (complementan la señal de Claude):
        # 1. Mensaje muy corto (<3 palabras) → baja
        # 2. Claude reportó baja → baja
        # 3. Ningún estudio tuvo coincidencia directa (todo pasó por sinónimos) → baja
        palabras_mensaje = body.mensaje.strip().split()
        hay_directa = len(ids_con_coincidencia_directa) > 0
        confianza: str
        if confianza_claude == "baja" or len(palabras_mensaje) < 3 or not hay_directa:
            confianza = "baja"
        else:
            confianza = "alta"

        # Paso 3: Obtener candidatos de Supabase
        # El RPC filtra sucursales con al menos 1 estudio disponible y calcula
        # tiempo_total_min (espera en clínica). No incluye lat/lon ni traslado.
        rec = sb.rpc("fn_recomendar_sucursales", {
            "p_ids_estudios": ids_estudios,
            "p_lat_usuario":  body.lat,
            "p_lon_usuario":  body.lon,
            "p_limite":       30
        }).execute()
        sucursales_rpc = rec.data or []
        if not sucursales_rpc:
            raise HTTPException(404, "No hay sucursales disponibles para esos estudios")

        # Paso 4: Enriquecer con latitud/longitud (el RPC no las devuelve)
        ids_candidatos = [s["id_sucursal"] for s in sucursales_rpc]
        coords_res = sb.table("sucursales") \
            .select("id, latitud, longitud") \
            .in_("id", ids_candidatos) \
            .execute()
        coords_map: dict[int, tuple] = {
            r["id"]: (r.get("latitud"), r.get("longitud"))
            for r in (coords_res.data or [])
        }

        # Paso 5: Construir DatosSucursal y delegar a la función pura
        datos_sucursales = [
            DatosSucursal(
                id_sucursal       = s["id_sucursal"],
                nombre_sucursal   = s["nombre_sucursal"],
                direccion         = s["direccion"],
                ciudad            = s["ciudad"],
                latitud           = coords_map.get(s["id_sucursal"], (None, None))[0],
                longitud          = coords_map.get(s["id_sucursal"], (None, None))[1],
                tiempo_espera_min = s["tiempo_total_min"] if s.get("tiempo_total_min") and s["tiempo_total_min"] > 0 else None,
                estudios_disponibles = s.get("estudios_disponibles", 0),
            )
            for s in sucursales_rpc
        ]

        evaluadas, razon_recomendada = seleccionar_mejor_sucursal(
            datos_sucursales, body.lat, body.lon
        )

        def resultado_a_dict(r, es_recomendada: bool) -> dict:
            return {
                "id_sucursal":          r.id_sucursal,
                "nombre_sucursal":      r.nombre_sucursal,
                "direccion":            r.direccion,
                "ciudad":               r.ciudad,
                "distancia_km":         r.distancia_km,
                "tiempo_traslado_min":  r.tiempo_traslado_min,
                "tiempo_espera_min":    r.tiempo_espera_min,
                "tiempo_total_min":     r.tiempo_total_min if r.tiempo_total_min > 0 else None,
                "score":                r.score,
                "estudios_disponibles": r.estudios_disponibles,
                **({"razon_recomendacion": r.razon_recomendacion} if es_recomendada else {}),
            }

        # Paso 6: Calcular orden sugerido de estudios
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
                    "id_estudio":           item["id_estudio"],
                    "orden":                item["orden_calculado"],
                    "nombre":               est.data["nombre"],
                    "requiere_preparacion": est.data["requiere_preparacion"],
                    "preparacion":          est.data["preparacion_instrucciones"],
                })

        return {
            "sucursal_recomendada":    resultado_a_dict(evaluadas[0], es_recomendada=True),
            "alternativas":            [resultado_a_dict(r, es_recomendada=False) for r in evaluadas[1:]],
            "estudios_detectados":     estudios_detectados,
            "ids_estudios_detectados": ids_estudios,
            "orden_sugerido":          orden_con_nombres,
            "confianza":               confianza,
            "aviso_contenido":         aviso_contenido,
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


@router.post("/chat-resultado", response_model=IAResponse)
async def chat_resultado(body: ChatResultadoRequest):
    """
    Chat especializado en interpretar resultados médicos.
    Soporta archivo adjunto (imagen o PDF) para que la IA lo lea directamente.
    """
    try:
        system = PROMPT_CHAT_RESULTADO.replace("{contexto_resultado}", body.contexto_resultado)

        # Construir el mensaje del usuario con o sin archivo
        if body.archivo_base64 and body.media_type:
            es_pdf = "pdf" in body.media_type.lower()
            es_imagen = body.media_type.lower() in ("image/jpeg", "image/png", "image/gif", "image/webp")

            if es_pdf:
                # Claude soporta PDFs nativamente con type="document"
                contenido_usuario = [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": body.archivo_base64,
                        }
                    },
                    {"type": "text", "text": body.mensaje}
                ]
            elif es_imagen:
                contenido_usuario = [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": body.media_type,
                            "data": body.archivo_base64,
                        }
                    },
                    {"type": "text", "text": body.mensaje}
                ]
            else:
                # Tipo no soportado → solo texto
                contenido_usuario = body.mensaje

            user_message = {"role": "user", "content": contenido_usuario}
        else:
            # Sin archivo: solo texto
            user_message = body.mensaje

        reply = await call_claude(system, user_message, historial=body.historial, max_tokens=1500)
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
