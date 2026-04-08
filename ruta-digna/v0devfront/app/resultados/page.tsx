"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, Camera, Lock, Sparkles, Upload, FileText } from "lucide-react"
import BottomNav from "@/components/BottomNav"
import Footer from "@/components/Footer"
import { explicarResultados } from "@/app/lib/api"

export default function Resultados() {
  const [activeTab, setActiveTab] = useState<"foto" | "texto">("foto")
  const [textoResultados, setTextoResultados] = useState("")
  const [imagenPreview, setImagenPreview] = useState<string | null>(null)
  const [imagenBase64, setImagenBase64] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<string>("image/jpeg")
  const [loading, setLoading] = useState(false)
  const [respuesta, setRespuesta] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImagenSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setMediaType(file.type || "image/jpeg")

    // Preview
    const previewUrl = URL.createObjectURL(file)
    setImagenPreview(previewUrl)

    // Base64
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1]
      setImagenBase64(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleExplicar = async () => {
    setLoading(true)
    setError(null)
    setRespuesta(null)

    try {
      let data: any = {}
      if (activeTab === "foto" && imagenBase64) {
        data = { imagen_base64: imagenBase64, media_type: mediaType }
      } else if (activeTab === "texto" && textoResultados.trim()) {
        data = { resultados: textoResultados.trim() }
      } else {
        setError("Sube una imagen o escribe tus resultados")
        setLoading(false)
        return
      }

      const response = await explicarResultados(data)
      setRespuesta(response.reply)
    } catch (err) {
      setError("No pudimos procesar tus resultados. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral pb-4">
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
            className={`flex-1 py-2.5 px-4 rounded-[10px] text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === "foto" ? "bg-primary text-white" : "bg-white text-muted"
            }`}
          >
            <Camera className="w-4 h-4" /> Foto
          </button>
          <button
            onClick={() => setActiveTab("texto")}
            className={`flex-1 py-2.5 px-4 rounded-[10px] text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === "texto" ? "bg-primary text-white" : "bg-white text-muted"
            }`}
          >
            <FileText className="w-4 h-4" /> Texto
          </button>
        </div>

        {activeTab === "foto" ? (
          <>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImagenSelect}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />

            {!imagenPreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-primary/40 bg-[#EFF6FF] rounded-[16px] p-6 text-center mb-5 cursor-pointer active:bg-primary/5"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-medium text-text mb-1">Toma foto de tus resultados</h3>
                <p className="text-xs text-muted mb-4">JPG, PNG o WebP · máx 5 MB</p>
                <span className="px-4 py-2 border border-primary text-primary text-sm font-medium rounded-[10px]">
                  Seleccionar imagen
                </span>
              </div>
            ) : (
              <div className="mb-5">
                <div className="rounded-[16px] overflow-hidden border border-slate-200 mb-3">
                  <img src={imagenPreview} alt="Resultados" className="w-full" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 text-sm border border-slate-200 rounded-[10px] text-muted"
                  >
                    Cambiar imagen
                  </button>
                  <button
                    onClick={handleExplicar}
                    disabled={loading}
                    className="flex-1 py-2 text-sm bg-primary text-white rounded-[10px] font-medium disabled:opacity-50"
                  >
                    {loading ? "Analizando..." : "Explicar resultados"}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] mb-5">
            <textarea
              className="w-full p-3 rounded-[10px] border border-slate-200 text-sm resize-none bg-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[200px]"
              value={textoResultados}
              onChange={e => setTextoResultados(e.target.value)}
              placeholder="Pega aquí el texto de tus resultados..."
            />
            <button
              onClick={handleExplicar}
              disabled={loading || !textoResultados.trim()}
              className="w-full mt-4 bg-primary text-white font-medium py-3 px-4 rounded-[10px] active:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Analizando..." : "Explicar resultados"}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-sm text-primary font-medium">Analizando tus resultados con IA...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-[16px] p-4 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Resultado del análisis */}
        {respuesta && (
          <div className="bg-[#F0FDF4] border border-success/30 rounded-[16px] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-success" />
              <span className="text-sm font-semibold text-success">Análisis de Ruta Digna</span>
            </div>

            <div className="text-sm text-text leading-relaxed whitespace-pre-wrap">
              {respuesta}
            </div>

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-success/20">
              <Lock className="w-3.5 h-3.5 text-muted" />
              <p className="text-xs text-muted">
                {activeTab === "foto"
                  ? "Tu imagen no fue almacenada. Procesada en memoria y descartada."
                  : "El texto no fue almacenado. Procesado en memoria y descartado."}
              </p>
            </div>
          </div>
        )}

        <Footer />
      </main>

      <BottomNav />
    </div>
  )
}
