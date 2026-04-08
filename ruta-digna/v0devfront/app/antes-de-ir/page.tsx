"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  FlaskConical, Activity, ScanLine, Info, ChevronDown, ChevronUp,
  ArrowRight, Lock, Unlock, Navigation, MapPin,  
  Stethoscope, Eye, Heart, Zap, Bone, Camera as CameraIcon,
  CalendarCheck, AlertCircle, Sparkles, Check
} from "lucide-react"
import BottomNav from "@/components/BottomNav"
import Footer from "@/components/Footer"
import { getVisitaStatus, getEstudiosReordenables, type EstadoVisita } from "@/app/lib/api"

const ESTUDIO_ICONS: Record<string, any> = {
  LABORATORIO: FlaskConical,
  ULTRASONIDO: Activity,
  'RAYOS X': ScanLine,
  'DENSITOMETRÍA': Bone,
  'MASTOGRAFÍA': CameraIcon,
  'PAPANICOLAOU': Heart,
  'ELECTROCARDIOGRAMA': Zap,
  'TOMOGRAFÍA': ScanLine,
  'RESONANCIA MAGNÉTICA': ScanLine,
  'NUTRICIÓN': Stethoscope,
  'ÓPTICA': Eye,
  'EXAMEN DE LA VISTA': Eye,
}

function getIconForEstudio(nombre: string) {
  return ESTUDIO_ICONS[nombre] || Activity
}

function StudyCard({ title, icon, badge, badgeColor, instructions, isLocked, guia }: any) {
  const [showInstructions, setShowInstructions] = useState(false)
  const [showGuia, setShowGuia] = useState(false)

  const badgeStyles = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    gray: "bg-slate-50 text-slate-500 border-slate-100",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100",
  }

  return (
    <div className={`bg-white rounded-[24px] p-6 shadow-sm border-2 transition-all ${isLocked ? 'border-transparent' : 'border-emerald-50'}`}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${isLocked ? 'bg-slate-50 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider ${badgeStyles[badgeColor as keyof typeof badgeStyles]}`}>
              {badge}
            </span>
            {isLocked ? (
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase">
                <Lock className="w-3 h-3" /> FIJO
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase">
                <Unlock className="w-3 h-3" /> FLEXIBLE
              </div>
            )}
          </div>
          <h3 className="text-lg font-black text-slate-800 leading-tight uppercase tracking-tight">{title}</h3>
        </div>
      </div>

      <div className="flex gap-4 mt-5">
        {instructions && (
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest transition-colors ${showInstructions ? 'text-blue-600' : 'text-slate-400'}`}
          >
            <Info className="w-3.5 h-3.5" />
            {showInstructions ? "Ocultar" : "Instrucciones"}
          </button>
        )}
        {guia && guia.instrucciones && (
          <button
            onClick={() => setShowGuia(!showGuia)}
            className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest transition-colors ${showGuia ? 'text-blue-600' : 'text-slate-400'}`}
          >
            <Navigation className="w-3.5 h-3.5" />
            {showGuia ? "Cerrar Mapa" : "¿Dónde está?"}
          </button>
        )}
      </div>

      {showInstructions && (
        <div className="mt-4 p-4 bg-slate-50 rounded-2xl text-sm text-slate-600 leading-relaxed animate-in slide-in-from-top-2 text-left">
          <p className="font-bold text-[10px] uppercase text-slate-400 mb-1 tracking-tighter">Preparación necesaria:</p>
          {instructions}
        </div>
      )}

      {showGuia && (
        <div className="mt-4 p-4 bg-blue-50/50 rounded-2xl text-sm animate-in slide-in-from-top-2 border border-blue-100/50 text-left">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span className="font-black text-xs text-slate-800 uppercase tracking-tight">{guia.nombre_area}</span>
          </div>
          <p className="text-xs text-slate-600 pl-6 leading-relaxed">
            {guia.ubicacion} {guia.piso > 1 && `· Piso ${guia.piso}`}. {guia.instrucciones}
          </p>
        </div>
      )}
    </div>
  )
}

