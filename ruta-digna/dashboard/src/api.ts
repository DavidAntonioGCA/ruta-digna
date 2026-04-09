import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  headers: { 'Content-Type': 'application/json' },
})

// ── Salud ─────────────────────────────────────────────────────
export const checkHealth = () => api.get('/health').then(r => r.data)

// ── Clínicas ──────────────────────────────────────────────────
export const getClinicas        = () => api.get('/clinicas').then(r => r.data)
export const getClinicaEstado   = (id: number) => api.get(`/clinicas/${id}/estado`).then(r => r.data)

// ── Visitas ───────────────────────────────────────────────────
export const getVisitasActivas  = () => api.get('/visitas/activas').then(r => r.data)
export const getVisitaStatus    = (id: string) => api.get(`/visitas/status/${id}`).then(r => r.data)
export const getVisitasEspecialista = (estudio: string) =>
  api.get('/visitas/especialista', { params: { estudio } }).then(r => r.data)

export const avanzarEstudio = (visitaId: string, body: {
  id_visita_estudio: string
  nuevo_estatus:     number
  nuevo_paso:        string
  nuevo_progreso:    number
}) => api.patch(`/visitas/${visitaId}/avanzar`, body).then(r => r.data)

export const cambiarTipoPaciente = (visitaId: string, tipo_paciente: string) =>
  api.patch(`/visitas/${visitaId}/tipo-paciente`, { tipo_paciente }).then(r => r.data)

// ── Alertas ───────────────────────────────────────────────────
export const getAlertas = (idSucursal: number) =>
  api.get(`/alertas/${idSucursal}`).then(r => r.data)

export const crearAlerta = (body: {
  id_sucursal:        number
  id_estudio?:        number | null
  tipo_alerta:        string
  titulo:             string
  descripcion?:       string
  severidad:          string
  impacto_tiempo_min: number
}) => api.post('/alertas', body).then(r => r.data)

export const resolverAlerta = (alertaId: string) =>
  api.patch(`/alertas/${alertaId}/resolver`, { resuelta_por: 'operador' }).then(r => r.data)

// ── Resultados ───────────────────────────────────────────────
export const subirResultado = (formData: FormData) =>
  api.post('/resultados/subir', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)

export const getResultadosVisita = (visitaId: string) =>
  api.get(`/resultados/visita/${visitaId}`).then(r => r.data)

export const getHistorialPaciente = (visitaId: string) =>
  api.get(`/resultados/historial/${visitaId}`).then(r => r.data)

// ── Guías ─────────────────────────────────────────────────────
export const getGuiasSucursal = (idSucursal: number) =>
  api.get(`/guias/sucursal/${idSucursal}`).then(r => r.data)

export const guardarGuia = (body: {
  id_sucursal:   number
  id_estudio:    number
  nombre_area:   string
  ubicacion:     string
  piso:          number
  instrucciones?: string
  referencia?:   string
}) => api.post('/guias', body).then(r => r.data)

export default api
