"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Check, Clock, MapPin, Sparkles } from "lucide-react"
import BottomNav from "@/components/BottomNav"
import Footer from "@/components/Footer"

const otherOptions = [
  { name: "Salud Digna Los Mochis", time: "34 min", distance: "8.1 km" },
  { name: "Salud Digna Mazatlán", time: "41 min", distance: "15.4 km" },
]

export default function Recomendar() {
  const [showOthers, setShowOthers] = useState(false)

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
            placeholder="Ej: necesito laboratorio y ultrasonido, estoy en el norte de la ciudad..."
          />
          <button className="w-full mt-3 bg-primary text-white font-medium py-3 px-4 rounded-[10px] active:bg-primary/90 transition-colors">
            Buscar clínica ideal
          </button>
        </div>

        {/* Processing chip */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="text-xs font-medium text-primary">Analizando con IA...</span>
          </div>
        </div>

        {/* Main result card */}
        <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] border-2 border-primary mb-4">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-xs font-medium px-2 py-1 bg-success/10 text-success rounded-full">
              Mejor opción para ti
            </span>
          </div>

          <h3 className="font-semibold text-text text-lg">Salud Digna Culiacán Centro</h3>
          <p className="text-sm text-muted mt-1">
            Av. Álvaro Obregón 1234, Culiacán, Sinaloa
          </p>

          {/* Metrics */}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded-full">
              <Clock className="w-3 h-3" /> 28 min espera
            </span>
            <span className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded-full">
              <MapPin className="w-3 h-3" /> 2.3 km
            </span>
            <span className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded-full">
              <Check className="w-3 h-3" /> 2 estudios disponibles
            </span>
          </div>

          {/* Available studies */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-success" />
              <span className="text-text">LABORATORIO disponible</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-success" />
              <span className="text-text">ULTRASONIDO disponible</span>
            </div>
          </div>

          {/* CTA */}
          <Link href="/tracking">
            <button className="w-full mt-4 bg-primary text-white font-medium py-3 px-4 rounded-[10px] flex items-center justify-center gap-2 active:bg-primary/90 transition-colors">
              Iniciar mi visita
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>

        {/* Other options accordion */}
        <div className="bg-white rounded-[16px] shadow-[0_2px_12px_rgba(0,0,0,0.08)] overflow-hidden">
          <button
            onClick={() => setShowOthers(!showOthers)}
            className="w-full p-4 flex items-center justify-between"
          >
            <span className="font-medium text-text">Otras opciones</span>
            {showOthers ? (
              <ChevronUp className="w-5 h-5 text-muted" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted" />
            )}
          </button>

          {showOthers && (
            <div className="px-4 pb-4 space-y-3">
              {otherOptions.map((option, idx) => (
                <div 
                  key={idx}
                  className="p-3 bg-slate-50 rounded-[10px] flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-text">{option.name}</span>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>{option.time}</span>
                    <span>·</span>
                    <span>{option.distance}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Score note */}
        <p className="text-xs text-muted text-center mt-5">
          Score calculado: tiempo de espera (60%) + distancia (40%)
        </p>

        <Footer />
      </main>

      <BottomNav />
    </div>
  )
}
