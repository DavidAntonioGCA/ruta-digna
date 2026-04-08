"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Camera, Lock, Sparkles } from "lucide-react"
import BottomNav from "@/components/BottomNav"
import Footer from "@/components/Footer"

export default function Resultados() {
  const [activeTab, setActiveTab] = useState<"foto" | "texto">("foto")

  return (
    <div className="min-h-screen bg-neutral pb-4">
      {/* Header */}
      <header className="bg-white px-4 py-4 shadow-sm flex items-center gap-3">
        <Link href="/tracking">
          <ArrowLeft className="w-5 h-5 text-text" />
        </Link>
        <h1 className="text-lg font-semibold text-text">Mis resultados</h1>
      </header>

      <main className="px-4 py-5">
        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setActiveTab("foto")}
            className={`flex-1 py-2.5 px-4 rounded-[10px] text-sm font-medium transition-colors ${
              activeTab === "foto"
                ? "bg-primary text-white"
                : "bg-white text-muted"
            }`}
          >
            Foto
          </button>
          <button
            onClick={() => setActiveTab("texto")}
            className={`flex-1 py-2.5 px-4 rounded-[10px] text-sm font-medium transition-colors ${
              activeTab === "texto"
                ? "bg-primary text-white"
                : "bg-white text-muted"
            }`}
          >
            Texto
          </button>
        </div>

        {activeTab === "foto" ? (
          <>
            {/* Upload zone */}
            <div className="border-2 border-dashed border-primary/40 bg-[#EFF6FF] rounded-[16px] p-6 text-center mb-5">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-medium text-text mb-1">Toma foto de tus resultados</h3>
              <p className="text-xs text-muted mb-4">JPG o PNG · máx 5 MB</p>
              <button className="px-4 py-2 border border-primary text-primary text-sm font-medium rounded-[10px] active:bg-primary/5 transition-colors">
                Seleccionar imagen
              </button>
            </div>

            {/* Example analyzed result */}
            <div className="bg-[#F0FDF4] border border-success/30 rounded-[16px] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-success" />
                <span className="text-sm font-semibold text-success">Análisis de Ruta Digna</span>
                <span className="text-xs text-muted ml-auto">hace 2 min</span>
              </div>
              
              <div className="text-sm text-text leading-relaxed space-y-3">
                <p>
                  Tus resultados de <strong>glucosa</strong> muestran un valor de <strong>94 mg/dL</strong>, 
                  que está dentro del rango normal (70–100 mg/dL en ayuno). ✓
                </p>
                <p>
                  Tu <strong>hemoglobina</strong> es de 13.8 g/dL, también dentro de parámetros 
                  normales para mujeres adultas. ✓
                </p>
                <p>
                  No se detectaron valores de alerta. Te recomiendo compartir estos 
                  resultados con tu médico en tu próxima consulta.
                </p>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-success/20">
                <Lock className="w-3.5 h-3.5 text-muted" />
                <p className="text-xs text-muted">
                  Tu imagen no fue almacenada. Procesada en memoria y descartada.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Text input */}
            <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
              <textarea
                className="w-full p-3 rounded-[10px] border border-slate-200 text-sm resize-none bg-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[200px]"
                placeholder="Pega aquí el texto de tus resultados..."
              />
              <button className="w-full mt-4 bg-primary text-white font-medium py-3 px-4 rounded-[10px] active:bg-primary/90 transition-colors">
                Explicar resultados
              </button>
            </div>
          </>
        )}

        <Footer />
      </main>

      <BottomNav />
    </div>
  )
}
