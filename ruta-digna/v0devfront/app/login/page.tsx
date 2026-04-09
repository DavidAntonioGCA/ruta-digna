"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Phone, ArrowRight, Activity, Sparkles, ShieldCheck,
  Lock, User, Calendar, Globe, MapPin, ChevronRight,
  CheckCircle2, AlertCircle, Eye, EyeOff, Baby, Accessibility
} from "lucide-react"
import { verificarPaciente, loginPaciente, registrarPaciente, type VerificarResponse } from "@/app/lib/api"

type Paso = 'telefono' | 'cuenta_activa' | 'primer_acceso_sd' | 'nuevo'

const TIPO_INFO: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  adulto_mayor: { label: "Adulto mayor", color: "text-amber-700 bg-amber-50 border-amber-200", icon: "👴", desc: "Atención prioritaria por edad" },
  discapacidad:  { label: "Discapacidad",  color: "text-purple-700 bg-purple-50 border-purple-200", icon: "♿", desc: "Acceso preferencial" },
  embarazada:    { label: "Embarazada",    color: "text-pink-700 bg-pink-50 border-pink-200",   icon: "🤰", desc: "Atención prioritaria" },
  con_cita:      { label: "Con cita previa", color: "text-blue-700 bg-blue-50 border-blue-200", icon: "📋", desc: "Paciente con historial" },
  sin_cita:      { label: "Sin cita",      color: "text-slate-600 bg-slate-50 border-slate-200", icon: "👤", desc: "Paciente nuevo" },
}

