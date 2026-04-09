"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  X, User, Phone, LogOut, Activity, ChevronRight, Lock,
  Bell, BellOff, Copy, CheckCheck, FileText, Trash2,
  Share2, Sparkles, ChevronDown, ChevronUp, MapPin, Settings2, UserCircle2
} from "lucide-react"

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
    q: "¿Dónde veo mis resultados?",
    a: "En 'Mi visita' (Tracking), al final de la página encontrarás 'Mis Resultados' con los archivos que el especialista haya subido para ti.",
  },
  {
    q: "¿Qué significa cada color de prioridad?",
    a: "Rojo = Urgente · Rosa = Embarazada · Ámbar = Adulto mayor · Morado = Discapacidad · Azul = Con cita · Gris = Sin cita",
  },
  {
    q: "¿Puedo tener varios estudios en una visita?",
    a: "Sí. Al crear tu visita puedes seleccionar varios estudios. El sistema genera la ruta más eficiente para realizarlos todos.",
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3.5 text-left gap-3"
      >
        <span className="text-sm font-semibold text-slate-700 leading-snug">{q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <p className="text-xs text-slate-500 leading-relaxed pb-3.5">{a}</p>
      )}
    </div>
  )
}

function NavItem({
  icon: Icon, iconBg, label, sublabel, right, onClick, danger, href, onClose,
}: {
  icon: any; iconBg: string; label: string; sublabel?: string
  right?: React.ReactNode; onClick?: () => void; danger?: boolean
  href?: string; onClose?: () => void
}) {
  const inner = (
    <div
      onClick={onClick}
      className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all cursor-pointer
        ${danger ? "hover:bg-red-50" : "hover:bg-slate-50"}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight ${danger ? "text-red-600" : "text-slate-800"}`}>{label}</p>
        {sublabel && <p className="text-xs text-slate-400 mt-0.5 truncate">{sublabel}</p>}
      </div>
      {right ?? <ChevronRight className={`w-4 h-4 shrink-0 ${danger ? "text-red-200" : "text-slate-200"}`} />}
    </div>
  )
  if (href) return <Link href={href} onClick={onClose}>{inner}</Link>
  return inner
}

export default function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
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
  }, [open])   // re-read session every time drawer opens

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  const handleLogout = () => {
    localStorage.removeItem("ruta_session")
    document.cookie = "ruta_auth=; path=/; max-age=0"
    onClose()
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
    const v = !notifs
    setNotifs(v)
    localStorage.setItem("rd_notifs", v ? "1" : "0")
  }

  const handleDeleteData = () => {
    localStorage.removeItem("ruta_session")
    localStorage.removeItem("rd_notifs")
    document.cookie = "ruta_auth=; path=/; max-age=0"
    onClose()
    router.push("/login")
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300
          ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      />

      {/* Drawer panel */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 flex flex-col bg-white shadow-2xl
          w-[85vw] max-w-sm
          transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-black tracking-tight text-slate-900 uppercase">Ajustes</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8 space-y-6">

          {/* Perfil */}
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 overflow-hidden">
                {(() => {
                  const foto = typeof window !== 'undefined' && session?.paciente_id
                    ? localStorage.getItem(`rd_foto_${session.paciente_id}`)
                    : null
                  return foto
                    ? <img src={foto} alt="Foto" className="w-full h-full object-cover" />
                    : <User className="w-6 h-6 text-white/70" />
                })()}
              </div>
              <div className="min-w-0">
                <p className="font-black text-base truncate">{session?.nombre ?? "Sin sesión"}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3 h-3 text-white/40" />
                  <span className="text-xs text-white/60">{session?.telefono ?? "—"}</span>
                </div>
              </div>
            </div>
            {session?.visita_id && (
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Visita activa</p>
                <span className="flex items-center gap-1.5 text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  En curso
                </span>
              </div>
            )}
          </div>

          {/* Mi visita */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1 px-1">Mi cuenta</p>
            <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
              <NavItem icon={UserCircle2} iconBg="bg-blue-50 text-blue-600"
                label="Mi Perfil" sublabel="Nombre, foto, tipo de paciente"
                href="/perfil" onClose={onClose} />
            </div>
          </div>

          {/* Mi visita */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1 px-1">Mi visita</p>
            <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
              <NavItem icon={Activity} iconBg="bg-blue-50 text-blue-600"
                label="Ver estado en tiempo real" sublabel="Cola, turno, estudios"
                href="/tracking" onClose={onClose} />
              <NavItem icon={MapPin} iconBg="bg-emerald-50 text-emerald-600"
                label="Buscar clínica" sublabel="Recomendación por IA"
                href="/recomendar" onClose={onClose} />
              <NavItem icon={FileText} iconBg="bg-purple-50 text-purple-600"
                label="Analizar mis resultados" sublabel="Sube imagen o texto para interpretación IA"
                href="/resultados" onClose={onClose} />
              {session?.visita_id && (
                <NavItem
                  icon={copied ? CheckCheck : Share2}
                  iconBg={copied ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}
                  label={copied ? "¡Enlace copiado!" : "Compartir mi turno"}
                  sublabel="Manda el link a un familiar"
                  onClick={handleCopyLink}
                  right={
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${copied ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                      {copied ? "✓" : "Copiar"}
                    </span>
                  }
                />
              )}
            </div>
          </div>

          {/* Preferencias */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1 px-1">Preferencias</p>
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <NavItem
                icon={notifs ? Bell : BellOff}
                iconBg={notifs ? "bg-amber-50 text-amber-500" : "bg-slate-100 text-slate-400"}
                label="Notificaciones"
                sublabel={notifs ? "Alertas de cambios en tu cola" : "Desactivadas"}
                onClick={handleToggleNotifs}
                right={
                  <div className={`w-10 h-5.5 h-[22px] rounded-full transition-colors relative shrink-0 ${notifs ? "bg-blue-600" : "bg-slate-200"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${notifs ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                  </div>
                }
              />
            </div>
          </div>

          {/* Privacidad */}
          <div className="bg-blue-50 rounded-2xl border border-blue-100 px-4 py-4 flex gap-3">
            <Lock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 font-medium leading-relaxed">
              Solo tú puedes ver tu historial. Los resultados son accesibles únicamente con tu ID de visita. No compartimos datos con terceros.
            </p>
          </div>

          {/* FAQ */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1 px-1">Ayuda</p>
            <div className="bg-white rounded-2xl border border-slate-100 px-4">
              {FAQ.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
            </div>
          </div>

          {/* Sesión */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1 px-1">Sesión</p>
            <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
              <NavItem icon={LogOut} iconBg="bg-red-50 text-red-500"
                label="Cerrar sesión" sublabel="Tu visita activa no se cancela"
                onClick={handleLogout} danger />
              {!showDeleteConfirm
                ? (
                  <NavItem icon={Trash2} iconBg="bg-red-50 text-red-400"
                    label="Eliminar datos locales" sublabel="Borra sesión y preferencias de este dispositivo"
                    onClick={() => setShowDeleteConfirm(true)} danger />
                ) : (
                  <div className="px-4 py-4 space-y-3">
                    <p className="text-sm font-bold text-red-700">¿Confirmar eliminación?</p>
                    <p className="text-xs text-red-400">Se borrarán los datos de este dispositivo. Tu historial en la clínica permanece.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                        Cancelar
                      </button>
                      <button onClick={handleDeleteData}
                        className="flex-1 py-2 text-xs font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors">
                        Eliminar
                      </button>
                    </div>
                  </div>
                )
              }
            </div>
          </div>

          {/* Acerca de */}
          <div className="text-center py-2 space-y-1">
            <p className="text-xs font-black text-slate-400 tracking-tight">Ruta Digna · v2.0.0</p>
            <p className="text-[10px] text-slate-300">Hackathon Talent Land 2026 · Powered by Claude AI</p>
          </div>

        </div>
      </aside>
    </>
  )
}
