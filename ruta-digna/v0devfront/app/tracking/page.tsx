"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import {
  FlaskConical, Activity, ScanLine, Check, Send, Clock,
  MapPin, AlertTriangle, ChevronDown, ChevronUp, Navigation
} from "lucide-react"
import BottomNav from "@/components/BottomNav"
import Footer from "@/components/Footer"
import { getVisitaStatus, chatAsistente, type EstadoVisita, type EstudioVisita } from "@/app/lib/api"

// Iconos por estudio
const ESTUDIO_ICON: Record<string, any> = {
  LABORATORIO: FlaskConical,
  ULTRASONIDO: Activity,
  'RAYOS X': ScanLine,
}

function getIcon(nombre: string) {
  return ESTUDIO_ICON[nombre] || Activity
}

// Componente de alerta para el paciente
function AlertasPaciente({ alertas }: { alertas: any[] }) {
  if (!alertas || alertas.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {alertas.map((a: any, idx: number) => (
        <div
          key={idx}
          className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
            a.severidad === 'critica' || a.severidad === 'alta'
              ? 'bg-red-50 border border-red-200'
              : 'bg-amber-50 border border-amber-200'
          }`}
        >
          <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
            a.severidad === 'critica' || a.severidad === 'alta'
              ? 'text-red-500' : 'text-amber-500'
          }`} />
          <div>
            <p className={`font-medium text-xs ${
              a.severidad === 'critica' || a.severidad === 'alta'
                ? 'text-red-800' : 'text-amber-800'
            }`}>
              {a.titulo}
            </p>
            {a.impacto_tiempo_min > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                Posible retraso de ~{a.impacto_tiempo_min} min
                {a.estudio_afectado && ` en ${a.estudio_afectado}`}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// Componente de guía de navegación
function GuiaNavegacion({ guia, nombre }: { guia: any; nombre: string }) {
  const [showGuia, setShowGuia] = useState(false)

  if (!guia || guia.instrucciones === 'Pregunta en recepción') return null

  return (
    <div className="mt-2">
      <button
        onClick={() => setShowGuia(!showGuia)}
        className="flex items-center gap-1.5 text-xs text-primary font-medium"
      >
        <Navigation className="w-3 h-3" />
        {showGuia ? 'Ocultar cómo llegar' : '¿Cómo llego?'}
        {showGuia ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {showGuia && (
        <div className="mt-2 p-3 bg-blue-50 rounded-xl text-xs text-text space-y-1.5">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="font-medium">{guia.nombre_area} — {guia.ubicacion}</span>
          </div>
          {guia.piso > 1 && (
            <p className="text-muted pl-5">Piso {guia.piso}</p>
          )}
          <p className="text-text pl-5 leading-relaxed">{guia.instrucciones}</p>
          {guia.referencia && (
            <p className="text-muted pl-5 italic">Referencia: {guia.referencia}</p>
          )}
        </div>
      )}
    </div>
  )
}

// Estudio completado
function EstudioCompletado({ estudio }: { estudio: EstudioVisita }) {
  const Icon = getIcon(estudio.nombre)
  return (
    <div className="relative pl-12 pb-6">
      <div className="absolute left-4 top-0 w-8 h-8 rounded-full bg-success flex items-center justify-center">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="absolute left-[1.45rem] top-8 w-0.5 h-full bg-success" />
      <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-text">{estudio.nombre}</h3>
          <span className="flex items-center gap-1 text-xs font-medium text-success">
            <Check className="w-3 h-3" /> COMPLETADO
          </span>
        </div>
        <p className="text-xs text-muted">Finalizado</p>
      </div>
    </div>
  )
}

// Estudio en progreso (actual)
function EstudioActual({ estudio, visitaId }: { estudio: EstudioVisita; visitaId: string }) {
  const [message, setMessage] = useState("")
  const [chatMessages, setChatMessages] = useState<{ text: string; isUser: boolean }[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [historial, setHistorial] = useState<any[]>([])
  const Icon = getIcon(estudio.nombre)

  const handleSend = async () => {
    if (!message.trim()) return
    const userMsg = message.trim()
    setChatMessages(prev => [...prev, { text: userMsg, isUser: true }])
    setMessage("")
    setIsTyping(true)

    try {
      const newHistorial = [
        ...historial,
        { role: "user", content: userMsg }
      ]
      const response = await chatAsistente(visitaId, userMsg, historial)
      setChatMessages(prev => [...prev, { text: response.reply, isUser: false }])
      setHistorial([
        ...newHistorial,
        { role: "assistant", content: response.reply }
      ])
    } catch {
      setChatMessages(prev => [...prev, {
        text: "Lo siento, no pude conectarme en este momento. Intenta de nuevo.",
        isUser: false
      }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="relative pl-12 pb-6">
      <div className="absolute left-4 top-0">
        <span className="absolute inline-flex h-8 w-8 rounded-full bg-primary/30 animate-ping" />
        <div className="relative w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <div className="absolute left-[1.45rem] top-8 w-0.5 h-full bg-slate-200" />

      <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] border-2 border-primary">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-text">{estudio.nombre}</h3>
          <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-primary text-white rounded-full animate-pulse">
            Estás aquí
          </span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-text">Estado: {estudio.estatus}</span>
          <span className="text-sm text-muted">· {estudio.progreso_pct}%</span>
        </div>

        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${estudio.progreso_pct}%` }}
          />
        </div>

        <p className="text-xs text-muted">
          Tiempo estimado: ~{Math.max(estudio.tiempo_espera_min - 5, 2)}-{estudio.tiempo_espera_min + 8} min
        </p>

        {/* Guía de navegación */}
        <GuiaNavegacion guia={estudio.guia} nombre={estudio.nombre} />

        {/* Chat con IA */}
        <div className="mt-4 p-3 bg-[#EFF6FF] rounded-[10px]">
          <div className="flex items-start gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-semibold text-white">RD</span>
            </div>
            <p className="text-sm text-text leading-relaxed">
              ¿Tienes alguna duda sobre tu {estudio.nombre.toLowerCase()}? Puedo ayudarte.
            </p>
          </div>

          {chatMessages.length > 0 && (
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl text-sm leading-relaxed ${
                    msg.isUser
                      ? "bg-primary text-white ml-4 rounded-br-sm"
                      : "bg-white text-text mr-4 rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
              {isTyping && (
                <div className="bg-white text-muted p-2.5 rounded-xl text-sm mr-4 rounded-bl-sm">
                  <span className="flex gap-1">
                    <span className="w-2 h-2 bg-muted/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Escribe tu pregunta..."
              className="flex-1 px-3 py-2 text-sm rounded-[8px] border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || isTyping}
              className="w-9 h-9 bg-primary rounded-[8px] flex items-center justify-center active:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Estudio pendiente
function EstudioPendiente({ estudio, isLast }: { estudio: EstudioVisita; isLast: boolean }) {
  const [showGuia, setShowGuia] = useState(false)
  const Icon = getIcon(estudio.nombre)

  return (
    <div className={`relative pl-12 ${isLast ? '' : 'pb-6'}`}>
      <div className="absolute left-4 top-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
        <Icon className="w-4 h-4 text-muted" />
      </div>
      {!isLast && <div className="absolute left-[1.45rem] top-8 w-0.5 h-full bg-slate-200" />}

      <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] opacity-70">
        <h3 className="font-semibold text-muted">{estudio.nombre}</h3>
        <p className="text-sm text-muted">Siguiente estudio</p>
        <p className="text-xs text-muted mt-1">
          Tiempo estimado: ~{Math.max(estudio.tiempo_espera_min - 5, 2)}-{estudio.tiempo_espera_min + 8} min
        </p>
        <GuiaNavegacion guia={estudio.guia} nombre={estudio.nombre} />
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function Tracking() {
  const [visita, setVisita] = useState<EstadoVisita | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visitaId, setVisitaId] = useState("")
  const [inputId, setInputId] = useState("")

  // Intentar cargar visita de demo o de URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id') || '06b8efbf-67bc-426c-9523-3059d0dec059'
    setVisitaId(id)
    setInputId(id)
  }, [])

  // Polling del estado
  const fetchStatus = useCallback(async () => {
    if (!visitaId) return
    try {
      const data = await getVisitaStatus(visitaId)
      setVisita(data)
      setError(null)
    } catch (err) {
      setError("No se pudo conectar al servidor")
    } finally {
      setLoading(false)
    }
  }, [visitaId])

  useEffect(() => {
    if (!visitaId) return
    setLoading(true)
    fetchStatus()
    const iv = setInterval(fetchStatus, 5000)
    return () => clearInterval(iv)
  }, [visitaId, fetchStatus])

  const handleBuscar = () => {
    if (inputId.trim()) {
      setVisitaId(inputId.trim())
    }
  }

  // Calcular tiempo restante como rango
  const tiempoRestante = visita?.tiempo_espera_total_min ?? 0
  const tiempoMin = Math.max(tiempoRestante - 8, 2)
  const tiempoMax = tiempoRestante + 12

  // Resumen por línea
  const resumenEstudios = visita?.estudios?.map(e => {
    if (e.es_estado_final) return `${e.nombre} completado`
    if (e.es_actual) return `${e.nombre} ~${Math.max(e.tiempo_espera_min - 3, 1)}-${e.tiempo_espera_min + 5} min`
    return `${e.nombre} ~${e.tiempo_espera_min} min`
  }).join(' · ') || ''

  return (
    <div className="min-h-screen bg-neutral pb-20">
      {/* Header */}
      <header className="bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text">Mi visita</h1>
          {visita && visita.estatus === 'en_proceso' && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
              </span>
              <span className="text-xs font-medium text-success">En proceso</span>
            </div>
          )}
        </div>
        {visita && (
          <p className="text-sm text-muted mt-1">
            {visita.sucursal} · {visita.paciente}
          </p>
        )}
      </header>

      <main className="px-4 py-5">
        {/* Input de visita_id */}
        {!visita && !loading && (
          <div className="bg-white rounded-[16px] p-4 shadow-sm mb-4">
            <p className="text-sm font-medium text-text mb-2">Ingresa tu ID de visita</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputId}
                onChange={e => setInputId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleBuscar()}
                placeholder="ej: 06b8efbf-..."
                className="flex-1 px-3 py-2 text-sm rounded-[10px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={handleBuscar}
                className="px-4 py-2 bg-primary text-white text-sm rounded-[10px]"
              >
                Buscar
              </button>
            </div>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </div>
        )}

        {loading && (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted">Cargando tu visita...</p>
          </div>
        )}

        {visita && (
          <>
            {/* Alertas del paciente */}
            <AlertasPaciente alertas={visita.alertas_sucursal} />

            {/* Tiempo estimado */}
            <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted mb-1">Tiempo estimado restante</p>
                  <p className="text-[28px] font-semibold text-text leading-none">
                    ~{tiempoMin}-{tiempoMax} min
                  </p>
                  <p className="text-xs text-muted mt-1">
                    Puede variar por emergencias o imprevistos
                  </p>
                </div>
                <div className="w-11 h-11 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted text-center mb-5">{resumenEstudios}</p>

            {/* Stepper de estudios */}
            <div className="space-y-0">
              {visita.estudios.map((estudio, idx) => {
                if (estudio.es_estado_final) {
                  return <EstudioCompletado key={estudio.id_estudio} estudio={estudio} />
                }
                if (estudio.es_actual) {
                  return <EstudioActual key={estudio.id_estudio} estudio={estudio} visitaId={visita.visita_id} />
                }
                return (
                  <EstudioPendiente
                    key={estudio.id_estudio}
                    estudio={estudio}
                    isLast={idx === visita.estudios.length - 1}
                  />
                )
              })}
            </div>

            <Footer />
          </>
        )}
      </main>

      {/* Botón flotante de resultados */}
      {visita && (
        <div className="fixed bottom-20 left-4 right-4 z-40">
          <Link href="/resultados">
            <button className="w-full bg-primary text-white font-medium py-3.5 px-4 rounded-[10px] shadow-lg active:bg-primary/90 transition-colors">
              Ver resultados
            </button>
          </Link>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
