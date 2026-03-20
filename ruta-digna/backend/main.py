from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import clinicas, visitas, ia
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Ruta Digna API",
    description="Backend para el sistema de atención inteligente — Hackathon Talent Land 2026",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
        os.getenv("DASHBOARD_URL", "http://localhost:3001"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clinicas.router,  prefix="/clinicas",  tags=["Clínicas"])
app.include_router(visitas.router,   prefix="/visitas",   tags=["Visitas"])
app.include_router(ia.router,        prefix="/ia",        tags=["IA"])

@app.get("/health", tags=["Sistema"])
def health():
    return {"status": "ok", "proyecto": "Ruta Digna"}

@app.get("/paciente/status/{visita_id}", tags=["Visitas"])
async def get_paciente_status(visita_id: str):
    """Alias amigable de GET /visitas/{id}/status para el frontend."""
    from routers.visitas import get_visita_status
    return await get_visita_status(visita_id)
