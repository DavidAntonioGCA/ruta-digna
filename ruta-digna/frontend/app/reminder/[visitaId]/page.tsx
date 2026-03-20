'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { LoadingSpinner, PrepCard, Card } from '../../components/ui'
import { getVisitaStatus } from '../../lib/api'

export default function ReminderPage() {
  const { visitaId } = useParams<{ visitaId: string }>()
  const [data, setData]   = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getVisitaStatus(visitaId)
      .then(setData)
      .catch(() => setError('No pudimos cargar tus instrucciones.'))
  }, [visitaId])

  if (error) return (
    <div className="min-h-screen bg-neutral flex items-center justify-center p-4">
      <p className="text-red-600 text-sm text-center">{error}</p>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-neutral flex items-center justify-center">
      <LoadingSpinner text="Cargando tus instrucciones..." />
    </div>
  )

  const estudiosConPrep = data.estudios?.filter((e: any) => e.preparacion) ?? []

  return (
    <div className="min-h-screen bg-neutral">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-brand-text">Ruta Digna</h1>
          <div className="mt-3 p-3 bg-warning/10 rounded-card border border-warning/30">
            <p className="text-sm font-medium text-warning">Recuerda — tu visita es mañana</p>
            <p className="text-xs text-brand-muted mt-0.5">
              {data.sucursal} · {data.ciudad}
            </p>
          </div>
        </div>

        {estudiosConPrep.length === 0 ? (
          <Card>
            <p className="text-sm text-brand-muted text-center py-4">
              No hay instrucciones especiales de preparación para tus estudios.
            </p>
          </Card>
        ) : (
          <>
            <p className="text-sm text-brand-muted mb-3">
              Sigue estas instrucciones en el orden de tus estudios:
            </p>
            {estudiosConPrep
              .sort((a: any, b: any) => a.orden - b.orden)
              .map((est: any) => (
                <PrepCard
                  key={est.orden}
                  orden={est.orden}
                  nombreEstudio={est.nombre}
                  instrucciones={est.preparacion}
                />
              ))}
          </>
        )}
      </div>
    </div>
  )
}
