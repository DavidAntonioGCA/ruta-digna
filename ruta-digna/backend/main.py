from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
try:
    from backend.routers import clinicas, visitas, ia, estudios, alertas, guias, resultados, especialistas
except ImportError:
    from routers import clinicas, visitas, ia, estudios, alertas, guias, resultados, especialistas
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Ruta Digna API",
    description="Backend para el sistema de atención inteligente — Hackathon Talent Land 2026",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clinicas.router,  prefix="/clinicas",  tags=["Clínicas"])
app.include_router(visitas.router,   prefix="/visitas",   tags=["Visitas"])
app.include_router(ia.router,        prefix="/ia",        tags=["IA"])
app.include_router(estudios.router,  prefix="/estudios",  tags=["Estudios"])
app.include_router(alertas.router,   prefix="/alertas",   tags=["Alertas"])
app.include_router(guias.router,          prefix="/guias",         tags=["Guías"])
app.include_router(resultados.router,     prefix="/resultados",    tags=["Resultados"])
app.include_router(especialistas.router,  prefix="/especialista",  tags=["Especialistas"])

@app.get("/health", tags=["Sistema"])
def health():
    return {"status": "ok", "proyecto": "Ruta Digna", "version": "2.0.0"}


@app.post("/admin/sync-colas", tags=["Sistema"])
async def sync_todas_las_colas():
    """Sincroniza colas_en_tiempo_real para TODAS las sucursales activas."""
    try:
        from backend.services.supabase_client import get_supabase
    except ImportError:
        from services.supabase_client import get_supabase
    try:
        sb = get_supabase()
        sucursales = sb.table("sucursales").select("id, nombre").eq("activa", True).execute()
        resultados = []
        for s in (sucursales.data or []):
            try:
                sb.rpc("fn_sincronizar_colas", {"p_id_sucursal": s["id"]}).execute()
                resultados.append({"id": s["id"], "nombre": s["nombre"], "ok": True})
            except Exception as e:
                resultados.append({"id": s["id"], "nombre": s["nombre"], "ok": False, "error": str(e)})
        return {"sincronizadas": len([r for r in resultados if r["ok"]]), "detalle": resultados}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/paciente/buscar", tags=["Visitas"])
