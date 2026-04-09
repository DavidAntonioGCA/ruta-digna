from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
try:
    from backend.routers import clinicas, visitas, ia, estudios, alertas, guias
except ImportError:
    from routers import clinicas, visitas, ia, estudios, alertas, guias
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
app.include_router(guias.router,     prefix="/guias",     tags=["Guías"])

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


@app.post("/paciente/registrar", tags=["Visitas"])
async def registrar_paciente(body: dict):
    """Crea un nuevo paciente y retorna su id."""
    try:
        from services.supabase_client import get_supabase
    except ImportError:
        from backend.services.supabase_client import get_supabase
    import uuid as _uuid
    try:
        sb = get_supabase()
        # Si ya existe ese teléfono, devolver el existente
        existing = sb.table("pacientes").select("id, nombre").eq("telefono", body.get("telefono", "")).execute()
        if existing.data:
            p = existing.data[0]
            return {"paciente_id": p["id"], "nombre": p["nombre"]}
        pid = str(_uuid.uuid4())
        sb.table("pacientes").insert({
            "id":       pid,
            "nombre":   body.get("nombre", "Paciente"),
            "telefono": body.get("telefono", ""),
            "email":    body.get("email"),
        }).execute()
        return {"paciente_id": pid, "nombre": body.get("nombre", "Paciente")}
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
        v = sb.table("visitas").select("id_sucursal, tipo_paciente, timestamp_llegada, id_estudio_actual").eq("id", visita_id).single().execute()
        if not v.data:
            raise HTTPException(404, "Visita no encontrada")

        id_sucursal = v.data["id_sucursal"]
        id_estudio  = v.data.get("id_estudio_actual")
        tipo        = v.data["tipo_paciente"]
        llegada     = v.data["timestamp_llegada"]

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

        # Filtrar los que tienen este estudio pendiente
        ve_r = sb.from_("visita_estudios").select("id_visita, id_estudio").eq("id_estudio", id_estudio).execute()
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
