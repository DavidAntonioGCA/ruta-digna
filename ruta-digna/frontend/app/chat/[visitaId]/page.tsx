'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Send, Camera, ChevronDown, ChevronUp, ArrowLeft, Sparkles, Download, FileText } from 'lucide-react'
import { Button, Card, ChatBubble, LoadingSpinner } from '../../components/ui'
import { sendChat, explicarResultados, getVisitaStatus } from '../../lib/api'
import { getResultadosVisita, type ResultadoEstudio } from '../../api'

export default function ChatPage() {
  const { visitaId } = useParams<{ visitaId: string }>()
  const router = useRouter()

  // Chat
  const [mensajes, setMensajes] = useState<{ role: 'user'|'assistant'; content: string }[]>([])
  const [input, setInput]       = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Resultados de la doctora
  const [resultados, setResultados]               = useState<ResultadoEstudio[]>([])
  const [resultadosLoading, setResultadosLoading] = useState(true)
  const [resultadoExpandido, setResultadoExpandido] = useState<string | null>(null)

  // Explicador IA manual
  const [modoInput, setModoInput]       = useState<'archivo' | 'texto'>('archivo')
  const [archivoNombre, setArchivoNombre] = useState('')
  const [imgPreview, setImgPreview]     = useState<string>('')
  const [imgBase64, setImgBase64]       = useState<string>('')
  const [mediaType, setMediaType]       = useState<string>('image/jpeg')
  const [textoFallback, setTextoFallback] = useState('')
  const [explicacion, setExplicacion]   = useState('')
  const [explicLoading, setExplicLoading] = useState(false)
  const [explicError, setExplicError]   = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Init chat
  useEffect(() => {
    const init = async () => {
      try {
        const estado = await getVisitaStatus(visitaId)
        const n      = estado.estudios?.length ?? 0
        const actual = estado.estudio_actual?.nombre ?? 'registro'
        setMensajes([{
          role: 'assistant',
          content: `Hola, soy tu asistente de Ruta Digna. Tienes ${n} estudio${n !== 1 ? 's' : ''} programados. Actualmente estás en ${actual}. ¿En qué puedo ayudarte?`
        }])
      } catch {
        setMensajes([{ role: 'assistant', content: 'Hola, soy tu asistente de Ruta Digna. ¿En qué puedo ayudarte?' }])
      }
    }
    init()
  }, [visitaId])

  // Cargar resultados y refrescar cada 30s
  useEffect(() => {
    const fetchResultados = async () => {
      try {
        const data = await getResultadosVisita(visitaId)
        setResultados(Array.isArray(data) ? data : [])
      } catch {
        setResultados([])
      } finally {
        setResultadosLoading(false)
      }
    }
    fetchResultados()
    const iv = setInterval(fetchResultados, 30000)
    return () => clearInterval(iv)
  }, [visitaId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const handleSend = async () => {
    if (!input.trim() || chatLoading) return
    const userMsg = input.trim()
    setInput('')
    const historial = mensajes.map(m => ({ role: m.role, content: m.content }))
    setMensajes(prev => [...prev, { role: 'user', content: userMsg }])
    setChatLoading(true)
    try {
      const data = await sendChat(visitaId, userMsg, historial)
      setMensajes(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMensajes(prev => [...prev, { role: 'assistant', content: 'No pude procesar tu mensaje. Intenta de nuevo.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setExplicError('Archivo demasiado grande (máx. 10 MB)'); return }
    setArchivoNombre(file.name)
    setExplicacion(''); setExplicError('')

    if (file.type === 'application/pdf') {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const b64 = (ev.target?.result as string).replace('data:application/pdf;base64,', '')
        setImgBase64(b64)
        setMediaType('application/pdf')
        setImgPreview('pdf')
      }
      reader.readAsDataURL(file)
    } else {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const img = new Image()
        img.onload = () => {
          const canvas  = document.createElement('canvas')
          const maxW    = 1200
          const ratio   = Math.min(1, maxW / img.width)
          canvas.width  = img.width  * ratio
          canvas.height = img.height * ratio
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
          setImgPreview(dataUrl)
          setImgBase64(dataUrl.replace('data:image/jpeg;base64,', ''))
          setMediaType('image/jpeg')
        }
        img.src = ev.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  const handleExplicar = async () => {
    if (!imgBase64 && !textoFallback.trim()) return
    setExplicLoading(true)
    setExplicacion('')
    setExplicError('')
    try {
      const data = imgBase64
        ? await explicarResultados(imgBase64, mediaType, undefined)
        : await explicarResultados(undefined, undefined, textoFallback)
      setExplicacion(data.reply)
    } catch {
      setExplicError('Algo salió mal, intenta de nuevo.')
    } finally {
      setExplicLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="p-2 hover:bg-neutral rounded-full transition-colors">
          <ArrowLeft size={20} className="text-brand-text" />
        </button>
        <div>
          <h1 className="text-sm font-bold text-brand-text leading-none">Asistente Virtual</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">En línea</span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full flex flex-col flex-1 pb-24">

        {/* ── SECCIÓN 1: CHAT ───────────────────────────── */}
        <div className="flex-1 px-4 py-6 overflow-y-auto space-y-4">
          {mensajes.map((m, i) => (
            <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ChatBubble role={m.role} message={m.content} />
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── SECCIÓN 2: MIS RESULTADOS ─────────────────── */}
        {/* Separador */}
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-brand-muted uppercase tracking-widest">
            <FileText size={12} className="text-emerald-500" />
            Mis Resultados
          </div>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="px-4 pb-2">
          {resultadosLoading ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-400">Verificando resultados...</p>
            </div>
          ) : resultados.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 flex flex-col items-center gap-2">
              <FileText size={24} className="text-gray-300" />
              <p className="text-sm font-semibold text-gray-400">Aún no hay resultados</p>
              <p className="text-xs text-gray-400">Tu médico los subirá cuando estén listos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {resultados.map(r => (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center shrink-0">
                      <FileText size={18} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">{r.nombre_archivo}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {r.tipo_estudio && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">
                            {r.tipo_estudio}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">
                          {new Date(r.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <a
                      href={r.url_archivo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
                      title="Descargar resultado"
                    >
                      <Download size={16} />
                    </a>
                  </div>

                  {r.interpretacion_ia && (
                    <div className="border-t border-gray-50">
                      <button
                        onClick={() => setResultadoExpandido(prev => prev === r.id ? null : r.id)}
                        className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <Sparkles size={12} />
                          ¿Qué significan mis resultados?
                        </div>
                        {resultadoExpandido === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {resultadoExpandido === r.id && (
                        <div className="px-4 pb-4 animate-in slide-in-from-top-1">
                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Sparkles size={12} className="text-blue-500" />
                              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Interpretación con IA</span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{r.interpretacion_ia}</p>
                            {r.subido_por && (
                              <p className="text-[10px] text-gray-400 mt-3 text-right">Subido por {r.subido_por}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── SECCIÓN 3: ANÁLISIS IA MANUAL ─────────────── */}
        {/* Separador */}
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-brand-muted uppercase tracking-widest">
            <Sparkles size={12} className="text-primary" />
            Análisis de Resultados
          </div>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="px-4 pb-6">
          <Card className="border-none shadow-xl bg-white overflow-hidden">
            <p className="text-xs font-semibold text-gray-600 mb-3">¿Tienes un resultado externo? Sube el archivo o escribe los valores y la IA te lo explica.</p>

            {/* Selector de modo */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => { setModoInput('archivo'); setTextoFallback(''); setExplicacion(''); setExplicError('') }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                  modoInput === 'archivo'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Camera size={13} />
                Archivo / Foto
              </button>
              <button
                onClick={() => { setModoInput('texto'); setImgPreview(''); setImgBase64(''); setArchivoNombre(''); setExplicacion(''); setExplicError('') }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                  modoInput === 'texto'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <FileText size={13} />
                Texto
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Vista: Archivo/Foto */}
            {modoInput === 'archivo' && (
              <div className="space-y-4">
                {!imgPreview && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-blue-50/50 border-2 border-dashed border-primary/20 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-blue-50 transition-all group"
                  >
                    <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Camera size={24} />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-sm text-brand-text">Seleccionar archivo o foto</p>
                      <p className="text-xs text-brand-muted mt-1">PDF, JPG o PNG · máx. 10 MB</p>
                    </div>
                  </button>
                )}

                {imgPreview && imgPreview === 'pdf' && (
                  <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                      <FileText size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{archivoNombre}</p>
                      <p className="text-xs text-blue-600">PDF listo para analizar</p>
                    </div>
                    <button
                      onClick={() => { setImgPreview(''); setImgBase64(''); setArchivoNombre(''); setExplicacion('') }}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <ChevronDown size={16} className="rotate-45" />
                    </button>
                  </div>
                )}

                {imgPreview && imgPreview !== 'pdf' && (
                  <div className="relative rounded-xl overflow-hidden group">
                    <img src={imgPreview} alt="Preview" className="w-full object-contain max-h-52 bg-neutral" />
                    <button onClick={() => { setImgPreview(''); setImgBase64(''); setArchivoNombre('') }} className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full backdrop-blur-md">
                      <ChevronDown size={14} className="rotate-45" />
                    </button>
                  </div>
                )}

                {imgPreview && (
                  <Button className="w-full shadow-lg shadow-primary/20" loading={explicLoading} onClick={handleExplicar}>
                    Traducir resultados
                  </Button>
                )}
              </div>
            )}

            {/* Vista: Texto */}
            {modoInput === 'texto' && (
              <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300 pb-2">
                <textarea
                  className="w-full border-none bg-neutral/50 rounded-xl p-4 text-sm resize-none focus:ring-2 focus:ring-primary outline-none transition-all"
                  rows={4}
                  placeholder="Ej: Glucosa 110 mg/dL, Hemoglobina 13.5 g/dL..."
                  value={textoFallback}
                  onChange={e => setTextoFallback(e.target.value)}
                />
                <Button className="w-full" loading={explicLoading} onClick={handleExplicar} disabled={!textoFallback.trim()}>
                  Analizar texto
                </Button>
              </div>
            )}

            {explicError && <p className="text-red-500 text-xs text-center mt-2">{explicError}</p>}

            {explicacion && (
              <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-primary" />
                  <span className="text-[10px] font-bold text-primary uppercase">Interpretación IA</span>
                </div>
                <p className="text-sm text-brand-text leading-relaxed">{explicacion}</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Input de Chat Fijo al fondo */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t px-4 py-4 z-20">
        <div className="max-w-md mx-auto flex gap-2">
          <input
            className="flex-1 bg-neutral border-none rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-primary transition-all outline-none"
            placeholder="Haz una pregunta..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={chatLoading || !input.trim()}
            className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 active:scale-90 transition-all disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
