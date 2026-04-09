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
import { getVisitaStatus, getEstudiosReordenables, buscarPaciente, type EstadoVisita } from "@/app/lib/api"

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

// Ubicaciones de ejemplo por tipo de estudio (se usan cuando no hay guía en BD)
const GUIA_EJEMPLO: Record<string, { nombre_area: string; ubicacion: string; piso: number; instrucciones: string }> = {
  LABORATORIO: {
    nombre_area: "Laboratorio Clínico",
    ubicacion: "Planta baja, pasillo derecho al fondo",
    piso: 1,
    instrucciones: "Entra por la puerta principal, gira a la derecha y sigue el pasillo hasta ver el letrero azul de Laboratorio."
  },
  ULTRASONIDO: {
    nombre_area: "Gabinete de Ultrasonido",
    ubicacion: "Segundo piso, ala norte",
    piso: 2,
    instrucciones: "Sube las escaleras principales o usa el elevador, gira a la izquierda y busca las cabinas numeradas del 1 al 4."
  },
  "RAYOS X": {
    nombre_area: "Radiología e Imagen",
    ubicacion: "Planta baja, frente a recepción central",
    piso: 1,
    instrucciones: "Desde la entrada principal, cruza hacia el centro del edificio. El área de rayos X está identificada con un letrero rojo de advertencia de radión."
  },
  DENSITOMETRÍA: {
    nombre_area: "Densitometría Ósea",
    ubicacion: "Primer piso, ala sur",
    piso: 1,
    instrucciones: "Entra y gira a la izquierda. Sigue el pasillo sur hasta el consultorio 12. El equipo de densitometría es el de la cama que parece una plancha blanca."
  },
  MASTOGRAFÍA: {
    nombre_area: "Mastografía y Prevención Femenina",
    ubicacion: "Segundo piso, zona privada",
    piso: 2,
    instrucciones: "Accede por el elevador o escalera lateral. El área tiene entrada independiente marcada como 'Zona Femenina'. Toca el timbre si la puerta está cerrada."
  },
  PAPANICOLAOU: {
    nombre_area: "Ginecolgía Preventiva",
    ubicacion: "Segundo piso, consultorio 8",
    piso: 2,
    instrucciones: "Sube al segundo piso y busca el consultorio 8. Si hay cortina azul en la puerta, espera en los sillones del pasillo."
  },
  ELECTROCARDIOGRAMA: {
    nombre_area: "Cardiología Básica",
    ubicacion: "Planta baja, al fondo del pasillo central",
    piso: 1,
    instrucciones: "Desde recepción, toma el pasillo central. El cuarto del electro está al final, es pequeño con una camilla y cables. La puerta tiene un corazón dibujado."
  },
  TOMOGRAFÍA: {
    nombre_area: "Tomografía Computarizada",
    ubicacion: "Sótano, acceso por rampa lateral",
    piso: 0,
    instrucciones: "Baja por la rampa lateral izquierda del edificio (no uses el elevador principal). El área de tomografía tiene puertas dobles metálicas y letrero naranja."
  },
  "RESONANCIA MAGNÉTICA": {
    nombre_area: "Resonancia Magnética",
    ubicacion: "Sótano, junto a Tomografía",
    piso: 0,
    instrucciones: "Baja por la rampa lateral. La RM está a un lado de la tomografía, tras la puerta blindada. Deja objetos metálicos en el casillero antes de entrar."
  },
  NUTRICIÓN: {
    nombre_area: "Consulta de Nutrición",
    ubicacion: "Primer piso, consultorio 5",
    piso: 1,
    instrucciones: "Entra y sigue el pasillo principal. El consultorio 5 está a mitad del pasillo, tiene una balanza digital afuera como referencia."
  },
  "ÓPTICA": {
    nombre_area: "Centro Óptico",
    ubicacion: "Planta baja, local 2 junto a farmacia",
    piso: 1,
    instrucciones: "Desde la entrada entra hacia la derecha. El centro óptico comparte espacio con farmacia, busca el letrero verde con anteojos."
  },
  "EXAMEN DE LA VISTA": {
    nombre_area: "Optometría",
    ubicacion: "Planta baja, junto a Óptica",
    piso: 1,
    instrucciones: "Está contiguo al centro óptico. Entra y dile a la recepcionista que vienes para el examen de la vista, te asignarán la cabina de pruebas."
  },
}

