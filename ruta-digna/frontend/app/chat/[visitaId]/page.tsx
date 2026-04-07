'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Send, Camera, ChevronDown, ChevronUp, ArrowLeft, Sparkles } from 'lucide-react'
import { Button, Card, ChatBubble, LoadingSpinner } from '../../components/ui'
import { sendChat, explicarResultados, getVisitaStatus } from '../../lib/api'

export default function ChatPage() {
  const { visitaId } = useParams<{ visitaId: string }>()
  const router = useRouter()

  // Chat
  const [mensajes, setMensajes] = useState<{ role: 'user'|'assistant'; content: string }[]>([])
  const [input, setInput]       = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Explicador
  const [imgPreview, setImgPreview]     = useState<string>('')
  const [imgBase64, setImgBase64]       = useState<string>('')
  const [mediaType, setMediaType]       = useState<string>('image/jpeg')
  const [textoFallback, setTextoFallback] = useState('')
  const [mostrarTexto, setMostrarTexto] = useState(false)
  const [explicacion, setExplicacion]   = useState('')
  const [explicLoading, setExplicLoading] = useState(false)
  const [explicError, setExplicError]   = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setExplicError('La imagen es muy pesada. Toma una foto nueva.')
      return
    }
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
        setExplicacion('')
        setExplicError('')
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
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
      {/* Header con estilo de App Nativa */}
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
        {/* ── SECCIÓN 1: CHAT ─────────────────────────────── */}
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

        {/* Separador Estético */}
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-brand-muted uppercase tracking-widest">
            <Sparkles size={12} className="text-primary" />
            IA Explicadora
          </div>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* ── SECCIÓN 2: EXPLICADOR ──────────────── */}
        <div className="px-4">
          <Card className="border-none shadow-xl bg-white overflow-hidden">
            {!imgPreview && !mostrarTexto && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-blue-50/50 border-2 border-dashed border-primary/20 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-blue-50 transition-all group"
              >
                <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Camera size={24} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm text-brand-text">¿Tienes resultados?</p>
                  <p className="text-xs text-brand-muted mt-1">Sube una foto para explicarlos</p>
                </div>
              </button>
            )}

            {imgPreview && (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden group">
                  <img src={imgPreview} alt="Preview" className="w-full object-contain max-h-52 bg-neutral" />
                  <button onClick={() => {setImgPreview(''); setImgBase64('')}} className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full backdrop-blur-md">
                    <ChevronDown size={14} className="rotate-45" />
                  </button>
                </div>
                <Button className="w-full shadow-lg shadow-primary/20" loading={explicLoading} onClick={handleExplicar}>
                  Traducir resultados
                </Button>
              </div>
            )}

            <button
              className="w-full py-4 text-[10px] font-bold text-brand-muted hover:text-primary transition-colors flex items-center justify-center gap-2 uppercase tracking-tighter"
              onClick={() => setMostrarTexto(v => !v)}
            >
              {mostrarTexto ? 'Cerrar editor' : 'O prefiere escribir el texto'}
              {mostrarTexto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {mostrarTexto && (
              <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300 pb-2">
                <textarea
                  className="w-full border-none bg-neutral/50 rounded-xl p-4 text-sm resize-none focus:ring-2 focus:ring-primary outline-none transition-all"
                  rows={4}
                  placeholder="Ej: Glucosa 110 mg/dL..."
                  value={textoFallback}
                  onChange={e => setTextoFallback(e.target.value)}
                />
                <Button className="w-full" loading={explicLoading} onClick={handleExplicar} disabled={!textoFallback.trim()}>
                  Analizar texto
                </Button>
              </div>
            )}

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
