import { useEffect, useState, useCallback } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend
} from 'chart.js'
import {
  checkHealth, getClinicas, getVisitasActivas, avanzarEstudio,
  cambiarTipoPaciente, getAlertas, crearAlerta, resolverAlerta
} from './api'
import api from './api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

// ── Flujo simplificado para la demo ──────────────────────────────
const FLUJO_DEMO = [
  { id: 1,  nombre: 'PAGADO',      paso: 'espera',      progreso: 0   },
  { id: 9,  nombre: 'INICIO_TOMA', paso: 'inicio_toma', progreso: 33  },
  { id: 10, nombre: 'FIN_TOMA',    paso: 'fin_toma',    progreso: 66  },
  { id: 12, nombre: 'VERIFICADO',  paso: 'finalizado',  progreso: 100 },
]

function getSiguienteEstatus(estatusActualId: number) {
  const idx = FLUJO_DEMO.findIndex(f => f.id === estatusActualId)
  return idx >= 0 && idx < FLUJO_DEMO.length - 1 ? FLUJO_DEMO[idx + 1] : null
}

function estatusToId(nombre: string) {
  return nombre === 'PAGADO' ? 1 : nombre === 'INICIO_TOMA' ? 9 : nombre === 'FIN_TOMA' ? 10 : 12
}

// ── Constantes ────────────────────────────────────────────────────
const TIPOS_PACIENTE = [
  { value: 'urgente',       label: 'Urgente',        color: 'bg-red-100 text-red-700',    dot: 'bg-red-500' },
  { value: 'embarazada',    label: 'Embarazada',     color: 'bg-pink-100 text-pink-700',  dot: 'bg-pink-500' },
  { value: 'adulto_mayor',  label: 'Adulto mayor',   color: 'bg-amber-100 text-amber-700',dot: 'bg-amber-500' },
  { value: 'discapacidad',  label: 'Discapacidad',   color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  { value: 'con_cita',      label: 'Con cita',       color: 'bg-blue-100 text-blue-700',  dot: 'bg-blue-500' },
  { value: 'sin_cita',      label: 'Sin cita',       color: 'bg-gray-100 text-gray-600',  dot: 'bg-gray-400' },
]

const TIPOS_ALERTA = [
  { value: 'equipo_averiado',   label: 'Equipo averiado',     icon: '🔧' },
  { value: 'personal_ausente',  label: 'Personal ausente',    icon: '👤' },
  { value: 'emergencia_medica', label: 'Emergencia médica',   icon: '🚨' },
  { value: 'retraso_general',   label: 'Retraso general',     icon: '⏱️' },
  { value: 'cierre_temporal',   label: 'Cierre temporal',     icon: '🚫' },
  { value: 'saturacion',        label: 'Saturación',          icon: '📊' },
  { value: 'otro',              label: 'Otro',                icon: '📌' },
]

const SEVERIDADES = [
  { value: 'baja',    label: 'Baja',    color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'media',   label: 'Media',   color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'alta',    label: 'Alta',    color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'critica', label: 'Crítica', color: 'bg-red-100 text-red-700 border-red-200' },
]

const SUCURSALES = [
  { id: 1,  nombre: 'Culiacán'  },
  { id: 5,  nombre: 'Los Mochis'},
  { id: 6,  nombre: 'Mazatlán'  },
  { id: 9,  nombre: 'Mexicali'  },
  { id: 12, nombre: 'Tijuana'   },
]

function minutosDesde(ts: string) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  return diff < 60 ? `${diff} min` : `${Math.floor(diff / 60)}h ${diff % 60}m`
}

function getTipoInfo(tipo: string) {
  return TIPOS_PACIENTE.find(t => t.value === tipo) || TIPOS_PACIENTE[5]
}

// ── Tabs ──────────────────────────────────────────────────────────
type TabId = 'colas' | 'pacientes' | 'alertas'