function StudyCard({ title, icon, badge, badgeColor, instructions, isLocked, guia, isCompleted }: any) {
  const [showInstructions, setShowInstructions] = useState(false)
  const [showGuia, setShowGuia] = useState(false)

  const badgeStyles = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    gray: "bg-slate-50 text-slate-500 border-slate-100",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100",
  }

  // Estudio completado — visa verde, contenido opaco
  if (isCompleted) {
    return (
      <div className="bg-white rounded-[24px] p-5 border-2 border-emerald-100 opacity-70">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Check className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 uppercase tracking-wider">Completado</span>
            <h3 className="text-base font-black text-slate-500 leading-tight uppercase tracking-tight mt-1">{title}</h3>
          </div>
        </div>
      </div>
    )
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
  const [pacienteNombre, setPacienteNombre] = useState("Paciente")

  useEffect(() => {
    const resolveVisitaId = async () => {
      const params = new URLSearchParams(window.location.search)
      let id = params.get("id")

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

  const fetchData = useCallback(async () => {
    if (!visitaId) return
    try {
      const [statusData, reordData] = await Promise.all([
        getVisitaStatus(visitaId),
        getEstudiosReordenables(visitaId).catch(() => null),
      ])
      setVisita(statusData); setReordenables(reordData)
    } catch (e) {
      console.error("Error fetching data", e)
    } finally { 
      setLoading(false) 
    }
  }, [visitaId])

  useEffect(() => {
    if (!visitaId) return
    setLoading(true); fetchData()
  }, [visitaId, fetchData])

  return (
    <div className="min-h-screen bg-[#F9FBFF] pb-24">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div className="text-left select-none">
            <h1 className="text-xl font-black bg-gradient-to-br from-blue-600 to-emerald-500 bg-clip-text text-transparent tracking-tight">
              Antes de Ir
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">Mi Preparación</p>
          </div>
        </div>
        <Sparkles className="w-5 h-5 text-blue-500/30" />
      </header>

      <main className="px-6 py-8 space-y-6 max-w-2xl mx-auto pb-10">
        {!loading && !visita && (
          <div className="bg-white rounded-[32px] p-10 text-center shadow-xl shadow-blue-900/5 border border-slate-50">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">No hay visita activa</h2>
            <p className="text-sm font-medium text-slate-500 mb-6">Parece que no tienes ninguna visita en curso. Regresa a inicio para crear una nueva.</p>
            <Link href="/recomendar">
              <button className="bg-blue-600 text-white font-bold py-3 px-6 rounded-xl text-sm transition-all active:scale-95">Ir a Crear Visita</button>
            </Link>
          </div>
        )}

        {visita && (
          <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-blue-900/5 border border-slate-50 animate-in slide-in-from-bottom-4">
             <div className="flex items-center gap-4 mb-4 text-left">
                <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
                   <Check className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente</p>
                   <p className="text-lg font-black text-slate-800 leading-none">{visita?.paciente || pacienteNombre}</p>
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
                const isCompleted = estudio.es_estado_final
                const isFirst = idx === 0 && !isCompleted
                const isLocked = reordenables?.bloqueados?.some((b: any) => b.id_estudio === estudio.id_estudio)

                // Estudios completados no tienen badge de paso
                let badge = `Paso ${idx + 1}`
                let badgeColor: "blue" | "gray" | "green" = "gray"
                if (isFirst) { badge = "Iniciar aquí"; badgeColor = "blue" }

                // GUIA_EJEMPLO tiene prioridad sobre el dato de BD (que suele traer "Pregunta en recepción")
                const guiaFinal = GUIA_EJEMPLO[estudio.nombre] ?? (estudio.guia?.instrucciones && !estudio.guia.instrucciones.toLowerCase().includes('recepci') ? estudio.guia : null)

                return (
                  <StudyCard
                    key={estudio.id_estudio}
                    title={estudio.nombre}
                    icon={<IconComp className="w-6 h-6" />}
                    badge={badge}
                    badgeColor={badgeColor}
                    instructions={estudio.preparacion}
                    isLocked={isLocked}
                    guia={guiaFinal}
                    isCompleted={isCompleted}
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
            <Link href={visitaId ? `/tracking?id=${visitaId}` : "/tracking"}>
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
