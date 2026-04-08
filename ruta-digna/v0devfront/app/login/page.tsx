"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Phone, User, ArrowRight, Activity, Sparkles, ShieldCheck } from "lucide-react"
import { buscarPaciente, registrarPaciente } from "@/app/lib/api"

export default function Login() {
  const router = useRouter()
  const [tab, setTab]         = useState<"login" | "register">("login")
  const [telefono, setTelefono] = useState("")
  const [nombre, setNombre]   = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const saveSession = (paciente_id: string, nombreP: string, visita_id: string | null) => {
    localStorage.setItem("ruta_session", JSON.stringify({ paciente_id, nombre: nombreP, telefono, visita_id }))
  }

  const handleLogin = async () => {
    if (!telefono.trim()) return
    setLoading(true); setError(null)
    try {
      const data = await buscarPaciente(telefono.trim())
      if (!data.encontrado) {
        setError("No encontramos ese número. ¿Eres nuevo? Regístrate abajo.")
        return
      }
      saveSession(data.paciente_id!, data.nombre!, data.visita_id ?? null)
      router.push(data.visita_id ? `/antes-de-ir?id=${data.visita_id}` : "/recomendar")
    } catch {
      setError("Error de conexión. Verifica que el backend esté activo.")
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!nombre.trim() || !telefono.trim()) return
    setLoading(true); setError(null)
    try {
      const data = await registrarPaciente(nombre.trim(), telefono.trim())
      saveSession(data.paciente_id, data.nombre, null)
      router.push("/recomendar")
    } catch {
      setError("Error al registrarte. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return
    tab === "login" ? handleLogin() : handleRegister()
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">

      {/* ── HERO ── */}
      <div className="relative bg-gradient-to-b from-[#0A1628] via-blue-950 to-slate-900 px-8 pt-20 pb-24 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-blue-600 rounded-full blur-[140px] opacity-10" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-500 rounded-full blur-[100px] opacity-10" />
        </div>

        <div className="relative max-w-md mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/50">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-black tracking-tighter text-lg leading-none">RUTA DIGNA</p>
              <p className="text-blue-400 text-[9px] font-bold uppercase tracking-[0.3em]">by Salud Digna · IA</p>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-black text-white tracking-tighter leading-[1.05] mb-4">
            Tu visita,<br />
            <span className="text-blue-400">sin esperas.</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium leading-relaxed">
            Optimizamos tu recorrido en la clínica con inteligencia artificial.
          </p>
        </div>
      </div>

      {/* ── FORM ── */}
      <div className="flex-1 bg-[#F8FAFC] rounded-t-[44px] -mt-10 px-6 pt-10 pb-16 max-w-md mx-auto w-full">

        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-[18px] mb-8">
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null) }}
              className={`flex-1 py-3.5 rounded-[14px] text-xs font-black transition-all tracking-wider uppercase ${
                tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {t === "login" ? "Ya tengo cuenta" : "Soy nuevo"}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {/* Nombre (solo en registro) */}
          {tab === "register" && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
                Tu nombre completo
              </label>
              <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 border-2 border-transparent focus-within:border-blue-300 shadow-sm transition-all">
                <User className="w-5 h-5 text-slate-300 shrink-0" />
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Ej: María González"
                  className="flex-1 text-slate-800 font-bold outline-none bg-transparent placeholder:text-slate-300 placeholder:font-normal text-base"
                />
              </div>
            </div>
          )}

          {/* Teléfono */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
              Número de teléfono
            </label>
            <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 border-2 border-transparent focus-within:border-blue-300 shadow-sm transition-all">
              <Phone className="w-5 h-5 text-slate-300 shrink-0" />
              <input
                type="tel"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ej: 6671234567"
                className="flex-1 text-slate-800 font-bold outline-none bg-transparent placeholder:text-slate-300 placeholder:font-normal text-base"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 animate-in slide-in-from-top-2">
              <p className="text-sm text-red-700 font-bold leading-snug">{error}</p>
              {error.includes("nuevo") && (
                <button
                  onClick={() => { setTab("register"); setError(null) }}
                  className="text-xs text-red-500 font-black underline mt-1"
                >
                  Ir a Registro →
                </button>
              )}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={tab === "login" ? handleLogin : handleRegister}
            disabled={loading || !telefono.trim() || (tab === "register" && !nombre.trim())}
            className="w-full mt-2 bg-blue-600 disabled:bg-slate-200 text-white font-black py-5 rounded-[22px] shadow-xl shadow-blue-500/20 transition-all active:scale-[0.97] flex items-center justify-center gap-3 group uppercase tracking-widest text-xs disabled:text-slate-400 disabled:shadow-none"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {tab === "login" ? "Acceder a mi visita" : "Crear mi cuenta"}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <Sparkles className="w-3.5 h-3.5 text-slate-300" />
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-slate-300" />
            <p className="text-xs font-medium text-center">
              Tus datos son privados · Salud Digna · Talent Land 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
