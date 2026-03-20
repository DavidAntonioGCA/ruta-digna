'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { LoadingSpinner, MultiStepTracker, Card } from '../../components/ui'
import { getVisitaStatus } from '../../lib/api'

export default function TrackingPage() {
  const { visitaId } = useParams<{ visitaId: string }>()
  const router       = useRouter()
  const [data, setData]   = useState<any>(null)
  const [error, setError] = useState('')

  const fetchStatus = async () => {
    try {
      const res = await getVisitaStatus(visitaId)
      setData(res)
    } catch {
      setError('No pudimos cargar tu proceso. Intenta de nuevo.')
    }
  }

  useEffect(() => {
    fetchStatus()
    // Polling cada 5 segundos
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)   // cleanup obligatorio
  }, [visitaId])

  if (error) return (
    <div className="min-h-screen bg-neutral flex items-center justify-center p-4">
      <p className="text-red-600 text-center text-sm">{error}</p>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-neutral flex items-center justify-center">
      <LoadingSpinner text="Cargando tu proceso..." />
    </div>
  )

  const completada = data.estatus === 'completada'

  return (
    <div className="min-h-screen bg-neutral">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-brand-text">Ruta Digna</h1>
          <p className="text-brand-muted text-sm">{data.sucursal} · {data.ciudad}</p>
          <p className="text-sm text-brand-text mt-0.5">{data.paciente}</p>
        </div>

        {/* Visita completada */}
        {completada ? (
          <Card className="text-center py-8 border-2 border-success">
            <p className="text-4xl mb-3">✓</p>
            <p className="font-semibold text-success text-lg">¡Tu visita ha terminado!</p>
            <p className="text-brand-muted text-sm mt-1">Recuerda recoger tus resultados en recepción.</p>
          </Card>
        ) : (
          <>
            {/* Estudio actual destacado */}
            {data.estudio_actual && (
              <Card className="mb-4 bg-blue-50 border border-primary">
                <p className="text-xs text-primary font-medium mb-1">Ahora en:</p>
                <p className="font-semibold text-brand-text">{data.estudio_actual.nombre}</p>
                <p className="text-xs text-brand-muted mt-1">
                  Tiempo estimado: ~{data.tiempo_espera_total_min} min restantes
                </p>
              </Card>
            )}

            {/* Tracker multi-estudio */}
            {data.estudios?.length > 0 && (
              <Card className="mb-4">
                <MultiStepTracker
                  estudios={data.estudios}
                  progresoPct={data.progreso_general_pct}
                />
              </Card>
            )}
          </>
        )}

        {/* Botón flotante al chat */}
        {!completada && (
          <button
            onClick={() => router.push(`/chat/${visitaId}`)}
            className="fixed bottom-6 right-6 bg-primary text-white rounded-full p-4 shadow-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <MessageCircle size={22} />
            <span className="text-sm font-medium pr-1">Asistente</span>
          </button>
        )}
      </div>
    </div>
  )
}
