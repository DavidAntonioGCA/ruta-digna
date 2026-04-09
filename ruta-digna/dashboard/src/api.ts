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
export const getVisitasEspecialista = (estudio: string, id_sucursal?: number) =>
  api.get('/visitas/especialista', { params: { estudio, ...(id_sucursal ? { id_sucursal } : {}) } }).then(r => r.data)

export const getVisitasAtendidas = (estudio: string, id_sucursal?: number) =>
  api.get('/visitas/atendidos', { params: { estudio, ...(id_sucursal ? { id_sucursal } : {}) } }).then(r => r.data)

// ── Especialistas ─────────────────────────────────────────────
export const loginEspecialista = (id_empleado: string, pin: string) =>
  api.post('/especialista/login', { id_empleado, pin }).then(r => r.data)

export const getSucursalesEspecialista = () =>
  api.get('/especialista/sucursales').then(r => r.data)

export const getAreasEspecialista = () =>
  api.get('/especialista/areas').then(r => r.data)

export const registrarEspecialista = (body: {
  nombre:      string
  id_empleado: string
  pin:         string
  id_sucursal: number
  id_estudio:  number
  rol:         'especialista' | 'admin'
}) => api.post('/especialista/registrar', body).then(r => r.data)

export const getEspecialistasSucursal = () =>
  api.get('/especialista/lista').then(r => r.data)

export const avanzarEstudio = (visitaId: string, body: {
  id_visita_estudio: string
  nuevo_estatus:     number
  nuevo_paso:        string
  nuevo_progreso:    number
}) => api.patch(`/visitas/${visitaId}/avanzar`, body).then(r => r.data)

export const cambiarTipoPaciente = (visitaId: string, tipo_paciente: string) =>
  api.patch(`/visitas/${visitaId}/tipo-paciente`, { tipo_paciente }).then(r => r.data)

// ── Alertas ───────────────────────────────────────────────────
export const getAlertas = (idSucursal: number, idEstudio?: number) =>
  api.get(`/alertas/${idSucursal}`, {
    params: idEstudio != null ? { id_estudio: idEstudio } : {}
  }).then(r => r.data)

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

// ── Pantalla pública ──────────────────────────────────────────
export const getPantallaData = (idSucursal: number) =>
  api.get(`/visitas/pantalla/${idSucursal}`).then(r => r.data)

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