function PinInput({ value, onChange, placeholder = "••••" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 border-2 border-transparent focus-within:border-blue-300 shadow-sm transition-all">
      <Lock className="w-5 h-5 text-slate-300 shrink-0" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder={placeholder}
        inputMode="numeric"
        className="flex-1 text-slate-800 font-black text-2xl tracking-[0.5em] outline-none bg-transparent placeholder:text-slate-200 placeholder:tracking-widest placeholder:text-base placeholder:font-normal"
      />
      <button type="button" onClick={() => setShow(!show)} className="text-slate-300 hover:text-slate-500 transition-colors">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

function Campo({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 flex items-center gap-1.5">
        <Icon className="w-3 h-3" /> {label}
      </label>
      {children}
    </div>
  )
}

function inputCls(extra = "") {
  return `w-full px-4 py-3.5 rounded-2xl border-2 border-transparent bg-white shadow-sm text-slate-800 font-semibold outline-none focus:border-blue-300 transition-all placeholder:text-slate-300 placeholder:font-normal ${extra}`
}

export default function Login() {
  const router = useRouter()
  const [paso, setPaso] = useState<Paso>("telefono")
  const [telefono, setTelefono] = useState("")
  const [pin, setPin] = useState("")
  const [nuevoPin, setNuevoPin] = useState("")
  const [confirmarPin, setConfirmarPin] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificado, setVerificado] = useState<VerificarResponse | null>(null)
  const [embarazada, setEmbarazada] = useState(false)

  // Formulario de registro nuevo
  const [form, setForm] = useState({
    nombre: "", primer_apellido: "", segundo_apellido: "",
    fecha_nacimiento: "", sexo: "", nacionalidad: "Mexicana", residencia: "",
    discapacidad: false,
  })

  const saveSession = (paciente_id: string, nombre: string, telefono: string, visita_id: string | null, tipo_paciente: string) => {
    localStorage.setItem("ruta_session", JSON.stringify({ paciente_id, nombre, telefono, visita_id, tipo_paciente }))
    document.cookie = "ruta_auth=1; path=/; max-age=2592000; samesite=lax"
  }

  // ── PASO 1: Verificar teléfono ────────────────────────────────────
  const handleVerificar = async () => {
    if (telefono.length < 10) return
    setLoading(true); setError(null)
    try {
      const data = await verificarPaciente(telefono)
      setVerificado(data)
      setPaso(data.escenario)
    } catch {
      setError("Error de conexión. Verifica que el backend esté activo.")
    } finally { setLoading(false) }
  }

  // ── PASO 2a: Login con PIN ────────────────────────────────────────
  const handleLogin = async () => {
    if (pin.length !== 4) { setError("El PIN debe tener 4 dígitos"); return }
    setLoading(true); setError(null)
    try {
      const data = await loginPaciente(telefono, pin)
      saveSession(data.paciente_id, data.nombre, telefono, data.visita_id, data.tipo_paciente)
      router.push(data.visita_id ? `/tracking?id=${data.visita_id}` : "/recomendar")
    } catch (e: any) {
      setError(e.message?.includes("401") ? "PIN incorrecto. Intenta de nuevo." : "Error de conexión.")
    } finally { setLoading(false) }
  }

  // ── PASO 2b: Primer acceso desde SD ──────────────────────────────
  const handleActivarSD = async () => {
    if (nuevoPin.length !== 4) { setError("El PIN debe tener 4 dígitos"); return }
    if (nuevoPin !== confirmarPin) { setError("Los PINs no coinciden"); return }
    if (!verificado?.datos_sd) return
    setLoading(true); setError(null)
    try {
      const sd = verificado.datos_sd
      const data = await registrarPaciente({
        nombre: sd.nombre, primer_apellido: sd.primer_apellido,
        segundo_apellido: sd.segundo_apellido, telefono,
        fecha_nacimiento: sd.fecha_nacimiento, sexo: sd.sexo,
        nacionalidad: sd.nacionalidad, residencia: sd.residencia,
        discapacidad: sd.discapacidad, embarazada, pin: nuevoPin,
      })
      saveSession(data.paciente_id, data.nombre, telefono, null, data.tipo_paciente)
      router.push("/recomendar")
    } catch { setError("Error al activar la cuenta. Intenta de nuevo.") }
    finally { setLoading(false) }
  }

  // ── PASO 2c: Registro nuevo ───────────────────────────────────────
  const handleRegistro = async () => {
    if (!form.nombre || !form.primer_apellido || !form.fecha_nacimiento || !form.sexo) {
      setError("Completa los campos obligatorios"); return
    }
    if (nuevoPin.length !== 4) { setError("El PIN debe tener 4 dígitos"); return }
    if (nuevoPin !== confirmarPin) { setError("Los PINs no coinciden"); return }
    setLoading(true); setError(null)
    try {
      const data = await registrarPaciente({ ...form, telefono, embarazada, pin: nuevoPin })
      saveSession(data.paciente_id, data.nombre, telefono, null, data.tipo_paciente)
      router.push("/recomendar")
    } catch { setError("Error al registrarte. Intenta de nuevo.") }
    finally { setLoading(false) }
  }

  const tipoInfo = verificado?.tipo_paciente
    ? TIPO_INFO[verificado.tipo_paciente] ?? TIPO_INFO.sin_cita
    : verificado?.tipo_detectado
    ? TIPO_INFO[verificado.tipo_detectado] ?? TIPO_INFO.sin_cita
    : null

  const mostrarEmbarazada =
    (verificado?.mujer_fertil) ||
    (form.sexo === "F" && (() => {
      try {
        const age = (Date.now() - new Date(form.fecha_nacimiento).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
        return age >= 15 && age <= 50
      } catch { return false }
    })())

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black bg-gradient-to-br from-blue-600 to-emerald-500 bg-clip-text text-transparent tracking-tight">
              Ruta Digna
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">Acceso Paciente</p>
          </div>
        </div>
        <Sparkles className="w-5 h-5 text-blue-300" />
      </header>

      <main className="max-w-md mx-auto px-6 py-8">

        {/* ── PASO 1: Teléfono ── */}
        {paso === "telefono" && (
          <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-blue-900/5 border border-slate-50 space-y-6">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">Bienvenido</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">
                Ingresa tu número para verificar si tienes registro en Salud Digna.
              </p>
            </div>

            <Campo label="Número de teléfono" icon={Phone}>
              <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 border-2 border-transparent focus-within:border-blue-300 shadow-sm transition-all">
                <Phone className="w-5 h-5 text-slate-300 shrink-0" />
                <input
                  type="tel" inputMode="numeric" value={telefono}
                  onChange={e => setTelefono(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  onKeyDown={e => e.key === "Enter" && handleVerificar()}
                  placeholder="Ej: 6671234567"
                  className="flex-1 text-slate-800 font-bold outline-none bg-transparent placeholder:text-slate-300 placeholder:font-normal text-base"
                />
                {telefono.length === 10 && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
              </div>
            </Campo>

            {error && <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex gap-2"><AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><p className="text-sm text-red-700 font-bold">{error}</p></div>}

            <button onClick={handleVerificar} disabled={loading || telefono.length < 10}
              className="w-full bg-blue-600 disabled:bg-slate-200 text-white font-black py-5 rounded-[22px] shadow-xl shadow-blue-500/20 transition-all active:scale-[0.97] flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:text-slate-400 disabled:shadow-none">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>Verificar número</span><ArrowRight className="w-4 h-4" /></>}
            </button>

            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-slate-100" />
              <ShieldCheck className="w-3.5 h-3.5 text-slate-300" />
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <p className="text-xs text-center text-slate-400 font-medium">
              Verificamos tu número contra el registro de Salud Digna para proteger tu atención.
            </p>
          </div>
        )}

        {/* ── PASO 2a: Cuenta activa → PIN ── */}
        {paso === "cuenta_activa" && verificado && (
          <div className="space-y-4">
            <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-blue-900/5 border border-slate-50 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center">
                  <User className="w-7 h-7 text-white/70" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bienvenido de vuelta</p>
                  <p className="text-xl font-black text-slate-900">{verificado.nombre_mascara}</p>
                </div>
              </div>

              {tipoInfo && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-bold ${tipoInfo.color}`}>
                  <span className="text-xl">{tipoInfo.icon}</span>
                  <div>
                    <p className="font-black">{tipoInfo.label}</p>
                    <p className="font-medium text-xs opacity-70">{tipoInfo.desc}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tu PIN de 4 dígitos</label>
                <PinInput value={pin} onChange={setPin} />
                {!verificado.tiene_pin && (
                  <p className="text-xs text-slate-400 ml-1">💡 Si es tu primera vez, usa los últimos 4 dígitos de tu teléfono.</p>
                )}
              </div>

              {error && <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex gap-2"><AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><p className="text-sm text-red-700 font-bold">{error}</p></div>}

              <button onClick={handleLogin} disabled={loading || pin.length !== 4}
                className="w-full bg-blue-600 disabled:bg-slate-200 text-white font-black py-5 rounded-[22px] shadow-xl shadow-blue-500/20 transition-all active:scale-[0.97] flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:text-slate-400 disabled:shadow-none">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>Entrar</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>

            <button onClick={() => { setPaso("telefono"); setError(null); setPin("") }}
              className="w-full text-sm text-slate-400 font-bold py-3 hover:text-slate-600 transition-colors">
              ← Cambiar número
            </button>
          </div>
        )}

        {/* ── PASO 2b: Primer acceso desde SD ── */}
        {paso === "primer_acceso_sd" && verificado?.datos_sd && (
          <div className="space-y-4">
            <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-blue-900/5 border border-slate-50 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Encontrado en Salud Digna</p>
                </div>
                <h2 className="text-xl font-black text-slate-900">
                  {verificado.datos_sd.nombre} {verificado.datos_sd.primer_apellido}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">Confirma tus datos y crea tu PIN para acceder.</p>
              </div>

              {/* Datos del paciente en SD */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tus datos registrados</p>
                {[
                  { label: "Nombre completo", value: `${verificado.datos_sd.nombre} ${verificado.datos_sd.primer_apellido} ${verificado.datos_sd.segundo_apellido}` },
                  { label: "Fecha de nacimiento", value: new Date(verificado.datos_sd.fecha_nacimiento + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }) },
                  { label: "Sexo", value: verificado.datos_sd.sexo === "F" ? "Femenino" : "Masculino" },
                  { label: "Nacionalidad", value: verificado.datos_sd.nacionalidad },
                  { label: "Residencia", value: verificado.datos_sd.residencia },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-3 py-1 border-b border-slate-100 last:border-0">
                    <span className="text-xs text-slate-400 font-medium shrink-0">{label}</span>
                    <span className="text-xs text-slate-700 font-bold text-right">{value}</span>
                  </div>
                ))}
                {verificado.datos_sd.discapacidad && (
                  <div className="flex items-center gap-2 pt-1">
                    <Accessibility className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-xs font-bold text-purple-600">Registro con discapacidad</span>
                  </div>
                )}
              </div>

              {/* Tipo detectado */}
              {tipoInfo && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-bold ${tipoInfo.color}`}>
                  <span className="text-xl">{tipoInfo.icon}</span>
                  <div>
                    <p className="font-black">Prioridad detectada: {tipoInfo.label}</p>
                    <p className="font-medium text-xs opacity-70">Asignada automáticamente por el sistema</p>
                  </div>
                </div>
              )}

              {/* Embarazada (solo mujeres fértiles) */}
              {mostrarEmbarazada && (
                <button onClick={() => setEmbarazada(!embarazada)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${embarazada ? "border-pink-300 bg-pink-50" : "border-slate-200 bg-white"}`}>
                  <Baby className={`w-5 h-5 ${embarazada ? "text-pink-500" : "text-slate-300"}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${embarazada ? "text-pink-700" : "text-slate-600"}`}>¿Actualmente estás embarazada?</p>
                    <p className="text-xs text-slate-400 mt-0.5">Recibirás atención prioritaria</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${embarazada ? "border-pink-500 bg-pink-500" : "border-slate-300"}`}>
                    {embarazada && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Crea tu PIN de acceso (4 dígitos)</label>
                <PinInput value={nuevoPin} onChange={setNuevoPin} placeholder="Crear PIN" />
                <PinInput value={confirmarPin} onChange={setConfirmarPin} placeholder="Confirmar PIN" />
              </div>

              {error && <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex gap-2"><AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><p className="text-sm text-red-700 font-bold">{error}</p></div>}

              <button onClick={handleActivarSD} disabled={loading || nuevoPin.length !== 4 || nuevoPin !== confirmarPin}
                className="w-full bg-blue-600 disabled:bg-slate-200 text-white font-black py-5 rounded-[22px] shadow-xl shadow-blue-500/20 transition-all active:scale-[0.97] flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:text-slate-400 disabled:shadow-none">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>Activar cuenta</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>

            <button onClick={() => { setPaso("telefono"); setError(null) }}
              className="w-full text-sm text-slate-400 font-bold py-3 hover:text-slate-600 transition-colors">
              ← Cambiar número
            </button>
          </div>
        )}

        {/* ── PASO 2c: Registro completamente nuevo ── */}
        {paso === "nuevo" && (
          <div className="space-y-4">
            <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-blue-900/5 border border-slate-50 space-y-5">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Número no encontrado en Salud Digna</p>
                <h2 className="text-xl font-black text-slate-900">Crear cuenta nueva</h2>
                <p className="text-sm text-slate-500 mt-0.5">Completa tus datos para registrarte.</p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Nombre *" icon={User}>
                    <input value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))}
                      placeholder="Nombre" className={inputCls()} />
                  </Campo>
                  <Campo label="Primer apellido *" icon={User}>
                    <input value={form.primer_apellido} onChange={e => setForm(f => ({...f, primer_apellido: e.target.value}))}
                      placeholder="Apellido" className={inputCls()} />
                  </Campo>
                </div>

                <Campo label="Segundo apellido" icon={User}>
                  <input value={form.segundo_apellido} onChange={e => setForm(f => ({...f, segundo_apellido: e.target.value}))}
                    placeholder="Segundo apellido (opcional)" className={inputCls()} />
                </Campo>

                <Campo label="Fecha de nacimiento *" icon={Calendar}>
                  <input type="date" value={form.fecha_nacimiento} onChange={e => setForm(f => ({...f, fecha_nacimiento: e.target.value}))}
                    className={inputCls()} />
                </Campo>

                <Campo label="Sexo *" icon={User}>
                  <div className="grid grid-cols-2 gap-2">
                    {[{v:"M", l:"Masculino"}, {v:"F", l:"Femenino"}].map(({v, l}) => (
                      <button key={v} onClick={() => setForm(f => ({...f, sexo: v}))}
                        className={`py-3.5 rounded-2xl text-sm font-bold border-2 transition-all ${form.sexo === v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </Campo>

                <Campo label="Nacionalidad" icon={Globe}>
                  <input value={form.nacionalidad} onChange={e => setForm(f => ({...f, nacionalidad: e.target.value}))}
                    placeholder="Mexicana" className={inputCls()} />
                </Campo>

                <Campo label="Ciudad de residencia" icon={MapPin}>
                  <input value={form.residencia} onChange={e => setForm(f => ({...f, residencia: e.target.value}))}
                    placeholder="Ej: Culiacán, Sinaloa" className={inputCls()} />
                </Campo>

                {/* Discapacidad */}
                <button onClick={() => setForm(f => ({...f, discapacidad: !f.discapacidad}))}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${form.discapacidad ? "border-purple-300 bg-purple-50" : "border-slate-200 bg-white"}`}>
                  <Accessibility className={`w-5 h-5 ${form.discapacidad ? "text-purple-500" : "text-slate-300"}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${form.discapacidad ? "text-purple-700" : "text-slate-600"}`}>¿Tienes alguna discapacidad?</p>
                    <p className="text-xs text-slate-400 mt-0.5">Acceso preferencial y atención prioritaria</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${form.discapacidad ? "border-purple-500 bg-purple-500" : "border-slate-300"}`}>
                    {form.discapacidad && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>

                {/* Embarazada */}
                {mostrarEmbarazada && (
                  <button onClick={() => setEmbarazada(!embarazada)}
                    className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${embarazada ? "border-pink-300 bg-pink-50" : "border-slate-200 bg-white"}`}>
                    <Baby className={`w-5 h-5 ${embarazada ? "text-pink-500" : "text-slate-300"}`} />
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${embarazada ? "text-pink-700" : "text-slate-600"}`}>¿Actualmente estás embarazada?</p>
                      <p className="text-xs text-slate-400 mt-0.5">Recibirás atención prioritaria</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${embarazada ? "border-pink-500 bg-pink-500" : "border-slate-300"}`}>
                      {embarazada && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                )}
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Crea tu PIN de acceso (4 dígitos)</label>
                <PinInput value={nuevoPin} onChange={setNuevoPin} placeholder="Crear PIN" />
                <PinInput value={confirmarPin} onChange={setConfirmarPin} placeholder="Confirmar PIN" />
              </div>

              {error && <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex gap-2"><AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><p className="text-sm text-red-700 font-bold">{error}</p></div>}

              <button onClick={handleRegistro} disabled={loading || !form.nombre || !form.primer_apellido || !form.fecha_nacimiento || !form.sexo || nuevoPin.length !== 4 || nuevoPin !== confirmarPin}
                className="w-full bg-blue-600 disabled:bg-slate-200 text-white font-black py-5 rounded-[22px] shadow-xl shadow-blue-500/20 transition-all active:scale-[0.97] flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:text-slate-400 disabled:shadow-none">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>Crear cuenta</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>

            <button onClick={() => { setPaso("telefono"); setError(null) }}
              className="w-full text-sm text-slate-400 font-bold py-3 hover:text-slate-600 transition-colors">
              ← Cambiar número
            </button>
          </div>
        )}

      </main>
    </div>
  )
}
