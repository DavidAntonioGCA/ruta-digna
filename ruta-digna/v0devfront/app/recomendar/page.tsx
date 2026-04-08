"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp,
  Check, Clock, MapPin, Sparkles, Lock, Unlock, AlertTriangle
} from "lucide-react"
import BottomNav from "@/components/BottomNav"
import Footer from "@/components/Footer"
import { recomendar, type RecomendacionResponse } from "@/app/lib/api"

export default function Recomendar() {
  const [mensaje, setMensaje] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RecomendacionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showOthers, setShowOthers] = useState(false)
  const [showOrden, setShowOrden] = useState(false)

  const handleBuscar = async () => {
    if (!mensaje.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Intentar obtener ubicación del usuario
      let lat: number | undefined
      let lon: number | undefined
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        )
        lat = pos.coords.latitude
        lon = pos.coords.longitude
      } catch {
        // Sin ubicación, ok
      }

      const data = await recomendar(mensaje, lat, lon)
      setResult(data)
    } catch (err) {
      setError("No pudimos procesar tu solicitud. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  const recomendada = result?.sucursal_recomendada

  return (
    <div className="min-h-screen bg-neutral pb-4">
      {/* Header */}
      <header className="bg-white px-4 py-4 shadow-sm flex items-center gap-3">
        <Link href="/antes-de-ir">
          <ArrowLeft className="w-5 h-5 text-text" />
        </Link>
        <h1 className="text-lg font-semibold text-primary">Ruta Digna</h1>
      </header>

      <main className="px-4 py-5">
        {/* Search section */}
        <div className="bg-[#EFF6FF] rounded-[16px] p-4 mb-5">
          <h2 className="text-lg font-semibold text-text mb-3">
            ¿Qué estudios necesitas hoy?
          </h2>
          <textarea
            className="w-full p-3 rounded-[10px] border border-slate-200 text-sm resize-none bg-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
            rows={3}
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            placeholder="Ej: necesito laboratorio y ultrasonido, estoy en el norte de la ciudad..."
          />
          <button
            onClick={handleBuscar}
            disabled={loading || !mensaje.trim()}
            className="w-full mt-3 bg-primary text-white font-medium py-3 px-4 rounded-[10px] active:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Buscando..." : "Buscar clínica ideal"}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
              <span className="text-xs font-medium text-primary">Analizando con IA...</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Warning si no detectó estudios */}
        {result?.advertencia && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">{result.advertencia}</p>
          </div>
        )}

        {/* Estudios detectados */}
        {result && result.estudios_detectados.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className="text-xs text-muted">Detectados:</span>
            {result.estudios_detectados.map((e, i) => (
              <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {e}
              </span>
            ))}
          </div>
        )}

        {/* Main result card */}
        {recomendada && (
          <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] border-2 border-primary mb-4">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-xs font-medium px-2 py-1 bg-success/10 text-success rounded-full">
                Mejor opción para ti
              </span>
            </div>

            <h3 className="font-semibold text-text text-lg">
              Salud Digna {recomendada.nombre_sucursal}
            </h3>
            {recomendada.direccion && (
              <p className="text-sm text-muted mt-1">{recomendada.direccion}, {recomendada.ciudad}</p>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              <span className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded-full">
                <Clock className="w-3 h-3" />
                ~{Math.max(recomendada.tiempo_total_min - 5, 5)}-{recomendada.tiempo_total_min + 10} min espera
              </span>
              <span className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded-full">
                <Check className="w-3 h-3" /> {recomendada.estudios_disponibles} estudios disponibles
              </span>
            </div>

            {/* Orden sugerido */}
            {result.orden_sugerido && result.orden_sugerido.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowOrden(!showOrden)}
                  className="flex items-center gap-1 text-sm text-primary font-medium"
                >
                  {showOrden ? "Ocultar orden" : "Ver orden de estudios"}
                  {showOrden ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showOrden && (
                  <div className="mt-2 space-y-2">
                    {result.orden_sugerido.map((e, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                        <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                          {e.orden}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text">{e.nombre}</p>
                          {e.requiere_preparacion && (
                            <p className="text-xs text-muted">Requiere preparación</p>
                          )}
                        </div>
                        <Lock className="w-3.5 h-3.5 text-muted" />
                      </div>
                    ))}
                    <p className="text-xs text-muted mt-2">
                      🔒 El orden es automático según reglas médicas de Salud Digna
                    </p>
                  </div>
                )}
              </div>
            )}

            <Link href="/tracking">
              <button className="w-full mt-4 bg-primary text-white font-medium py-3 px-4 rounded-[10px] flex items-center justify-center gap-2 active:bg-primary/90 transition-colors">
                Iniciar mi visita
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        )}

        {/* Other options */}
        {result && result.alternativas.length > 0 && (
          <div className="bg-white rounded-[16px] shadow-[0_2px_12px_rgba(0,0,0,0.08)] overflow-hidden">
            <button
              onClick={() => setShowOthers(!showOthers)}
              className="w-full p-4 flex items-center justify-between"
            >
              <span className="font-medium text-text">
                Otras opciones ({result.alternativas.length})
              </span>
              {showOthers ? <ChevronUp className="w-5 h-5 text-muted" /> : <ChevronDown className="w-5 h-5 text-muted" />}
            </button>

            {showOthers && (
              <div className="px-4 pb-4 space-y-3">
                {result.alternativas.map((alt: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-[10px]">
                    <p className="text-sm font-medium text-text">
                      Salud Digna {alt.nombre_sucursal}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted mt-1">
                      <span>~{alt.tiempo_total_min} min</span>
                      <span>·</span>
                      <span>{alt.ciudad}</span>
                      <span>·</span>
                      <span>{alt.estudios_disponibles} estudios</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {result && (
          <p className="text-xs text-muted text-center mt-5">
            Score: tiempo de espera (60%) + distancia (40%)
          </p>
        )}

        <Footer />
      </main>

      <BottomNav />
    </div>
  )
}
