const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Visitas ───────────────────────────────────────────────────────────────────

export interface EstudioVisita {
  orden:             number
  id_estudio:        number
  id_visita_estudio: string
  nombre:            string
  estatus:           string
  es_estado_final:   boolean
  es_actual:         boolean
  progreso_pct:      number
  tiempo_espera_min: number
  preparacion:       string | null
  guia: {
    nombre_area:   string
    ubicacion:     string
    piso:          number
    instrucciones: string
    referencia:    string | null
  }
}

export interface EstadoVisita {
  visita_id:               string
  paciente:                string
  sucursal:                string
  ciudad:                  string
  estatus:                 string
  tipo_paciente:           string
  progreso_general_pct:    number
  tiempo_espera_total_min: number
  timestamp_llegada:       string
  estudio_actual: {
    id_estudio:   number
    nombre:       string
    paso_actual:  string
    progreso_pct: number
    estatus:      string
    guia: {
      nombre_area:   string
      ubicacion:     string
      piso:          number
      instrucciones: string
      referencia:    string | null
    }
  } | null
  estudios:          EstudioVisita[]
  alertas_sucursal:  any[]
}

export const getVisitaStatus = (visitaId: string) =>
  apiFetch<EstadoVisita>(`/paciente/status/${visitaId}`)

// ── IA ────────────────────────────────────────────────────────────────────────

export const sendChat = (
  visitaId: string,
  mensaje:  string,
  historial: { role: string; content: string }[] = [],
) =>
  apiFetch<{ reply: string }>('/ia/chat', {
    method: 'POST',
    body: JSON.stringify({ visita_id: visitaId, mensaje, historial }),
  })

/**
 * Acepta dos firmas:
 *   explicarResultados(base64, mediaType, undefined)  → imagen
 *   explicarResultados(undefined, undefined, texto)   → texto
 */
export const explicarResultados = (
  imagen_base64?: string,
  media_type?:    string,
  resultados?:    string,
) =>
  apiFetch<{ reply: string }>('/ia/explicar-resultados', {
    method: 'POST',
    body: JSON.stringify({ imagen_base64, media_type, resultados }),
  })