async def buscar_paciente(telefono: str):
    """Busca un paciente por teléfono y retorna su visita activa."""
    try:
        from services.supabase_client import get_supabase
    except ImportError:
        from backend.services.supabase_client import get_supabase
    try:
        sb = get_supabase()
        p = sb.table("pacientes").select("id, nombre").eq("telefono", telefono).execute()
        if not p.data:
            return {"encontrado": False}
        paciente = p.data[0]
        v = sb.table("visitas").select("id").eq("id_paciente", paciente["id"]).eq("estatus", "en_proceso").order("timestamp_llegada", desc=True).limit(1).execute()
        return {
            "encontrado":  True,
            "paciente_id": paciente["id"],
            "nombre":      paciente["nombre"],
            "visita_id":   v.data[0]["id"] if v.data else None,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/paciente/verificar", tags=["Visitas"])
async def verificar_paciente(telefono: str):
    """
    Verifica el teléfono contra el mock de Salud Digna y el sistema interno.
    Retorna el escenario: 'cuenta_activa' | 'primer_acceso_sd' | 'nuevo'
    """
    try:
        from services.supabase_client import get_supabase
        from services.salud_digna_mock import buscar_en_sd, calcular_tipo_paciente, es_mujer_fertil
    except ImportError:
        from backend.services.supabase_client import get_supabase
        from backend.services.salud_digna_mock import buscar_en_sd, calcular_tipo_paciente, es_mujer_fertil
    try:
        sb = get_supabase()
        sd = buscar_en_sd(telefono)
        sistema = sb.table("pacientes").select("id, nombre, tipo_base, pin").eq("telefono", telefono).execute()
        en_sistema = bool(sistema.data)

        if en_sistema:
            p = sistema.data[0]
            tiene_pin = bool(p.get("pin"))
            nombre_completo = p.get("nombre", "")
            partes = nombre_completo.split()
            nombre_mask = f"{partes[0][0]}{'*' * (len(partes[0])-1)} {partes[-1][0]}{'*' * (len(partes[-1])-1)}" if len(partes) >= 2 else nombre_completo
            return {
                "escenario": "cuenta_activa",
                "nombre_mascara": nombre_mask,
                "tipo_paciente": p.get("tipo_base", "sin_cita"),
                "tiene_pin": tiene_pin,
                "en_sd": sd is not None,
            }

        if sd:
            tipo = calcular_tipo_paciente(sd)
            return {
                "escenario": "primer_acceso_sd",
                "datos_sd": {
                    "nombre":           sd["nombre"],
                    "primer_apellido":  sd["primer_apellido"],
                    "segundo_apellido": sd["segundo_apellido"],
                    "fecha_nacimiento": sd["fecha_nacimiento"],
                    "sexo":             sd["sexo"],
                    "nacionalidad":     sd["nacionalidad"],
                    "residencia":       sd["residencia"],
                    "discapacidad":     sd["discapacidad"],
                },
                "tipo_detectado":    tipo,
                "mujer_fertil":      es_mujer_fertil(sd),
            }

        return {"escenario": "nuevo"}

    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/paciente/login", tags=["Visitas"])
async def login_paciente(body: dict):
    """Valida PIN y retorna sesión del paciente."""
    try:
        from services.supabase_client import get_supabase
    except ImportError:
        from backend.services.supabase_client import get_supabase
    try:
        sb = get_supabase()
        telefono = body.get("telefono", "")
        pin = body.get("pin", "")
        p = sb.table("pacientes").select("id, nombre, pin, tipo_base").eq("telefono", telefono).execute()
        if not p.data:
            raise HTTPException(404, "Paciente no encontrado")
        pac = p.data[0]
        if pac.get("pin") and pac["pin"] != pin:
            raise HTTPException(401, "PIN incorrecto")
        v = sb.table("visitas").select("id").eq("id_paciente", pac["id"]).eq("estatus", "en_proceso").order("timestamp_llegada", desc=True).limit(1).execute()
        return {
            "paciente_id":  pac["id"],
            "nombre":       pac["nombre"],
            "tipo_paciente": pac.get("tipo_base", "sin_cita"),
            "visita_id":    v.data[0]["id"] if v.data else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/paciente/registrar", tags=["Visitas"])
async def registrar_paciente(body: dict):
    """Crea o activa un paciente con datos completos."""
    try:
        from services.supabase_client import get_supabase
        from services.salud_digna_mock import buscar_en_sd, calcular_tipo_paciente
    except ImportError:
        from backend.services.supabase_client import get_supabase
        from backend.services.salud_digna_mock import buscar_en_sd, calcular_tipo_paciente
    import uuid as _uuid
    try:
        sb = get_supabase()
        telefono = body.get("telefono", "")
        existing = sb.table("pacientes").select("id, nombre").eq("telefono", telefono).execute()
        if existing.data:
            p = existing.data[0]
            return {"paciente_id": p["id"], "nombre": p["nombre"], "tipo_paciente": body.get("tipo_paciente", "sin_cita")}

        embarazada = body.get("embarazada", False)
        datos = {
            "fecha_nacimiento": body.get("fecha_nacimiento", ""),
            "discapacidad":     body.get("discapacidad", False),
            "sexo":             body.get("sexo", ""),
            "visitas_previas":  0,
        }
        tipo_base = calcular_tipo_paciente(datos, embarazada=embarazada)
        nombre_completo = " ".join(filter(None, [
            body.get("nombre", ""), body.get("primer_apellido", ""), body.get("segundo_apellido", "")
        ])) or "Paciente"

        pid = str(_uuid.uuid4())
        pin = body.get("pin") or telefono[-4:]
        sd = buscar_en_sd(telefono)

        sb.table("pacientes").insert({
            "id":              pid,
            "nombre":          nombre_completo,
            "telefono":        telefono,
            "email":           body.get("email"),
            "primer_apellido": body.get("primer_apellido"),
            "segundo_apellido":body.get("segundo_apellido"),
            "fecha_nacimiento":body.get("fecha_nacimiento"),
            "sexo":            body.get("sexo"),
            "nacionalidad":    body.get("nacionalidad", "Mexicana"),
            "residencia":      body.get("residencia"),
            "discapacidad":    body.get("discapacidad", False),
            "tipo_base":       tipo_base,
            "pin":             pin,
            "sd_registrado":   sd is not None,
        }).execute()

        return {"paciente_id": pid, "nombre": nombre_completo, "tipo_paciente": tipo_base}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/paciente/status/{visita_id}", tags=["Visitas"])
async def get_paciente_status(visita_id: str):
    """Alias amigable de GET /visitas/status para el frontend."""
    try:
        from backend.routers.visitas import get_visita_status
    except ImportError:
        from routers.visitas import get_visita_status
    return await get_visita_status(visita_id)


@app.get("/paciente/cola/{visita_id}", tags=["Visitas"])
async def get_cola_paciente(visita_id: str):
    """
    Devuelve la posición del paciente en la cola de su estudio actual,
    más info de los pacientes que van delante y detrás (sin datos privados).
    """
    try:
        from backend.services.supabase_client import get_supabase
    except ImportError:
        from services.supabase_client import get_supabase
    try:
        sb = get_supabase()

        # Obtener visita actual
        v = sb.table("visitas").select("id_sucursal, tipo_paciente, timestamp_llegada").eq("id", visita_id).single().execute()
        if not v.data:
            raise HTTPException(404, "Visita no encontrada")

        id_sucursal = v.data["id_sucursal"]
        tipo        = v.data["tipo_paciente"]
        llegada     = v.data["timestamp_llegada"]

        # Leer el estudio actual desde visita_estudios (es_estudio_actual=True),
        # ya que fn_avanzar_estudio_visita actualiza ese campo y NO visitas.id_estudio_actual.
        ve_actual_r = sb.table("visita_estudios").select("id_estudio").eq("id_visita", visita_id).eq("es_estudio_actual", True).limit(1).execute()
        id_estudio = ve_actual_r.data[0]["id_estudio"] if ve_actual_r.data else None

        if not id_estudio:
            return {"posicion": None, "delante": [], "detras": []}

        # Obtener posición via RPC
        pos_r = sb.rpc("fn_posicion_en_cola", {"p_id_visita": visita_id, "p_id_estudio": id_estudio}).execute()
        posicion = pos_r.data if pos_r.data else 1

        # Prioridad numérica para ordenar
        PRIO = {"urgente": 1, "embarazada": 2, "adulto_mayor": 3, "discapacidad": 4, "con_cita": 5, "sin_cita": 6}
        mi_prio = PRIO.get(tipo, 6)

        # Obtener todos en la cola del mismo estudio
        cola_r = sb.from_("visitas").select(
            "id, tipo_paciente, timestamp_llegada"
        ).eq("id_sucursal", id_sucursal).eq("estatus", "en_proceso").neq("id", visita_id).execute()

        # Solo pacientes que tienen este estudio como ACTUAL (no los que ya lo completaron)
        ve_r = sb.from_("visita_estudios").select("id_visita").eq("id_estudio", id_estudio).eq("es_estudio_actual", True).execute()
        visitas_en_estudio = {row["id_visita"] for row in (ve_r.data or [])}

        candidatos = [
            c for c in (cola_r.data or [])
            if c["id"] in visitas_en_estudio
        ]

        def sort_key(c):
            return (PRIO.get(c["tipo_paciente"], 6), c["timestamp_llegada"])

        candidatos.sort(key=sort_key)
        mi_key = (mi_prio, llegada)

        delante = []
        detras  = []
        for c in candidatos:
            ck = sort_key(c)
            info = {"tipo": c["tipo_paciente"]}
            if ck < mi_key:
                delante.append(info)
            else:
                detras.append(info)

        return {
            "posicion": posicion,
            "total_en_cola": posicion + len(detras),
            "delante": delante[-3:],   # máx 3 antes de ti
            "detras":  detras[:3],     # máx 3 después de ti
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
