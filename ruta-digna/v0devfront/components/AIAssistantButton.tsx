"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send } from "lucide-react"
import { chatAsistente } from "@/app/lib/api"

interface ChatMessage {
  text: string
  isUser: boolean
}

export default function AIAssistantButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      text: "¡Hola! Soy el asistente de Ruta Digna. Puedo ayudarte con dudas sobre tus estudios, tiempos de espera, instrucciones de preparación o cómo llegar a cada área. ¿En qué te puedo ayudar?",
      isUser: false,
    },
  ])
  const [isTyping, setIsTyping] = useState(false)
  const [historial, setHistorial] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Obtener visita_id de la URL o de la sesión (si existe)
  const getVisitaId = () => {
    if (typeof window === "undefined") return null
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get("id")
    if (fromUrl) return fromUrl
    try {
      const session = JSON.parse(localStorage.getItem("ruta_session") || "null")
      return session?.visita_id || null
    } catch {
      return null
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (isOpen) scrollToBottom()
  }, [chatMessages, isOpen])

  const handleSend = async () => {
    if (!message.trim()) return
    const userMsg = message.trim()

    setChatMessages((prev) => [...prev, { text: userMsg, isUser: true }])
    setMessage("")
    setIsTyping(true)

    try {
      const visitaId = getVisitaId()
      if (!visitaId) {
        setChatMessages((prev) => [
          ...prev,
          {
            text: "Para ayudarte mejor necesito una visita activa. Inicia sesión y crea una visita primero.",
            isUser: false,
          },
        ])
        return
      }
      const newHistorial = [...historial, { role: "user", content: userMsg }]
      const response = await chatAsistente(visitaId, userMsg, historial)

      setChatMessages((prev) => [...prev, { text: response.reply, isUser: false }])
      setHistorial([
        ...newHistorial,
        { role: "assistant", content: response.reply },
      ])
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          text: "Lo siento, no pude conectarme en este momento. Intenta de nuevo en unos segundos.",
          isUser: false,
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <>
      {/* FAB Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 z-50 w-14 h-14 bg-primary rounded-full shadow-[0_4px_20px_rgba(37,99,235,0.4)] flex items-center justify-center active:scale-95 transition-transform"
        >
          <MessageCircle className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">IA</span>
          </span>
        </button>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sheet/Drawer */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[24px] transition-transform duration-300 ease-out ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: "85vh" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-sm font-semibold text-white">RD</span>
            </div>
            <div>
              <h2 className="font-semibold text-text">Asistente Ruta Digna</h2>
              <p className="text-xs text-muted">Pregúntame lo que necesites</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ height: "calc(85vh - 140px)" }}
        >
          <div className="space-y-3">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-[16px] text-sm leading-relaxed ${
                    msg.isUser
                      ? "bg-primary text-white rounded-br-[4px]"
                      : "bg-neutral text-text rounded-bl-[4px]"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-neutral text-muted p-3 rounded-[16px] rounded-bl-[4px] text-sm">
                  <span className="flex gap-1">
                    <span className="w-2 h-2 bg-muted/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Escribe tu pregunta..."
              className="flex-1 px-4 py-3 text-sm rounded-full border border-slate-200 bg-neutral focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || isTyping}
              className="w-11 h-11 bg-primary rounded-full flex items-center justify-center active:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
