"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import {
  FlaskConical, Activity, ScanLine, Check, Send, Clock,
  MapPin, AlertTriangle, ChevronDown, ChevronUp, Navigation,
  Search, Bot, Sparkles, ArrowRight, User, ShieldCheck, Lock,
  Timer, Calendar
} from "lucide-react"
import BottomNav from "@/components/BottomNav"
import Footer from "@/components/Footer"
import { getVisitaStatus, chatAsistente, buscarPaciente, type EstadoVisita, type EstudioVisita } from "@/app/lib/api"

// Temas visuales por tipo de estudio
const ESTUDIO_THEME: Record<string, { icon: any, color: string, bg: string }> = {
  LABORATORIO: { icon: FlaskConical, color: "text-blue-600", bg: "bg-blue-50" },
  ULTRASONIDO: { icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50" },
  'RAYOS X': { icon: ScanLine, color: "text-purple-600", bg: "bg-purple-50" },
}

function getTheme(nombre: string) {
  return ESTUDIO_THEME[nombre] || { icon: Activity, color: "text-primary", bg: "bg-slate-50" }
}

// ── COMPONENTES RE-DISEÑADOS ──────────────────────────────────────────

function AlertasPaciente({ alertas }: { alertas: any[] }) {
  if (!alertas || alertas.length === 0) return null
  return (
    <div className="space-y-3 mb-8 animate-in slide-in-from-top-4 duration-500">
      {alertas.map((a: any, idx: number) => (
        <div key={idx} className="flex items-center gap-4 p-4 rounded-3xl bg-amber-50 border border-amber-100 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Aviso de Sucursal</p>
            <p className="text-sm font-bold text-amber-900 leading-tight">{a.titulo}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function EstudioCompletado({ estudio }: { estudio: EstudioVisita }) {
  return (
    <div className="relative pl-14 pb-8">
      <div className="absolute left-4 top-0 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center z-10 shadow-lg shadow-emerald-100">
        <Check className="w-4 h-4 text-white stroke-[3px]" />
      </div>
      <div className="absolute left-[31px] top-8 w-0.5 h-full bg-emerald-100" />
      <div className="bg-white rounded-[24px] p-5 border border-slate-100 opacity-60 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 uppercase text-xs tracking-tight">{estudio.nombre}</h3>
          <span className="text-[9px] font-black px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md uppercase tracking-tighter">Completado</span>
      </div>
    </div>
  )
}

function EstudioActual({ estudio, visitaId }: { estudio: EstudioVisita; visitaId: string }) {
  const [message, setMessage] = useState("")
  const [chatMessages, setChatMessages] = useState<{ text: string; isUser: boolean }[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const { icon: Icon } = getTheme(estudio.nombre)

  const handleSend = async () => {
    if (!message.trim() || isTyping) return
    const userMsg = message.trim(); setChatMessages(prev => [...prev, { text: userMsg, isUser: true }]); setMessage(""); setIsTyping(true)
    try {
      const response = await chatAsistente(visitaId, userMsg, [])
      setChatMessages(prev => [...prev, { text: response.reply, isUser: false }])
    } catch { setChatMessages(prev => [...prev, { text: "Error de conexión.", isUser: false }]) }
    finally { setIsTyping(false) }
  }

  return (
    <div className="relative pl-14 pb-12">
      <div className="absolute left-4 top-0 z-20">
        <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-20 scale-150" />
        <div className="relative w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-xl ring-4 ring-white">
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <div className="absolute left-[31px] top-8 w-0.5 h-full border-l-2 border-dashed border-blue-100" />
      <div className="bg-white rounded-[40px] p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] border border-blue-50">
          <div className="flex items-center justify-between mb-6">
            <div className="text-left">
               <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">Servicio Actual</p>
               <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{estudio.nombre}</h3>
            </div>
            <div className="bg-blue-50 px-4 py-2 rounded-2xl">
                <span className="text-xl font-black text-blue-600 tabular-nums">{estudio.progreso_pct}%</span>
            </div>
          </div>
          <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden mb-8">
            <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: `${estudio.progreso_pct}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-8">
             <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 text-left">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Espera est.</p>
                <p className="text-lg font-black text-slate-800">~{estudio.tiempo_espera_min} min</p>
             </div>
             <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 text-left">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tu Turno</p>
                <p className="text-lg font-black text-slate-800">—</p>
             </div>
          </div>
          <div className="mt-4 bg-blue-600 rounded-3xl p-5 text-white">
             <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-blue-200" />
                <span className="text-[10px] font-black uppercase tracking-widest">Asistente Virtual</span>
             </div>
             <div className="space-y-3 mb-4 max-h-40 overflow-y-auto">
                <div className="bg-white text-blue-900 p-3 rounded-2xl text-xs font-bold mr-6 text-left">¿Tienes dudas sobre los requisitos o el proceso de tu estudio?</div>
                {chatMessages.map((msg, i) => (
                   <div key={i} className={`p-3 rounded-2xl text-xs font-bold ${msg.isUser ? "bg-blue-700 text-white ml-6 text-right" : "bg-white text-blue-900 mr-6 text-left"}`}>{msg.text}</div>
                ))}
             </div>
             <div className="relative">
                <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Pregunta algo..." className="w-full pl-4 pr-12 py-3 bg-blue-700/50 border-none rounded-2xl text-xs text-white placeholder:text-blue-300 outline-none focus:ring-2 focus:ring-white/20" />
                <button onClick={handleSend} className="absolute right-2 top-2 w-8 h-8 bg-white text-blue-600 rounded-xl flex items-center justify-center shadow-lg"><Send className="w-3.5 h-3.5" /></button>
             </div>
          </div>
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ────────────────────────────────────────────────

export default function Tracking() {
  const [visita, setVisita] = useState<EstadoVisita | null>(null)
  const [loading, setLoading] = useState(true)
  const [visitaId, setVisitaId] = useState("")
  const [inputId, setInputId] = useState("")
  const [pacienteNombre, setPacienteNombre] = useState("Paciente")

  useEffect(() => {
    const resolveVisitaId = async () => {
      let id = new URLSearchParams(window.location.search).get("id")

      try {
        const session = JSON.parse(localStorage.getItem("ruta_session") || "null")
        if (session?.nombre) {
          setPacienteNombre(session.nombre)
        }
        if (!id && session?.visita_id) {
          id = session.visita_id
        }

        if (!id && session?.telefono) {
          const data = await buscarPaciente(session.telefono)
          if (data?.encontrado && data?.visita_id) {
            id = data.visita_id
            localStorage.setItem("ruta_session", JSON.stringify({ ...session, visita_id: id }))
          }
        }

      } catch (e) {
        console.error("Error reading session", e)
      }

      if (id) {
        setVisitaId(id)
        setInputId(id)
      } else {
        setLoading(false)
      }
    }

    resolveVisitaId()
  }, [])

  const fetchStatus = useCallback(async () => {
    if (!visitaId) return
    try {
      const data = await getVisitaStatus(visitaId); 
      setVisita(data)
    } catch (e) {
      console.error("Error fetching status", e)
    } finally { 
      setLoading(false) 
    }
  }, [visitaId])

  useEffect(() => {
    if (!visitaId) return
    fetchStatus(); const iv = setInterval(fetchStatus, 5000); return () => clearInterval(iv)
  }, [visitaId, fetchStatus])

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-black tracking-tighter uppercase leading-none">{visita?.paciente || pacienteNombre}</h1>
            <div className="flex items-center gap-2 mt-1">
               <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded border border-emerald-100 uppercase tracking-tighter">Verificado</span>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID: {visitaId ? visitaId.slice(0, 8) : "---"}</span>
            </div>
          </div>
        </div>
        <div className="w-9 h-9 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm shrink-0">
           <Calendar className="w-5 h-5 text-slate-400" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {!loading && !visita && (
          <div className="bg-white rounded-[32px] p-10 text-center shadow-xl shadow-blue-900/5 border border-slate-50">
            <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">No hay visita activa</h2>
            <p className="text-sm font-medium text-slate-500 mb-6">No encontramos datos de tu visita. Es posible que haya concluido o no hayas iniciado el proceso.</p>
            <Link href="/recomendar">
              <button className="bg-blue-600 text-white font-bold py-3 px-6 rounded-xl text-sm transition-all active:scale-95">Crear Nueva Visita</button>
            </Link>
          </div>
        )}

        {loading && (
          <div className="py-24 text-center flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-black uppercase text-slate-300 tracking-[0.2em]">Cargando Tracking...</p>
          </div>
        )}

        {visita && (
          <div className="space-y-10">
            <AlertasPaciente alertas={visita.alertas_sucursal} />

            {/* DASHBOARD DE TIEMPO Y PROGRESO */}
            <section className="bg-slate-900 rounded-[48px] p-10 text-white overflow-hidden shadow-2xl shadow-blue-900/20 relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[120px] opacity-20 -mr-32 -mt-32" />
              
              <div className="relative grid md:grid-cols-2 gap-10 items-center text-left">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                     <Timer className="w-4 h-4 text-blue-400" />
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Tiempo de Estancia Restante</p>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-7xl font-black tracking-tighter tabular-nums">~{visita.tiempo_espera_total_min}</span>
                    <span className="text-2xl font-black text-slate-500 uppercase">Min</span>
                  </div>
                </div>

                <div className="bg-white/5 rounded-[32px] p-6 border border-white/10 backdrop-blur-md">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 text-center">Tu Ruta Crítica</p>
                   <div className="flex justify-center items-center gap-4">
                      {visita.estudios.map((e, i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${e.es_estado_final ? 'bg-emerald-500 border-emerald-500 text-white' : e.es_actual ? 'bg-blue-600 border-blue-600 text-white scale-110 shadow-lg' : 'bg-white/10 border-white/10 text-white/30'}`}>
                              {e.es_estado_final ? <Check className="w-5 h-5 stroke-[4px]" /> : <FlaskConical className="w-4 h-4" />}
                           </div>
                           {e.es_actual && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            </section>

            {/* LISTADO DE ESTUDIOS */}
            <div className="space-y-0 px-2 text-left pt-6">
              <div className="flex items-center justify-between mb-8 px-1">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Cronograma de Atención</h2>
                <div className="h-[1px] flex-1 bg-slate-100 ml-4"></div>
              </div>
              
              {visita.estudios.map((estudio, idx) => {
                if (estudio.es_estado_final) return <EstudioCompletado key={estudio.id_estudio} estudio={estudio} />
                if (estudio.es_actual) return <EstudioActual key={estudio.id_estudio} estudio={estudio} visitaId={visita.visita_id} />
                return (
                  <div key={estudio.id_estudio} className="relative pl-14 pb-8 group">
                    <div className="absolute left-4 top-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center z-10 border border-slate-200">
                      <FlaskConical className="w-4 h-4 text-slate-300" />
                    </div>
                    {idx !== visita.estudios.length -1 && <div className="absolute left-[31px] top-8 w-0.5 h-full bg-slate-100" />}
                    <div className="bg-white rounded-[24px] p-5 border border-slate-50 flex justify-between items-center opacity-40">
                        <h3 className="font-bold text-slate-400 uppercase text-xs tracking-tight">{estudio.nombre}</h3>
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">En espera</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <Footer />
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
