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
    document.cookie = "ruta_auth=1; path=/; max-age=2592000; samesite=lax"
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
    <div className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-900">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <div className="select-none text-left">
            <h1 className="text-xl font-black bg-gradient-to-br from-blue-600 to-emerald-500 bg-clip-text text-transparent tracking-tight">
              Ruta Digna
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">Acceso Paciente</p>
          </div>
        </div>
        <Sparkles className="w-5 h-5 text-blue-500/30" />
      </header>

      <main className="max-w-md mx-auto px-6 py-8">
        <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-blue-900/5 border border-slate-50">
          <div className="mb-6 text-left">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Tu visita, sin esperas</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Inicia sesión o crea tu cuenta para continuar.
            </p>
          </div>

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
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '')
                  setTelefono(val)
                }}
                onKeyDown={onKey}
                placeholder="Ej: 6671234567"
                className="flex-1 text-slate-800 font-bold outline-none bg-transparent placeholder:text-slate-300 placeholder:font-normal text-base"
                inputMode="numeric"
                pattern="[0-9]*"
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
      </main>
    </div>
  )
}
