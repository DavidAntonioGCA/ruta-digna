"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import {
  ArrowLeft, Camera, Lock, Sparkles, FileText,
  Upload, Image as ImageIcon, CheckCircle2, AlertCircle, RefreshCw, Printer,
  Download, Loader2, Send, MessageCircle, X
} from "lucide-react"
import BottomNav from "@/components/BottomNav"
import Footer from "@/components/Footer"
import { chatResultado, explicarResultados, getResultadosVisita, type ResultadoEstudio } from "@/app/lib/api"

// ── Helpers ────────────────────────────────────────────────────────────────
function getVisitaId(): string | null {
  if (typeof window === "undefined") return null
  try {
    const session = JSON.parse(localStorage.getItem("ruta_session") || "null")
    return session?.visita_id ?? null
  } catch { return null }
}

// ── ResultCard: tarjeta aislada con su propio chat ─────────────────────────
type Msg = { role: "user" | "ai"; text: string }

function ResultCard({ r, visitaId }: { r: ResultadoEstudio; visitaId: string }) {
  const [chatOpen, setChatOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  // Archivo cargado (base64 + tipo) para enviarlo a la IA
  const [archivoB64, setArchivoB64] = useState<string | undefined>(undefined)
  const [archivoMime, setArchivoMime] = useState<string | undefined>(undefined)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollBottom = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80)

  // Descarga el archivo del storage y lo convierte a base64
  const cargarArchivo = async (): Promise<{ b64: string; mime: string } | null> => {
    try {
      const resp = await fetch(r.url_archivo)
      if (!resp.ok) return null
      const blob = await resp.blob()
      const mime = blob.type || "application/octet-stream"
      const b64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onloadend = () => res((reader.result as string).split(",")[1])
        reader.onerror = rej
        reader.readAsDataURL(blob)
      })
      return { b64, mime }
    } catch { return null }
  }

  // Abre el chat y lanza la llamada inicial con el contexto del resultado
  const handleOpen = async () => {
    setChatOpen(true)
    if (msgs.length > 0) return
    const contexto = `Nombre del archivo: "${r.nombre_archivo}"${r.tipo_estudio ? ` | Tipo de estudio: ${r.tipo_estudio}` : ""}${r.subido_por ? ` | Subido por: ${r.subido_por}` : ""} | Fecha: ${new Date(r.created_at).toLocaleDateString("es-MX")}`
    const preguntaInicial = `Tengo este resultado y quiero entenderlo. Por favor léelo y explícame qué dice en términos sencillos.`
    setLoading(true)
    try {
      // Intentar cargar el archivo para que la IA lo lea directamente
      let b64 = archivoB64
      let mime = archivoMime
      if (!b64) {
        const archivo = await cargarArchivo()
        if (archivo) {
          b64 = archivo.b64
          mime = archivo.mime
          setArchivoB64(b64)
          setArchivoMime(mime)
        }
      }
      const res = await chatResultado(contexto, preguntaInicial, [], b64, mime)
      setMsgs([{ role: "ai", text: res.reply }])
    } catch {
      setMsgs([{ role: "ai", text: "Hola, estoy aquí para ayudarte con tus dudas sobre este resultado. ¿Qué te gustaría saber?" }])
    } finally {
      setLoading(false)
      scrollBottom()
    }
  }

  const handleClose = () => setChatOpen(false)

  const handleSend = async () => {
    const txt = input.trim()
    if (!txt || loading) return
    const contexto = `Nombre del archivo: "${r.nombre_archivo}"${r.tipo_estudio ? ` | Tipo: ${r.tipo_estudio}` : ""} | Fecha: ${new Date(r.created_at).toLocaleDateString("es-MX")}`
    const historial = msgs.map(m => ({
      role: m.role === "ai" ? "assistant" : "user",
      content: m.text,
    }))
    setInput("")
    setMsgs(prev => [...prev, { role: "user", text: txt }])
    setLoading(true)
    scrollBottom()
    try {
      // Solo se envía el archivo en el primer turno (ya está en el historial de Claude)
      const res = await chatResultado(contexto, txt, historial)
      setMsgs(prev => [...prev, { role: "ai", text: res.reply }])
    } catch {
      setMsgs(prev => [...prev, { role: "ai", text: "Error de conexión, intenta de nuevo." }])
    } finally {
      setLoading(false)
      scrollBottom()
    }
  }

  const descargar = () => {
    const lineas = msgs.map(m => `${m.role === "ai" ? "IA" : "Tú"}: ${m.text}`).join("\n\n")
    const contenido = `CONVERSACIÓN CON IA — Ruta Digna\n${"=".repeat(50)}\nArchivo: ${r.nombre_archivo}\nFecha: ${new Date().toLocaleString("es-MX")}\n${"=".repeat(50)}\n\n${lineas}\n\n${"=".repeat(50)}\nSólo informativo. No reemplaza la opinión médica.`
    const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Chat-IA-${r.nombre_archivo.replace(/\.[^.]+$/, "")}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
      {/* Cabecera del resultado */}
      <div className="flex items-center gap-4 p-5">
        <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-[18px] flex items-center justify-center shrink-0">
          <FileText className="w-6 h-6 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-slate-900 truncate">{r.nombre_archivo}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {r.tipo_estudio && (
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                {r.tipo_estudio}
              </span>
            )}
            <span className="text-[10px] font-bold text-slate-400">
              {new Date(r.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
            {r.subido_por && <span className="text-[10px] font-bold text-slate-400">· {r.subido_por}</span>}
          </div>
        </div>
        <a
          href={r.url_archivo}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 w-11 h-11 bg-blue-600 text-white rounded-[16px] flex items-center justify-center hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
          title="Descargar archivo"
        >
          <Download className="w-5 h-5" />
        </a>
      </div>

      {/* Botón toggle chat */}
      <div className="border-t border-slate-50">
        {!chatOpen ? (
          <button
            onClick={handleOpen}
            className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-black text-blue-600 hover:bg-blue-50 transition-colors uppercase tracking-widest"
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="w-3.5 h-3.5" />
              Consultar con IA
            </div>
            <Sparkles className="w-4 h-4" />
          </button>
        ) : (
          <>
            {/* Header del chat */}
            <div className="flex items-center justify-between px-5 py-3 bg-indigo-50 border-b border-indigo-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">IA Ruta Digna</span>
                <span className="text-[10px] text-indigo-400 font-bold truncate max-w-[120px]">· {r.nombre_archivo}</span>
              </div>
              <button onClick={handleClose} className="p-1 hover:bg-indigo-100 rounded-full transition-colors">
                <X className="w-4 h-4 text-indigo-500" />
              </button>
            </div>

            {/* Mensajes */}
            <div className="px-4 pt-3 pb-3 max-h-72 overflow-y-auto space-y-3 bg-slate-50/60">
              {/* Estado inicial: cargando y sin mensajes */}
              {loading && msgs.length === 0 && (
                <div className="flex items-center justify-center gap-2 py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  <span className="text-xs font-bold text-slate-400">Analizando tu resultado...</span>
                </div>
              )}

              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] px-4 py-3 rounded-[18px] text-xs font-medium leading-relaxed ${
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-white text-slate-700 border border-slate-100 rounded-bl-sm shadow-sm"
                  }`}>
                    {m.role === "ai" && (
                      <div className="flex items-center gap-1 mb-1.5">
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">IA Ruta Digna</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </div>
                </div>
              ))}

              {/* Indicador de escritura cuando ya hay mensajes */}
              {loading && msgs.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-100 rounded-[18px] rounded-bl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2 px-4 pb-3 pt-2 bg-white border-t border-slate-100">
              <input
                className="flex-1 bg-slate-50 border border-slate-200 rounded-[16px] px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                placeholder="Escribe tu pregunta..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                disabled={loading && msgs.length === 0}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="w-10 h-10 bg-indigo-600 text-white rounded-[14px] flex items-center justify-center shrink-0 disabled:opacity-50 active:scale-90 transition-all shadow-md shadow-indigo-500/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Descarga */}
            {msgs.length > 0 && (
              <div className="px-4 pb-4">
                <button
                  onClick={descargar}
                  className="w-full py-2.5 bg-slate-900 text-white text-[10px] font-black rounded-[14px] flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-widest"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar conversación
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function Resultados() {
  const [resultados, setResultados] = useState<ResultadoEstudio[]>([])
  const [resultadosLoading, setResultadosLoading] = useState(true)
  const [visitaId, setVisitaId] = useState<string | null>(null)

  useEffect(() => {
    const id = getVisitaId()
    setVisitaId(id)
    if (!id) { setResultadosLoading(false); return }
    const doFetch = async () => {
      try {
        const data = await getResultadosVisita(id)
        setResultados(Array.isArray(data) ? data : [])
      } catch { setResultados([]) }
      finally { setResultadosLoading(false) }
    }
    doFetch()
    const iv = setInterval(doFetch, 30000)
    return () => clearInterval(iv)
  }, [])

  // ── Analizador manual ──────────────────────────────────────────────
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
    setLoading(true); setError(null); setRespuesta(null)
    try {
      let data: any = {}
      if (activeTab === "foto" && imagenBase64) {
        data = { imagen_base64: imagenBase64, media_type: mediaType }
      } else if (activeTab === "texto" && textoResultados.trim()) {
        data = { resultados: textoResultados.trim() }
      } else {
        setError("Sube una imagen o escribe tus resultados")
        setLoading(false); return
      }
      const response = await explicarResultados(data)
      setRespuesta(response.reply)
    } catch { setError("No pudimos procesar tus resultados. Intenta de nuevo.") }
    finally { setLoading(false) }
  }

  const imprimirReporte = () => window.print()

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-900 selection:bg-blue-100">
      {/* Header */}
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

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-10">

        {/* ── SECCIÓN 1: RESULTADOS DEL MÉDICO ──────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-[14px] bg-emerald-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-sm font-black text-slate-700 uppercase tracking-[0.15em]">Resultados de tu médico</h2>
          </div>

          {resultadosLoading ? (
            <div className="bg-white rounded-[32px] border border-slate-100 p-8 flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verificando resultados...</p>
            </div>
          ) : resultados.length === 0 ? (
            <div className="bg-white rounded-[32px] border-2 border-dashed border-slate-200 p-10 flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-slate-50 rounded-[24px] flex items-center justify-center">
                <FileText className="w-8 h-8 text-slate-300" />
              </div>
              <p className="font-black text-slate-500 text-sm uppercase tracking-tight">Aún no hay resultados</p>
              <p className="text-xs text-slate-400 font-bold">Tu médico los subirá cuando estén listos</p>
            </div>
          ) : (
            <div className="space-y-4">
              {resultados.map(r => (
                <ResultCard key={r.id} r={r} visitaId={visitaId ?? "sin-visita"} />
              ))}
            </div>
          )}
        </section>

        {/* Divisor */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Análisis manual</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* ── SECCIÓN 2: ANALIZADOR MANUAL ──────────────────────── */}
        <div className="bg-slate-100 p-1.5 rounded-[24px] flex gap-1 shadow-inner border border-slate-200 print:hidden">
          <button
            onClick={() => setActiveTab("foto")}
            className={`flex-1 py-3.5 px-4 rounded-[20px] text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              activeTab === "foto" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Camera className="w-4 h-4" /> Archivo / Foto
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

        <section className="animate-in fade-in zoom-in-95 duration-500 print:hidden">
          {activeTab === "foto" ? (
            <div className="space-y-6">
              <input type="file" ref={fileInputRef} onChange={handleImagenSelect} accept="image/*,.pdf,application/pdf" className="hidden" />
              {!imagenPreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group border-2 border-dashed border-slate-200 bg-white hover:bg-blue-50/50 hover:border-blue-400/50 rounded-[40px] p-12 text-center transition-all cursor-pointer"
                >
                  <div className="w-20 h-20 mx-auto mb-6 rounded-[28px] bg-blue-50 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-100 transition-all duration-500 shadow-sm">
                    <Upload className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight text-center">Cargar Estudios</h3>
                  <p className="text-xs text-slate-400 font-bold px-8 leading-relaxed mb-8 uppercase tracking-tight text-center">PDF, JPG o PNG · máx. 10 MB</p>
                  <div className="flex justify-center">
                    <div className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white text-[11px] font-black rounded-[20px] shadow-xl shadow-blue-500/30 uppercase tracking-[0.2em]">
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

        {respuesta && (
          <div className="relative animate-in slide-in-from-bottom-12 duration-1000 group">
            <div className="absolute -top-4 left-10 z-10 bg-indigo-600 text-white text-[10px] font-black px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 border-2 border-white uppercase tracking-widest print:hidden">
              <CheckCircle2 className="w-4 h-4 text-white" /> Interpretación Lista
            </div>
            <div className="bg-white rounded-[48px] p-10 md:p-14 shadow-[0_40px_80px_rgba(0,0,0,0.08)] border-2 border-indigo-50 relative overflow-hidden print:shadow-none print:border-none print:p-0">
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
                <div className="text-slate-700 text-sm leading-[2.2] whitespace-pre-wrap font-medium text-left">{respuesta}</div>
                <div className="mt-12 pt-8 border-t border-slate-100 flex items-start gap-4">
                  <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 shrink-0 print:hidden"><Lock className="w-5 h-5" /></div>
                  <div className="text-left opacity-60">
                    <p className="text-[11px] text-slate-500 font-black leading-relaxed uppercase tracking-widest">Aviso Legal</p>
                    <p className="text-[10px] text-slate-400 leading-normal mt-1 font-bold">Documento generado para fines informativos por Ruta Digna.</p>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={imprimirReporte} className="w-full mt-8 py-6 bg-slate-950 text-white font-black rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-center gap-4 active:scale-95 transition-all text-xs uppercase tracking-[0.3em] group print:hidden">
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
