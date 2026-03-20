'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Send, Camera, ChevronDown, ChevronUp } from 'lucide-react'
import { Button, Card, ChatBubble, LoadingSpinner } from '../../components/ui'
import { sendChat, explicarResultados, getVisitaStatus } from '../../lib/api'

export default function ChatPage() {
  const { visitaId } = useParams<{ visitaId: string }>()

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

  // Mensaje inicial del asistente
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

  // Enviar mensaje al chat
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

  // Seleccionar imagen y comprimir
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
        // Comprimir con canvas — máx 1200px ancho, JPEG 80%
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

  // Explicar resultados
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
    <div className="min-h-screen bg-neutral flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col flex-1 px-4 py-4">

        {/* Header */}
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-brand-text">Asistente Ruta Digna</h1>
          <p className="text-xs text-brand-muted">Responde preguntas sobre tu proceso</p>
        </div>

        {/* ── SECCIÓN 1: CHAT ─────────────────────────────── */}
        <Card className="flex flex-col mb-4" style={{ minHeight: 300 }}>
          <div className="flex-1 overflow-y-auto pr-1 mb-3" style={{ maxHeight: 320 }}>
            {mensajes.map((m, i) => (
              <ChatBubble key={i} role={m.role} message={m.content} />
            ))}
            {chatLoading && (
              <div className="flex justify-start mb-3">
                <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-card">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input del chat */}
          <div className="flex gap-2 border-t pt-3">
            <input
              className="flex-1 border border-gray-200 rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Escribe tu pregunta..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={chatLoading || !input.trim()}
              className="p-2 bg-primary text-white rounded-button disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </Card>

        {/* Separador */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-brand-muted font-medium">Explicar mis resultados</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* ── SECCIÓN 2: EXPLICADOR CON FOTO ──────────────── */}
        <Card>
          {/* Botón principal — subir foto */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-card p-6 flex flex-col items-center gap-2 hover:border-primary hover:bg-blue-50 transition-colors"
          >
            <Camera size={32} className="text-primary" />
            <p className="font-medium text-sm text-brand-text">Tomar foto o subir imagen</p>
            <p className="text-xs text-brand-muted">Foto de tus resultados de laboratorio</p>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageSelect}
          />

          {/* Preview de imagen */}
          {imgPreview && (
            <div className="mt-3">
              <img src={imgPreview} alt="Preview" className="w-full rounded-lg object-contain max-h-48" />
              <Button className="w-full mt-3" loading={explicLoading} onClick={handleExplicar}>
                Explicar en lenguaje simple
              </Button>
            </div>
          )}

          {/* Link a texto alternativo */}
          <button
            className="w-full flex items-center justify-center gap-1 mt-3 text-xs text-brand-muted hover:text-primary transition-colors"
            onClick={() => setMostrarTexto(v => !v)}
          >
            {mostrarTexto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            ¿Prefieres escribir el texto?
          </button>

          {mostrarTexto && (
            <div className="mt-2">
              <textarea
                className="w-full border border-gray-200 rounded-input p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                rows={4}
                placeholder="Pega aquí el texto de tus resultados de laboratorio..."
                value={textoFallback}
                onChange={e => setTextoFallback(e.target.value)}
              />
              <Button
                className="w-full mt-2"
                loading={explicLoading}
                onClick={handleExplicar}
                disabled={!textoFallback.trim()}
              >
                Explicar en lenguaje simple
              </Button>
            </div>
          )}

          {/* Error del explicador */}
          {explicError && (
            <p className="text-xs text-red-600 mt-2 text-center">{explicError}</p>
          )}

          {/* Resultado de la explicación */}
          {explicacion && (
            <div className="mt-3 p-3 bg-blue-50 rounded-card border border-blue-100">
              <p className="text-xs font-medium text-primary mb-1">Explicación de tus resultados:</p>
              <p className="text-sm text-brand-text leading-relaxed whitespace-pre-wrap">{explicacion}</p>
            </div>
          )}
        </Card>

      </div>
    </div>
  )
}
