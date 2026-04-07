import { useEffect, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend
} from 'chart.js'
import { checkHealth, getClincias, getVisitasActivas, avanzarEstudio } from './api'
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

// ── Design tokens ─────────────────────────────────────────────────
const BADGE_TIPO: Record<string, string> = {
  urgente:  'bg-red-100 text-red-700',
  con_cita: 'bg-blue-100 text-blue-700',
  sin_cita: 'bg-gray-100 text-gray-600',
}

const LABEL_TIPO: Record<string, string> = {
  urgente:  'Urgente',
  con_cita: 'Con cita',
  sin_cita: 'Sin cita',
}

function minutosDesde(ts: string) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  return diff < 60 ? `${diff} min` : `${Math.floor(diff / 60)}h ${diff % 60}m`
}

// ── StatsCard ─────────────────────────────────────────────────────
function StatsCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-1">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ── VisitaRow ─────────────────────────────────────────────────────
function VisitaRow({
  visita,
  advancing,
  onAvanzar,
}: {
  visita: any
  advancing: string | null
  onAvanzar: (visitaId: string, veId: string, estatusId: number) => void
}) {
  const estudios: any[] = visita.estudios ?? []
  const actual = estudios.find((e: any) => e.es_actual)

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{visita.paciente ?? 'Paciente'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{minutosDesde(visita.timestamp_llegada)} en clínica</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_TIPO[visita.tipo_paciente] ?? 'bg-gray-100 text-gray-600'}`}>
          {LABEL_TIPO[visita.tipo_paciente] ?? visita.tipo_paciente}
        </span>
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
            {advancing === actual.id_visita_estudio ? 'Avanzando...' : `→ Avanzar a ${siguiente.nombre}`}
          </button>
        )
      })()}
    </div>
  )
}

// ── VisitaDemoControl (visita de prueba hardcoded) ────────────────
function VisitaDemoControl({ advancing, onAvanzar }: {
  advancing: string | null
  onAvanzar: (visitaId: string, veId: string, estatusId: number) => void
}) {
  const [visita, setVisita] = useState<any>(null)
  const VISITA_ID = '06b8efbf-67bc-426c-9523-3059d0dec059'

  const fetch = () =>
    api.get(`/paciente/status/${VISITA_ID}`)
      .then(r => setVisita(r.data))
      .catch(() => {})

  useEffect(() => {
    fetch()
    const iv = setInterval(fetch, 5000)
    return () => clearInterval(iv)
  }, [])

  if (!visita) return <p className="text-xs text-gray-400">Cargando visita demo...</p>

  return (
    <VisitaRow
      visita={{ ...visita, tipo_paciente: visita.tipo_paciente ?? 'sin_cita' }}
      advancing={advancing}
      onAvanzar={onAvanzar}
    />
  )
}

// ── App principal ─────────────────────────────────────────────────
export default function App() {
  const [clinicas,   setClincias]   = useState<any[]>([])
  const [visitas,    setVisitas]    = useState<any[]>([])
  const [sucursalId, setSucursalId] = useState<number>(1)
  const [advancing,  setAdvancing]  = useState<string | null>(null)
  const [connected,  setConnected]  = useState(false)

  // Health check
  useEffect(() => {
    checkHealth()
      .then(() => setConnected(true))
      .catch(() => setConnected(false))
  }, [])

  // Clínicas — polling 8s
  useEffect(() => {
    const fetch = () => getClincias().then(d => setClincias(Array.isArray(d) ? d : [])).catch(() => {})
    fetch()
    const iv = setInterval(fetch, 8000)
    return () => clearInterval(iv)
  }, [])

  // Visitas activas — polling 5s
  useEffect(() => {
    const fetch = () => getVisitasActivas().then(d => setVisitas(Array.isArray(d) ? d : [])).catch(() => {})
    fetch()
    const iv = setInterval(fetch, 5000)
    return () => clearInterval(iv)
  }, [])

  // Stats derivadas
  const datosSucursal = clinicas.filter((c: any) => c.id_sucursal === sucursalId)
  const totalEspera   = datosSucursal.reduce((s: number, c: any) => s + (c.pacientes_en_espera ?? 0), 0)
  const areaSaturada  = datosSucursal.reduce((max: any, c: any) =>
    (c.pacientes_en_espera ?? 0) > (max?.pacientes_en_espera ?? -1) ? c : max, null)
  const tiempoPromedio = datosSucursal.length > 0
    ? Math.round(datosSucursal.reduce((s: number, c: any) => s + (c.tiempo_espera_estimado_min ?? c.tiempo_espera_promedio_min ?? 0), 0) / datosSucursal.length)
    : 0

  // Gráfica multi-color
  const chartData = {
    labels: datosSucursal.map((c: any) => c.estudio ?? c.nombre_estudio ?? '—'),
    datasets: [
      {
        label: 'Urgentes',
        data: datosSucursal.map((c: any) => c.pacientes_urgentes ?? 0),
        backgroundColor: '#EF4444',
        borderRadius: 4,
      },
      {
        label: 'Con cita',
        data: datosSucursal.map((c: any) => c.pacientes_con_cita ?? 0),
        backgroundColor: '#2563EB',
        borderRadius: 4,
      },
      {
        label: 'Sin cita',
        data: datosSucursal.map((c: any) =>
          (c.pacientes_en_espera ?? 0) - (c.pacientes_urgentes ?? 0) - (c.pacientes_con_cita ?? 0)
        ),
        backgroundColor: '#CBD5E1',
        borderRadius: 4,
      },
    ],
  }
  const chartOpts = {
    indexAxis: 'y' as const,
    responsive: true,
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { size: 11 }, boxWidth: 12 } },
    },
    scales: {
      x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } },
      y: { stacked: true },
    },
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

  const SUCURSALES = [
    { id: 1,  nombre: 'Culiacán'  },
    { id: 5,  nombre: 'Los Mochis'},
    { id: 6,  nombre: 'Mazatlán'  },
    { id: 9,  nombre: 'Mexicali'  },
    { id: 12, nombre: 'Tijuana'   },
  ]

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Ruta Digna</h1>
          <p className="text-xs text-gray-400">Panel operativo de clínica</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'}`} />
            <span className="text-xs text-gray-500">{connected ? 'Conectado' : 'Sin conexión'}</span>
          </div>
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

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* ── StatsCards ── */}
        <div className="grid grid-cols-3 gap-4">
          <StatsCard
            label="Pacientes en espera"
            value={totalEspera}
            sub={`Sucursal seleccionada`}
          />
          <StatsCard
            label="Área más saturada"
            value={areaSaturada?.estudio ?? areaSaturada?.nombre_estudio ?? '—'}
            sub={areaSaturada ? `${areaSaturada.pacientes_en_espera} en espera` : undefined}
          />
          <StatsCard
            label="Tiempo promedio espera"
            value={tiempoPromedio > 0 ? `${tiempoPromedio} min` : '—'}
            sub="Estimado por área"
          />
        </div>

        {/* ── Contenido principal ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Gráfica de colas */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Colas por área</h2>
            {datosSucursal.length > 0
              ? <Bar data={chartData} options={chartOpts} />
              : <p className="text-sm text-gray-400 text-center py-10">Sin datos para esta sucursal</p>
            }
          </div>

          {/* Visitas activas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Visitas activas</h2>
              {visitas.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {visitas.length}
                </span>
              )}
            </div>

            <div className="space-y-3">
              {visitas.length > 0
                ? visitas.map((v: any) => (
                    <VisitaRow
                      key={v.visita_id}
                      visita={v}
                      advancing={advancing}
                      onAvanzar={handleAvanzar}
                    />
                  ))
                : (
                  /* Fallback: visita de demo hardcoded */
                  <div>
                    <p className="text-xs text-gray-400 mb-2">
                      Sin visitas activas en la vista — mostrando visita de demo:
                    </p>
                    <VisitaDemoControl
                      advancing={advancing}
                      onAvanzar={handleAvanzar}
                    />
                  </div>
                )
              }
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
