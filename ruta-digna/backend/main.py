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
