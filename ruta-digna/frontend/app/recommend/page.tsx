'use client'
import { useState } from 'react'
import { MapPin, Clock, ChevronRight, Search, Sparkles, AlertCircle } from 'lucide-react'
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

    let lat: number | undefined, lon: number | undefined
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
      )
      lat = pos.coords.latitude
      lon = pos.coords.longitude
    } catch { /* Fallback automático en backend */ }

    try {
      const data = await recomendar(mensaje, lat, lon)
      setResultado(data)
    } catch {
      setError('No logramos procesar tu solicitud. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header con gradiente sutil */}
      <div className="bg-white border-b border-gray-100 px-4 py-8 text-center shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-brand-text">Ruta Digna</h1>
        <p className="text-brand-muted text-sm mt-2 font-medium">Tu camino en la clínica, paso a paso.</p>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-6">
        {/* Input Card Principal */}
        <Card className="border-none shadow-xl bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Search size={18} className="text-primary" />
            </div>
            <label className="text-sm font-bold text-brand-text uppercase tracking-tight">
              ¿Qué estudios necesitas?
            </label>
          </div>
          
          <textarea
            className="w-full bg-neutral/50 border-none rounded-xl p-4 text-sm resize-none focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-brand-muted/60"
            rows={3}
            placeholder="Ej: necesito laboratorio y rayos X, salgo de Culiacán centro..."
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleBuscar())}
          />
          
          <Button 
            className="w-full mt-4 py-4 shadow-lg shadow-primary/20 text-sm font-bold tracking-wide" 
            loading={loading} 
            onClick={handleBuscar}
          >
            <Sparkles size={16} />
            Encontrar mejor ruta
          </Button>
        </Card>

        {/* Loading State */}
        {loading && (
          <div className="py-12 animate-pulse">
            <LoadingSpinner text="Analizando sucursales cercanas..." />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in fade-in zoom-in-95">
            <AlertCircle size={20} />
            <p className="text-xs font-bold">{error}</p>
          </div>
        )}

        {/* Resultados con animaciones escalonadas */}
        {resultado && (
          <div className="mt-8 space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* Orden Sugerido por IA */}
            {resultado.orden_sugerido?.length > 0 && (
              <section>
                <h3 className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.2em] mb-3 ml-1">
                  Tu itinerario optimizado
                </h3>
                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
                  <div className="flex gap-2 flex-wrap items-center">
                    {resultado.orden_sugerido.map((est: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
                          est.requiere_preparacion 
                            ? 'bg-warning/10 text-warning border border-warning/20' 
                            : 'bg-white text-primary border border-primary/10 shadow-sm'
                        }`}>
                          <span className="opacity-50">{est.orden}.</span>
                          {est.nombre}
                          {est.requiere_preparacion && <AlertCircle size={12} />}
                        </div>
                        {i < resultado.orden_sugerido.length - 1 && (
                          <ChevronRight size={14} className="text-primary/30" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Clínica Recomendada Destacada */}
            {resultado.sucursal_recomendada && (
              <section>
                <h3 className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.2em] mb-3 ml-1">
                  Mejor opción para ti
                </h3>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-400 rounded-[22px] blur opacity-25" />
                  <Card className="relative border-none bg-white p-5 shadow-xl rounded-[20px]">
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-success/10 text-success text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                        Sucursal Recomendada
                      </div>
                      <div className="flex items-center gap-1.5 text-brand-text font-bold">
                        <Clock size={16} className="text-primary" />
                        <span className="text-lg leading-none">~{resultado.sucursal_recomendada.tiempo_total_min} <span className="text-[10px] opacity-50">MIN</span></span>
                      </div>
                    </div>
                    
                    <h2 className="text-xl font-bold text-brand-text leading-tight">
                      {resultado.sucursal_recomendada.nombre_sucursal}
                    </h2>
                    
                    <div className="flex items-center gap-1.5 text-brand-muted text-sm mt-2">
                      <MapPin size={14} className="text-primary/60" />
                      <span>{resultado.sucursal_recomendada.ciudad}</span>
                    </div>
                  </Card>
                </div>
              </section>
            )}

            {/* Alternativas simplificadas */}
            {resultado.alternativas?.length > 0 && (
              <section>
                <h3 className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.2em] mb-3 ml-1">
                  Otras opciones
                </h3>
                <div className="space-y-2">
                  {resultado.alternativas.map((alt: any, i: number) => (
                    <div key={i} className="bg-white/60 border border-white rounded-xl p-4 flex justify-between items-center shadow-sm hover:bg-white transition-colors cursor-pointer">
                      <div>
                        <p className="font-bold text-sm text-brand-text">{alt.nombre_sucursal}</p>
                        <p className="text-[10px] text-brand-muted font-medium uppercase mt-0.5">{alt.ciudad}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-primary">~{alt.tiempo_total_min} min</p>
                        <p className="text-[10px] text-brand-muted font-bold uppercase">Espera</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