// ── StatsCard ─────────────────────────────────────────────────────
function StatsCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-1 border border-gray-100">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-semibold ${accent || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ── AlertBanner (resumen de alertas activas) ──────────────────────
function AlertBanner({ alertas, onViewAll }: { alertas: any[]; onViewAll: () => void }) {
  const criticas = alertas.filter((a: any) => a.severidad === 'critica' || a.severidad === 'alta')
  if (alertas.length === 0) return null

  return (
    <div className={`rounded-xl p-3 flex items-center justify-between ${
      criticas.length > 0
        ? 'bg-red-50 border border-red-200'
        : 'bg-amber-50 border border-amber-200'
    }`}>
      <div className="flex items-center gap-3">
        <span className="text-lg">{criticas.length > 0 ? '🚨' : '⚠️'}</span>
        <div>
          <p className={`text-sm font-medium ${criticas.length > 0 ? 'text-red-800' : 'text-amber-800'}`}>
            {alertas.length} alerta{alertas.length > 1 ? 's' : ''} activa{alertas.length > 1 ? 's' : ''}
            {criticas.length > 0 && ` · ${criticas.length} de alta prioridad`}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {alertas[0]?.titulo}
            {alertas.length > 1 && ` (+${alertas.length - 1} más)`}
          </p>
        </div>
      </div>
      <button
        onClick={onViewAll}
        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
      >
        Ver todas
      </button>
    </div>
  )
}

