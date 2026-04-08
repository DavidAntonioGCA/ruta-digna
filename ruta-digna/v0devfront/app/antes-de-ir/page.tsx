"use client"

import { useState } from "react"
import Link from "next/link"
import { FlaskConical, Activity, Info, ChevronDown, ChevronUp, ArrowRight } from "lucide-react"
import BottomNav from "@/components/BottomNav"
import Footer from "@/components/Footer"

interface StudyCardProps {
  step: number
  title: string
  icon: React.ReactNode
  badge: string
  badgeColor: "blue" | "gray"
  instructions: string
}

function StudyCard({ step, title, icon, badge, badgeColor, instructions }: StudyCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted">Paso {step}</span>
            <span 
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                badgeColor === "blue" 
                  ? "bg-primary/10 text-primary" 
                  : "bg-slate-100 text-muted"
              }`}
            >
              {badge}
            </span>
          </div>
          <h3 className="font-semibold text-text">{title}</h3>
        </div>
      </div>
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 mt-3 text-sm text-primary font-medium"
      >
        {isOpen ? "Ocultar instrucciones" : "Ver instrucciones"}
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {isOpen && (
        <div className="mt-3 p-3 bg-slate-50 rounded-[10px] text-sm text-text leading-relaxed">
          {instructions}
        </div>
      )}
    </div>
  )
}

export default function AntesDeIr() {
  return (
    <div className="min-h-screen bg-neutral pb-4">
      {/* Header */}
      <header className="bg-white px-4 py-5 shadow-sm">
        <h1 className="text-xl font-semibold text-primary">Ruta Digna</h1>
        <p className="text-sm text-muted mt-0.5">Tu camino en la clínica, paso a paso.</p>
      </header>

      <main className="px-4 py-5">
        {/* Subtitle section */}
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-text">
            Tu visita es mañana — revisa cómo prepararte
          </h2>
          <p className="text-sm text-muted mt-1">Paciente: María González</p>
        </div>

        {/* Study cards */}
        <div className="space-y-4">
          <StudyCard
            step={1}
            title="LABORATORIO"
            icon={<FlaskConical className="w-5 h-5 text-primary" />}
            badge="Primero en realizarse"
            badgeColor="blue"
            instructions="Ayuno mínimo de 8 horas antes de tu cita. No consumas medicamentos sin consultar. Bebe agua si es necesario."
          />

          <StudyCard
            step={2}
            title="ULTRASONIDO"
            icon={<Activity className="w-5 h-5 text-primary" />}
            badge="Después del laboratorio"
            badgeColor="gray"
            instructions="Para ultrasonido abdominal: ayuno de 4-6 horas y vejiga llena (tomar 1 litro de agua 1 hora antes sin orinar)."
          />
        </div>

        {/* Info note */}
        <div className="flex items-start gap-2 mt-6 p-3 bg-primary/5 rounded-[10px]">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted leading-relaxed">
            El orden fue calculado automáticamente según las reglas médicas de Salud Digna
          </p>
        </div>

        {/* CTA Button */}
        <Link href="/recomendar">
          <button className="w-full mt-6 bg-primary text-white font-medium py-3.5 px-4 rounded-[10px] flex items-center justify-center gap-2 active:bg-primary/90 transition-colors">
            Ya estoy listo
            <ArrowRight className="w-4 h-4" />
          </button>
        </Link>

        <Footer />
      </main>

      <BottomNav />
    </div>
  )
}
