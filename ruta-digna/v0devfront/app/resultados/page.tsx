"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import {  
  ArrowLeft, Camera, Lock, Sparkles, FileText,  
  Upload, Image as ImageIcon, CheckCircle2, AlertCircle, RefreshCw, Printer
} from "lucide-react"
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
    const previewUrl = URL.createObjectURL(file)
    setImagenPreview(previewUrl)
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

  // MÉTODO NATIVO: Más seguro y sin errores de librería
  const imprimirReporte = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-900 selection:bg-blue-100">
      {/* Header - Se oculta al imprimir */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/tracking" className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-all active:scale-90">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <h1 className="text-xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent select-none tracking-tighter uppercase">
            Análisis de Resultados
          </h1>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
           <Lock className="w-3 h-3 text-blue-600" />
           <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Seguro</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        
        {/* Tabs - Se ocultan al imprimir */}
        <div className="bg-slate-100 p-1.5 rounded-[24px] flex gap-1 shadow-inner border border-slate-200 print:hidden">
          <button
            onClick={() => setActiveTab("foto")}
            className={`flex-1 py-3.5 px-4 rounded-[20px] text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              activeTab === "foto" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Camera className="w-4 h-4" /> Foto
          </button>
          <button
            onClick={() => setActiveTab("texto")}
            className={`flex-1 py-3.5 px-4 rounded-[20px] text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              activeTab === "texto" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileText className="w-4 h-4" /> Texto
          </button>
        </div>

        {/* Sección de Input - Se oculta al imprimir */}
        <section className="animate-in fade-in zoom-in-95 duration-500 print:hidden">
          {activeTab === "foto" ? (
            <div className="space-y-6">
              <input type="file" ref={fileInputRef} onChange={handleImagenSelect} accept="image/*" className="hidden" />
              {!imagenPreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group border-2 border-dashed border-slate-200 bg-white hover:bg-blue-50/50 hover:border-blue-400/50 rounded-[40px] p-12 text-center transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className="w-20 h-20 mx-auto mb-6 rounded-[28px] bg-blue-50 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-100 transition-all duration-500 shadow-sm">
                    <Upload className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight text-center">Cargar Estudios</h3>
                  <p className="text-xs text-slate-400 font-bold px-8 leading-relaxed mb-8 uppercase tracking-tight text-center">Captura tu reporte para interpretación IA</p>
                  <div className="flex justify-center">
                    <div className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white text-[11px] font-black rounded-[20px] shadow-xl shadow-blue-500/30 active:scale-95 uppercase tracking-[0.2em]">
                      <ImageIcon className="w-4 h-4" /> Seleccionar Archivo
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative group rounded-[40px] overflow-hidden border-8 border-white shadow-2xl shadow-slate-300 aspect-[4/3] max-w-sm mx-auto">
                    <img src={imagenPreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm">
                       <button onClick={() => fileInputRef.current?.click()} className="bg-white p-5 rounded-full text-slate-900 shadow-2xl active:scale-90 transition-transform">
                         <RefreshCw className="w-8 h-8" />
                       </button>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-5 text-[10px] font-black bg-slate-100 text-slate-500 rounded-[22px] hover:bg-slate-200 transition-all uppercase tracking-widest">Cambiar</button>
                    <button onClick={handleExplicar} disabled={loading} className="flex-[2] py-5 bg-blue-600 text-white rounded-[22px] font-black text-[11px] shadow-2xl transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-[0.2em] flex items-center justify-center gap-3">
                      {loading ? <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      Analizar con IA
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 space-y-6">
              <textarea
                className="w-full p-6 rounded-[24px] border-2 border-slate-100 bg-slate-50/50 text-sm resize-none transition-all duration-300 focus:bg-white focus:border-blue-400/30 focus:ring-8 focus:ring-blue-50 outline-none placeholder:text-slate-400 min-h-[300px] font-medium"
                value={textoResultados}
                onChange={e => setTextoResultados(e.target.value)}
                placeholder="Pega aquí el contenido de tus estudios..."
              />
              <button
                onClick={handleExplicar}
                disabled={loading || !textoResultados.trim()}
                className="w-full bg-blue-600 text-white font-black py-5 rounded-[22px] shadow-2xl active:scale-[0.98] disabled:opacity-50 uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3"
              >
                {loading ? <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-5 h-5" />}
                Interpretar Texto
              </button>
            </div>
          )}
        </section>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-[24px] p-6 flex gap-4 print:hidden">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
            <p className="text-sm text-red-800 font-black leading-tight text-left">{error}</p>
          </div>
        )}

        {/* RESULTADO (Master Card) */}
        {respuesta && (
          <div className="relative animate-in slide-in-from-bottom-12 duration-1000 group">
            <div className="absolute -top-4 left-10 z-10 bg-indigo-600 text-white text-[10px] font-black px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 border-2 border-white uppercase tracking-widest print:hidden">
              <CheckCircle2 className="w-4 h-4 text-white" /> Interpretación Lista
            </div>
            
            {/* Contenedor del Reporte */}
            <div className="bg-white rounded-[48px] p-10 md:p-14 shadow-[0_40px_80px_rgba(0,0,0,0.08)] border-2 border-indigo-50 relative overflow-hidden transition-all group-hover:shadow-[0_40px_100px_rgba(0,0,0,0.12)] print:shadow-none print:border-none print:p-0">
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-full blur-[100px] -mr-24 -mt-24 print:hidden" />
              <div className="relative">
                <div className="flex items-center gap-4 mb-10 text-left">
                  <div className="w-14 h-14 rounded-3xl bg-indigo-50 flex items-center justify-center shadow-inner print:hidden">
                    <Sparkles className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">Reporte Médico IA</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">V2.4 MEDICAL ENGINE</p>
                  </div>
                </div>
                <div className="text-slate-700 text-sm leading-[2.2] whitespace-pre-wrap font-medium text-left">
                  {respuesta}
                </div>
                <div className="mt-12 pt-8 border-t border-slate-100 flex items-start gap-4">
                  <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 shrink-0 print:hidden">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="text-left opacity-60">
                    <p className="text-[11px] text-slate-500 font-black leading-relaxed uppercase tracking-widest">Aviso Legal</p>
                    <p className="text-[10px] text-slate-400 leading-normal mt-1 font-bold">Documento generado para fines informativos por Ruta Digna.</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Botón de Impresión / Guardar PDF Nativo */}
            <button 
              onClick={imprimirReporte}
              className="w-full mt-8 py-6 bg-slate-950 text-white font-black rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-center gap-4 active:scale-95 transition-all text-xs uppercase tracking-[0.3em] group print:hidden"
            >
              <Printer className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Imprimir o Guardar Reporte
            </button>
          </div>
        )}
        <Footer />
      </main>
      <BottomNav />
    </div>
  )
}
