'use client'
import { useState } from 'react'
import { MapPin, Clock, ChevronRight } from 'lucide-react'
import { Button, Card, LoadingSpinner } from '../components/ui'
import { recomendar } from '../lib/api'

export default function RecommendPage() {
  const [mensaje, setMensaje]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [error, setError]         = useState('')

  const handleBuscar = async () => {
    if (!mensaje.trim()) return
    setLoading(true)
    setError('')
    setResultado(null)

    // Geolocalización opcional
    let lat: number | undefined, lon: number | undefined
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
      )
      lat = pos.coords.latitude
      lon = pos.coords.longitude
    } catch { /* sin GPS — el backend maneja el fallback */ }

    try {
      const data = await recomendar(mensaje, lat, lon)
      setResultado(data)
    } catch {
      setError('Algo salió mal, intenta de nuevo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-brand-text">Ruta Digna</h1>
          <p className="text-brand-muted text-sm mt-1">Tu camino en la clínica, paso a paso.</p>
        </div>

        {/* Input */}
        <Card className="mb-4">
          <label className="text-sm font-medium text-brand-text block mb-2">
            ¿Qué estudios necesitas y desde dónde vas?
          </label>
          <textarea
            className="w-full border border-gray-200 rounded-input p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            rows={3}
            placeholder="Ej: necesito laboratorio y rayos X, salgo de Culiacán centro"
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleBuscar())}
          />
          <Button className="w-full mt-3" loading={loading} onClick={handleBuscar}>
            Buscar clínica
          </Button>
        </Card>

        {/* Error */}
        {error && <p className="text-red-600 text-sm text-center mb-4">{error}</p>}

        {/* Loading */}
        {loading && <LoadingSpinner text="Buscando la mejor opción para ti..." />}

        {/* Resultados */}
        {resultado && (
          <div>
            {/* Estudios detectados y orden */}
            {resultado.orden_sugerido?.length > 0 && (
              <div className="mb-4 card bg-blue-50 border border-blue-100">
                <p className="text-xs font-medium text-primary mb-2">Tu orden de atención:</p>
                <div className="flex gap-2 flex-wrap">
                  {resultado.orden_sugerido.map((est: any, i: number) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">
                        {est.orden}. {est.nombre}
                      </span>
                      {est.requiere_preparacion && (
                        <span className="text-xs text-warning">⚠</span>
                      )}
                      {i < resultado.orden_sugerido.length - 1 && (
                        <ChevronRight size={12} className="text-brand-muted" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clínica recomendada */}
            {resultado.sucursal_recomendada && (
              <Card className="mb-3 border-2 border-primary">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">Recomendada</span>
                  <div className="flex items-center gap-1 text-brand-muted text-xs">
                    <Clock size={12} />
                    <span>~{resultado.sucursal_recomendada.tiempo_total_min} min</span>
                  </div>
                </div>
                <p className="font-semibold text-brand-text mt-2">
                  {resultado.sucursal_recomendada.nombre_sucursal}
                </p>
                {resultado.sucursal_recomendada.ciudad && (
                  <div className="flex items-center gap-1 text-brand-muted text-xs mt-1">
                    <MapPin size={12} />
                    <span>{resultado.sucursal_recomendada.ciudad}</span>
                  </div>
                )}
              </Card>
            )}

            {/* Alternativas */}
            {resultado.alternativas?.map((alt: any, i: number) => (
              <Card key={i} className="mb-2 opacity-80">
                <div className="flex justify-between items-center">
                  <p className="font-medium text-sm text-brand-text">{alt.nombre_sucursal}</p>
                  <span className="text-xs text-brand-muted">~{alt.tiempo_total_min} min</span>
                </div>
                {alt.ciudad && <p className="text-xs text-brand-muted mt-0.5">{alt.ciudad}</p>}
              </Card>
            ))}

            {resultado.advertencia && (
              <p className="text-xs text-warning text-center mt-2">{resultado.advertencia}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
