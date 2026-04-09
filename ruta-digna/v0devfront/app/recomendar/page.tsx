"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp,
  Check, Clock, MapPin, Sparkles, Lock, AlertCircle, Search, Activity,
  GripVertical, MessageSquareOff, AlertTriangle, FlaskConical, Info
} from "lucide-react"
import BottomNav from "@/components/BottomNav"
import Footer from "@/components/Footer"
import {
  recomendar, crearVisita, getEstudiosDisponibles,
  type RecomendacionResponse
} from "@/app/lib/api"

type Sucursal = NonNullable<RecomendacionResponse["sucursal_recomendada"]>
type EstudioDisponible = { id: number; nombre: string }

export default function Recomendar() {
  const router = useRouter()
  const [mensaje, setMensaje] = useState("")
  const [loading, setLoading] = useState(false)
  const [creando, setCreando] = useState(false)
  const [result, setResult] = useState<RecomendacionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showOthers, setShowOthers] = useState(false)
  const [showOrden, setShowOrden] = useState(false)
  const [ordenPersonalizado, setOrdenPersonalizado] = useState<RecomendacionResponse["orden_sugerido"]>([])
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<Sucursal | null>(null)
  const [avisoAceptado, setAvisoAceptado] = useState(false)

  // ── Estado del panel de confirmación (confianza baja) ──────────────────────
  const [estudiosDisponibles, setEstudiosDisponibles] = useState<EstudioDisponible[]>([])
  const [estudiosConfirmados, setEstudiosConfirmados] = useState<number[]>([]) // IDs seleccionados en panel
  const [buscandoConEstudios, setBuscandoConEstudios] = useState(false) // spinner del botón confirmar

  const [tipoPaciente] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ruta_session") || "{}").tipo_paciente ?? "sin_cita"
    } catch { return "sin_cita" }
  })

  // Pre-cargar lista de estudios disponibles (para el panel de selección manual)
  useEffect(() => {
    getEstudiosDisponibles()
      .then(setEstudiosDisponibles)
      .catch(() => { /* falla silenciosa — el panel mostrará solo las sugerencias de IA */ })
  }, [])

  const handleBuscar = async () => {
    if (!mensaje.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setSucursalSeleccionada(null)
    setEstudiosConfirmados([])
    setAvisoAceptado(false)

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
      setOrdenPersonalizado(data.orden_sugerido ?? [])

      if (data.sucursal_recomendada) {
        setSucursalSeleccionada(data.sucursal_recomendada)
      }

      // Si hay confianza baja, pre-seleccionar los estudios detectados por IA
      if (data.confianza === "baja" && data.ids_estudios_detectados?.length) {
        setEstudiosConfirmados(data.ids_estudios_detectados)
      }
    } catch (err) {
      setError("No pudimos conectar con el servidor. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  /** Confirmar estudios del panel de baja confianza y buscar sucursales */
  const handleConfirmarEstudios = async () => {
    if (!estudiosConfirmados.length) return
    setBuscandoConEstudios(true)
    setError(null)
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

      // Volver a llamar al backend pero con mensaje que incluye los estudios confirmados
      // Construimos un mensaje enriquecido con los nombres de los estudios seleccionados
      const nombresSeleccionados = estudiosDisponibles
        .filter(e => estudiosConfirmados.includes(e.id))
        .map(e => e.nombre)
        .join(", ")
      const mensajeEnriquecido = nombresSeleccionados || mensaje

      const data = await recomendar(mensajeEnriquecido, lat, lon)
      setResult(data)
      setOrdenPersonalizado(data.orden_sugerido ?? [])
      if (data.sucursal_recomendada) {
        setSucursalSeleccionada(data.sucursal_recomendada)
      }
    } catch {
      setError("No pudimos conectar con el servidor. Intenta de nuevo.")
    } finally {
      setBuscandoConEstudios(false)
    }
  }

  const toggleEstudio = (id: number) => {
    setEstudiosConfirmados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleComenzar = async () => {
    if (!result || !sucursalSeleccionada) return
    setCreando(true)
    setError(null)
    try {
      const session = JSON.parse(localStorage.getItem("ruta_session") || "null")
      const paciente_id = session?.paciente_id
      if (!paciente_id) {
        setError("Primero inicia sesión para crear tu visita.")
        router.push("/login")
        return
      }
      const ids_estudios = ordenPersonalizado.length
        ? ordenPersonalizado.map(e => e.id_estudio)
        : result.ids_estudios_detectados?.length
          ? result.ids_estudios_detectados
          : [2]

      const id_sucursal = sucursalSeleccionada.id_sucursal

      const response = await crearVisita({
        id_paciente: paciente_id,
        id_sucursal,
        ids_estudios,
        tipo_paciente: tipoPaciente,
      })
      const visita_id = response.visita_id

      localStorage.setItem("ruta_session", JSON.stringify({ ...session, visita_id }))
      router.push(`/antes-de-ir?id=${visita_id}`)
    } catch {
      setError("No se pudo crear la visita. Intenta de nuevo.")
    } finally {
      setCreando(false)
    }
  }

  const todasSucursales: Sucursal[] = result?.sucursal_recomendada
    ? [result.sucursal_recomendada, ...(result.alternativas ?? [])]
    : []

  /** Muestra el tiempo de espera de forma segura: null/0 → "Sin datos" */
  const tiempoDisplay = (min: number | null | undefined) => {
    if (!min || min <= 0) return { texto: "Sin datos", clase: "text-slate-400 italic text-sm font-medium" }
    return { texto: `~${min} min`, clase: "text-slate-900 font-black text-3xl" }
  }

  // ¿Mostramos el panel de confirmación?
  const mostrarConfirmacion = result && !result.sin_estudios && result.confianza === "baja" && !result.sucursal_recomendada === false
    ? false // ya tiene sucursal (confianza baja pero llegó a recomendar — edge case)
    : result && !result.sin_estudios && result.confianza === "baja"

  // Si hay sucursal Y confianza baja, mostramos ambas (advertencia + resultado)
  const confianzaBajaConSucursal = result && !result.sin_estudios && result.confianza === "baja" && result.sucursal_recomendada

  return (
    <div className="min-h-screen bg-[#F9FBFF] pb-28 text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      
      {/* Header */}
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
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

        {/* Banner aviso contenido no médico */}
        {result?.aviso_contenido && (
          <div className="flex flex-col gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Sobre tu mensaje</p>
                <p className="text-sm text-slate-700 font-medium leading-relaxed">{result.aviso_contenido}</p>
              </div>
            </div>
            {!avisoAceptado && (
              <div className="flex justify-end mt-3">
                <button
                  onClick={() => setAvisoAceptado(true)}
                  className="bg-blue-600 text-white font-black py-3 px-6 rounded-xl text-sm hover:bg-blue-700 active:scale-95 transition-all"
                >
                  Entendido, ver recomendaciones →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Feedback de IA — solo cuando confianza alta */}
        {result && !result.sin_estudios && result.confianza === "alta" && result.estudios_detectados.length > 0 && (
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
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-800 font-bold">{error}</p>
          </div>
        )}

        {/* SIN ESTUDIOS STATE */}
        {result?.sin_estudios && (
          <div className="bg-amber-50 border border-amber-200 rounded-[28px] p-8 flex flex-col items-center text-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
              <MessageSquareOff className="w-7 h-7 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 mb-2">No encontramos estudios médicos</h3>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">{result.mensaje}</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {["Laboratorio", "Ultrasonido", "Rayos X", "Optometría", "Nutrición"].map(s => (
                <button
                  key={s}
                  onClick={() => setMensaje(`Necesito ${s.toLowerCase()}`)}
                  className="px-4 py-1.5 bg-white border border-amber-200 text-amber-700 text-xs font-bold rounded-full hover:bg-amber-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            PANEL DE CONFIRMACIÓN — confianza === "baja"
            Se muestra ANTES de la tarjeta de sucursal cuando la IA
            no está segura de qué estudios necesita el paciente.
        ═══════════════════════════════════════════════════════════════ */}
        {(!result?.aviso_contenido || avisoAceptado) && result && !result.sin_estudios && result.confianza === "baja" && (
          <div className="bg-amber-50 border border-amber-200 rounded-[28px] p-7 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Encabezado */}
            <div className="flex gap-4">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 leading-tight">
                  No estamos seguros de qué estudios necesitas
                </h3>
                <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
                  Basándonos en tu mensaje te sugerimos los siguientes estudios.
                  ¿Es esto lo que buscas? También puedes elegir manualmente.
                </p>
              </div>
            </div>

            {/* Sugerencias de IA (pre-seleccionadas) */}
            {result.estudios_detectados.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em] mb-3">
                  Sugeridos por IA
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.estudios_detectados.map((nombre, i) => {
                    const estudio = estudiosDisponibles.find(e =>
                      e.nombre.toUpperCase().includes(nombre.toUpperCase()) ||
                      nombre.toUpperCase().includes(e.nombre.toUpperCase())
                    )
                    const id = estudio?.id ?? result.ids_estudios_detectados?.[i]
                    if (!id) return null
                    const isSelected = estudiosConfirmados.includes(id)
                    return (
                      <button
                        key={id}
                        onClick={() => toggleEstudio(id)}
                        className={`px-4 py-2 rounded-xl text-xs font-black border-2 transition-all duration-150 active:scale-95
                          ${isSelected
                            ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20"
                            : "bg-white text-slate-700 border-slate-200 hover:border-blue-300"
                          }`}
                      >
                        {isSelected && <Check className="inline w-3 h-3 mr-1 stroke-[3px]" />}
                        {nombre}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Selector manual — todos los estudios disponibles */}
            {estudiosDisponibles.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">
                  O elige manualmente
                </p>
                <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto pr-1">
                  {estudiosDisponibles.map(est => {
                    const isSelected = estudiosConfirmados.includes(est.id)
                    return (
                      <button
                        key={est.id}
                        onClick={() => toggleEstudio(est.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border-2 transition-all duration-150 active:scale-95
                          ${isSelected
                            ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20"
                            : "bg-white text-slate-600 border-slate-100 hover:border-blue-200 hover:bg-slate-50"
                          }`}
                      >
                        {isSelected && <Check className="inline w-3 h-3 mr-1 stroke-[3px]" />}
                        {est.nombre}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Botón confirmar */}
            <button
              onClick={handleConfirmarEstudios}
              disabled={buscandoConEstudios || estudiosConfirmados.length === 0}
              className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-bold py-5 rounded-[22px] transition-all shadow-2xl hover:shadow-slate-400/40 flex items-center justify-center gap-3 group/btn overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
              {buscandoConEstudios ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FlaskConical className="w-5 h-5" />
                  <span className="text-base">
                    Confirmar {estudiosConfirmados.length > 0 ? `${estudiosConfirmados.length} estudio${estudiosConfirmados.length > 1 ? 's' : ''}` : 'estudios'} y ver sucursales
                  </span>
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {estudiosConfirmados.length === 0 && (
              <p className="text-center text-xs text-amber-600 font-bold -mt-2">
                Selecciona al menos un estudio para continuar
              </p>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            RESULTADO MAESTRO — confianza alta O baja-con-sucursal
        ═══════════════════════════════════════════════════════════════ */}
        {(!result?.aviso_contenido || avisoAceptado) && result && !result.sin_estudios && result.sucursal_recomendada && (
          <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">

            {/* Nota de advertencia si la confianza sigue siendo baja después de confirmar */}
            {confianzaBajaConSucursal && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 font-bold">
                  Sugerencia basada en tu descripción. Puedes cambiar la sucursal o los estudios antes de comenzar.
                </p>
              </div>
            )}

            {/* ─── SELECTOR DE SUCURSAL ─── */}
            <div className="bg-white rounded-[32px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4 select-none">
                Selecciona tu sucursal
              </h3>
              <div className="space-y-3">
                {todasSucursales.map((suc, idx) => {
                  const isSelected = sucursalSeleccionada?.id_sucursal === suc.id_sucursal
                  const isRecomendada = idx === 0
                  return (
                    <button
                      key={suc.id_sucursal}
                      onClick={() => setSucursalSeleccionada(suc)}
                      className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 flex items-start gap-4
                        ${isSelected
                          ? "border-blue-500 bg-blue-50/60 shadow-lg shadow-blue-500/10"
                          : "border-slate-100 bg-slate-50/50 hover:border-blue-200 hover:bg-white hover:shadow-md"
                        }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all
                        ${isSelected ? "border-blue-500 bg-blue-500" : "border-slate-300 bg-white"}`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-black text-sm ${isSelected ? "text-blue-700" : "text-slate-800"}`}>
                            {suc.nombre_sucursal}
                          </p>
                          {isRecomendada && (
                            <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                              Recomendada
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-xs text-slate-500 font-medium truncate">{suc.direccion}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs font-bold">
                            <Clock className="inline w-3 h-3 mr-1 text-blue-500" />
                            {(() => {
                              const t = tiempoDisplay(suc.tiempo_total_min)
                              return <span className={t.clase.replace('text-3xl', 'text-xs').replace('font-black', 'font-bold')}>{t.texto}</span>
                            })()}
                          </span>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">{suc.ciudad}</span>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4 text-white stroke-[3px]" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ─── TARJETA DETALLE SUCURSAL SELECCIONADA ─── */}
            {sucursalSeleccionada && (
              <div className="relative group">
                <div className="absolute -top-4 left-10 z-10 bg-emerald-500 text-white text-[11px] font-black px-5 py-2 rounded-full shadow-[0_10px_20px_rgba(16,185,129,0.3)] flex items-center gap-2 border-2 border-white select-none">
                  <Check className="w-3.5 h-3.5 stroke-[4px]" /> TU MEJOR RUTA
                </div>
                
                <div className="bg-white rounded-[40px] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.06)] border-2 border-blue-50 relative overflow-hidden transition-all group-hover:shadow-[0_30px_80px_rgba(0,0,0,0.08)] group-hover:border-blue-100/50">
                  <div className="relative">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight select-none">
                      {sucursalSeleccionada.nombre_sucursal}
                    </h3>
                    
                    <div className="flex items-center gap-2 text-slate-500 font-medium text-sm mt-3 select-none">
                      <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <span>{sucursalSeleccionada.direccion}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-5 mt-10">
                      <div className="bg-slate-50/80 p-5 rounded-[24px] border border-slate-100 select-none">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-blue-500" /> Espera
                        </div>
                        <div className="flex items-end gap-1 mt-2">
                          {(() => {
                            const t = tiempoDisplay(sucursalSeleccionada.tiempo_total_min)
                            return <span className={t.clase}>{t.texto}</span>
                          })()}
                          {sucursalSeleccionada.tiempo_total_min && sucursalSeleccionada.tiempo_total_min > 0 && (
                            <span className="text-xs font-bold text-slate-400 mb-1.5 uppercase">min</span>
                          )}
                        </div>
                      </div>
                      <div className="bg-slate-50/80 p-5 rounded-[24px] border border-slate-100 select-none">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Activity className="w-3 h-3 text-emerald-500" /> Capacidad
                        </div>
                        <div className="flex items-end gap-1 mt-2">
                          <span className="text-3xl font-black text-slate-900">{sucursalSeleccionada.estudios_disponibles}</span>
                          <span className="text-xs font-bold text-slate-400 mb-1.5 uppercase">ítems</span>
                        </div>
                      </div>
                    </div>

                    {/* Acordeón de Flujo */}
                    {ordenPersonalizado.length > 0 && (
                      <div className="mt-8 border-t border-slate-100 pt-6">
                        <button
                          onClick={() => setShowOrden(!showOrden)}
                          className="w-full flex items-center justify-between text-sm font-black text-slate-700 hover:text-blue-600 transition-colors select-none"
                        >
                          <span>FLUJO DE ATENCIÓN SUGERIDO</span>
                          {showOrden ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                        {showOrden && (
                          <div className="mt-5 space-y-3 animate-in slide-in-from-top-4">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-1">
                              <GripVertical className="inline w-3 h-3" /> Arrastra para cambiar estudios flexibles
                            </p>
                            {(() => {
                              const POR_QUE_ESTUDIO: Record<string, string> = {
                                "LABORATORIO": "Análisis de sangre y orina para detectar valores fuera de rango.",
                                "RAYOS X": "Imágenes óseas y pulmonares para detectar fracturas o anomalías.",
                                "ULTRASONIDO": "Visualización de órganos internos mediante ondas de sonido.",
                                "ELECTROCARDIOGRAMA": "Mide la actividad eléctrica del corazón.",
                                "TOMOGRAFÍA": "Imágenes detalladas en cortes transversales del cuerpo.",
                                "RESONANCIA MAGNÉTICA": "Imágenes de alta resolución de tejidos blandos.",
                                "DENSITOMETRÍA": "Mide la densidad ósea para detectar osteoporosis.",
                                "MASTOGRAFÍA": "Estudio preventivo de mama para detección temprana.",
                                "PAPANICOLAOU": "Detección temprana de cambios cervicales.",
                                "NUTRICIÓN": "Evaluación y orientación sobre hábitos alimenticios.",
                                "EXAMEN DE LA VISTA": "Evaluación de agudeza visual y salud ocular.",
                                "ÓPTICA": "Revisión y corrección de problemas de visión.",
                                "AUDIOMETRÍA": "Evaluación de la capacidad auditiva.",
                                "ESPIROMETRÍA": "Medición de la función pulmonar.",
                                "SALUD OCUPACIONAL": "Revisión médica relacionada con el entorno de trabajo.",
                              }
                              return ordenPersonalizado.map((e, idx) => {
                                const esFlexible = !e.requiere_preparacion
                                const puedeSubir = esFlexible && idx > 0 && !ordenPersonalizado[idx - 1].requiere_preparacion
                                const puedeBajar = esFlexible && idx < ordenPersonalizado.length - 1 && !ordenPersonalizado[idx + 1].requiere_preparacion
                                const mover = (dir: -1 | 1) => {
                                  const nuevo = [...ordenPersonalizado]
                                  const temp = nuevo[idx]
                                  nuevo[idx] = nuevo[idx + dir]
                                  nuevo[idx + dir] = temp
                                  setOrdenPersonalizado(nuevo)
                                }
                                const puedeEliminar = ordenPersonalizado.length > 1
                                return (
                                  <div key={e.id_estudio} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${esFlexible ? 'bg-blue-50/40 border-blue-100 hover:border-blue-200' : 'bg-slate-50/50 border-slate-100'}`}>
                                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-blue-500/20 shrink-0">{idx + 1}</div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-black text-slate-800 truncate">{e.nombre}</p>
                                      {e.requiere_preparacion
                                        ? <span className="text-[9px] font-black text-amber-600 uppercase tracking-tighter">⚠ Orden fijo — requiere preparación</span>
                                        : <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">Flexible — puedes cambiar el orden</span>
                                      }
                                      <p className="text-[10px] text-slate-400 font-medium mt-1 leading-relaxed">
                                        {POR_QUE_ESTUDIO[e.nombre.toUpperCase()] ?? "Estudio solicitado por tu médico o requerido para tu visita."}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {esFlexible ? (
                                        <div className="flex flex-col gap-0.5">
                                          <button onClick={() => mover(-1)} disabled={!puedeSubir} className="w-6 h-6 flex items-center justify-center rounded-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:bg-blue-100 active:scale-90" aria-label="Subir">
                                            <ChevronUp className="w-4 h-4 text-blue-600" />
                                          </button>
                                          <button onClick={() => mover(1)} disabled={!puedeBajar} className="w-6 h-6 flex items-center justify-center rounded-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:bg-blue-100 active:scale-90" aria-label="Bajar">
                                            <ChevronDown className="w-4 h-4 text-blue-600" />
                                          </button>
                                        </div>
                                      ) : (
                                        <Lock className="w-4 h-4 text-slate-300" />
                                      )}
                                      {puedeEliminar && (
                                        <button
                                          onClick={() => setOrdenPersonalizado(prev => prev.filter(est => est.id_estudio !== e.id_estudio))}
                                          className="w-6 h-6 rounded-full bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-xs font-black transition-all shrink-0 active:scale-90"
                                          aria-label="Eliminar estudio"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )
                              })
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Prioridad */}
                    {(() => {
                      const TIPO_BADGE: Record<string, { label: string; color: string; icon: string }> = {
                        adulto_mayor: { label: "Adulto mayor",   color: "bg-amber-50 text-amber-700 border-amber-200",   icon: "👴" },
                        discapacidad: { label: "Discapacidad",   color: "bg-purple-50 text-purple-700 border-purple-200", icon: "♿" },
                        embarazada:   { label: "Embarazada",     color: "bg-pink-50 text-pink-700 border-pink-200",       icon: "🤰" },
                        con_cita:     { label: "Con cita previa",color: "bg-blue-50 text-blue-700 border-blue-200",       icon: "📋" },
                        sin_cita:     { label: "Sin cita",       color: "bg-slate-50 text-slate-600 border-slate-200",    icon: "👤" },
                      }
                      const info = TIPO_BADGE[tipoPaciente] ?? TIPO_BADGE.sin_cita
                      return (
                        <div className={`mt-6 flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-bold ${info.color}`}>
                          <span className="text-lg">{info.icon}</span>
                          <div>
                            <p className="font-black leading-tight">Prioridad: {info.label}</p>
                            <p className="text-xs font-medium opacity-60 mt-0.5">Asignada automáticamente con tu perfil</p>
                          </div>
                        </div>
                      )
                    })()}

                    <button
                      onClick={handleComenzar}
                      disabled={creando || !sucursalSeleccionada}
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
          </div>
        )}

        {/* Otras Opciones */}
        {result && !result.sin_estudios && result.alternativas && result.alternativas.length > 0 && (
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden transition-all hover:shadow-md">
            <button
              onClick={() => setShowOthers(!showOthers)}
              className="w-full p-6 flex items-center justify-between group bg-slate-50/30"
            >
              <span className="font-black text-slate-800 select-none tracking-tight">Comparar todas las opciones</span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${showOthers ? 'bg-blue-600 text-white rotate-180' : 'bg-slate-200 text-slate-500'}`}>
                <ChevronDown className="w-5 h-5" />
              </div>
            </button>
            {showOthers && (
              <div className="px-6 pb-6 space-y-4 pt-4 animate-in slide-in-from-top-4">
                {result.alternativas.map((alt: any, idx: number) => (
                  <div className="p-5 bg-slate-50/50 rounded-2xl border border-transparent hover:border-blue-100 hover:bg-white hover:shadow-lg transition-all flex justify-between items-center group/item">
                    <div>
                      <p className="font-bold text-slate-800 group-hover/item:text-blue-600 transition-colors">{alt.nombre_sucursal}</p>
                      <p className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-widest">{alt.ciudad}</p>
                    </div>
                    <div className="text-right bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-50">
                      {(() => {
                        const t = tiempoDisplay(alt.tiempo_total_min)
                        const esSinDatos = !alt.tiempo_total_min || alt.tiempo_total_min <= 0
                        return (
                          <>
                            <p className={`text-sm font-black ${esSinDatos ? 'text-slate-400 italic' : 'text-slate-800'}`}>{t.texto}</p>
                            <p className="text-[9px] font-black text-blue-500 uppercase italic tracking-tighter">Tiempo est.</p>
                          </>
                        )
                      })()}
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
