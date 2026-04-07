'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MessageCircle, MapPin, User, ChevronRight } from 'lucide-react'
import { LoadingSpinner, MultiStepTracker, Card, Badge } from '../../components/ui'
import { getVisitaStatus } from '../../lib/api'

export default function TrackingPage() {
  const { visitaId } = useParams<{ visitaId: string }>()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  const fetchStatus = async () => {
    try {
      const res = await getVisitaStatus(visitaId)
      setData(res)
    } catch {
      setError('No pudimos sincronizar tu ruta. Reintenta en un momento.')
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [visitaId])

  if (error) return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-red-50 p-4 rounded-full mb-4">
        <p className="text-2xl">⚠️</p>
      </div>
      <p className="text-brand-text font-semibold mb-2">{error}</p>
      <button onClick={() => window.location.reload()} className="text-primary text-sm font-medium underline">
        Reintentar ahora
      </button>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner text="Sincronizando con la clínica..." />
      </div>
    </div>
  )

  const completada = data.estatus === 'completada'

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-brand-text font-sans">
      {/* Top Bar Decorativo */}
      <div className="h-1.5 bg-gradient-to-r from-primary to-blue-400 w-full" />

      <div className="max-w-md mx-auto px-5 py-8">
        {/* Header Estético */}
        <header className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-brand-text">Ruta Digna</h1>
              <div className="flex items-center gap-1.5 text-brand-muted text-sm mt-1">
                <MapPin size={14} className="text-primary" />
                <span>{data.sucursal} · {data.ciudad}</span>
              </div>
            </div>
            <Badge status={completada ? 'completado' : 'actual'}>
              {completada ? 'Finalizado' : 'En curso'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm p-3 rounded-2xl border border-white shadow-sm">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <User size={16} />
            </div>
            <span className="text-sm font-semibold">{data.paciente}</span>
          </div>
        </header>

        <main className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          {completada ? (
            <Card className="text-center py-12 border-none bg-gradient-to-b from-white to-green-50/30">
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-success/20 rounded-full animate-ping" />
                <div className="relative bg-success text-white rounded-full w-20 h-20 flex items-center justify-center shadow-lg shadow-success/30">
                  <span className="text-4xl font-bold">✓</span>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-brand-text mb-2">¡Misión cumplida!</h2>
              <p className="text-brand-muted text-sm px-6 leading-relaxed">
                Tu visita ha concluido exitosamente. Los resultados te esperan en recepción.
              </p>
            </Card>
          ) : (
            <>
              {/* Card Destacada del Estado Actual */}
              {data.estudio_actual && (
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-400 rounded-[18px] blur opacity-20 group-hover:opacity-30 transition duration-1000" />
                  <Card className="relative border-none bg-white shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-[0.1em] bg-primary/10 px-2.5 py-1 rounded-md">
                        Atención actual
                      </span>
                      <div className="flex items-center gap-1 text-primary font-bold">
                        <span className="text-lg">~{data.tiempo_espera_total_min}</span>
                        <span className="text-[10px] mt-1">MIN</span>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold mb-1">{data.estudio_actual.nombre}</h3>
                    <p className="text-brand-muted text-xs flex items-center gap-1">
                      Tu camino continúa paso a paso <ChevronRight size={12} />
                    </p>
                  </Card>
                </div>
              )}

              {/* Sección del Tracker */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-4 px-1">
                  <h4 className="text-sm font-bold text-brand-text uppercase tracking-widest">Tu Itinerario</h4>
                  <span className="text-xs font-medium text-brand-muted">{data.progreso_general_pct}% completado</span>
                </div>
                <Card className="border-none shadow-sm bg-white/80 backdrop-blur-md">
                  <MultiStepTracker
                    estudios={data.estudios}
                    progresoPct={data.progreso_general_pct}
                  />
                </Card>
              </div>
            </>
          )}
        </main>

        {/* Floating Action Button Mejorado */}
        {!completada && (
          <button
            onClick={() => router.push(`/chat/${visitaId}`)}
            className="fixed bottom-8 right-6 bg-primary text-white rounded-2xl px-5 py-4 shadow-[0_10px_25px_-5px_rgba(37,99,235,0.4)] flex items-center gap-3 hover:scale-105 active:scale-95 transition-all duration-300 z-50 group"
          >
            <div className="relative">
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-primary animate-pulse" />
              <MessageCircle size={24} />
            </div>
            <span className="font-bold text-sm tracking-wide">Asistente IA</span>
          </button>
        )}
      </div>
    </div>
  )
}
