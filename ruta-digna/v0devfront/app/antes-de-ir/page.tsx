"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  FlaskConical, Activity, ScanLine, Info, ChevronDown, ChevronUp,
  ArrowRight, Lock, Unlock, Navigation, MapPin, GripVertical,
  Stethoscope, Eye, Heart, Zap, Bone, Camera as CameraIcon
} from "lucide-react"
import BottomNav from "@/components/BottomNav"
import Footer from "@/components/Footer"
import { getVisitaStatus, getEstudiosReordenables, type EstadoVisita } from "@/app/lib/api"

// Iconos por nombre de estudio
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

// ── StudyCard con instrucciones expandibles y guía ────────────────
interface StudyCardProps {
  step: number
  title: string
  icon: React.ReactNode
  badge: string
  badgeColor: "blue" | "gray" | "green"
  instructions: string | null
  isLocked: boolean
  guia?: {
    nombre_area: string
    ubicacion: string
    piso: number
    instrucciones: string
    referencia: string | null
  }
}

function StudyCard({ step, title, icon, badge, badgeColor, instructions, isLocked, guia }: StudyCardProps) {
  const [showInstructions, setShowInstructions] = useState(false)
  const [showGuia, setShowGuia] = useState(false)

  const badgeStyles = {
    blue: "bg-primary/10 text-primary",
    gray: "bg-slate-100 text-muted",
    green: "bg-success/10 text-success",
  }

  return (
    <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-medium text-muted">Paso {step}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeStyles[badgeColor]}`}>
              {badge}
            </span>
            {isLocked ? (
              <span className="flex items-center gap-0.5 text-xs text-muted" title="Orden obligatorio por reglas médicas">
                <Lock className="w-3 h-3" />
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-xs text-success" title="Puedes hacer este estudio en otro orden">
                <Unlock className="w-3 h-3" />
              </span>
            )}
          </div>
          <h3 className="font-semibold text-text">{title}</h3>
        </div>
      </div>

      {/* Instrucciones de preparación */}
      {instructions && (
        <>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="flex items-center gap-1 mt-3 text-sm text-primary font-medium"
          >
            {showInstructions ? "Ocultar instrucciones" : "Ver instrucciones"}
            {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showInstructions && (
            <div className="mt-3 p-3 bg-slate-50 rounded-[10px] text-sm text-text leading-relaxed">
              {instructions}
            </div>
          )}
        </>
      )}

      {/* Guía de navegación */}
      {guia && guia.instrucciones && guia.instrucciones !== 'Pregunta en recepción' && (
        <>
          <button
            onClick={() => setShowGuia(!showGuia)}
            className="flex items-center gap-1 mt-2 text-sm text-blue-600 font-medium"
          >
            <Navigation className="w-3.5 h-3.5" />
            {showGuia ? "Ocultar ubicación" : "¿Dónde queda?"}
            {showGuia ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showGuia && (
            <div className="mt-2 p-3 bg-blue-50 rounded-[10px] text-sm space-y-1">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="font-medium text-text">{guia.nombre_area} — {guia.ubicacion}</span>
              </div>
              {guia.piso > 1 && (
                <p className="text-xs text-muted pl-5">Piso {guia.piso}</p>
              )}
              <p className="text-text pl-5 leading-relaxed text-xs">{guia.instrucciones}</p>
              {guia.referencia && (
                <p className="text-muted pl-5 italic text-xs">Ref: {guia.referencia}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Categoría de estudios (agrupación libre vs bloqueada) ─────────
function CategoriaInfo({ bloqueados, libres }: { bloqueados: any[]; libres: any[] }) {
  const [showInfo, setShowInfo] = useState(false)

  if (bloqueados.length === 0 && libres.length === 0) return null

  return (
    <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] mb-4">
      <button
        onClick={() => setShowInfo(!showInfo)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-text">Orden de tus estudios</span>
        </div>
        {showInfo ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
      </button>

      {showInfo && (
        <div className="mt-3 space-y-3">
          {bloqueados.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted mb-1.5 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Orden fijo (reglas médicas)
              </p>
              <div className="space-y-1">
                {bloqueados.map((e: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-2 bg-slate-50 rounded-lg">
                    <Lock className="w-3 h-3 text-muted flex-shrink-0" />
                    <span className="text-text">{e.nombre}</span>
                    <span className="text-muted ml-auto">{e.motivo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {libres.length > 0 && (
            <div>
              <p className="text-xs font-medium text-success mb-1.5 flex items-center gap-1">
                <Unlock className="w-3 h-3" /> Orden flexible (tú eliges)
              </p>
              <div className="space-y-1">
                {libres.map((e: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-2 bg-green-50 rounded-lg">
                    <Unlock className="w-3 h-3 text-success flex-shrink-0" />
                    <span className="text-text">{e.nombre}</span>
                    <span className="text-success ml-auto">Puedes cambiar el orden</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted leading-relaxed">
            Los estudios con 🔒 tienen un orden obligatorio por reglas médicas de Salud Digna.
            Los estudios con 🔓 puedes hacerlos en el orden que prefieras, ya que no tienen dependencias entre ellos.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function AntesDeIr() {
  const [visita, setVisita] = useState<EstadoVisita | null>(null)
  const [reordenables, setReordenables] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visitaId, setVisitaId] = useState("")
  const [inputId, setInputId] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id') || '06b8efbf-67bc-426c-9523-3059d0dec059'
    setVisitaId(id)
    setInputId(id)
  }, [])

  const fetchData = useCallback(async () => {
    if (!visitaId) return
    try {
      const [statusData, reordData] = await Promise.all([
        getVisitaStatus(visitaId),
        getEstudiosReordenables(visitaId).catch(() => null),
      ])
      setVisita(statusData)
      setReordenables(reordData)
      setError(null)
    } catch {
      setError("No se pudo cargar la visita")
    } finally {
      setLoading(false)
    }
  }, [visitaId])

  useEffect(() => {
    if (!visitaId) return
    setLoading(true)
    fetchData()
  }, [visitaId, fetchData])

  const handleBuscar = () => {
    if (inputId.trim()) setVisitaId(inputId.trim())
  }

  return (
    <div className="min-h-screen bg-neutral pb-4">
      {/* Header */}
      <header className="bg-white px-4 py-5 shadow-sm">
        <h1 className="text-xl font-semibold text-primary">Ruta Digna</h1>
        <p className="text-sm text-muted mt-0.5">Tu camino en la clínica, paso a paso.</p>
      </header>

      <main className="px-4 py-5">
        {/* Input de visita si no hay datos */}
        {!visita && !loading && (
          <div className="bg-white rounded-[16px] p-4 shadow-sm mb-5">
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
            {/* Subtitle section */}
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-text">
                Tu visita es mañana — revisa cómo prepararte
              </h2>
              <p className="text-sm text-muted mt-1">
                Paciente: {visita.paciente} · {visita.sucursal}
              </p>
            </div>

            {/* Categorías reordenables */}
            {reordenables && (
              <CategoriaInfo
                bloqueados={reordenables.bloqueados || []}
                libres={reordenables.libres || []}
              />
            )}

            {/* Study cards */}
            <div className="space-y-4">
              {visita.estudios.map((estudio, idx) => {
                const Icon = getIconForEstudio(estudio.nombre)
                const isFirst = idx === 0
                const isLocked = reordenables
                  ? (reordenables.bloqueados || []).some((b: any) => b.id_estudio === estudio.id_estudio)
                  : true

                let badge = ""
                let badgeColor: "blue" | "gray" | "green" = "gray"
                if (isFirst) {
                  badge = "Primero en realizarse"
                  badgeColor = "blue"
                } else if (estudio.es_actual) {
                  badge = "En proceso"
                  badgeColor = "green"
                } else {
                  const prevName = visita.estudios[idx - 1]?.nombre
                  badge = prevName ? `Después de ${prevName.toLowerCase()}` : `Paso ${idx + 1}`
                }

                return (
                  <StudyCard
                    key={estudio.id_estudio}
                    step={estudio.orden}
                    title={estudio.nombre}
                    icon={<Icon className="w-5 h-5 text-primary" />}
                    badge={badge}
                    badgeColor={badgeColor}
                    instructions={estudio.preparacion}
                    isLocked={isLocked}
                    guia={estudio.guia}
                  />
                )
              })}
            </div>

            {/* Info note */}
            <div className="flex items-start gap-2 mt-6 p-3 bg-primary/5 rounded-[10px]">
              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted leading-relaxed">
                El orden fue calculado automáticamente según las reglas médicas de Salud Digna.
                Los estudios con 🔒 no se pueden reordenar. Los que tienen 🔓 puedes hacerlos en el orden que prefieras.
              </p>
            </div>

            {/* CTA */}
            <Link href="/recomendar">
              <button className="w-full mt-6 bg-primary text-white font-medium py-3.5 px-4 rounded-[10px] flex items-center justify-center gap-2 active:bg-primary/90 transition-colors">
                Ya estoy listo
                <ArrowRight className="w-4 h-4" />
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
