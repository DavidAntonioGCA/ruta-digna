"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp,
  Check, Clock, MapPin, Sparkles, Lock, AlertCircle, Search, Activity
} from "lucide-react"
import BottomNav from "@/components/BottomNav"
import Footer from "@/components/Footer"
import { recomendar, crearVisita, type RecomendacionResponse } from "@/app/lib/api"

export default function Recomendar() {
  const router = useRouter()
  const [mensaje, setMensaje] = useState("")
  const [loading, setLoading] = useState(false)
  const [creando, setCreando] = useState(false)
  const [result, setResult] = useState<RecomendacionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showOthers, setShowOthers] = useState(false)
  const [showOrden, setShowOrden] = useState(false)
  const [tipoPaciente, setTipoPaciente] = useState("sin_cita")

  const handleBuscar = async () => {
    if (!mensaje.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      let lat: number | undefined
      let lon: number | undefined
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        )
        lat = pos.coords.latitude
        lon = pos.coords.longitude
      } catch { /* Ubicación opcional */ }

      const data = await recomendar(mensaje, lat, lon)
      setResult(data)
    } catch (err) {
      setError("No pudimos conectar con el servidor. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  const handleComenzar = async () => {
    if (!result) return
    setCreando(true)
    try {
      const session = JSON.parse(localStorage.getItem("ruta_session") || "null")
      const paciente_id = session?.paciente_id
      if (!paciente_id) {
        setError("Primero inicia sesión para crear tu visita.")
        router.push("/login")
        return
      }
      const ids_estudios = result.ids_estudios_detectados?.length
        ? result.ids_estudios_detectados
        : [2] // fallback: laboratorio
      const id_sucursal = result.sucursal_recomendada?.id_sucursal || 1

      const { visita_id } = await crearVisita({ id_paciente: paciente_id, id_sucursal, ids_estudios, tipo_paciente: tipoPaciente })
      const nextSession = {
        paciente_id,
        nombre: session?.nombre || "Paciente",
        telefono: session?.telefono || "",
        visita_id,
      }
      localStorage.setItem("ruta_session", JSON.stringify(nextSession))
      router.push(`/antes-de-ir?id=${visita_id}`)
    } catch {
      setError("No se pudo crear la visita. Intenta de nuevo.")
    } finally {
      setCreando(false)
    }
  }

  const recomendada = result?.sucursal_recomendada

  return (
    <div className="min-h-screen bg-[#F9FBFF] pb-28 text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      
      {/* Header Estilo Apple: Glassmorphism */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/antes-de-ir" className="p-2 -ml-2 hover:bg-slate-100/50 rounded-full transition-all active:scale-90">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="select-none">
            <h1 className="text-xl font-black bg-gradient-to-br from-blue-600 to-emerald-500 bg-clip-text text-transparent">
              Ruta Digna
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">Inteligencia Artificial</p>
          </div>
        </div>
        <Activity className="w-5 h-5 text-blue-500/30 animate-pulse" />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        
        {/* Sección de Búsqueda */}
        <section className="bg-white rounded-[32px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
            <Search className="w-24 h-24 text-blue-600" />
          </div>
          
          <h2 className="text-2xl font-black text-slate-800 mb-6 relative select-none">
            ¿Qué necesitas hoy?
          </h2>
          
          <div className="relative">
            <textarea
              className="w-full p-6 rounded-2xl border-2 border-slate-100 bg-slate-50/50 text-base resize-none transition-all duration-300 focus:bg-white focus:border-blue-400/30 focus:ring-8 focus:ring-blue-50 outline-none placeholder:text-slate-400"
              rows={3}
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              placeholder="Ej: Necesito laboratorio y ultrasonido cerca de mí..."
            />
            <div className="absolute bottom-4 right-4 flex gap-2">
               <Sparkles className={`w-5 h-5 transition-all ${mensaje ? 'text-blue-500 scale-110' : 'text-slate-200'}`} />
            </div>
          </div>

          <button
            onClick={handleBuscar}
            disabled={loading || !mensaje.trim()}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-bold py-5 rounded-2xl shadow-2xl shadow-blue-500/30 transition-all active:scale-[0.97] flex items-center justify-center gap-3 group overflow-hidden"
          >
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="tracking-wide">Analizando opciones...</span>
              </div>
            ) : (
              <>
                <span className="text-lg">Optimizar mi visita</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
              </>
            )}
          </button>
        </section>

        {/* Feedback de IA */}
        {result && result.estudios_detectados.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center px-2 animate-in fade-in slide-in-from-left-4 select-none">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">Analizado:</span>
            {result.estudios_detectados.map((e, i) => (
              <span key={i} className="px-4 py-1.5 bg-blue-50 text-blue-700 text-[11px] font-black rounded-full border border-blue-100/50 shadow-sm uppercase">
                {e}
              </span>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex gap-3 animate-bounce">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-800 font-bold">{error}</p>
          </div>
        )}

        {/* RESULTADO MAESTRO */}
        {recomendada && (
          <div className="relative animate-in slide-in-from-bottom-8 duration-700 group">
            {/* Badge de Confianza */}
            <div className="absolute -top-4 left-10 z-10 bg-emerald-500 text-white text-[11px] font-black px-5 py-2 rounded-full shadow-[0_10px_20px_rgba(16,185,129,0.3)] flex items-center gap-2 border-2 border-white select-none">
              <Check className="w-3.5 h-3.5 stroke-[4px]" /> TU MEJOR RUTA
            </div>
            
            <div className="bg-white rounded-[40px] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.06)] border-2 border-blue-50 relative overflow-hidden transition-all group-hover:shadow-[0_30px_80px_rgba(0,0,0,0.08)] group-hover:border-blue-100/50">
              
              <div className="relative">
                {/* TÍTULO SIN CURSOR (select-none) */}
                <h3 className="text-3xl font-black text-slate-900 tracking-tight select-none outline-none">
                  {recomendada.nombre_sucursal}
                </h3>
                
                {/* DIRECCIÓN (Cambiado p por div para evitar error de hidratación) */}
                <div className="flex items-center gap-2 text-slate-500 font-medium text-sm mt-3 select-none">
                  <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span>{recomendada.direccion}</span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-5 mt-10">
                  <div className="bg-slate-50/80 p-5 rounded-[24px] border border-slate-100 select-none">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-blue-500" /> Espera
                    </div>
                    <div className="flex items-end gap-1 mt-2">
                      <span className="text-3xl font-black text-slate-900">~{recomendada.tiempo_total_min}</span>
                      <span className="text-xs font-bold text-slate-400 mb-1.5 uppercase">min</span>
                    </div>
                  </div>
                  <div className="bg-slate-50/80 p-5 rounded-[24px] border border-slate-100 select-none">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Activity className="w-3 h-3 text-emerald-500" /> Capacidad
                    </div>
                    <div className="flex items-end gap-1 mt-2">
                      <span className="text-3xl font-black text-slate-900">{recomendada.estudios_disponibles}</span>
                      <span className="text-xs font-bold text-slate-400 mb-1.5 uppercase">ítems</span>
                    </div>
                  </div>
                </div>

                {/* Acordeón de Flujo */}
                {result.orden_sugerido && result.orden_sugerido.length > 0 && (
                  <div className="mt-8 border-t border-slate-100 pt-6">
                    <button 
                      onClick={() => setShowOrden(!showOrden)}
                      className="w-full flex items-center justify-between text-sm font-black text-slate-700 hover:text-blue-600 transition-colors select-none"
                    >
                      FLUJO DE ATENCIÓN SUGERIDO
                      {showOrden ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                    {showOrden && (
                      <div className="mt-5 space-y-4 animate-in slide-in-from-top-4">
                        {result.orden_sugerido.map((e, idx) => (
                          <div key={idx} className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 group/item">
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-blue-500/20">
                              {e.orden}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-black text-slate-800">{e.nombre}</p>
                              {e.requiere_preparacion && (
                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-tighter">Requiere preparación</span>
                              )}
                            </div>
                            <Lock className="w-4 h-4 text-slate-200" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Selector de tipo de paciente */}
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 select-none">¿Tienes alguna condición especial?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "sin_cita",     label: "Sin cita",      color: "bg-slate-100 text-slate-600",   active: "bg-slate-800 text-white" },
                      { value: "con_cita",     label: "Con cita",      color: "bg-blue-50 text-blue-700",      active: "bg-blue-600 text-white" },
                      { value: "embarazada",   label: "Embarazada",    color: "bg-pink-50 text-pink-700",      active: "bg-pink-500 text-white" },
                      { value: "adulto_mayor", label: "Adulto mayor",  color: "bg-amber-50 text-amber-700",    active: "bg-amber-500 text-white" },
                      { value: "discapacidad", label: "Discapacidad",  color: "bg-purple-50 text-purple-700",  active: "bg-purple-600 text-white" },
                      { value: "urgente",      label: "Urgente",       color: "bg-red-50 text-red-700",        active: "bg-red-600 text-white" },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setTipoPaciente(opt.value)}
                        className={`py-2.5 px-3 rounded-2xl text-xs font-black transition-all select-none ${tipoPaciente === opt.value ? opt.active + " shadow-lg scale-[1.02]" : opt.color}`}
                      >
                        {opt.label}
                        {tipoPaciente === opt.value && <span className="ml-1">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleComenzar}
                  disabled={creando}
                  className="w-full mt-6 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-bold py-5 rounded-[22px] transition-all shadow-2xl hover:shadow-slate-400/40 flex items-center justify-center gap-3 group/btn overflow-hidden relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                  {creando ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="text-lg">Comenzar Visita</span>
                      <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-2 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Otras Opciones */}
        {result && result.alternativas.length > 0 && (
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden transition-all hover:shadow-md">
            <button
              onClick={() => setShowOthers(!showOthers)}
              className="w-full p-6 flex items-center justify-between group bg-slate-50/30"
            >
              <span className="font-black text-slate-800 select-none tracking-tight">Otras opciones cercanas</span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${showOthers ? 'bg-blue-600 text-white rotate-180' : 'bg-slate-200 text-slate-500'}`}>
                <ChevronDown className="w-5 h-5" />
              </div>
            </button>
            {showOthers && (
              <div className="px-6 pb-6 space-y-4 pt-4 animate-in slide-in-from-top-4">
                {result.alternativas.map((alt: any, idx: number) => (
                  <div key={idx} className="p-5 bg-slate-50/50 rounded-2xl border border-transparent hover:border-blue-100 hover:bg-white hover:shadow-lg transition-all flex justify-between items-center group/item">
                    <div>
                      <p className="font-bold text-slate-800 group-hover/item:text-blue-600 transition-colors">{alt.nombre_sucursal}</p>
                      <p className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-widest">{alt.ciudad}</p>
                    </div>
                    <div className="text-right bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-50">
                      <p className="text-sm font-black text-slate-800">~{alt.tiempo_total_min} min</p>
                      <p className="text-[9px] font-black text-blue-500 uppercase italic tracking-tighter">Tiempo est.</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Footer />
      </main>

      <BottomNav />
    </div>
  )
}
