"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  User, Phone, LogOut, Activity, ChevronRight, Shield,
  Bell, BellOff, Copy, CheckCheck, FileText, HelpCircle,
  Info, Sparkles, Trash2, Share2, ExternalLink, Lock,
  ChevronDown, ChevronUp, MapPin
} from "lucide-react"
import BottomNav from "@/components/BottomNav"

interface Session {
  paciente_id: string
  nombre: string
  telefono: string
  visita_id: string | null
}

const FAQ = [
  {
    q: "¿Cómo funciona la cola de prioridad?",
    a: "El sistema ordena a los pacientes por tipo (urgente, embarazada, adulto mayor, discapacidad, con cita, sin cita) y dentro de cada tipo por hora de llegada. El especialista puede ajustar tu prioridad desde su panel.",
  },
  {
    q: "¿Por qué cambia mi tiempo de espera?",
    a: "El tiempo estimado se recalcula en tiempo real según cuántos pacientes van antes que tú y cuánto tarda cada estudio. Si alguien urgente llega, tu tiempo puede aumentar.",
  },
  {
    q: "¿Dónde veo mis resultados cuando estén listos?",
    a: "En la pantalla 'Mi visita' (Tracking), al final de la página encontrarás la sección 'Mis Resultados' con todos los archivos que el especialista haya subido para ti.",
  },
  {
    q: "¿Qué significa cada color de prioridad?",
    a: "Rojo = Urgente · Rosa = Embarazada · Amarillo = Adulto mayor · Morado = Discapacidad · Azul = Con cita previa · Gris = Sin cita",
  },
  {
    q: "¿Puedo tener varios estudios en una visita?",
    a: "Sí. Al crear tu visita puedes seleccionar varios estudios (laboratorio, ultrasonido, rayos X, etc.). El sistema te genera la ruta más eficiente para realizarlos todos.",
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-3 hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm font-bold text-slate-800 leading-snug">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4">
          <p className="text-sm text-slate-500 font-medium leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

function SettingRow({
  icon: Icon, iconBg, label, sublabel, right, onClick, danger, href,
}: {
  icon: any; iconBg: string; label: string; sublabel?: string
  right?: React.ReactNode; onClick?: () => void; danger?: boolean; href?: string
}) {
  const inner = (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 px-5 py-4 bg-white rounded-2xl border transition-all cursor-pointer
        ${danger ? "border-red-100 hover:bg-red-50" : "border-slate-100 hover:bg-slate-50"}`}
    >
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${danger ? "text-red-600" : "text-slate-800"}`}>{label}</p>
        {sublabel && <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">{sublabel}</p>}
      </div>
      {right ?? <ChevronRight className={`w-4 h-4 shrink-0 ${danger ? "text-red-300" : "text-slate-300"}`} />}
    </div>
  )
  if (href) return <Link href={href}>{inner}</Link>
  return inner
}

export default function Ajustes() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [notifs, setNotifs] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("ruta_session") || "null")
      setSession(s)
      const n = localStorage.getItem("rd_notifs")
      if (n !== null) setNotifs(n === "1")
    } catch {}
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("ruta_session")
    document.cookie = "ruta_auth=; path=/; max-age=0"
    router.push("/login")
  }

  const handleCopyLink = () => {
    if (!session?.visita_id) return
    const url = `${window.location.origin}/tracking?id=${session.visita_id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const handleToggleNotifs = () => {
    const newVal = !notifs
    setNotifs(newVal)
    localStorage.setItem("rd_notifs", newVal ? "1" : "0")
  }

  const handleDeleteData = () => {
    localStorage.removeItem("ruta_session")
    localStorage.removeItem("rd_notifs")
    document.cookie = "ruta_auth=; path=/; max-age=0"
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter uppercase leading-none">Ajustes</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ruta Digna</p>
            </div>
          </div>
          <Sparkles className="w-5 h-5 text-blue-400/40" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8 space-y-8">

        {/* PERFIL */}
        <section>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Mi cuenta</p>
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-3xl p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                <User className="w-7 h-7 text-white/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-black tracking-tight truncate">
                  {session?.nombre ?? "Sin sesión"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Phone className="w-3.5 h-3.5 text-white/40" />
                  <span className="text-sm text-white/60 font-medium">
                    {session?.telefono ?? "—"}
                  </span>
                </div>
              </div>
            </div>
            {session?.visita_id && (
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Visita activa</p>
                  <p className="text-xs font-bold text-white/70 font-mono mt-0.5">
                    {session.visita_id.slice(0, 16)}…
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  En curso
                </span>
              </div>
            )}
          </div>
        </section>

        {/* MI VISITA */}
        <section>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Mi visita</p>
          <div className="space-y-2">
            <SettingRow
              icon={Activity} iconBg="bg-blue-50 text-blue-600"
              label="Ver mi estado en tiempo real"
              sublabel="Posición en cola, tiempo de espera, estudios"
              href="/tracking"
            />
            <SettingRow
              icon={MapPin} iconBg="bg-emerald-50 text-emerald-600"
              label="Buscar o cambiar clínica"
              sublabel="Recomendación inteligente por IA"
              href="/recomendar"
            />
            <SettingRow
              icon={FileText} iconBg="bg-purple-50 text-purple-600"
              label="Analizar resultados propios"
              sublabel="Sube una foto o texto para que la IA los interprete"
              href="/resultados"
            />
            {session?.visita_id && (
              <SettingRow
                icon={copied ? CheckCheck : Share2}
                iconBg={copied ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}
                label={copied ? "¡Enlace copiado!" : "Compartir seguimiento"}
                sublabel="Comparte el link de tu turno con un familiar"
                onClick={handleCopyLink}
                right={
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${copied ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                    {copied ? "✓" : "Copiar"}
                  </span>
                }
              />
            )}
          </div>
        </section>

        {/* PREFERENCIAS */}
        <section>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Preferencias</p>
          <div className="space-y-2">
            <SettingRow
              icon={notifs ? Bell : BellOff}
              iconBg={notifs ? "bg-amber-50 text-amber-500" : "bg-slate-100 text-slate-400"}
              label="Notificaciones de turno"
              sublabel={notifs ? "Recibirás alertas de cambios en tu fila" : "Notificaciones desactivadas"}
              onClick={handleToggleNotifs}
              right={
                <div
                  className={`w-11 h-6 rounded-full transition-colors ${notifs ? "bg-blue-600" : "bg-slate-200"} relative shrink-0`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notifs ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
              }
            />
          </div>
        </section>

        {/* PRIVACIDAD */}
        <section>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Privacidad y seguridad</p>
          <div className="space-y-2">
            <div className="bg-white rounded-2xl border border-slate-100 px-5 py-4 flex gap-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Tus datos son privados</p>
                <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed">
                  Solo tú puedes ver tu historial. Los resultados subidos por el especialista son accesibles únicamente con tu ID de visita. No compartimos datos con terceros.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* AYUDA / FAQ */}
        <section>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Preguntas frecuentes</p>
          <div className="space-y-2">
            {FAQ.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
          </div>
        </section>

        {/* SESIÓN */}
        <section>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Sesión</p>
          <div className="space-y-2">
            <SettingRow
              icon={LogOut} iconBg="bg-red-50 text-red-500"
              label="Cerrar sesión"
              sublabel="Tu visita activa no se cancela"
              onClick={handleLogout}
              danger
            />
            {!showDeleteConfirm ? (
              <SettingRow
                icon={Trash2} iconBg="bg-red-50 text-red-400"
                label="Eliminar mis datos locales"
                sublabel="Borra sesión y preferencias de este dispositivo"
                onClick={() => setShowDeleteConfirm(true)}
                danger
              />
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                <p className="text-sm font-bold text-red-800 mb-1">¿Confirmar eliminación?</p>
                <p className="text-xs text-red-500 font-medium mb-4">Se borrarán todos los datos locales de este dispositivo. Tu historial en la clínica permanece.</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2.5 text-xs font-bold rounded-xl border border-red-200 text-red-400 hover:bg-red-100 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleDeleteData}
                    className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors">
                    Sí, eliminar
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ACERCA DE */}
        <section>
          <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-3">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <p className="text-base font-black text-slate-900 tracking-tight">Ruta Digna</p>
            <p className="text-xs text-slate-400 font-medium">Versión 2.0.0 · Hackathon Talent Land 2026</p>
            <p className="text-[10px] text-slate-300 font-medium pt-1">
              Sistema de atención inteligente · Powered by Claude AI
            </p>
          </div>
        </section>

      </main>
      <BottomNav />
    </div>
  )
}
