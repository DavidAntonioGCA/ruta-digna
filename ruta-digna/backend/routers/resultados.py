from fastapi import APIRouter, HTTPException, UploadFile, File, Form
import base64, uuid, os, anthropic

try:
    from backend.services.supabase_client import get_supabase
except ImportError:
    from services.supabase_client import get_supabase

router = APIRouter()

ALLOWED_TYPES = {
    "image/jpeg":      "jpeg",
    "image/jpg":       "jpeg",
    "image/png":       "png",
    "application/pdf": "pdf",
}


async def _interpretar_con_ia(file_bytes: bytes, media_type: str, tipo_estudio: str) -> str:
    try:
        client = anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))
        b64 = base64.standard_b64encode(file_bytes).decode("utf-8")

        system = (
            "Eres un asistente médico especializado en interpretar resultados de estudios de diagnóstico. "
            "Explica los resultados de forma clara, empática y accesible para el paciente, evitando jerga médica compleja. "
            "Organiza la respuesta en: 1) Qué muestra el estudio, 2) Valores o hallazgos importantes, "
            "3) Qué significa para el paciente, 4) Recomendación de seguimiento con su médico."
        )

        if media_type == "application/pdf":
            content = [
                {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}},
                {"type": "text", "text": f"Interpreta este resultado de {tipo_estudio or 'estudio médico'} para el paciente."},
            ]
        else:
            content = [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": f"Interpreta esta imagen de {tipo_estudio or 'estudio médico'} para el paciente."},
            ]

        msg = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": content}],
        )
        return msg.content[0].text
    except Exception as e:
        return f"Interpretación no disponible temporalmente: {str(e)}"


@router.post("/subir")
async def subir_resultado(
    file: UploadFile = File(...),
    visita_id: str = Form(...),
    tipo_estudio: str = Form(default=""),
    especialista: str = Form(default=""),
):
    media_type = file.content_type or ""
    if media_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Tipo no permitido. Use: JPEG, PNG o PDF.")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(400, "Archivo demasiado grande (máx. 10 MB)")

    sb = get_supabase()

    # Obtener id_paciente desde la visita
    v = sb.table("visitas").select("id_paciente").eq("id", visita_id).single().execute()
    if not v.data:
        raise HTTPException(404, "Visita no encontrada")
    paciente_id = v.data["id_paciente"]

    # Subir a Supabase Storage
    ext = ALLOWED_TYPES[media_type]
    file_path = f"{visita_id}/{uuid.uuid4()}.{ext}"
    try:
        sb.storage.from_("resultados").upload(
            file_path,
            file_bytes,
            {"content-type": media_type, "upsert": "false"},
        )
        url = sb.storage.from_("resultados").get_public_url(file_path)
    except Exception as e:
        raise HTTPException(500, f"Error subiendo archivo al storage: {str(e)}")

    # Interpretación IA
    interpretacion = await _interpretar_con_ia(file_bytes, media_type, tipo_estudio)

    # Guardar en BD
    resultado_id = str(uuid.uuid4())
    sb.table("resultados_estudios").insert({
        "id":              resultado_id,
        "id_visita":       visita_id,
        "id_paciente":     paciente_id,
        "nombre_archivo":  file.filename or f"resultado.{ext}",
        "url_archivo":     url,
        "tipo_estudio":    tipo_estudio,
        "interpretacion_ia": interpretacion,
        "subido_por":      especialista,
    }).execute()

    return {"id": resultado_id, "url": url, "nombre": file.filename, "interpretacion_ia": interpretacion}


@router.get("/visita/{visita_id}")
async def get_resultados_visita(visita_id: str):
    """Resultados subidos para una visita específica (para el paciente)."""
    try:
        sb = get_supabase()
        r = sb.table("resultados_estudios").select("*").eq("id_visita", visita_id).order("created_at", desc=True).execute()
        return r.data or []
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/historial/{visita_id}")
async def get_historial_por_visita(visita_id: str):
    """Todos los resultados del paciente dueño de esta visita (historial completo)."""
    try:
        sb = get_supabase()
        v = sb.table("visitas").select("id_paciente").eq("id", visita_id).single().execute()
        if not v.data:
            raise HTTPException(404, "Visita no encontrada")
        paciente_id = v.data["id_paciente"]

        r = sb.table("resultados_estudios").select("*").eq("id_paciente", paciente_id).order("created_at", desc=True).execute()
        p = sb.table("pacientes").select("nombre, telefono").eq("id", paciente_id).single().execute()

        return {
            "paciente_id": paciente_id,
            "paciente":    p.data or {},
            "resultados":  r.data or [],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
