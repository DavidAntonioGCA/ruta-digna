import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  headers: { 'Content-Type': 'application/json' },
})

// ── Health ──────────────────────────────────────────────────────
export const checkHealth = () =>
  api.get('/health').then(r => r.data)

// ── Visitas ─────────────────────────────────────────────────────
export const getVisitaStatus = (visitaId: string) =>
  api.get(`/visita/status/${visitaId}`).then(r => r.data)

export const crearVisita = (body: {
  id_paciente: string
  id_sucursal: number
  ids_estudios: number[]
  tipo_paciente?: string
}) => api.post('/visitas', body).then(r => r.data)

export const avanzarEstudio = (visitaId: string, body: {
  id_visita_estudio: string
  nuevo_estatus:     number
  nuevo_paso:        string
  nuevo_progreso:    number
}) => api.patch(`/visitas/${visitaId}/avanzar`, body).then(r => r.data)

// ── IA ───────────────────────────────────────────────────────────
export const recomendar = (mensaje: string, lat?: number, lon?: number) =>
  api.post('/ia/recomendar', { mensaje, lat, lon }).then(r => r.data)

export const sendChat = (
  visita_id: string,
  mensaje: string,
  historial: { role: string; content: string }[] = []
) => api.post('/ia/chat', { visita_id, mensaje, historial }).then(r => r.data)

/**
 * Explica resultados médicos.
 * Preferir imagen — el backend la procesa con Claude Vision.
 * Si no hay imagen, pasar texto plano como fallback.
 */
export const explicarResultados = (
  imagenBase64?: string,
  mediaType?: string,
  resultados?: string
) => api.post('/ia/explicar-resultados', {
  imagen_base64: imagenBase64 ?? null,
  media_type:    mediaType   ?? null,
  resultados:    resultados  ?? null,
}).then(r => r.data)

// ── Clínicas ─────────────────────────────────────────────────────
export const getClincias = () =>
  api.get('/clinicas').then(r => r.data)

export const getClinicaEstado = (id: number) =>
  api.get(`/clinicas/${id}/estado`).then(r => r.data)

export default api
