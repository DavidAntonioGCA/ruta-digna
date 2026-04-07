import os
import httpx
from typing import Optional, Union

CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"
CLAUDE_MODEL   = "claude-sonnet-4-20250514"

class ClaudeAPIError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"Claude API error {status_code}: {message}")

async def call_claude(
    system_prompt: str,
    user_message:  Union[str, dict],   # str para texto, dict para imagen
    historial:     Optional[list] = None,
    max_tokens:    int  = 1024
) -> str:
    """
    Función central para llamar a Claude API.
    Todos los módulos de IA la usan — solo cambia el system_prompt.

    user_message puede ser:
      - str: mensaje de texto normal
      - dict: bloque con imagen {"role": "user", "content": [...]}
    """
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        raise ValueError("CLAUDE_API_KEY no está en .env")

    # Construir lista de mensajes
    messages = list(historial or [])

    if isinstance(user_message, dict):
        # Ya viene formateado como bloque de mensaje (caso imagen)
        messages.append(user_message)
    else:
        messages.append({"role": "user", "content": user_message})

    headers = {
        "x-api-key":           api_key,
        "anthropic-version":   "2023-06-01",
        "content-type":        "application/json",
    }
    payload = {
        "model":      CLAUDE_MODEL,
        "max_tokens": max_tokens,
        "system":     system_prompt,
        "messages":   messages,
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(CLAUDE_API_URL, json=payload, headers=headers)
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            body = e.response.text or ""
            raise ClaudeAPIError(e.response.status_code, body[:2000]) from e
        except httpx.HTTPError as e:
            raise ClaudeAPIError(0, str(e)) from e

        data = resp.json()
        return data["content"][0]["text"]


# ── System prompts ─────────────────────────────────────────────

PROMPT_EXTRACTOR = """
Del mensaje de un paciente de Salud Digna, extrae en JSON exactamente:
{ "estudios_mencionados": [lista de strings], "zona_o_referencia": string_o_null, "horario_preferido": string_o_null }
Estudios válidos: LABORATORIO, RAYOS X, ULTRASONIDO, DENSITOMETRÍA, MASTOGRAFÍA,
PAPANICOLAOU, ELECTROCARDIOGRAMA, TOMOGRAFÍA, RESONANCIA MAGNÉTICA, NUTRICIÓN,
EXAMEN DE LA VISTA, ÓPTICA, SALUD OCUPACIONAL.
Responde SOLO el JSON, sin texto adicional, sin markdown.
""".strip()

PROMPT_ASISTENTE = """
Eres el asistente de Ruta Digna en una clínica de Salud Digna.
Estado actual de la visita del paciente:
{estado_visita}

Reglas que debes conocer:
- Sin preparación siempre antes que con preparación
- Papanicolaou siempre antes de Ultrasonido
- Densitometría siempre antes de Tomografía o Resonancia Magnética
- Laboratorio siempre antes de Ultrasonido cuando requiere ayuno
- En Ultrasonido: urgentes primero, con cita segundo, sin cita tercero
- Tomografía y Resonancia requieren puntualidad estricta
- Mastografía: menores de 35 años necesitan orden médica de especialista

Responde de forma clara, empática y concisa. Máximo 2-3 oraciones.
NO inventes información. NO diagnostiques. NO recomiendas medicamentos.
Si no sabes algo, sugiere preguntar en recepción.
""".strip()

PROMPT_EXPLICADOR = """
Eres un asistente que explica resultados de laboratorio en lenguaje simple
para pacientes mexicanos sin conocimientos médicos.
Puedes recibir una imagen de los resultados o texto directo — trata ambos igual.
Si recibes una imagen: lee todos los valores visibles aunque estén en tabla o columnas.
Para cada valor: qué es, si está en rango normal (usa el rango de referencia del documento
si aparece), qué significa en términos cotidianos. Usa analogías cuando ayude.
NUNCA diagnostiques enfermedades.
NUNCA recomiendes medicamentos o tratamientos.
SIEMPRE termina con: "Te recomiendo compartir estos resultados con tu médico para una interpretación profesional."
Si la imagen no es legible responde exactamente:
"No pude leer bien la imagen. Intenta con mejor iluminación o usa la opción de texto."
Si el contenido no parece ser resultados médicos, indícalo amablemente.
""".strip()
