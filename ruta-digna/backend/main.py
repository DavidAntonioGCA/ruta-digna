from fastapi import FastAPI
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

@app.get("/paciente/status/{visita_id}", tags=["Visitas"])
async def get_paciente_status(visita_id: str):
    """Alias amigable de GET /visitas/status para el frontend."""
    try:
        from backend.routers.visitas import get_visita_status
    except ImportError:
        from routers.visitas import get_visita_status
    return await get_visita_status(visita_id)
