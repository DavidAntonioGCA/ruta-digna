"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, User, Phone, Camera, Check, Edit3,
  Shield, Sparkles, Save, AlertCircle, BadgeCheck
} from "lucide-react"
import BottomNav from "@/components/BottomNav"

interface Session {
  paciente_id: string
  nombre: string
  telefono: string
  tipo_paciente?: string
  visita_id: string | null
}

const TIPO_INFO: Record<string, { label: string; color: string; bg: string; icon: string; desc: string }> = {
  adulto_mayor: { label: "Adulto Mayor",   color: "text-amber-700", bg: "bg-amber-50 border-amber-200",  icon: "👴", desc: "Prioridad especial en atención" },
  discapacidad: { label: "Discapacidad",   color: "text-purple-700", bg: "bg-purple-50 border-purple-200", icon: "♿", desc: "Acceso preferencial garantizado" },
  embarazada:   { label: "Embarazada",     color: "text-pink-700",   bg: "bg-pink-50 border-pink-200",    icon: "🤰", desc: "Atención prioritaria en todo momento" },
  con_cita:     { label: "Con Cita",       color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",    icon: "📋", desc: "Cita programada en el sistema Salud Digna" },
  sin_cita:     { label: "Sin Cita",       color: "text-slate-600",  bg: "bg-slate-50 border-slate-200",  icon: "👤", desc: "Acceso general sin cita previa" },
  urgente:      { label: "Urgente",        color: "text-red-700",    bg: "bg-red-50 border-red-200",      icon: "🚨", desc: "Atención inmediata requerida" },
}

export default function PerfilPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [session, setSession] = useState<Session | null>(null)
  const [nombre, setNombre] = useState("")
  const [editingNombre, setEditingNombre] = useState(false)
  const [foto, setFoto] = useState<string | null>(null)
  const [savedOk, setSavedOk] = useState(false)
  const [savingNombre, setSavingNombre] = useState(false)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    try {
      const s: Session = JSON.parse(localStorage.getItem("ruta_session") || "null")
      if (!s) { router.push("/login"); return }
      setSession(s)
      setNombre(s.nombre ?? "")
      const savedFoto = localStorage.getItem(`rd_foto_${s.paciente_id}`)
      if (savedFoto) setFoto(savedFoto)
    } catch { router.push("/login") }
  }, [router])

  const handleGuardarNombre = () => {
    if (!nombre.trim() || !session) return
    setSavingNombre(true)
    setErrorMsg(null)
    try {
      const updated = { ...session, nombre: nombre.trim() }
      localStorage.setItem("ruta_session", JSON.stringify(updated))
      setSession(updated)
      setEditingNombre(false)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2500)
    } catch {
      setErrorMsg("No se pudo guardar el nombre.")
    } finally {
      setSavingNombre(false)
    }
  }

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session) return
    setUploadingFoto(true)
    setErrorMsg(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      if (base64.length > 2_000_000) {
        setErrorMsg("La imagen es demasiado grande. Usa una menor a 1.5 MB.")
        setUploadingFoto(false)
        return
      }
      setFoto(base64)
      localStorage.setItem(`rd_foto_${session.paciente_id}`, base64)
      setUploadingFoto(false)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2500)
    }
    reader.onerror = () => {
      setErrorMsg("No se pudo leer la imagen.")
      setUploadingFoto(false)
    }
    reader.readAsDataURL(file)
  }

  const tipoPaciente = session?.tipo_paciente ?? "sin_cita"
  const tipoInfo = TIPO_INFO[tipoPaciente] ?? TIPO_INFO.sin_cita

  if (!session) return null

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28 text-slate-900">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-5 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <Link href="/ajustes" className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-all active:scale-90">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black tracking-tight text-slate-900">Mi Perfil</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ruta Digna</p>
          </div>
          <Sparkles className="w-5 h-5 text-blue-400/40" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-8 space-y-6">

        {/* ─── AVATAR ─── */}
        <section className="flex flex-col items-center gap-4">
          <div className="relative group">
            <div className="w-28 h-28 rounded-[32px] overflow-hidden border-4 border-white shadow-xl shadow-blue-900/10 bg-gradient-to-br from-slate-100 to-blue-50 flex items-center justify-center">
              {foto
                ? <img src={foto} alt="Foto de perfil" className="w-full h-full object-cover" />
                : <User className="w-12 h-12 text-slate-300" />
              }
            </div>
            {/* Botón de cambio de foto */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFoto}
              className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 transition-all active:scale-90 border-2 border-white"
              aria-label="Cambiar foto de perfil"
            >
              {uploadingFoto
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Camera className="w-4 h-4" />
              }
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFotoChange}
              id="foto-input"
            />
          </div>
          <p className="text-xs text-slate-400 font-medium">Toca el ícono para cambiar tu foto</p>
        </section>

        {/* ─── TOAST OK ─── */}
        {savedOk && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 animate-in slide-in-from-top-2 duration-300">
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-bold text-emerald-800">¡Cambios guardados correctamente!</p>
          </div>
        )}

        {/* ─── ERROR ─── */}
        {errorMsg && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-5 py-4">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm font-bold text-red-700">{errorMsg}</p>
          </div>
        )}

        {/* ─── NOMBRE ─── */}
        <section className="bg-white rounded-[28px] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 pt-6 pb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Nombre del paciente</p>
          </div>
          {editingNombre ? (
            <div className="px-6 pb-6 space-y-3">
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleGuardarNombre()}
                className="w-full px-5 py-4 rounded-2xl border-2 border-blue-200 bg-blue-50/30 text-base font-bold text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all"
                autoFocus
                maxLength={80}
                placeholder="Tu nombre completo"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingNombre(false); setNombre(session.nombre) }}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardarNombre}
                  disabled={savingNombre || !nombre.trim()}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:bg-slate-300 transition-colors flex items-center justify-center gap-2"
                >
                  {savingNombre
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Save className="w-4 h-4" /> Guardar</>
                  }
                </button>
              </div>
            </div>
          ) : (
            <div
              className="px-6 pb-6 flex items-center justify-between gap-3 cursor-pointer group hover:bg-slate-50/50 transition-colors"
              onClick={() => setEditingNombre(true)}
            >
              <div className="flex items-center gap-3 py-2">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-base font-black text-slate-900">{session.nombre}</p>
                  <p className="text-xs text-slate-400 font-medium">Toca para editar</p>
                </div>
              </div>
              <Edit3 className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
            </div>
          )}
        </section>

        {/* ─── TELÉFONO (solo lectura) ─── */}
        <section className="bg-white rounded-[28px] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)]">
          <div className="px-6 pt-6 pb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Teléfono</p>
          </div>
          <div className="px-6 pb-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-slate-900 tracking-wide font-mono">{session.telefono || "—"}</p>
              <p className="text-xs text-slate-400 font-medium">Solo lectura · Proporcionado al registrarte</p>
            </div>
            <Shield className="w-4 h-4 text-slate-200 shrink-0" />
          </div>
        </section>

        {/* ─── TIPO DE PACIENTE ─── */}
        <section className="bg-white rounded-[28px] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)]">
          <div className="px-6 pt-6 pb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Tipo de paciente</p>
          </div>
          <div className="px-6 pb-6">
            <div className={`flex items-center gap-4 p-4 rounded-2xl border ${tipoInfo.bg}`}>
              <span className="text-3xl">{tipoInfo.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-black text-base ${tipoInfo.color}`}>{tipoInfo.label}</p>
                  <BadgeCheck className={`w-4 h-4 ${tipoInfo.color} opacity-70`} />
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{tipoInfo.desc}</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-300 font-medium mt-3 text-center">
              El tipo se asigna automáticamente al registrarte o con tu expediente de Salud Digna
            </p>
          </div>
        </section>

        {/* ─── PRIVACIDAD ─── */}
        <div className="flex items-start gap-3 px-4 py-4 bg-blue-50 rounded-2xl border border-blue-100">
          <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 font-medium leading-relaxed">
            Tu foto se guarda únicamente en este dispositivo. Tus datos personales nunca se comparten con terceros.
          </p>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
