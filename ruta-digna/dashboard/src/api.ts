import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  headers: { 'Content-Type': 'application/json' },
})

export const checkHealth         = () => api.get('/health').then(r => r.data)
export const getClincias         = () => api.get('/clinicas').then(r => r.data)
export const getClinicaEstado    = (id: number) => api.get(`/clinicas/${id}/estado`).then(r => r.data)
export const getVisitasActivas   = () => api.get('/visitas/activas').then(r => r.data)

export const avanzarEstudio = (visitaId: string, body: {
  id_visita_estudio: string
  nuevo_estatus:     number
  nuevo_paso:        string
  nuevo_progreso:    number
}) => api.patch(`/visitas/${visitaId}/avanzar`, body).then(r => r.data)

export default api