export default function AntesDeIr() {
  const [visita, setVisita] = useState<EstadoVisita | null>(null)
  const [reordenables, setReordenables] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [visitaId, setVisitaId] = useState("")
  const [inputId, setInputId] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id') || '06b8efbf-67bc-426c-9523-3059d0dec059'
    setVisitaId(id); setInputId(id)
  }, [])

  const fetchData = useCallback(async () => {
    if (!visitaId) return
    try {
      const [statusData, reordData] = await Promise.all([
        getVisitaStatus(visitaId),
        getEstudiosReordenables(visitaId).catch(() => null),
      ])
      setVisita(statusData); setReordenables(reordData)
    } catch { /* Error handle */ } finally { setLoading(false) }
  }, [visitaId])

  useEffect(() => {
    if (!visitaId) return
    setLoading(true); fetchData()
  }, [visitaId, fetchData])

  return (
    <div className="min-h-screen bg-[#F9FBFF] pb-24">
      <header className="bg-gradient-to-r from-blue-700 to-blue-500 px-6 pt-12 pb-20 rounded-b-[40px] shadow-lg relative overflow-hidden text-left">
        <div className="absolute top-0 right-0 p-10 opacity-10">
          <CalendarCheck className="w-32 h-32 text-white" />
        </div>
        <div className="relative flex justify-between items-start">
           <div>
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Mi Preparación</h1>
              <p className="text-blue-100 text-sm font-bold mt-1 uppercase tracking-widest opacity-80">Ruta Digna IA</p>
           </div>
           <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30">
              <Sparkles className="w-6 h-6 text-white" />
           </div>
        </div>
      </header>

      <main className="px-6 -mt-12 space-y-6 max-w-2xl mx-auto pb-10">
        {visita && (
          <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-blue-900/5 border border-slate-50 animate-in slide-in-from-bottom-4">
             <div className="flex items-center gap-4 mb-4 text-left">
                <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
                   <Check className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente</p>
                   <p className="text-lg font-black text-slate-800 leading-none">{visita.paciente}</p>
                </div>
             </div>
             <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl">
                <MapPin className="w-4 h-4 text-blue-500" />
                <p className="text-xs font-bold text-slate-600">Salud Digna {visita.sucursal}</p>
             </div>
          </div>
        )}

        {loading && (
          <div className="py-24 text-center flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-black uppercase text-slate-300 tracking-[0.2em]">Cargando Instrucciones...</p>
          </div>
        )}

        {visita && (
          <>
            <div className="bg-blue-600 rounded-[24px] p-6 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden group text-left">
               <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                     <Info className="w-4 h-4 text-blue-200" />
                     <p className="text-[10px] font-black uppercase tracking-widest">Optimización Médica</p>
                  </div>
                  <p className="text-sm font-bold leading-tight">
                    Hemos ordenado tus estudios para que tu estancia sea lo más corta posible.
                  </p>
               </div>
               <Activity className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-10 group-hover:scale-110 transition-transform" />
            </div>

            <div className="space-y-4">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-2 text-left">Pasos sugeridos</h2>
              {visita.estudios.map((estudio, idx) => {
                const IconComp = getIconForEstudio(estudio.nombre)
                const isFirst = idx === 0
                const isLocked = reordenables?.bloqueados?.some((b: any) => b.id_estudio === estudio.id_estudio)

                let badge = `Paso ${idx + 1}`
                let badgeColor: "blue" | "gray" | "green" = "gray"
                if (isFirst) { badge = "Iniciar aquí"; badgeColor = "blue" }

                return (
                  <StudyCard
                    key={estudio.id_estudio}
                    title={estudio.nombre}
                    icon={<IconComp className="w-6 h-6" />}
                    badge={badge}
                    badgeColor={badgeColor}
                    instructions={estudio.preparacion}
                    isLocked={isLocked}
                    guia={estudio.guia}
                  />
                )
              })}
            </div>

            <div className="flex items-start gap-4 p-5 bg-amber-50 rounded-[24px] border border-amber-100 text-left mb-6">
               <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
               <p className="text-[11px] font-medium text-amber-800 leading-relaxed">
                 <span className="font-black uppercase tracking-tighter block mb-1">Aviso Importante</span>
                 Si no sigues las instrucciones de preparación, es posible que no podamos realizar algunos estudios hoy.
               </p>
            </div>

            {/* BOTÓN AL FINAL DEL CONTENIDO (Ya no flota) */}
            <Link href="/tracking">
              <button className="w-full bg-slate-900 hover:bg-black text-white font-black py-6 rounded-[28px] shadow-xl flex items-center justify-center gap-4 transition-all active:scale-95 group uppercase text-xs tracking-[0.2em]">
                ¡Todo listo, ir al Tracking!
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform text-blue-400" />
              </button>
            </Link>

            <Footer />
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
