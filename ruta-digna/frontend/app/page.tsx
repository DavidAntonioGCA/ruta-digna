'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

type Paso = 'telefono' | 'pin' | 'registro' | 'loading'

export default function HomePage() {
  const router = useRouter()
  const [paso, setPaso] = useState<Paso>('telefono')
  const [telefono, setTelefono] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [escenario, setEscenario] = useState<string>('')
  const [nombreMascara, setNombreMascara] = useState('')
  const [tienePIN, setTienePIN] = useState(false)
  const [datosSd, setDatosSd] = useState<any>(null)
  const [registro, setRegistro] = useState({
    nombre: '', primer_apellido: '', segundo_apellido: '',
    fecha_nacimiento: '', sexo: '', pin: '', pin2: '',
    discapacidad: false, embarazada: false,
  })

  const verificarTelefono = async () => {
    if (telefono.length < 10) { setError('Ingresa un teléfono de 10 dígitos'); return }
    setError(''); setLoading(true)
    try {
      const data = await apiFetch<any>(`/paciente/verificar?telefono=${telefono}`)
      setEscenario(data.escenario)
      if (data.escenario === 'cuenta_activa') {
        setNombreMascara(data.nombre_mascara)
        setTienePIN(data.tiene_pin)
        setPaso('pin')
      } else if (data.escenario === 'primer_acceso_sd') {
        setDatosSd(data.datos_sd)
        setRegistro(r => ({
          ...r,
          nombre: data.datos_sd.nombre || '',
          primer_apellido: data.datos_sd.primer_apellido || '',
          segundo_apellido: data.datos_sd.segundo_apellido || '',
          fecha_nacimiento: data.datos_sd.fecha_nacimiento || '',
          sexo: data.datos_sd.sexo || '',
        }))
        setPaso('registro')
      } else {
        setPaso('registro')
      }
    } catch { setError('Error al verificar. Intenta de nuevo.') }
    finally { setLoading(false) }
  }

  const loginConPIN = async () => {
    setError(''); setLoading(true)
    try {
      const data = await apiFetch<any>('/paciente/login', {
        method: 'POST',
        body: JSON.stringify({ telefono, pin }),
      })
      if (data.visita_id) {
        router.push(`/chat/${data.visita_id}`)
      } else {
        // No tiene visita activa — crear una nueva
        await iniciarVisita(data.paciente_id, data.tipo_paciente)
      }
    } catch (e: any) {
      setError(e.message?.includes('401') ? 'PIN incorrecto' : 'Error al iniciar sesión')
    } finally { setLoading(false) }
  }

  const registrarYEntrar = async () => {
    if (!registro.nombre || !registro.primer_apellido || !registro.fecha_nacimiento || !registro.sexo) {
      setError('Completa todos los campos obligatorios'); return
    }
    if (registro.pin && registro.pin !== registro.pin2) {
      setError('Los PINs no coinciden'); return
    }
    setError(''); setLoading(true)
    try {
      const data = await apiFetch<any>('/paciente/registrar', {
        method: 'POST',
        body: JSON.stringify({ ...registro, telefono, pin: registro.pin || undefined }),
      })
      await iniciarVisita(data.paciente_id, data.tipo_paciente)
    } catch { setError('Error al registrar. Intenta de nuevo.') }
    finally { setLoading(false) }
  }

  const iniciarVisita = async (pacienteId: string, tipoPaciente: string) => {
    // Usar la primera sucursal disponible (por defecto sucursal 1)
    const data = await apiFetch<any>('/visitas/iniciar', {
      method: 'POST',
      body: JSON.stringify({ id_paciente: pacienteId, id_sucursal: 1, tipo_paciente: tipoPaciente }),
    })
    router.push(`/chat/${data.visita_id}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/30 mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9 text-white" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Ruta Digna</h1>
          <p className="text-sm text-gray-500 mt-1">Tu camino en la clínica, paso a paso</p>
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/80 p-6">

          {/* PASO 1: TELÉFONO */}
          {paso === 'telefono' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-800">¡Bienvenido!</h2>
                <p className="text-sm text-gray-500 mt-1">Ingresa tu número de teléfono para continuar</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Teléfono</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={telefono}
                  onChange={e => setTelefono(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && verificarTelefono()}
                  placeholder="10 dígitos"
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <button
                onClick={verificarTelefono}
                disabled={loading || telefono.length < 10}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/30"
              >
                {loading ? 'Verificando...' : 'Continuar →'}
              </button>
            </div>
          )}

          {/* PASO 2: PIN */}
          {paso === 'pin' && (
            <div className="space-y-5">
              <div>
                <button onClick={() => { setPaso('telefono'); setError(''); setPin('') }} className="text-xs text-blue-600 font-semibold mb-3 flex items-center gap-1">
                  ← Cambiar número
                </button>
                <h2 className="text-lg font-bold text-gray-800">Hola, {nombreMascara}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {tienePIN ? 'Ingresa tu PIN de 4 dígitos' : 'Ingresa los últimos 4 dígitos de tu teléfono como PIN'}
                </p>
              </div>
              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && loginConPIN()}
                  placeholder="● ● ● ●"
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-2xl font-mono tracking-[1rem] text-center focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <button
                onClick={loginConPIN}
                disabled={loading || pin.length < 4}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-600/30"
              >
                {loading ? 'Entrando...' : 'Entrar →'}
              </button>
            </div>
          )}

          {/* PASO 3: REGISTRO */}
          {paso === 'registro' && (
            <div className="space-y-4">
              <div>
                <button onClick={() => { setPaso('telefono'); setError('') }} className="text-xs text-blue-600 font-semibold mb-3 flex items-center gap-1">
                  ← Cambiar número
                </button>
                <h2 className="text-lg font-bold text-gray-800">
                  {datosSd ? 'Confirma tus datos' : 'Registro nuevo'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {datosSd ? 'Encontramos tu información en el sistema' : 'Completa tus datos para continuar'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Input label="Nombre(s) *" value={registro.nombre} onChange={v => setRegistro(r => ({ ...r, nombre: v }))} />
                <Input label="Primer apellido *" value={registro.primer_apellido} onChange={v => setRegistro(r => ({ ...r, primer_apellido: v }))} />
                <Input label="Segundo apellido" value={registro.segundo_apellido} onChange={v => setRegistro(r => ({ ...r, segundo_apellido: v }))} />

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Fecha de nacimiento *</label>
                  <input
                    type="date"
                    value={registro.fecha_nacimiento}
                    onChange={e => setRegistro(r => ({ ...r, fecha_nacimiento: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Sexo *</label>
                  <select
                    value={registro.sexo}
                    onChange={e => setRegistro(r => ({ ...r, sexo: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="">Selecciona</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={registro.discapacidad} onChange={e => setRegistro(r => ({ ...r, discapacidad: e.target.checked }))} className="w-4 h-4 rounded text-blue-600" />
                    Discapacidad
                  </label>
                  {registro.sexo === 'F' && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={registro.embarazada} onChange={e => setRegistro(r => ({ ...r, embarazada: e.target.checked }))} className="w-4 h-4 rounded text-blue-600" />
                      Embarazada
                    </label>
                  )}
                </div>

                <div className="border-t pt-3">
                  <p className="text-xs text-gray-500 mb-2">PIN de acceso (opcional — se usará los últimos 4 dígitos de tu tel. si no defines uno)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="PIN (4 dígitos)" value={registro.pin} type="password" maxLength={4} onChange={v => setRegistro(r => ({ ...r, pin: v.replace(/\D/g, '') }))} />
                    <Input label="Confirmar PIN" value={registro.pin2} type="password" maxLength={4} onChange={v => setRegistro(r => ({ ...r, pin2: v.replace(/\D/g, '') }))} />
                  </div>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <button
                onClick={registrarYEntrar}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-600/30"
              >
                {loading ? 'Registrando...' : 'Registrarme y entrar →'}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Salud Digna · Sistema de Atención Inteligente
        </p>
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', maxLength }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; maxLength?: number
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
      />
    </div>
  )
}
