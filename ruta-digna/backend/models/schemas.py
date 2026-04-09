from pydantic import BaseModel, Field
from typing import Optional, List, Literal

# ── Visitas ────────────────────────────────────────────────────

class CrearVisitaRequest(BaseModel):
    id_paciente:       str
    id_sucursal:       int
    ids_estudios:      List[int]
    tipo_paciente:     Literal[
        'urgente', 'embarazada', 'adulto_mayor',
        'discapacidad', 'con_cita', 'sin_cita'
    ] = 'sin_cita'
    id_reservacion_sd: Optional[int] = None

class AvanzarEstudioRequest(BaseModel):
    id_visita_estudio: str
    nuevo_estatus:     int
    nuevo_paso:        str
    nuevo_progreso:    int

class CambiarTipoPacienteRequest(BaseModel):
    tipo_paciente: Literal[
        'urgente', 'embarazada', 'adulto_mayor',
        'discapacidad', 'con_cita', 'sin_cita'
    ]

# ── Estudios ───────────────────────────────────────────────────

class RestriccionesRequest(BaseModel):
    edad_paciente: Optional[int] = None
    meses_desde_ultimo: Optional[int] = None

class RestriccionesResponse(BaseModel):
    tiene_restriccion: bool
    requiere_orden_medica: bool
    descripcion: Optional[str] = None

# ── IA ─────────────────────────────────────────────────────────

class RecomendarRequest(BaseModel):
    mensaje: str
    lat:     Optional[float] = None
    lon:     Optional[float] = None

class ChatRequest(BaseModel):
    visita_id: str
    mensaje:   str
    historial: List[dict] = Field(default_factory=list)

class ChatResultadoRequest(BaseModel):
    """Chat especializado para interpretar un resultado médico específico."""
    contexto_resultado: str          # nombre, tipo y fecha del resultado
    mensaje:            str
    historial:          List[dict] = Field(default_factory=list)
    archivo_base64:     Optional[str] = None   # contenido del archivo en base64
    media_type:         Optional[str] = None   # image/jpeg, image/png, application/pdf

class ExplicarRequest(BaseModel):
    imagen_base64: Optional[str] = None
    media_type:    Optional[str] = None
    resultados:    Optional[str] = None

class IAResponse(BaseModel):
    reply: str

# ── Alertas ────────────────────────────────────────────────────

class CrearAlertaRequest(BaseModel):
    id_sucursal:       int
    id_estudio:        Optional[int] = None
    tipo_alerta:       Literal[
        'equipo_averiado', 'personal_ausente', 'emergencia_medica',
        'retraso_general', 'cierre_temporal', 'saturacion', 'otro'
    ]
    titulo:            str
    descripcion:       Optional[str] = None
    severidad:         Literal['baja', 'media', 'alta', 'critica'] = 'media'
    impacto_tiempo_min: int = 0

class ResolverAlertaRequest(BaseModel):
    resuelta_por: str = 'operador'

# ── Paciente ──────────────────────────────────────────────────

class RegistrarPacienteRequest(BaseModel):
    nombre:   str
    telefono: str
    email:    Optional[str] = None

# ── Especialistas ─────────────────────────────────────────────

class RegistrarEspecialistaRequest(BaseModel):
    nombre:      str
    id_empleado: str                    # número de empleado SD
    pin:         str = Field(min_length=4, max_length=4, pattern=r'^\d{4}$')
    id_sucursal: int
    id_estudio:  int                    # área que atiende
    rol:         Literal['especialista', 'admin'] = 'especialista'

class LoginEspecialistaRequest(BaseModel):
    id_empleado: str
    pin:         str

class EspecialistaResponse(BaseModel):
    especialista_id: str
    nombre:          str
    id_empleado:     str
    rol:             str
    id_sucursal:     int
    nombre_sucursal: Optional[str] = None
    id_estudio:      int
    nombre_estudio:  Optional[str] = None

# ── Guías de navegación ───────────────────────────────────────

class GuiaNavegacionRequest(BaseModel):
    id_sucursal:   int
    id_estudio:    int
    nombre_area:   str
    ubicacion:     str
    piso:          int = 1
    instrucciones: Optional[str] = None
    referencia:    Optional[str] = None
