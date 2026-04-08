"use client"

import { useState } from "react"
import Link from "next/link"
import { FlaskConical, Activity, ScanLine, Check, Send, Clock } from "lucide-react"
import BottomNav from "@/components/BottomNav"
import Footer from "@/components/Footer"

const mockResponse = "El ultrasonido abdominal es un procedimiento no invasivo que utiliza ondas sonoras para crear imágenes de tus órganos internos. No causa dolor y dura aproximadamente 20-30 minutos. Es normal sentir presión leve cuando el técnico mueve el transductor."

export default function Tracking() {
  const [message, setMessage] = useState("")
  const [chatMessages, setChatMessages] = useState<{ text: string; isUser: boolean }[]>([])
  const [isTyping, setIsTyping] = useState(false)

  const handleSend = () => {
    if (!message.trim()) return
    
    setChatMessages(prev => [...prev, { text: message, isUser: true }])
    setMessage("")
    setIsTyping(true)
    
    setTimeout(() => {
      setIsTyping(false)
      setChatMessages(prev => [...prev, { text: mockResponse, isUser: false }])
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-neutral pb-20">
      {/* Header */}
      <header className="bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text">Mi visita</h1>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
            </span>
            <span className="text-xs font-medium text-success">En proceso</span>
          </div>
        </div>
        <p className="text-sm text-muted mt-1">Salud Digna Culiacán · María González</p>
      </header>

      <main className="px-4 py-5">
        {/* Estimated time card */}
        <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] mb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted mb-1">Tiempo estimado restante</p>
              <p className="text-[32px] font-semibold text-text leading-none">47 min</p>
              <p className="text-xs text-muted mt-1">Basado en concurrencia actual</p>
            </div>
            <div className="w-11 h-11 rounded-full bg-[#EFF6FF] flex items-center justify-center">
              <Clock className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted text-center mb-5">
          Laboratorio completado · Ultrasonido ~22 min · Rayos X ~25 min
        </p>

        {/* Stepper */}
        <div className="space-y-0">
          {/* Study 1 - Completed */}
          <div className="relative pl-12 pb-6">
            <div className="absolute left-4 top-0 w-8 h-8 rounded-full bg-success flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-white" />
            </div>
            <div className="absolute left-[1.45rem] top-8 w-0.5 h-full bg-success" />
            
            <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-text">LABORATORIO</h3>
                <span className="flex items-center gap-1 text-xs font-medium text-success">
                  <Check className="w-3 h-3" /> COMPLETADO
                </span>
              </div>
              <p className="text-sm text-muted">Tiempo en sala: 18 min</p>
              <p className="text-xs text-muted mt-1">09:14 AM — Finalizado</p>
            </div>
          </div>

          {/* Study 2 - In progress */}
          <div className="relative pl-12 pb-6">
            <div className="absolute left-4 top-0">
              <span className="absolute inline-flex h-8 w-8 rounded-full bg-primary/30 animate-pulse-ring" />
              <div className="relative w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="absolute left-[1.45rem] top-8 w-0.5 h-full bg-slate-200" />
            
            <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] border-2 border-primary">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-text">ULTRASONIDO</h3>
                <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-primary text-white rounded-full animate-pulse">
                  Estás aquí
                </span>
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-text">Estado: Inicio de toma</span>
                <span className="text-sm text-muted">· Progreso: 33%</span>
              </div>
              
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-primary rounded-full" style={{ width: "33%" }} />
              </div>
              
              <p className="text-xs text-muted">Tiempo estimado restante: ~22 min</p>

              {/* AI Assistant */}
              <div className="mt-4 p-3 bg-[#EFF6FF] rounded-[10px]">
                <div className="flex items-start gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-semibold text-white">RD</span>
                  </div>
                  <p className="text-sm text-text leading-relaxed">
                    ¿Tienes alguna duda sobre tu ultrasonido? Puedo ayudarte a entender el proceso.
                  </p>
                </div>

                {/* Chat messages */}
                {chatMessages.length > 0 && (
                  <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                    {chatMessages.map((msg, idx) => (
                      <div 
                        key={idx}
                        className={`p-2 rounded-lg text-sm ${
                          msg.isUser 
                            ? "bg-primary text-white ml-4" 
                            : "bg-white text-text mr-4"
                        }`}
                      >
                        {msg.text}
                      </div>
                    ))}
                    {isTyping && (
                      <div className="bg-white text-muted p-2 rounded-lg text-sm mr-4">
                        Escribiendo...
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Escribe tu pregunta..."
                    className="flex-1 px-3 py-2 text-sm rounded-[8px] border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button 
                    onClick={handleSend}
                    className="w-9 h-9 bg-primary rounded-[8px] flex items-center justify-center active:bg-primary/90 transition-colors"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Study 3 - Pending */}
          <div className="relative pl-12">
            <div className="absolute left-4 top-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
              <ScanLine className="w-4 h-4 text-muted" />
            </div>
            
            <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] opacity-70">
              <h3 className="font-semibold text-muted">RAYOS X</h3>
              <p className="text-sm text-muted">Siguiente estudio</p>
              <p className="text-xs text-muted mt-1">Tiempo estimado: ~35 min</p>
            </div>
          </div>
        </div>

        <Footer />
      </main>

      {/* Floating button */}
      <div className="fixed bottom-20 left-4 right-4 z-40">
        <Link href="/resultados">
          <button className="w-full bg-primary text-white font-medium py-3.5 px-4 rounded-[10px] shadow-lg active:bg-primary/90 transition-colors">
            Ver resultados
          </button>
        </Link>
      </div>

      <BottomNav />
    </div>
  )
}