// ── VisitaRow ─────────────────────────────────────────────────────
function VisitaRow({ visita, advancing, onAvanzar, onChangePriority }: {
  visita: any
  advancing: string | null
  onAvanzar: (visitaId: string, veId: string, estatusId: number) => void
  onChangePriority: (visitaId: string, tipo: string) => void
}) {
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const estudios: any[] = visita.estudios ?? []
  const actual = estudios.find((e: any) => e.es_actual)
  const tipoInfo = getTipoInfo(visita.tipo_paciente)

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{visita.paciente ?? 'Paciente'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{minutosDesde(visita.timestamp_llegada)} en clínica</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowPriorityMenu(!showPriorityMenu)}
            className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all ${tipoInfo.color}`}
            title="Cambiar prioridad"
          >
            {tipoInfo.label} ▾
          </button>
          {showPriorityMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowPriorityMenu(false)} />
              <div className="absolute right-0 top-7 z-40 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[160px]">
                <p className="text-xs text-gray-400 px-3 py-1 font-medium">Cambiar prioridad:</p>
                {TIPOS_PACIENTE.map(tipo => (
                  <button
                    key={tipo.value}
                    onClick={() => {
                      onChangePriority(visita.visita_id, tipo.value)
                      setShowPriorityMenu(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 ${
                      visita.tipo_paciente === tipo.value ? 'font-medium' : ''
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${tipo.dot}`} />
                    {tipo.label}
                    {visita.tipo_paciente === tipo.value && <span className="ml-auto">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Estudios en orden */}
      <div className="flex items-center gap-1 flex-wrap mb-3">
        {estudios.map((est: any, i: number) => (
          <div key={est.orden ?? i} className="flex items-center gap-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              est.es_estado_final ? 'bg-green-100 text-green-700' :
              est.es_actual       ? 'bg-blue-100 text-blue-700 font-medium' :
                                    'bg-gray-100 text-gray-500'
            }`}>
              {est.orden}. {est.nombre}
              {est.es_estado_final ? ' ✓' : est.es_actual ? ' ⏳' : ''}
            </span>
            {i < estudios.length - 1 && <span className="text-gray-300 text-xs">→</span>}
          </div>
        ))}
      </div>

      {/* Guía de ubicación del estudio actual */}
      {actual?.guia && actual.guia.instrucciones && actual.guia.instrucciones !== 'Pregunta en recepción' && (
        <div className="text-xs text-gray-500 bg-blue-50 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
          <span>📍</span>
          <span>{actual.guia.nombre_area} — {actual.guia.ubicacion}</span>
        </div>
      )}

      {/* Botón avanzar */}
      {actual && (() => {
        const estatusId = estatusToId(actual.estatus)
        const siguiente = getSiguienteEstatus(estatusId)
        if (!siguiente) return null
        return (
          <button
            disabled={advancing !== null}
            onClick={() => onAvanzar(visita.visita_id, actual.id_visita_estudio ?? '', estatusId)}
            className="w-full text-xs bg-blue-600 text-white px-3 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            {advancing === (actual.id_visita_estudio ?? '') ? 'Avanzando...' : `→ Avanzar a ${siguiente.nombre}`}
          </button>
        )
      })()}
    </div>
  )
}

// ── VisitaDemoControl ────────────────────────────────────────────
function VisitaDemoControl({ advancing, onAvanzar, onChangePriority }: {
  advancing: string | null
  onAvanzar: (visitaId: string, veId: string, estatusId: number) => void
  onChangePriority: (visitaId: string, tipo: string) => void
}) {
  const [visita, setVisita] = useState<any>(null)
  const VISITA_ID = '06b8efbf-67bc-426c-9523-3059d0dec059'

  const fetchVisita = useCallback(() => {
    api.get(`/paciente/status/${VISITA_ID}`)
      .then(r => setVisita(r.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchVisita()
    const iv = setInterval(fetchVisita, 5000)
    return () => clearInterval(iv)
  }, [fetchVisita])

  if (!visita) return <p className="text-xs text-gray-400">Cargando visita demo...</p>

  return (
    <VisitaRow
      visita={{ ...visita, tipo_paciente: visita.tipo_paciente ?? 'sin_cita' }}
      advancing={advancing}
      onAvanzar={onAvanzar}
      onChangePriority={onChangePriority}
    />
  )
}

// ── Panel de Alertas ─────────────────────────────────────────────
function AlertasPanel({ sucursalId, alertas, onRefresh }: {
  sucursalId: number; alertas: any[]; onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    tipo_alerta: 'retraso_general',
    titulo: '',
    descripcion: '',
    severidad: 'media',
    impacto_tiempo_min: 15,
    id_estudio: null as number | null,
  })
  const [submitting, setSubmitting] = useState(false)

  const handleCrear = async () => {
    if (!form.titulo.trim()) return
    setSubmitting(true)
    try {
      await crearAlerta({
        id_sucursal: sucursalId,
        id_estudio: form.id_estudio,
        tipo_alerta: form.tipo_alerta,
        titulo: form.titulo,
        descripcion: form.descripcion || undefined,
        severidad: form.severidad,
        impacto_tiempo_min: form.impacto_tiempo_min,
      })
      setForm({ tipo_alerta: 'retraso_general', titulo: '', descripcion: '', severidad: 'media', impacto_tiempo_min: 15, id_estudio: null })
      setShowForm(false)
      onRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResolver = async (alertaId: string) => {
    try {
      await resolverAlerta(alertaId)
      onRefresh()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Alertas e imprevistos</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium"
        >
          + Nueva alerta
        </button>
      </div>

      {/* Formulario de nueva alerta */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <p className="text-sm font-medium text-gray-900 mb-3">Reportar imprevisto</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
              <select
                value={form.tipo_alerta}
                onChange={e => setForm({ ...form, tipo_alerta: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
              >
                {TIPOS_ALERTA.map(t => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Severidad</label>
              <select
                value={form.severidad}
                onChange={e => setForm({ ...form, severidad: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
              >
                {SEVERIDADES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">Título</label>
            <input
              type="text"
              value={form.titulo}
              onChange={e => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ej: Equipo de Ultrasonido sala 2 fuera de servicio"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5"
            />
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">Descripción (opcional)</label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Detalles del imprevisto..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 resize-none"
              rows={2}
            />
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">
              Impacto estimado en tiempo: <strong>{form.impacto_tiempo_min} min</strong>
            </label>
            <input
              type="range"
              min="0" max="120" step="5"
              value={form.impacto_tiempo_min}
              onChange={e => setForm({ ...form, impacto_tiempo_min: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCrear}
              disabled={!form.titulo.trim() || submitting}
              className="flex-1 text-xs bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
            >
              {submitting ? 'Creando...' : 'Crear alerta'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de alertas activas */}
      {alertas.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-sm">Sin alertas activas</p>
          <p className="text-xs">Todo funciona con normalidad</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alertas.map((alerta: any) => {
            const sevInfo = SEVERIDADES.find(s => s.value === alerta.severidad) || SEVERIDADES[1]
            const tipoInfo = TIPOS_ALERTA.find(t => t.value === alerta.tipo_alerta) || TIPOS_ALERTA[6]
            return (
              <div key={alerta.id} className={`rounded-xl p-4 border ${sevInfo.color}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{tipoInfo.icon}</span>
                      <p className="text-sm font-medium">{alerta.titulo}</p>
                    </div>
                    {alerta.descripcion && (
                      <p className="text-xs text-gray-600 mt-1">{alerta.descripcion}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      {alerta.estudio_afectado && (
                        <span>Área: {alerta.estudio_afectado}</span>
                      )}
                      {alerta.impacto_tiempo_min > 0 && (
                        <span>+{alerta.impacto_tiempo_min} min impacto</span>
                      )}
                      <span>{minutosDesde(alerta.timestamp_inicio)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleResolver(alerta.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-green-700 hover:bg-green-50 font-medium flex-shrink-0"
                  >
                    ✓ Resolver
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── App principal ─────────────────────────────────────────────────
export default function App() {
  const [clinicas,   setClinicas]   = useState<any[]>([])
  const [visitas,    setVisitas]    = useState<any[]>([])
  const [alertas,    setAlertas]    = useState<any[]>([])
  const [sucursalId, setSucursalId] = useState<number>(1)
  const [advancing,  setAdvancing]  = useState<string | null>(null)
  const [connected,  setConnected]  = useState(false)
  const [activeTab,  setActiveTab]  = useState<TabId>('colas')

  // Health check
  useEffect(() => {
    checkHealth()
      .then(() => setConnected(true))
      .catch(() => setConnected(false))
  }, [])

  // Clínicas — polling 8s
  useEffect(() => {
    const f = () => getClinicas().then(d => setClinicas(Array.isArray(d) ? d : [])).catch(() => {})
    f(); const iv = setInterval(f, 8000); return () => clearInterval(iv)
  }, [])

  // Visitas activas — polling 5s
  useEffect(() => {
    const f = () => getVisitasActivas().then(d => setVisitas(Array.isArray(d) ? d : [])).catch(() => {})
    f(); const iv = setInterval(f, 5000); return () => clearInterval(iv)
  }, [])

  // Alertas — polling 10s
  const fetchAlertas = useCallback(() => {
    getAlertas(sucursalId).then(d => setAlertas(Array.isArray(d) ? d : [])).catch(() => setAlertas([]))
  }, [sucursalId])

  useEffect(() => {
    fetchAlertas()
    const iv = setInterval(fetchAlertas, 10000)
    return () => clearInterval(iv)
  }, [fetchAlertas])

  // Stats derivadas
  const datosSucursal = clinicas.filter((c: any) => c.id_sucursal === sucursalId)
  const totalEspera   = datosSucursal.reduce((s: number, c: any) => s + (c.pacientes_en_espera ?? 0), 0)
  const areaSaturada  = datosSucursal.reduce((max: any, c: any) =>
    (c.pacientes_en_espera ?? 0) > (max?.pacientes_en_espera ?? -1) ? c : max, null)
  const tiempoPromedio = datosSucursal.length > 0
    ? Math.round(datosSucursal.reduce((s: number, c: any) => s + (c.tiempo_espera_estimado_min ?? c.tiempo_espera_promedio_min ?? 0), 0) / datosSucursal.length)
    : 0

  // Impacto de alertas en tiempo
  const impactoAlertas = alertas.reduce((s: number, a: any) => s + (a.impacto_tiempo_min ?? 0), 0)

  // Gráfica
  const chartData = {
    labels: datosSucursal.map((c: any) => c.estudio ?? c.nombre_estudio ?? '—'),
    datasets: [
      { label: 'Urgentes', data: datosSucursal.map((c: any) => c.pacientes_urgentes ?? 0), backgroundColor: '#EF4444', borderRadius: 4 },
      { label: 'Con cita', data: datosSucursal.map((c: any) => c.pacientes_con_cita ?? 0), backgroundColor: '#2563EB', borderRadius: 4 },
      { label: 'Sin cita', data: datosSucursal.map((c: any) => (c.pacientes_en_espera ?? 0) - (c.pacientes_urgentes ?? 0) - (c.pacientes_con_cita ?? 0)), backgroundColor: '#CBD5E1', borderRadius: 4 },
    ],
  }
  const chartOpts = {
    indexAxis: 'y' as const,
    responsive: true,
    plugins: { legend: { position: 'bottom' as const, labels: { font: { size: 11 }, boxWidth: 12 } } },
    scales: { x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }, y: { stacked: true } },
  }

  // Avanzar estudio
  const handleAvanzar = async (visitaId: string, veId: string, estatusActualId: number) => {
    const siguiente = getSiguienteEstatus(estatusActualId)
    if (!siguiente) return
    setAdvancing(veId)
    try {
      await avanzarEstudio(visitaId, {
        id_visita_estudio: veId,
        nuevo_estatus:     siguiente.id,
        nuevo_paso:        siguiente.paso,
        nuevo_progreso:    siguiente.progreso,
      })
    } finally {
      setAdvancing(null)
    }
  }

  // Cambiar prioridad
  const handleChangePriority = async (visitaId: string, tipo: string) => {
    try {
      await cambiarTipoPaciente(visitaId, tipo)
    } catch (e) {
      console.error(e)
    }
  }

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: 'colas',     label: 'Colas por área' },
    { id: 'pacientes', label: 'Pacientes', count: visitas.length || undefined },
    { id: 'alertas',   label: 'Alertas',   count: alertas.length || undefined },
  ]

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Ruta Digna</h1>
          <p className="text-xs text-gray-400">Panel del operador · Personal clínico</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'}`} />
            <span className="text-xs text-gray-500">{connected ? 'Conectado' : 'Sin conexión'}</span>
          </div>
          <a
            href={`${import.meta.env.VITE_FRONTEND_URL || 'http://localhost:3000'}/login`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium"
          >
            Abrir App Paciente ↗
          </a>
          <select
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
            value={sucursalId}
            onChange={e => setSucursalId(Number(e.target.value))}
          >
            {SUCURSALES.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* ── Alert Banner ── */}
        <AlertBanner alertas={alertas} onViewAll={() => setActiveTab('alertas')} />

        {/* ── StatsCards ── */}
        <div className="grid grid-cols-4 gap-4">
          <StatsCard
            label="Pacientes en espera"
            value={totalEspera}
            sub="Sucursal seleccionada"
          />
          <StatsCard
            label="Área más saturada"
            value={areaSaturada?.estudio ?? areaSaturada?.nombre_estudio ?? '—'}
            sub={areaSaturada ? `${areaSaturada.pacientes_en_espera} en espera` : undefined}
          />
          <StatsCard
            label="Tiempo promedio"
            value={tiempoPromedio > 0
              ? `~${Math.max(tiempoPromedio - 5, 5)}-${tiempoPromedio + 10} min`
              : '—'}
            sub="Rango estimado por área"
          />
          <StatsCard
            label="Alertas activas"
            value={alertas.length}
            sub={impactoAlertas > 0 ? `+${impactoAlertas} min impacto total` : 'Sin impacto'}
            accent={alertas.length > 0 ? 'text-red-600' : undefined}
          />
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 text-sm py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id
                    ? tab.id === 'alertas' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {activeTab === 'colas' && (
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">Colas por área — {SUCURSALES.find(s => s.id === sucursalId)?.nombre}</h2>
            {datosSucursal.length > 0
              ? <Bar data={chartData} options={chartOpts} />
              : <p className="text-sm text-gray-400 text-center py-10">Sin datos para esta sucursal</p>
            }
            <p className="text-xs text-gray-400 mt-3 text-center">
              Tiempos son estimaciones que pueden variar por imprevistos o emergencias
            </p>
          </div>
        )}

        {activeTab === 'pacientes' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Pacientes en proceso</h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Prioridad:</span>
                {TIPOS_PACIENTE.slice(0, 4).map(t => (
                  <span key={t.value} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                    {t.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {visitas.length > 0
                ? visitas.map((v: any) => (
                    <VisitaRow
                      key={v.visita_id}
                      visita={v}
                      advancing={advancing}
                      onAvanzar={handleAvanzar}
                      onChangePriority={handleChangePriority}
                    />
                  ))
                : (
                  <p className="text-sm text-gray-400 text-center py-10">Sin visitas activas</p>
                )
              }
            </div>
          </div>
        )}

        {activeTab === 'alertas' && (
          <AlertasPanel
            sucursalId={sucursalId}
            alertas={alertas}
            onRefresh={fetchAlertas}
          />
        )}

      </div>
    </div>
  )
}
