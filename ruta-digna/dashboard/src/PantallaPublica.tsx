import { useEffect, useRef, useState } from 'react'
import { getPantallaData, getSucursalesEspecialista } from './api'

// ── Metadatos por área ─────────────────────────────────────────────
const AREA_META: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  LABORATORIO:        { icon: '🧪', color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100'    },
  ULTRASONIDO:        { icon: '📡', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  'RAYOS X':          { icon: '☢️',  color: 'text-purple-600', bg: 'bg-purple-50',  border: 'border-purple-100'  },
  TOMOGRAFÍA:         { icon: '🔬', color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-100'  },
  ELECTROCARDIOGRAMA: { icon: '❤️',  color: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-100'     },
  MASTOGRAFÍA:        { icon: '🩺', color: 'text-pink-600',    bg: 'bg-pink-50',    border: 'border-pink-100'    },
  DENSITOMETRÍA:      { icon: '🦴', color: 'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-cyan-100'    },
}

const TIPO_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  urgente:      { label: 'URGENTE',      color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-100'    },
  embarazada:   { label: 'EMBARAZADA',   color: 'text-pink-600',   bg: 'bg-pink-50',   border: 'border-pink-100'   },
  adulto_mayor: { label: 'ADULTO MAYOR', color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100'  },
  discapacidad: { label: 'DISCAPACIDAD', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  con_cita:     { label: 'CON CITA',     color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
  sin_cita:     { label: '',             color: '',                bg: '',             border: ''                  },
}

function getArea(area: string) {
  const k = Object.keys(AREA_META).find(k => area.toUpperCase().includes(k))
  return k ? AREA_META[k] : { icon: '🏥', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100' }
}

function pisoStr(piso?: number | null) {
  if (piso == null) return ''
  return piso <= 1 ? 'Planta Baja' : `Piso ${piso}`
}

// ── Tipos ──────────────────────────────────────────────────────────
interface TurnoData {
  turno_codigo:      string
  nombre_paciente:   string
  tipo_paciente:     string
  area:              string
  id_estudio:        number
  ubicacion:         string
  piso?:             number | null
  instrucciones:     string
  timestamp_llegada: string
}
interface PantallaData { sucursal: string; llamando: TurnoData[]; en_espera: TurnoData[] }
interface Sucursal     { id: number; nombre: string; ciudad: string; estado: string }

// ── Pantalla de selección ──────────────────────────────────────────
function SucursalSelector({ onSelect }: { onSelect: (s: Sucursal) => void }) {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading,    setLoading]    = useState(true)
  const [time,       setTime]       = useState(new Date())

  useEffect(() => {
    getSucursalesEspecialista().then(setSucursales).catch(() => setSucursales([]))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { const iv = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(iv) }, [])

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <header className="bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-xl shadow-lg shadow-blue-600/20">🏥</div>
          <div>
            <h1 className="font-black text-xl tracking-tighter text-slate-900 uppercase leading-none">Ruta Digna</h1>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-0.5">Pantalla Pública de Turnos</p>
          </div>
        </div>
        <span className="font-mono text-lg font-bold text-slate-400 tabular-nums">
          {time.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-10">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-3">— Configuración —</p>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-3">
              Selecciona la Sucursal
            </h2>
            <p className="text-slate-500 font-medium">
              Esta pantalla mostrará los turnos en tiempo real de la sucursal seleccionada.
            </p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {sucursales.map(s => (
                <button key={s.id} onClick={() => onSelect(s)}
                  className="group bg-white rounded-[28px] p-6 border-2 border-slate-100 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-600/10 transition-all text-left active:scale-95">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-600 flex items-center justify-center text-2xl mb-4 transition-colors">🏥</div>
                  <p className="font-black text-slate-900 text-base uppercase tracking-tight leading-tight">{s.nombre}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{s.ciudad}, {s.estado}</p>
                  <div className="mt-4 flex items-center gap-1.5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-black uppercase tracking-wider">Proyectar</span>
                    <span>→</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pantalla de turnos ─────────────────────────────────────────────
function DisplayTurnos({ sucursal, onCambiar }: { sucursal: Sucursal; onCambiar: () => void }) {
  const [data,   setData]   = useState<PantallaData | null>(null)
  const [flash,  setFlash]  = useState(false)
  const [time,   setTime]   = useState(new Date())
  const [online, setOnline] = useState(true)
  const prevKey = useRef('')

  useEffect(() => { const iv = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(iv) }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const d = await getPantallaData(sucursal.id)
        if (cancelled) return
        setData(d); setOnline(true)
        const key = d.llamando.map((t: TurnoData) => t.turno_codigo).join(',')
        if (key && key !== prevKey.current) { setFlash(true); setTimeout(() => setFlash(false), 3000) }
        prevKey.current = key
      } catch { if (!cancelled) setOnline(false) }
    }
    load(); const iv = setInterval(load, 3000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [sucursal.id])

  const llamando = data?.llamando  ?? []
  const espera   = data?.en_espera ?? []

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-xl shadow-lg shadow-blue-600/20">🏥</div>
          <div>
            <h1 className="font-black text-xl tracking-tighter text-slate-900 uppercase leading-none">Ruta Digna</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">
              {sucursal.nombre} · {sucursal.ciudad}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {data && llamando.length > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-blue-600 font-black text-xs uppercase tracking-wider">
                {llamando.length} llamando
              </span>
            </div>
          )}
          {data && (
            <span className="text-slate-400 text-xs font-black uppercase tracking-wider">
              {espera.length} en espera
            </span>
          )}
          <span className="font-mono text-xl font-bold text-slate-700 tabular-nums tracking-tight">
            {time.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs text-slate-400 font-bold">{online ? 'En vivo' : 'Sin conexión'}</span>
          </div>
          <button onClick={onCambiar}
            className="text-xs font-black uppercase tracking-wider text-slate-400 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-xl transition-all">
            Cambiar
          </button>
        </div>
      </header>

      {/* ── Cuerpo ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ══ Zona izquierda: turno llamado ══ */}
        <div className="flex-[3] flex flex-col items-center justify-center px-10 py-8 overflow-hidden">

          {llamando.length === 0 ? (
            /* Sin turnos */
            <div className="text-center">
              <div className="w-32 h-32 rounded-[40px] bg-slate-100 flex items-center justify-center text-6xl mx-auto mb-8">🪑</div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-3">Estado actual</p>
              <p className="text-4xl font-black text-slate-700 uppercase tracking-tighter">Sin turnos activos</p>
              <p className="text-slate-400 font-medium mt-3 text-lg">Espera tu llamado</p>
            </div>

          ) : llamando.length === 1 ? (
            /* Un solo turno — card grande */
            <TurnoCardGrande turno={llamando[0]} flash={flash} />

          ) : (
            /* Múltiples */
            <div className="w-full space-y-4 overflow-y-auto max-h-full py-4">
              <p className="text-center text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-6">
                — Turnos llamados —
              </p>
              {llamando.map((t, i) => <TurnoCardCompacto key={t.turno_codigo} turno={t} highlight={i === 0} />)}
            </div>
          )}
        </div>

        {/* Divisor */}
        <div className="w-px bg-slate-100 my-8 shrink-0" />

        {/* ══ Zona derecha: próximos ══ */}
        <div className="flex-[2] flex flex-col px-8 py-8 overflow-hidden bg-white">

          <div className="shrink-0 mb-5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Próximos en cola</p>
            {espera.length > 0 && (
              <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">
                {espera.length} persona{espera.length !== 1 ? 's' : ''} esperando
              </p>
            )}
          </div>

          {espera.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-[20px] bg-emerald-50 flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
                <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Cola vacía</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 scrollbar-none">
              {espera.map((t, i) => <EsperaRow key={t.turno_codigo} turno={t} pos={i + 1} />)}
            </div>
          )}

          <div className="shrink-0 mt-6 pt-5 border-t border-slate-50 text-center">
            <p className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Salud Digna · Ruta Digna</p>
          </div>
        </div>
      </div>

      {/* ── Ticker ── */}
      {espera.length >= 5 && (
        <div className="shrink-0 bg-white border-t border-slate-100 py-2.5 overflow-hidden">
          <div className="flex animate-marquee whitespace-nowrap text-xs font-bold">
            {[0, 1].map(copy => (
              <span key={copy} className="flex items-center shrink-0">
                <span className="text-slate-300 font-black mx-8 uppercase tracking-[0.2em]">En espera</span>
                {espera.map(t => (
                  <span key={`${copy}-${t.turno_codigo}`} className="mr-10 shrink-0">
                    <span className="text-slate-700 font-black">{t.turno_codigo}</span>
                    {t.nombre_paciente && (
                      <span className="ml-1.5 text-slate-400">{t.nombre_paciente.split(' ')[0]}</span>
                    )}
                    <span className="ml-2 text-slate-300 uppercase">· {t.area}</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tarjeta grande (1 turno) ───────────────────────────────────────
function TurnoCardGrande({ turno, flash }: { turno: TurnoData; flash: boolean }) {
  const area = getArea(turno.area)
  const tipo = TIPO_META[turno.tipo_paciente] ?? TIPO_META.sin_cita
  const loc  = [turno.ubicacion, pisoStr(turno.piso)].filter(Boolean).join(' · ')
  const [abrev, num] = turno.turno_codigo.split('-')

  return (
    <div className={`w-full transition-all duration-500 ${flash ? 'scale-[1.02]' : 'scale-100'}`}>
      {/* Sección hero oscura (igual al tracking page) */}
      <div className="bg-slate-900 rounded-[48px] p-10 text-white overflow-hidden shadow-2xl shadow-slate-900/20 relative mb-6">
        {/* Glow de fondo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[120px] opacity-20 -mr-32 -mt-32 pointer-events-none" />
        {flash && (
          <div className="absolute inset-0 bg-blue-600 rounded-[48px] opacity-5 pointer-events-none" />
        )}

        <div className="relative">
          {/* Label */}
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-5 text-center">
            — Turno llamado —
          </p>

          {/* Badge prioridad */}
          {tipo.label && (
            <div className="flex justify-center mb-5">
              <span className={`text-xs font-black uppercase tracking-[0.2em] px-5 py-2 rounded-full border ${tipo.bg} ${tipo.color} ${tipo.border}`}>
                {tipo.label}
              </span>
            </div>
          )}

          {/* Código GRANDE */}
          <div className="flex items-baseline justify-center gap-2 leading-none mb-2">
            <span className="text-[5rem] font-black text-slate-500 leading-none tracking-tight">{abrev}</span>
            <span className="text-[4rem] font-black text-slate-600 leading-none mb-1">-</span>
            <span className={`text-[10rem] font-black leading-none tracking-widest transition-colors duration-300 ${flash ? 'text-white' : 'text-slate-100'}`}>
              {num}
            </span>
          </div>

          {/* Nombre del paciente */}
          {turno.nombre_paciente && (
            <p className="text-center text-slate-300 font-bold text-xl mt-3 tracking-tight">
              {turno.nombre_paciente}
            </p>
          )}
        </div>
      </div>

      {/* Card de área + ubicación (blanca) */}
      <div className={`bg-white rounded-[32px] border-2 ${area.border} p-7 shadow-sm flex flex-col items-center gap-3`}>
        <div className="flex items-center gap-4">
          <span className="text-3xl font-black text-slate-400">→</span>
          <div className={`w-12 h-12 ${area.bg} rounded-2xl flex items-center justify-center text-2xl border ${area.border}`}>
            {area.icon}
          </div>
          <span className={`text-3xl font-black uppercase tracking-wide ${area.color}`}>
            {turno.area}
          </span>
        </div>
        {loc && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-slate-400 text-base">📍</span>
            <p className="text-slate-500 text-base font-bold">{loc}</p>
          </div>
        )}
        {turno.instrucciones && (
          <p className="text-slate-400 text-sm font-medium text-center max-w-sm">{turno.instrucciones}</p>
        )}
      </div>
    </div>
  )
}

// ── Tarjeta compacta (múltiples turnos) ───────────────────────────
function TurnoCardCompacto({ turno, highlight }: { turno: TurnoData; highlight: boolean }) {
  const area = getArea(turno.area)
  const tipo = TIPO_META[turno.tipo_paciente] ?? TIPO_META.sin_cita
  const loc  = [turno.ubicacion, pisoStr(turno.piso)].filter(Boolean).join(' · ')

  return (
    <div className={`bg-white rounded-[28px] border-2 ${highlight ? 'border-blue-200 shadow-lg shadow-blue-600/10' : 'border-slate-100'} p-6 flex items-center gap-6`}>
      {/* Código */}
      <div className="shrink-0 bg-slate-900 rounded-[20px] px-6 py-4 text-center min-w-[120px]">
        <p className="text-[2.5rem] font-black text-white leading-none tracking-widest">{turno.turno_codigo}</p>
        {turno.nombre_paciente && (
          <p className="text-slate-400 text-xs font-bold mt-1 truncate">{turno.nombre_paciente.split(' ')[0]}</p>
        )}
      </div>

      {/* Área */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">{area.icon}</span>
          <span className={`text-xl font-black uppercase tracking-tight ${area.color}`}>{turno.area}</span>
          <span className="text-xl text-slate-300">→</span>
        </div>
        {loc && <p className="text-slate-400 text-sm font-bold">📍 {loc}</p>}
      </div>

      {tipo.label && (
        <span className={`text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shrink-0 border ${tipo.bg} ${tipo.color} ${tipo.border}`}>
          {tipo.label}
        </span>
      )}
    </div>
  )
}

// ── Fila de espera ─────────────────────────────────────────────────
function EsperaRow({ turno, pos }: { turno: TurnoData; pos: number }) {
  const area  = getArea(turno.area)
  const tipo  = TIPO_META[turno.tipo_paciente] ?? TIPO_META.sin_cita
  const isUrgente = turno.tipo_paciente === 'urgente'

  return (
    <div className={`
      bg-white rounded-[20px] border-2 p-4 flex items-center gap-4 transition-all
      ${isUrgente ? 'border-red-100 bg-red-50/50' : pos === 1 ? 'border-blue-100 bg-blue-50/30' : 'border-slate-100'}
    `}>
      {/* Posición */}
      <div className={`
        w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg shrink-0
        ${pos === 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-100 text-slate-500'}
      `}>
        {pos}
      </div>

      {/* Código */}
      <div className={`shrink-0 rounded-xl px-3 py-1.5 border ${area.bg} ${area.border}`}>
        <span className={`font-black text-lg tracking-wider ${area.color}`}>{turno.turno_codigo}</span>
      </div>

      {/* Nombre + área */}
      <div className="flex-1 min-w-0">
        {turno.nombre_paciente && (
          <p className="font-black text-slate-800 text-sm leading-tight truncate">{turno.nombre_paciente}</p>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-sm">{area.icon}</span>
          <span className={`text-xs font-bold uppercase tracking-tight ${area.color}`}>{turno.area}</span>
        </div>
      </div>

      {tipo.label && (
        <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 border ${tipo.bg} ${tipo.color} ${tipo.border}`}>
          {tipo.label}
        </span>
      )}
    </div>
  )
}

// ── Raíz ───────────────────────────────────────────────────────────
export default function PantallaPublica({ idSucursal }: { idSucursal?: number }) {
  const [sucursal,     setSucursal]     = useState<Sucursal | null>(null)
  const [loadingInit,  setLoadingInit]  = useState(!!idSucursal)

  useEffect(() => {
    if (!idSucursal) return
    getSucursalesEspecialista()
      .then((lista: Sucursal[]) => {
        const found = lista.find((s: Sucursal) => s.id === idSucursal)
        if (found) setSucursal(found)
      })
      .catch(() => {})
      .finally(() => setLoadingInit(false))
  }, [idSucursal])

  if (loadingInit) return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!sucursal) return <SucursalSelector onSelect={setSucursal} />

  return <DisplayTurnos sucursal={sucursal} onCambiar={() => setSucursal(null)} />
}
