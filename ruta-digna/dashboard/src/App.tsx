import { useEffect, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend
} from 'chart.js'
import { getClincias, avanzarEstudio } from './api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

// Flujo simplificado para la demo
// 1(PAGADO) → 9(INICIO_TOMA) → 10(FIN_TOMA) → 12(VERIFICADO=final)
const FLUJO_DEMO = [
  { id: 1,  nombre: 'PAGADO',       paso: 'espera',      progreso: 0   },
  { id: 9,  nombre: 'INICIO_TOMA',  paso: 'inicio_toma', progreso: 33  },
  { id: 10, nombre: 'FIN_TOMA',     paso: 'fin_toma',    progreso: 66  },
  { id: 12, nombre: 'VERIFICADO',   paso: 'finalizado',  progreso: 100 },
]

function getSiguienteEstatus(estatusActualId: number) {
  const idx = FLUJO_DEMO.findIndex(f => f.id === estatusActualId)
  return idx >= 0 && idx < FLUJO_DEMO.length - 1
    ? FLUJO_DEMO[idx + 1]
    : null
}

export default function App() {
  const [clinicas, setClincias]         = useState<any[]>([])
  const [sucursalId, setSucursalId]     = useState<number>(1)
  const [visitas, setVisitas]           = useState<any[]>([])
  const [advancing, setAdvancing]       = useState<string | null>(null)
  const [connected, setConnected]       = useState(false)

  // Health check inicial
  useEffect(() => {
    import('./api').then(m => m.checkHealth())
      .then(() => setConnected(true))
      .catch(() => setConnected(false))
  }, [])

  // Cargar clínicas con polling
  useEffect(() => {
    const fetch = () =>
      getClincias()
        .then(d => setClincias(Array.isArray(d) ? d : []))
        .catch(() => {})
    fetch()
    const interval = setInterval(fetch, 8000)
    return () => clearInterval(interval)
  }, [])

  // Filtrar datos de la sucursal seleccionada
  const datosSucursal = clinicas.filter((c: any) => c.id_sucursal === sucursalId)

  // Gráfica Chart.js
  const chartData = {
    labels: datosSucursal.map((c: any) => c.estudio),
    datasets: [{
      label: 'Pacientes en espera',
      data: datosSucursal.map((c: any) => c.pacientes_en_espera),
      backgroundColor: '#2563EB',
      borderRadius: 6,
    }]
  }
  const chartOpts = {
    indexAxis: 'y' as const,
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
  }

  // Avanzar estado de un estudio
  const handleAvanzar = async (visita: any, veId: string, estatusActualId: number) => {
    const siguiente = getSiguienteEstatus(estatusActualId)
    if (!siguiente) return
    setAdvancing(veId)
    try {
      await avanzarEstudio(visita.visita_id, {
        id_visita_estudio: veId,
        nuevo_estatus:     siguiente.id,
        nuevo_paso:        siguiente.paso,
        nuevo_progreso:    siguiente.progreso,
      })
      // Refrescar visitas
      import('./api').then(m => m.getVisitasActivas?.())
        .then((d: any) => d && setVisitas(d))
        .catch(() => {})
    } finally {
      setAdvancing(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ruta Digna</h1>
          <p className="text-xs text-gray-500">Panel operativo de clínica</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'}`} />
          <span className="text-xs text-gray-500">{connected ? 'Conectado' : 'Sin conexión'}</span>
          {/* Selector de sucursal */}
          <select
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
            value={sucursalId}
            onChange={e => setSucursalId(Number(e.target.value))}
          >
            <option value={1}>Culiacán (id=1)</option>
            <option value={5}>Los Mochis (id=5)</option>
            <option value={6}>Mazatlán (id=6)</option>
            <option value={9}>Mexicali (id=9)</option>
            <option value={12}>Tijuana (id=12)</option>
          </select>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Gráfica de colas */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-medium text-gray-900 mb-4">Colas por área</h2>
          {datosSucursal.length > 0
            ? <Bar data={chartData} options={chartOpts} />
            : <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
          }
        </div>

        {/* Panel de control de visita de prueba */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-medium text-gray-900 mb-1">Control de demo</h2>
          <p className="text-xs text-gray-400 mb-4">
            visita: 06b8efbf-67bc-426c-9523-3059d0dec059
          </p>

          <VisitaDemoControl
            advancing={advancing}
            onAvanzar={handleAvanzar}
          />
        </div>

      </div>
    </div>
  )
}

// Componente separado para el control de la visita de prueba
function VisitaDemoControl({ advancing, onAvanzar }: {
  advancing: string | null
  onAvanzar: (visita: any, veId: string, estatusId: number) => void
}) {
  const [estudios, setEstudios] = useState<any[]>([])
  const [loading, setLoading]   = useState(false)
  const VISITA_ID = '06b8efbf-67bc-426c-9523-3059d0dec059'

  const fetchEstados = () => {
    setLoading(true)
    import('./api').then(m =>
      m.default.get(`/visita/status/${VISITA_ID}`)
        .then(r => {
          setEstudios(r.data?.estudios ?? [])
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    )
  }

  useEffect(() => {
    fetchEstados()
    const interval = setInterval(fetchEstados, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading && estudios.length === 0)
    return <p className="text-sm text-gray-400">Cargando...</p>

  return (
    <div className="space-y-3">
      {estudios.map((est: any) => {
        const esFinal     = est.es_estado_final
        const esActual    = est.es_actual
        const siguiente   = getSiguienteEstatus(
          // mapear nombre de estatus a id
          est.estatus === 'PAGADO' ? 1 :
          est.estatus === 'INICIO_TOMA' ? 9 :
          est.estatus === 'FIN_TOMA' ? 10 : 12
        )

        return (
          <div key={est.orden} className={`p-3 rounded-xl border ${
            esActual  ? 'border-blue-200 bg-blue-50' :
            esFinal   ? 'border-green-200 bg-green-50' :
                        'border-gray-100 bg-gray-50'
          }`}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-400">Paso {est.orden}</p>
                <p className="font-medium text-sm text-gray-900">{est.nombre}</p>
                <p className={`text-xs mt-0.5 ${esFinal ? 'text-green-600' : esActual ? 'text-blue-600' : 'text-gray-400'}`}>
                  {est.estatus} · {est.progreso_pct}%
                </p>
              </div>

              {esActual && siguiente && (
                <button
                  disabled={advancing !== null}
                  onClick={() => onAvanzar(
                    { visita_id: VISITA_ID },
                    est.id_visita_estudio ?? '',
                    est.estatus === 'PAGADO' ? 1 :
                    est.estatus === 'INICIO_TOMA' ? 9 :
                    est.estatus === 'FIN_TOMA' ? 10 : 12
                  )}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {advancing ? '...' : `→ ${siguiente.nombre}`}
                </button>
              )}

              {esFinal && (
                <span className="text-xs text-green-600 font-medium">✓ Completo</span>
              )}
            </div>
          </div>
        )
      })}

      <button
        onClick={fetchEstados}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors w-full text-center mt-2"
      >
        Actualizar ahora
      </button>
    </div>
  )
}
