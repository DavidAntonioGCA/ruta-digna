const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '/api').replace(/\/+$/, '')

function joinUrl(base: string, path: string) {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

async function apiFetch<T>(path: string, options?: RequestInit, silent404 = false): Promise<T> {
  const res = await fetch(joinUrl(API_URL, path), {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const errorBody = await res.text()
    const err = new Error(`API error ${res.status}: ${errorBody}`)
    if (res.status === 404 && silent404) throw err   // caller handles silently
    console.error(`[API] Error en ${path}:`, err.message)
    throw err
  }
  return res.json()
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
  timestamp_llegada: string; posicion_en_cola: number | null
  estudio_actual: { id_estudio: number; nombre: string; paso_actual: string; progreso_pct: number; estatus: string
    guia: { nombre_area: string; ubicacion: string; piso: number; instrucciones: string; referencia: string | null }
  } | null
  estudios: EstudioVisita[]; alertas_sucursal: any[]
}

export const getVisitaStatus = (visitaId: string) => apiFetch<EstadoVisita>(`/paciente/status/${visitaId}`)

export interface ColaPaciente {
  posicion: number | null
  total_en_cola: number
  delante: { tipo: string }[]
  detras: { tipo: string }[]
}
export const getColaPaciente = (visitaId: string) => apiFetch<ColaPaciente>(`/paciente/cola/${visitaId}`)

// ── Paciente / Auth ───────────────────────────────────────────

export const buscarPaciente = (telefono: string) =>
  apiFetch<{ encontrado: boolean; paciente_id?: string; nombre?: string; visita_id?: string | null }>(
    `/paciente/buscar?telefono=${encodeURIComponent(telefono)}`
  )

export interface VerificarResponse {
  escenario: 'cuenta_activa' | 'primer_acceso_sd' | 'nuevo'
  // cuenta_activa
  nombre_mascara?: string; tipo_paciente?: string; tiene_pin?: boolean; en_sd?: boolean
  // primer_acceso_sd
  datos_sd?: {
    nombre: string; primer_apellido: string; segundo_apellido: string
    fecha_nacimiento: string; sexo: string; nacionalidad: string
    residencia: string; discapacidad: boolean
  }
  tipo_detectado?: string; mujer_fertil?: boolean
}
export const verificarPaciente = (telefono: string) =>
  apiFetch<VerificarResponse>(`/paciente/verificar?telefono=${encodeURIComponent(telefono)}`)

export const loginPaciente = (telefono: string, pin: string) =>
  apiFetch<{ paciente_id: string; nombre: string; tipo_paciente: string; visita_id: string | null }>(
    '/paciente/login', { method: 'POST', body: JSON.stringify({ telefono, pin }) }
  )

export const registrarPaciente = (data: {
  nombre: string; primer_apellido: string; segundo_apellido?: string
  telefono: string; fecha_nacimiento: string; sexo: string
  nacionalidad?: string; residencia?: string; discapacidad?: boolean
  embarazada?: boolean; pin: string
}) =>
  apiFetch<{ paciente_id: string; nombre: string; tipo_paciente: string }>(
    '/paciente/registrar', { method: 'POST', body: JSON.stringify(data) }
  )

export const crearVisita = (body: {
  id_paciente: string
  id_sucursal: number
  ids_estudios: number[]
  tipo_paciente?: string
}) => apiFetch<{ visita_id: string; estado: any }>('/visitas/', {
  method: 'POST',
  body: JSON.stringify({ tipo_paciente: 'sin_cita', ...body }),
})
export const getGuiaVisita = (visitaId: string) => apiFetch<any[]>(`/guias/visita/${visitaId}`)
export const getEstudiosReordenables = (visitaId: string) => apiFetch<any>(`/visitas/${visitaId}/estudios-reordenables`)
export const getVisitasActivas = () => apiFetch<Array<{ visita_id: string }>>(`/visitas/activas`)

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

export interface ResultadoEstudio {
  id: string
  id_visita: string
  nombre_archivo: string
  url_archivo: string
  tipo_estudio: string
  interpretacion_ia: string | null
  subido_por: string
  created_at: string
}
export const getResultadosVisita = (visitaId: string) =>
  apiFetch<ResultadoEstudio[]>(`/resultados/visita/${visitaId}`, undefined, true)
