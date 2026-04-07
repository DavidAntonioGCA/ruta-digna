from pydantic import BaseModel, Field
from typing import Optional, List

# ── Visitas ────────────────────────────────────────────────────

class CrearVisitaRequest(BaseModel):
    id_paciente:       str
    id_sucursal:       int
    ids_estudios:      List[int]
    tipo_paciente:     str = "sin_cita"   # urgente | con_cita | sin_cita
    id_reservacion_sd: Optional[int] = None

class AvanzarEstudioRequest(BaseModel):
    id_visita_estudio: str    # uuid del row en visita_estudios
    nuevo_estatus:     int    # id de estatus_servicio
    nuevo_paso:        str    # espera|registro|pago|inicio_toma|fin_toma|diagnostico|finalizado
    nuevo_progreso:    int    # 0-100

# ── Estudios ───────────────────────────────────────────────────

class RestriccionesRequest(BaseModel):
    edad_paciente: Optional[int] = None
    meses_desde_ultimo: Optional[int] = None

class RestriccionesResponse(BaseModel):
    tiene_restriccion: bool
    requiere_orden_medica: bool
    descripcion: Optional[str] = None

class RecomendarRequest(BaseModel):
    mensaje: str
    lat:     Optional[float] = None
    lon:     Optional[float] = None

class ChatRequest(BaseModel):
    visita_id: str
    mensaje:   str
    historial: List[dict] = Field(default_factory=list)

class ExplicarRequest(BaseModel):
    imagen_base64: Optional[str] = None   # base64 sin prefijo data:...
    media_type:    Optional[str] = None   # image/jpeg | image/png | image/webp
    resultados:    Optional[str] = None   # texto plano como alternativa

class IAResponse(BaseModel):
    reply: str
