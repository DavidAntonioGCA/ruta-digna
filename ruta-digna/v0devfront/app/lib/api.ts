const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    if (!res.ok) {
      const errorBody = await res.text()
      throw new Error(`API error ${res.status}: ${errorBody}`)
    }
    return res.json()
  } catch (err) {
    console.error(`[API] Error en ${path}:`, err)
    throw err
  }
}

export interface EstudioVisita {
  orden: number; id_estudio: number; id_visita_estudio: string; nombre: string
  estatus: string; es_estado_final: boolean; es_actual: boolean; progreso_pct: number
  tiempo_espera_min: number; preparacion: string | null
  guia: { nombre_area: string; ubicacion: string; piso: number; instrucciones: string; referencia: string | null }
}

export interface EstadoVisita {
  visita_id: string; paciente: string; sucursal: string; ciudad: string; estatus: string
  tipo_paciente: string; progreso_general_pct: number; tiempo_espera_total_min: number
  timestamp_llegada: string
  estudio_actual: { id_estudio: number; nombre: string; paso_actual: string; progreso_pct: number; estatus: string
    guia: { nombre_area: string; ubicacion: string; piso: number; instrucciones: string; referencia: string | null }
  } | null
  estudios: EstudioVisita[]; alertas_sucursal: any[]
}

export const getVisitaStatus = (visitaId: string) => apiFetch<EstadoVisita>(`/paciente/status/${visitaId}`)
export const getGuiaVisita = (visitaId: string) => apiFetch<any[]>(`/guias/visita/${visitaId}`)
export const getEstudiosReordenables = (visitaId: string) => apiFetch<any>(`/visitas/${visitaId}/estudios-reordenables`)

export interface RecomendacionResponse {
  sucursal_recomendada: { id_sucursal: number; nombre_sucursal: string; direccion: string; ciudad: string; tiempo_total_min: number; score: number; estudios_disponibles: number }
  alternativas: any[]; estudios_detectados: string[]; ids_estudios_detectados: number[]
  orden_sugerido: { orden: number; nombre: string; requiere_preparacion: boolean; preparacion: string }[]
  advertencia?: string
}

export const recomendar = (mensaje: string, lat?: number, lon?: number) =>
  apiFetch<RecomendacionResponse>('/ia/recomendar', { method: 'POST', body: JSON.stringify({ mensaje, lat, lon }) })

export const chatAsistente = (visita_id: string, mensaje: string, historial: any[] = []) =>
  apiFetch<{ reply: string }>('/ia/chat', { method: 'POST', body: JSON.stringify({ visita_id, mensaje, historial }) })

export const explicarResultados = (data: { imagen_base64?: string; media_type?: string; resultados?: string }) =>
  apiFetch<{ reply: string }>('/ia/explicar-resultados', { method: 'POST', body: JSON.stringify(data) })
