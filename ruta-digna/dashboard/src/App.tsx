import { useEffect, useState, useCallback } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend
} from 'chart.js'
import {
  checkHealth, getClinicas, getVisitasActivas, avanzarEstudio,
  cambiarTipoPaciente, getAlertas, crearAlerta, resolverAlerta,
  getVisitasEspecialista, getVisitasAtendidas, subirResultado, getResultadosVisita, getHistorialPaciente,
  loginEspecialista, getSucursalesEspecialista, getAreasEspecialista,
  registrarEspecialista, getEspecialistasSucursal,
} from './api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

// ── Flujo de estatus ──────────────────────────────────────────────
const FLUJO_DEMO = [
  { id: 1,  nombre: 'PAGADO',      label: 'Iniciar cita',   paso: 'espera',      progreso: 0   },
  { id: 9,  nombre: 'INICIO_TOMA', label: 'Terminar cita',  paso: 'inicio_toma', progreso: 33  },
  { id: 10, nombre: 'FIN_TOMA',    label: 'Terminar cita',  paso: 'fin_toma',    progreso: 66  },
  { id: 12, nombre: 'VERIFICADO',  label: '',               paso: 'finalizado',  progreso: 100 },
]
// Flujo del especialista: 2 acciones — el resultado se sube desde el historial de atendidos
const FLUJO_ESPECIALISTA: Record<number, { id: number; label: string; paso: string; progreso: number } | null> = {
  1:  { id: 9,  label: 'Iniciar cita',  paso: 'inicio_toma', progreso: 50  }, // PAGADO → INICIO_TOMA
  9:  { id: 12, label: 'Finalizar',     paso: 'finalizado',  progreso: 100 }, // INICIO_TOMA → VERIFICADO
  10: { id: 12, label: 'Finalizar',     paso: 'finalizado',  progreso: 100 }, // FIN_TOMA → VERIFICADO (por si acaso)
  12: null, // ya terminó
}
function getSiguienteEstatus(id: number) {
  const idx = FLUJO_DEMO.findIndex(f => f.id === id)
  return idx >= 0 && idx < FLUJO_DEMO.length - 1 ? FLUJO_DEMO[idx + 1] : null
}
function getSiguienteEspecialista(id: number) {
  return FLUJO_ESPECIALISTA[id] ?? null
}
function estatusToId(nombre: string) {
  return nombre === 'PAGADO' ? 1 : nombre === 'INICIO_TOMA' ? 9 : nombre === 'FIN_TOMA' ? 10 : 12
}

// ── Constantes ────────────────────────────────────────────────────
const TIPOS_PACIENTE = [
  { value: 'urgente',      label: 'Urgente',      color: 'bg-red-100 text-red-700',      dot: 'bg-red-500',    ring: 'ring-red-200'    },
  { value: 'embarazada',   label: 'Embarazada',   color: 'bg-pink-100 text-pink-700',    dot: 'bg-pink-500',   ring: 'ring-pink-200'   },
  { value: 'adulto_mayor', label: 'Adulto mayor', color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500',  ring: 'ring-amber-200'  },
  { value: 'discapacidad', label: 'Discapacidad', color: 'bg-purple-100 text-purple-700',dot: 'bg-purple-500', ring: 'ring-purple-200' },
  { value: 'con_cita',     label: 'Con cita',     color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500',   ring: 'ring-blue-200'   },
  { value: 'sin_cita',     label: 'Sin cita',     color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400',   ring: 'ring-gray-200'   },
]
const TIPOS_ALERTA = [
  { value: 'equipo_averiado',   label: 'Equipo averiado',   icon: '🔧' },
  { value: 'personal_ausente',  label: 'Personal ausente',  icon: '👤' },
  { value: 'emergencia_medica', label: 'Emergencia médica', icon: '🚨' },
  { value: 'retraso_general',   label: 'Retraso general',   icon: '⏱️' },
  { value: 'cierre_temporal',   label: 'Cierre temporal',   icon: '🚫' },
  { value: 'saturacion',        label: 'Saturación',        icon: '📊' },
  { value: 'otro',              label: 'Otro',              icon: '📌' },
]
const SEVERIDADES = [
  { value: 'baja',    label: 'Baja',    color: 'bg-green-100 text-green-700 border-green-200'   },
  { value: 'media',   label: 'Media',   color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'alta',    label: 'Alta',    color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'critica', label: 'Crítica', color: 'bg-red-100 text-red-700 border-red-200'          },
]
// Sucursales se cargan dinámicamente del backend (ver App component)
const ESTUDIOS_AREA = [
  { key: 'LABORATORIO',        label: 'Laboratorio',   icon: '🧪', color: 'bg-blue-600',   light: 'bg-blue-50 text-blue-700 border-blue-200'   },
  { key: 'ULTRASONIDO',        label: 'Ultrasonido',   icon: '📡', color: 'bg-emerald-600', light: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'RAYOS X',            label: 'Rayos X',       icon: '☢️',  color: 'bg-purple-600', light: 'bg-purple-50 text-purple-700 border-purple-200'  },
  { key: 'TOMOGRAFÍA',         label: 'Tomografía',    icon: '🔬', color: 'bg-orange-600',  light: 'bg-orange-50 text-orange-700 border-orange-200'  },
  { key: 'ELECTROCARDIOGRAMA', label: 'ECG',           icon: '❤️',  color: 'bg-red-600',    light: 'bg-red-50 text-red-700 border-red-200'           },
  { key: 'MASTOGRAFÍA',        label: 'Mastografía',   icon: '🩺', color: 'bg-pink-600',    light: 'bg-pink-50 text-pink-700 border-pink-200'        },
  { key: 'DENSITOMETRÍA',      label: 'Densitometría', icon: '🦴', color: 'bg-cyan-600',    light: 'bg-cyan-50 text-cyan-700 border-cyan-200'        },
]

// ── Session ───────────────────────────────────────────────────────
interface Session {
  rol:             'especialista' | 'coordinador'
  nombre:          string
  area?:           string   // nombre del estudio, ej: "LABORATORIO"
  // Campos del especialista autenticado (solo rol === 'especialista')
  especialista_id?: string
  id_empleado?:     string
  id_sucursal?:     number
  nombre_sucursal?: string
  id_estudio?:      number
}

function getSession(): Session | null {
  try { return JSON.parse(localStorage.getItem('rd_staff_session') || 'null') }
  catch { return null }
}
function saveSession(s: Session) {
  localStorage.setItem('rd_staff_session', JSON.stringify(s))
}
function clearSession() {
  localStorage.removeItem('rd_staff_session')
}

// ── Helpers ───────────────────────────────────────────────────────
function minutosDesde(ts: string) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  return diff < 60 ? `${diff} min` : `${Math.floor(diff / 60)}h ${diff % 60}m`
}
function getTipoInfo(tipo: string) {
  return TIPOS_PACIENTE.find(t => t.value === tipo) || TIPOS_PACIENTE[5]
}

// ── StatsCard ─────────────────────────────────────────────────────
function StatsCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-1 border border-gray-100">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-semibold ${accent || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ── AlertBanner ───────────────────────────────────────────────────
function AlertBanner({ alertas, onViewAll }: { alertas: any[]; onViewAll: () => void }) {
  const criticas = alertas.filter((a: any) => a.severidad === 'critica' || a.severidad === 'alta')
  if (alertas.length === 0) return null
  return (
    <div className={`rounded-xl p-3 flex items-center justify-between ${
      criticas.length > 0 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
    }`}>
      <div className="flex items-center gap-3">
        <span className="text-lg">{criticas.length > 0 ? '🚨' : '⚠️'}</span>
        <div>
          <p className={`text-sm font-medium ${criticas.length > 0 ? 'text-red-800' : 'text-amber-800'}`}>
            {alertas.length} alerta{alertas.length > 1 ? 's' : ''} activa{alertas.length > 1 ? 's' : ''}
            {criticas.length > 0 && ` · ${criticas.length} de alta prioridad`}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {alertas[0]?.titulo}{alertas.length > 1 && ` (+${alertas.length - 1} más)`}
          </p>
        </div>
      </div>
      <button onClick={onViewAll} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
        Ver todas
      </button>
    </div>
  )
}

// ── VisitaRow (coordinador — vista compacta) ──────────────────────
function VisitaRow({ visita, advancing, onAvanzar, onChangePriority }: {
  visita: any; advancing: string | null
  onAvanzar: (visitaId: string, veId: string, estatusId: number) => void
  onChangePriority: (visitaId: string, tipo: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const estudios: any[] = visita.estudios ?? []
  const actual = estudios.find((e: any) => e.es_actual)
  const tipoInfo = getTipoInfo(visita.tipo_paciente)

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{visita.paciente ?? 'Paciente'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{minutosDesde(visita.timestamp_llegada)} en clínica</p>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)}
            className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all ${tipoInfo.color}`}>
            {tipoInfo.label} ▾
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-7 z-40 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[160px]">
                <p className="text-xs text-gray-400 px-3 py-1 font-medium">Cambiar prioridad:</p>
                {TIPOS_PACIENTE.map(tipo => (
                  <button key={tipo.value} onClick={() => { onChangePriority(visita.visita_id, tipo.value); setShowMenu(false) }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 ${visita.tipo_paciente === tipo.value ? 'font-medium' : ''}`}>
                    <span className={`w-2 h-2 rounded-full ${tipo.dot}`} />
                    {tipo.label}
                    {visita.tipo_paciente === tipo.value && <span className="ml-auto">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-wrap mb-3">
        {estudios.map((est: any, i: number) => (
          <div key={est.orden ?? i} className="flex items-center gap-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              est.es_estado_final ? 'bg-green-100 text-green-700' :
              est.es_actual ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-100 text-gray-500'
            }`}>
              {est.orden}. {est.nombre}{est.es_estado_final ? ' ✓' : est.es_actual ? ' ⏳' : ''}
            </span>
            {i < estudios.length - 1 && <span className="text-gray-300 text-xs">→</span>}
          </div>
        ))}
      </div>
      {actual && (() => {
        const estatusId = estatusToId(actual.estatus)
        const siguiente = getSiguienteEstatus(estatusId)
        if (!siguiente) return null
        return (
          <button disabled={advancing !== null}
            onClick={() => onAvanzar(visita.visita_id, actual.id_visita_estudio ?? '', estatusId)}
            className="w-full text-xs bg-blue-600 text-white px-3 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium">
            {advancing === actual.id_visita_estudio ? 'Avanzando...' : siguiente.label}
          </button>
        )
      })()}
    </div>
  )
}

// ── EspecialistaPacienteCard ──────────────────────────────────────
function EspecialistaPacienteCard({ visita, posicion, advancing, onAvanzar, onChangePriority, especialistaNombre }: {
  visita: any; posicion: number; advancing: string | null
  onAvanzar: (visitaId: string, veId: string, estatusId: number) => void
  onChangePriority: (visitaId: string, tipo: string) => void
  especialistaNombre: string
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showHistorial, setShowHistorial] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTipo, setUploadTipo] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [historial, setHistorial] = useState<any[] | null>(null)
  const [historialLoading, setHistorialLoading] = useState(false)
  const tipoInfo = getTipoInfo(visita.tipo_paciente)
  const estudios: any[] = visita.estudios ?? []
  const actual = estudios.find((e: any) => e.es_actual)
  const completados = estudios.filter((e: any) => e.es_estado_final)
  const pendientes = estudios.filter((e: any) => !e.es_estado_final && !e.es_actual)
  const esUrgente = visita.tipo_paciente === 'urgente'


  return (
    <div className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all ${
      esUrgente ? 'border-red-200 shadow-red-50' : posicion === 1 ? 'border-blue-200 shadow-blue-50' : 'border-gray-100'
    }`}>
      {/* Barra de estado urgente */}
      {esUrgente && (
        <div className="bg-red-500 text-white text-xs font-black text-center py-1 tracking-widest uppercase">
          🚨 Atención urgente
        </div>
      )}
      {posicion === 1 && !esUrgente && (
        <div className="bg-blue-600 text-white text-xs font-black text-center py-1 tracking-widest uppercase">
          ⏭ Siguiente en atender
        </div>
      )}

      <div className="p-5">
        {/* Header: posición + nombre + prioridad */}
        <div className="flex items-start gap-4">
          {/* Número de turno */}
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 ${
            esUrgente ? 'bg-red-100 text-red-600' :
            posicion === 1 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
          }`}>
            {posicion}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-gray-900 text-base truncate">{visita.paciente ?? 'Paciente'}</p>
              {/* Dropdown prioridad */}
              <div className="relative shrink-0">
                <button onClick={() => setShowMenu(!showMenu)}
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold cursor-pointer hover:ring-2 transition-all ${tipoInfo.color} ${tipoInfo.ring}`}>
                  {tipoInfo.label} ▾
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-8 z-40 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[160px]">
                      <p className="text-xs text-gray-400 px-3 py-1 font-medium">Cambiar prioridad:</p>
                      {TIPOS_PACIENTE.map(tipo => (
                        <button key={tipo.value}
                          onClick={() => { onChangePriority(visita.visita_id, tipo.value); setShowMenu(false) }}
                          className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 ${visita.tipo_paciente === tipo.value ? 'font-semibold' : ''}`}>
                          <span className={`w-2 h-2 rounded-full ${tipo.dot}`} />
                          {tipo.label}
                          {visita.tipo_paciente === tipo.value && <span className="ml-auto text-blue-600">✓</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span>⏱ {minutosDesde(visita.timestamp_llegada)} en clínica</span>
              <span>~{visita.tiempo_espera_total_min ?? '?'} min estimado</span>
            </div>
          </div>
        </div>

        {/* Estudios de la visita */}
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ruta de estudios</p>
          <div className="flex flex-col gap-1.5">
            {estudios.map((est: any, i: number) => (
              <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium ${
                est.es_estado_final
                  ? 'bg-green-50 text-green-700'
                  : est.es_actual
                  ? 'bg-blue-50 text-blue-800 ring-1 ring-blue-200'
                  : 'bg-gray-50 text-gray-500'
              }`}>
                <span className="shrink-0">
                  {est.es_estado_final ? '✅' : est.es_actual ? '▶' : '⏸'}
                </span>
                <span className="flex-1">{est.nombre}</span>
                {est.es_actual && (
                  <span className="text-[9px] font-black uppercase tracking-tighter text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                    Aquí ahora
                  </span>
                )}
                {est.es_estado_final && (
                  <span className="text-[9px] font-black uppercase tracking-tighter text-green-600">
                    Listo
                  </span>
                )}
                {!est.es_actual && !est.es_estado_final && (
                  <span className="text-[9px] text-gray-400">Pendiente</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Botones de turno: Llamar · Finalizar ── */}
        {actual && (() => {
          const estatusId = estatusToId(actual.estatus)
          const isProcessing = advancing === actual.id_visita_estudio
          const yaFinalizado = estatusId === 12
          const puedeIniciar   = estatusId === 1
          const puedeFinalizar = estatusId === 9 || estatusId === 10

          if (yaFinalizado) return (
            <div className="mt-4 text-center text-xs text-green-600 font-semibold bg-green-50 py-2.5 rounded-xl border border-green-100">
              ✓ Cita finalizada
            </div>
          )

          return (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                disabled={!puedeIniciar || isProcessing}
                onClick={() => onAvanzar(visita.visita_id, actual.id_visita_estudio ?? '', 1)}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 border-2 ${
                  puedeIniciar && !isProcessing
                    ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200'
                    : estatusId > 1
                    ? 'bg-blue-50 border-blue-100 text-blue-300 cursor-default'
                    : 'bg-gray-50 border-gray-100 text-gray-300 cursor-default'
                }`}
              >
                <span className="text-base">{estatusId > 1 ? '✓' : '📣'}</span>
                Iniciar cita
              </button>
              <button
                disabled={!puedeFinalizar || isProcessing}
                onClick={() => onAvanzar(visita.visita_id, actual.id_visita_estudio ?? '', estatusId)}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 border-2 ${
                  puedeFinalizar && !isProcessing
                    ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200'
                    : 'bg-gray-50 border-gray-100 text-gray-300 cursor-default'
                }`}
              >
                <span className="text-base">✅</span>
                Finalizar
              </button>
            </div>
          )
        })()}

        {completados.length > 0 && pendientes.length > 0 && (
          <p className="text-[10px] text-gray-400 mt-2 text-center">
            {completados.length} completado{completados.length > 1 ? 's' : ''} · {pendientes.length} pendiente{pendientes.length > 1 ? 's' : ''} después
          </p>
        )}

        {/* Acciones: Subir resultado + Historial */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => { setShowUpload(!showUpload); setShowHistorial(false); setUploadMsg(null) }}
            className="flex-1 text-xs font-semibold py-2 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5">
            📤 Subir resultado
          </button>
          <button
            onClick={async () => {
              setShowHistorial(!showHistorial); setShowUpload(false)
              if (!showHistorial && historial === null) {
                setHistorialLoading(true)
                try {
                  const data = await getHistorialPaciente(visita.visita_id)
                  setHistorial(data.resultados ?? [])
                } catch { setHistorial([]) }
                finally { setHistorialLoading(false) }
              }
            }}
            className="flex-1 text-xs font-semibold py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
            📋 Historial
          </button>
        </div>

        {/* Panel de subida */}
        {showUpload && (
          <div className="mt-3 p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Subir resultado al paciente</p>
            <input
              type="text" placeholder="Tipo de estudio (ej: Laboratorio)"
              value={uploadTipo} onChange={e => setUploadTipo(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-blue-200 bg-white outline-none focus:ring-2 focus:ring-blue-300"
            />
            <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors text-xs font-medium ${uploadFile ? 'border-blue-400 bg-blue-100 text-blue-700' : 'border-blue-200 text-blue-400 hover:border-blue-400'}`}>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                onChange={e => { setUploadFile(e.target.files?.[0] ?? null); setUploadMsg(null) }} />
              {uploadFile ? `✓ ${uploadFile.name}` : 'Seleccionar PDF o imagen...'}
            </label>
            <button
              disabled={!uploadFile || uploading}
              onClick={async () => {
                if (!uploadFile) return
                setUploading(true); setUploadMsg(null)
                const fd = new FormData()
                fd.append('file', uploadFile)
                fd.append('visita_id', visita.visita_id)
                fd.append('tipo_estudio', uploadTipo)
                fd.append('especialista', especialistaNombre)
                fd.append('analizar_con_ia', 'false')
                try {
                  await subirResultado(fd)
                  setUploadMsg({ ok: true, text: '✓ Resultado subido correctamente.' })
                  setUploadFile(null); setUploadTipo('')
                } catch (err: any) {
                  setUploadMsg({ ok: false, text: `Error: ${err?.response?.data?.detail ?? err.message}` })
                } finally { setUploading(false) }
              }}
              className="w-full py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
              {uploading ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Subiendo...</> : 'Subir resultado'}
            </button>
            {uploadMsg && (
              <p className={`text-xs font-semibold text-center ${uploadMsg.ok ? 'text-green-600' : 'text-red-500'}`}>
                {uploadMsg.text}
              </p>
            )}
          </div>
        )}

        {/* Panel de historial */}
        {showHistorial && (
          <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Historial de resultados</p>
            {historialLoading && <p className="text-xs text-gray-400">Cargando...</p>}
            {!historialLoading && historial?.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">Sin resultados anteriores</p>
            )}
            {historial?.map((r: any) => (
              <div key={r.id} className="bg-white rounded-lg p-3 border border-gray-100 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-800 truncate flex-1">{r.nombre_archivo}</span>
                  <a href={r.url_archivo} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-blue-600 font-bold hover:underline">
                    Abrir ↗
                  </a>
                </div>
                <div className="flex items-center gap-2 mt-1 text-gray-400">
                  {r.tipo_estudio && <span className="font-bold text-blue-500 uppercase text-[10px]">{r.tipo_estudio}</span>}
                  <span>{new Date(r.created_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' })}</span>
                  {r.subido_por && <span>· por {r.subido_por}</span>}
                </div>
                {r.interpretacion_ia && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-blue-600 font-semibold text-[10px] uppercase tracking-wide">Ver interpretación IA</summary>
                    <p className="mt-1 text-gray-600 leading-relaxed bg-blue-50 rounded p-2 whitespace-pre-wrap text-[10px]">{r.interpretacion_ia}</p>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Vista del Especialista (pantalla completa al hacer login) ─────
function EspecialistaView({ session, onLogout, connected }: {
  session: Session; onLogout: () => void; connected: boolean
}) {
  const [pacientes,  setPacientes]  = useState<any[]>([])
  const [atendidos,  setAtendidos]  = useState<any[]>([])
  const [advancing,  setAdvancing]  = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [alertas,    setAlertas]    = useState<any[]>([])
  const [activeTab,  setActiveTab]  = useState<'pacientes' | 'atendidos' | 'alertas'>('pacientes')
  const areaInfo = ESTUDIOS_AREA.find(e => e.key === session.area) || ESTUDIOS_AREA[0]

  const fetchPacientes = useCallback(() => {
    if (!session.area) return
    getVisitasEspecialista(session.area, session.id_sucursal)
      .then(data => { setPacientes(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [session.area, session.id_sucursal])

  const fetchAtendidos = useCallback(() => {
    if (!session.area) return
    getVisitasAtendidas(session.area, session.id_sucursal)
      .then(data => setAtendidos(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [session.area, session.id_sucursal])

  const fetchAlertas = useCallback(() => {
    if (!session.id_sucursal) return
    getAlertas(session.id_sucursal, session.id_estudio)
      .then(data => setAlertas(Array.isArray(data) ? data : []))
      .catch(() => setAlertas([]))
  }, [session.id_sucursal, session.id_estudio])

  useEffect(() => {
    fetchPacientes()
    const iv = setInterval(fetchPacientes, 5000)
    return () => clearInterval(iv)
  }, [fetchPacientes])

  useEffect(() => {
    fetchAlertas()
    const iv = setInterval(fetchAlertas, 10000)
    return () => clearInterval(iv)
  }, [fetchAlertas])

  useEffect(() => {
    fetchAtendidos()
    const iv = setInterval(fetchAtendidos, 30000)
    return () => clearInterval(iv)
  }, [fetchAtendidos])

  const handleAvanzar = async (visitaId: string, veId: string, estatusId: number) => {
    const siguiente = getSiguienteEspecialista(estatusId)
    if (!siguiente) return
    setAdvancing(veId)
    try {
      await avanzarEstudio(visitaId, {
        id_visita_estudio: veId,
        nuevo_estatus: siguiente.id,
        nuevo_paso: siguiente.paso,
        nuevo_progreso: siguiente.progreso,
      })
      setTimeout(fetchPacientes, 800)
      // Si se finalizó el estudio (VERIFICADO), refrescar la lista de atendidos
      if (siguiente.id === 12) {
        setTimeout(fetchAtendidos, 1200)
      }
    } finally {
      setAdvancing(null)
    }
  }

  const handleChangePriority = async (visitaId: string, tipo: string) => {
    try {
      await cambiarTipoPaciente(visitaId, tipo)
      setTimeout(fetchPacientes, 800)
    } catch {}
  }

  const urgentes = pacientes.filter(p => p.tipo_paciente === 'urgente')

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header especialista */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 ${areaInfo.color} rounded-xl flex items-center justify-center text-lg`}>
              {areaInfo.icon}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-none">{session.nombre}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {areaInfo.label} · {session.nombre_sucursal ?? 'Especialista'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-xs text-gray-400">{connected ? 'En vivo' : 'Sin conexión'}</span>
            </div>
            <button onClick={onLogout}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium">
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Tabs: Pacientes / Atendidos / Alertas */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          <button onClick={() => setActiveTab('pacientes')}
            className={`flex-1 text-sm py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'pacientes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            Mis pacientes
            {pacientes.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'pacientes' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                {pacientes.length}
              </span>
            )}
          </button>
          <button onClick={() => { setActiveTab('atendidos'); fetchAtendidos() }}
            className={`flex-1 text-sm py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'atendidos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            Atendidos
            {atendidos.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'atendidos' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                {atendidos.length}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab('alertas')}
            className={`flex-1 text-sm py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'alertas' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            Alertas
            {alertas.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'alertas' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'}`}>
                {alertas.length}
              </span>
            )}
          </button>
        </div>

        {/* Resumen — solo en tab pacientes */}
        {activeTab === 'pacientes' && <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center shadow-sm">
            <p className="text-3xl font-black text-gray-900">{pacientes.length}</p>
            <p className="text-xs text-gray-500 mt-1">En cola</p>
          </div>
          <div className={`rounded-2xl p-4 border text-center shadow-sm ${urgentes.length > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
            <p className={`text-3xl font-black ${urgentes.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{urgentes.length}</p>
            <p className={`text-xs mt-1 ${urgentes.length > 0 ? 'text-red-500' : 'text-gray-500'}`}>Urgentes</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center shadow-sm">
            <p className="text-3xl font-black text-gray-900">
              {pacientes.length > 0 ? `~${Math.min(pacientes[0]?.tiempo_espera_total_min ?? 0, 99)}m` : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Espera 1°</p>
          </div>
        </div>}

        {/* Lista de pacientes */}
        {activeTab === 'pacientes' && (
          <>
            {loading ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">Cargando pacientes...</p>
              </div>
            ) : pacientes.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                <p className="text-4xl mb-3">✅</p>
                <p className="font-semibold text-gray-700">Cola vacía</p>
                <p className="text-sm text-gray-400 mt-1">No hay pacientes esperando en {areaInfo.label}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pacientes.map((v: any, idx: number) => (
                  <EspecialistaPacienteCard
                    key={v.visita_id}
                    visita={v}
                    posicion={idx + 1}
                    advancing={advancing}
                    onAvanzar={handleAvanzar}
                    onChangePriority={handleChangePriority}
                    especialistaNombre={session.nombre}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Tab atendidos hoy */}
        {activeTab === 'atendidos' && (
          <AtendidosPanel
            atendidos={atendidos}
            especialistaNombre={session.nombre}
            onResultadoSubido={fetchAtendidos}
          />
        )}

        {/* Tab alertas del área */}
        {activeTab === 'alertas' && session.id_sucursal && (
          <AlertasPanel
            sucursalId={session.id_sucursal}
            alertas={alertas}
            onRefresh={fetchAlertas}
            defaultEstudioId={session.id_estudio}
          />
        )}
      </div>
    </div>
  )
}

// ── Panel Atendidos Hoy ───────────────────────────────────────────
function AtendidosPanel({ atendidos, especialistaNombre, onResultadoSubido }: {
  atendidos: any[]
  especialistaNombre: string
  onResultadoSubido: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Atendidos hoy</h2>
        <span className="text-xs text-gray-400">{atendidos.length} paciente{atendidos.length !== 1 ? 's' : ''}</span>
      </div>
      {atendidos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold text-gray-700">Sin atendidos hoy</p>
          <p className="text-sm text-gray-400 mt-1">Los pacientes finalizados aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-4">
          {atendidos.map((v: any) => (
            <AtendidoCard
              key={v.visita_id}
              visita={v}
              especialistaNombre={especialistaNombre}
              onResultadoSubido={onResultadoSubido}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AtendidoCard({ visita, especialistaNombre, onResultadoSubido }: {
  visita: any
  especialistaNombre: string
  onResultadoSubido: () => void
}) {
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTipo, setUploadTipo] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showResultados, setShowResultados] = useState(false)

  const horaFin = visita.timestamp_fin_visita
    ? new Date(visita.timestamp_fin_visita).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : '—'
  const tipoInfo = getTipoInfo(visita.tipo_paciente ?? 'sin_cita')
  const resultados: any[] = visita.resultados ?? []

  const handleSubir = async () => {
    if (!uploadFile) return
    setUploading(true); setUploadMsg(null)
    const fd = new FormData()
    fd.append('file', uploadFile)
    fd.append('visita_id', visita.visita_id)
    fd.append('tipo_estudio', uploadTipo)
    fd.append('especialista', especialistaNombre)
    fd.append('analizar_con_ia', 'false')
    try {
      await subirResultado(fd)
      setUploadMsg({ ok: true, text: '✓ Resultado subido correctamente.' })
      setUploadFile(null); setUploadTipo('')
      onResultadoSubido()
    } catch (err: any) {
      setUploadMsg({ ok: false, text: `Error: ${err?.response?.data?.detail ?? err.message}` })
    } finally { setUploading(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header de la tarjeta */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-50">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 font-black text-sm shrink-0">
          ✓
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate">{visita.paciente ?? 'Paciente'}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${tipoInfo.color}`}>{tipoInfo.label}</span>
            <span className="text-xs text-gray-400">Finalizado {horaFin}</span>
          </div>
        </div>
        {resultados.length > 0 && (
          <button
            onClick={() => setShowResultados(v => !v)}
            className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 font-semibold hover:bg-emerald-100 transition-colors"
          >
            {resultados.length} resultado{resultados.length !== 1 ? 's' : ''} {showResultados ? '▲' : '▼'}
          </button>
        )}
      </div>

      {/* Resultados ya subidos */}
      {showResultados && resultados.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Resultados subidos</p>
          {resultados.map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl p-3 border border-gray-100 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{r.nombre_archivo}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-gray-400">
                    {r.tipo_estudio && <span className="font-bold text-blue-500 uppercase text-[10px]">{r.tipo_estudio}</span>}
                    <span>{new Date(r.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <a href={r.url_archivo} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 text-blue-600 font-bold hover:underline">Abrir ↗</a>
              </div>
              {r.interpretacion_ia && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-blue-600 font-semibold text-[10px] uppercase tracking-wide">Ver interpretación IA</summary>
                  <p className="mt-1 text-gray-600 leading-relaxed bg-blue-50 rounded p-2 whitespace-pre-wrap text-[10px]">{r.interpretacion_ia}</p>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Acciones */}
      <div className="p-4">
        <button
          onClick={() => { setShowUpload(v => !v); setUploadMsg(null) }}
          className="w-full text-xs font-semibold py-2.5 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors flex items-center justify-center gap-2"
        >
          📤 {showUpload ? 'Cancelar' : 'Subir resultado'}
        </button>

        {showUpload && (
          <div className="mt-3 space-y-3">
            <input
              type="text" placeholder="Tipo de estudio (ej: Laboratorio)"
              value={uploadTipo} onChange={e => setUploadTipo(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-300"
            />
            <label className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-colors text-xs font-medium ${
              uploadFile ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-400 hover:border-blue-300'
            }`}>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                onChange={e => { setUploadFile(e.target.files?.[0] ?? null); setUploadMsg(null) }} />
              {uploadFile ? `✓ ${uploadFile.name}` : '📎 Seleccionar PDF o imagen...'}
            </label>
            <button
              disabled={!uploadFile || uploading}
              onClick={handleSubir}
              className="w-full py-2.5 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {uploading
                ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Subiendo y analizando...</>
                : 'Subir y analizar con IA'}
            </button>
            {uploadMsg && (
              <p className={`text-xs font-semibold text-center ${uploadMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                {uploadMsg.text}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Panel Alertas ─────────────────────────────────────────────────
function AlertasPanel({ sucursalId, alertas, onRefresh, defaultEstudioId }: {
  sucursalId: number; alertas: any[]; onRefresh: () => void; defaultEstudioId?: number
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    tipo_alerta: 'retraso_general', titulo: '', descripcion: '',
    severidad: 'media', impacto_tiempo_min: 15, id_estudio: defaultEstudioId ?? null as number | null,
  })
  const [submitting, setSubmitting] = useState(false)

  const handleCrear = async () => {
    if (!form.titulo.trim()) return
    setSubmitting(true)
    try {
      await crearAlerta({ id_sucursal: sucursalId, id_estudio: form.id_estudio,
        tipo_alerta: form.tipo_alerta, titulo: form.titulo,
        descripcion: form.descripcion || undefined,
        severidad: form.severidad, impacto_tiempo_min: form.impacto_tiempo_min })
      setForm({ tipo_alerta: 'retraso_general', titulo: '', descripcion: '', severidad: 'media', impacto_tiempo_min: 15, id_estudio: null })
      setShowForm(false); onRefresh()
    } finally { setSubmitting(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Alertas e imprevistos</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium">
          + Nueva alerta
        </button>
      </div>
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <p className="text-sm font-medium text-gray-900 mb-3">Reportar imprevisto</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
              <select value={form.tipo_alerta} onChange={e => setForm({ ...form, tipo_alerta: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                {TIPOS_ALERTA.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Severidad</label>
              <select value={form.severidad} onChange={e => setForm({ ...form, severidad: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                {SEVERIDADES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">Título</label>
            <input type="text" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ej: Equipo de Ultrasonido sala 2 fuera de servicio"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5" />
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">
              Impacto estimado: <strong>{form.impacto_tiempo_min} min</strong>
            </label>
            <input type="range" min="0" max="120" step="5" value={form.impacto_tiempo_min}
              onChange={e => setForm({ ...form, impacto_tiempo_min: Number(e.target.value) })}
              className="w-full" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCrear} disabled={!form.titulo.trim() || submitting}
              className="flex-1 text-xs bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium">
              {submitting ? 'Creando...' : 'Crear alerta'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      )}
      {alertas.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-sm">Sin alertas activas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alertas.map((alerta: any) => {
            const sevInfo = SEVERIDADES.find(s => s.value === alerta.severidad) || SEVERIDADES[1]
            const tipoInfo = TIPOS_ALERTA.find(t => t.value === alerta.tipo_alerta) || TIPOS_ALERTA[6]
            return (
              <div key={alerta.id} className={`rounded-xl p-4 border ${sevInfo.color}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{tipoInfo.icon}</span>
                      <p className="text-sm font-medium">{alerta.titulo}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      {alerta.impacto_tiempo_min > 0 && <span>+{alerta.impacto_tiempo_min} min</span>}
                      <span>{minutosDesde(alerta.timestamp_inicio)}</span>
                    </div>
                  </div>
                  <button onClick={() => resolverAlerta(alerta.id).then(onRefresh)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-green-700 hover:bg-green-50 font-medium shrink-0">
                    ✓ Resolver
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Panel de Especialistas ────────────────────────────────────────
function EspecialistasPanel() {
  const [lista,      setLista]      = useState<any[]>([])
  const [sucursales, setSucursales] = useState<any[]>([])
  const [areas,      setAreas]      = useState<any[]>([])
  const [showForm,   setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg,        setMsg]        = useState<{ ok: boolean; text: string } | null>(null)
  const [form, setForm] = useState({
    nombre:      '',
    id_empleado: '',
    pin:         '',
    id_sucursal: 0,
    id_estudio:  0,
    rol:         'especialista' as 'especialista' | 'admin',
  })

  const load = useCallback(() => {
    getEspecialistasSucursal().then(d => setLista(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    getSucursalesEspecialista().then(d => {
      const arr = Array.isArray(d) ? d : []
      setSucursales(arr)
      if (arr.length > 0 && form.id_sucursal === 0) setForm(f => ({ ...f, id_sucursal: arr[0].id }))
    }).catch(() => {})
    getAreasEspecialista().then(d => {
      const arr = Array.isArray(d) ? d : []
      setAreas(arr)
      if (arr.length > 0 && form.id_estudio === 0) setForm(f => ({ ...f, id_estudio: arr[0].id }))
    }).catch(() => {})
  }, [load])

  const handleRegistrar = async () => {
    if (!form.nombre.trim() || !form.id_empleado.trim() || form.pin.length !== 4) {
      setMsg({ ok: false, text: 'Nombre, ID de empleado y PIN de 4 dígitos son obligatorios.' })
      return
    }
    setSubmitting(true); setMsg(null)
    try {
      await registrarEspecialista(form)
      setMsg({ ok: true, text: `Especialista "${form.nombre}" registrado exitosamente.` })
      setForm({ nombre: '', id_empleado: '', pin: '', id_sucursal: sucursales[0]?.id ?? 0, id_estudio: areas[0]?.id ?? 0, rol: 'especialista' })
      setShowForm(false)
      load()
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.message ?? 'Error desconocido'
      setMsg({ ok: false, text: detail })
    } finally { setSubmitting(false) }
  }

  const ROL_LABEL: Record<string, string> = { especialista: 'Especialista', admin: 'Admin' }
  const ROL_COLOR: Record<string, string> = { especialista: 'bg-blue-100 text-blue-700', admin: 'bg-purple-100 text-purple-700' }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Especialistas registrados</h2>
        <button onClick={() => { setShowForm(!showForm); setMsg(null) }}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium">
          {showForm ? 'Cancelar' : '+ Agregar especialista'}
        </button>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${msg.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
          <p className="text-sm font-semibold text-gray-900 mb-4">Nuevo especialista</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Nombre completo</label>
              <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Dra. Ana Torres"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Número de empleado</label>
              <input type="text" value={form.id_empleado} onChange={e => setForm({ ...form, id_empleado: e.target.value.toUpperCase() })}
                placeholder="EMP-OBR01"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">PIN (4 dígitos)</label>
              <input type="password" inputMode="numeric" maxLength={4}
                value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                placeholder="● ● ● ●"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Sucursal</label>
              <select value={form.id_sucursal} onChange={e => setForm({ ...form, id_sucursal: Number(e.target.value) })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
                {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre} — {s.ciudad}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Área / Estudio</label>
              <select value={form.id_estudio} onChange={e => setForm({ ...form, id_estudio: Number(e.target.value) })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
                {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Rol</label>
              <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value as 'especialista' | 'admin' })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
                <option value="especialista">Especialista</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button onClick={handleRegistrar} disabled={submitting}
            className="w-full text-sm bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors">
            {submitting ? 'Registrando...' : 'Registrar especialista'}
          </button>
        </div>
      )}

      {lista.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">👤</p>
          <p className="text-sm">Sin especialistas registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((e: any) => (
            <div key={e.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-4">
              <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-lg shrink-0">🧑‍⚕️</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{e.nombre}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  <span className="font-mono">{e.id_empleado}</span>
                  {' · '}{e.nombre_estudio ?? '—'}
                  {' · '}{e.nombre_sucursal ?? '—'}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${ROL_COLOR[e.rol] ?? 'bg-gray-100 text-gray-600'}`}>
                {ROL_LABEL[e.rol] ?? e.rol}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ── Pantalla de Login ─────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (s: Session) => void }) {
  const [modo, setModo] = useState<'elegir' | 'especialista' | 'coordinador'>('elegir')
  const [nombre, setNombre] = useState('')          // solo coordinador
  const [idEmpleado, setIdEmpleado] = useState('')  // especialista
  const [pin, setPin] = useState('')                // especialista
  const [area, setArea] = useState('')              // solo coordinador
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLoginEspecialista = async () => {
    if (!idEmpleado.trim()) { setError('Ingresa tu número de empleado'); return }
    if (pin.length !== 4)   { setError('El PIN debe tener 4 dígitos');   return }
    setLoading(true); setError('')
    try {
      const data = await loginEspecialista(idEmpleado.trim(), pin)
      // data: { especialista_id, nombre, id_empleado, rol, id_sucursal, nombre_sucursal, id_estudio, nombre_estudio }
      onLogin({
        rol:             'especialista',
        nombre:          data.nombre,
        area:            data.nombre_estudio?.toUpperCase() ?? '',
        especialista_id: data.especialista_id,
        id_empleado:     data.id_empleado,
        id_sucursal:     data.id_sucursal,
        nombre_sucursal: data.nombre_sucursal,
        id_estudio:      data.id_estudio,
      })
    } catch (e: any) {
      const status = e?.response?.status
      setError(status === 401 ? 'PIN incorrecto.' : status === 404 ? 'Número de empleado no encontrado.' : 'Error de conexión.')
    } finally { setLoading(false) }
  }

  const handleLoginCoordinador = () => {
    if (!nombre.trim()) { setError('Ingresa tu nombre'); return }
    onLogin({ rol: 'coordinador', nombre: nombre.trim(), area: area || undefined })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-white tracking-tight">Ruta Digna</h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">Panel del Personal Clínico</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {modo === 'elegir' ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">¿Cómo deseas ingresar?</h2>
              <p className="text-sm text-gray-500 mb-6">Selecciona tu rol para ver la vista correspondiente</p>
              <div className="space-y-3">
                <button onClick={() => setModo('especialista')}
                  className="w-full p-4 rounded-2xl border-2 border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl group-hover:bg-blue-200 transition-colors">🧑‍⚕️</div>
                    <div>
                      <p className="font-bold text-gray-900">Especialista</p>
                      <p className="text-xs text-gray-500 mt-0.5">Ve solo los pacientes de tu área de servicio</p>
                    </div>
                    <span className="ml-auto text-gray-300 group-hover:text-blue-400 text-xl">→</span>
                  </div>
                </button>
                <button onClick={() => setModo('coordinador')}
                  className="w-full p-4 rounded-2xl border-2 border-gray-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all text-left group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl group-hover:bg-emerald-200 transition-colors">🖥️</div>
                    <div>
                      <p className="font-bold text-gray-900">Coordinador General</p>
                      <p className="text-xs text-gray-500 mt-0.5">Vista completa de todas las áreas y colas</p>
                    </div>
                    <span className="ml-auto text-gray-300 group-hover:text-emerald-400 text-xl">→</span>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => { setModo('elegir'); setError('') }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-6 font-medium">
                ← Volver
              </button>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {modo === 'especialista' ? '🧑‍⚕️ Acceso Especialista' : '🖥️ Acceso Coordinador'}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {modo === 'especialista' ? 'Ingresa tus datos para ver tu área' : 'Acceso al panel general de operaciones'}
              </p>

              {/* ── Especialista: id_empleado + PIN ── */}
              {modo === 'especialista' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">Número de empleado</label>
                  <input
                    type="text"
                    value={idEmpleado}
                    onChange={e => { setIdEmpleado(e.target.value); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleLoginEspecialista()}
                    placeholder="Ej: EMP001"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none text-sm transition-all font-mono tracking-widest"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">PIN (4 dígitos)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleLoginEspecialista()}
                    placeholder="● ● ● ●"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none text-2xl font-mono tracking-[1rem] text-center transition-all"
                  />
                </div>

                {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}

                <button
                  onClick={handleLoginEspecialista}
                  disabled={loading || idEmpleado.length === 0 || pin.length !== 4}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                  {loading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verificando...</>
                    : 'Entrar →'
                  }
                </button>
              </div>
              ) : (
              /* ── Coordinador: solo nombre ── */
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">Tu nombre</label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={e => { setNombre(e.target.value); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleLoginCoordinador()}
                    placeholder="Coordinador"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none text-sm transition-all"
                    autoFocus
                  />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-2">Filtrar por área (opcional)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {ESTUDIOS_AREA.map(est => (
                        <button key={est.key} onClick={() => { setArea(est.key); setError('') }}
                          className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all flex items-center gap-2 ${
                            area === est.key
                              ? `${est.color} text-white border-transparent shadow-lg`
                              : 'border-gray-100 text-gray-700 hover:border-gray-200 bg-gray-50'
                          }`}>
                          <span>{est.icon}</span>
                          <span className="text-xs">{est.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

                <button onClick={handleLoginCoordinador}
                  className="w-full py-3.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all">
                  Ingresar al panel
                </button>
              </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── App principal ─────────────────────────────────────────────────
type TabId = 'colas' | 'pacientes' | 'alertas' | 'especialistas'

export default function App() {
  const [session,    setSession]    = useState<Session | null>(() => getSession())
  const [clinicas,   setClinicas]   = useState<any[]>([])
  const [visitas,    setVisitas]    = useState<any[]>([])
  const [alertas,    setAlertas]    = useState<any[]>([])
  const [sucursales, setSucursales] = useState<{ id: number; nombre: string; ciudad?: string }[]>([])
  const [sucursalId, setSucursalId] = useState<number>(0)
  const [advancing,  setAdvancing]  = useState<string | null>(null)
  const [connected,  setConnected]  = useState(false)
  const [activeTab,  setActiveTab]  = useState<TabId>('colas')

  const handleLogin = (s: Session) => { saveSession(s); setSession(s) }
  const handleLogout = () => { clearSession(); setSession(null) }

  // Health check
  useEffect(() => {
    checkHealth().then(() => setConnected(true)).catch(() => setConnected(false))
    const iv = setInterval(() => checkHealth().then(() => setConnected(true)).catch(() => setConnected(false)), 15000)
    return () => clearInterval(iv)
  }, [])

  // Sucursales desde el backend (solo coordinador)
  useEffect(() => {
    if (session?.rol !== 'coordinador') return
    getSucursalesEspecialista()
      .then((data: any[]) => {
        const lista = Array.isArray(data) ? data : []
        setSucursales(lista)
        if (lista.length > 0 && sucursalId === 0) setSucursalId(lista[0].id)
      })
      .catch(() => {})
  }, [session?.rol])

  // Clínicas y visitas solo para coordinador
  useEffect(() => {
    if (session?.rol !== 'coordinador') return
    const f = () => getClinicas().then(d => setClinicas(Array.isArray(d) ? d : [])).catch(() => {})
    f(); const iv = setInterval(f, 8000); return () => clearInterval(iv)
  }, [session?.rol])

  const fetchVisitas = useCallback(() => {
    if (session?.rol !== 'coordinador') return
    getVisitasActivas().then(d => setVisitas(Array.isArray(d) ? d : [])).catch(() => {})
  }, [session?.rol])

  useEffect(() => {
    fetchVisitas()
    const iv = setInterval(fetchVisitas, 5000)
    return () => clearInterval(iv)
  }, [fetchVisitas])

  const fetchAlertas = useCallback(() => {
    if (session?.rol !== 'coordinador' || !sucursalId) return
    getAlertas(sucursalId).then(d => setAlertas(Array.isArray(d) ? d : [])).catch(() => setAlertas([]))
  }, [sucursalId, session?.rol])

  useEffect(() => {
    fetchAlertas()
    const iv = setInterval(fetchAlertas, 10000)
    return () => clearInterval(iv)
  }, [fetchAlertas])

  // Sin sesión → login
  if (!session) return <LoginScreen onLogin={handleLogin} />

  // Especialista → vista dedicada
  if (session.rol === 'especialista') {
    return <EspecialistaView session={session} onLogout={handleLogout} connected={connected} />
  }

  // Coordinador → dashboard completo
  const datosSucursal = clinicas.filter((c: any) => c.id_sucursal === sucursalId)
  const totalEspera   = datosSucursal.reduce((s: number, c: any) => s + (c.pacientes_en_espera ?? 0), 0)
  const areaSaturada  = datosSucursal.reduce((max: any, c: any) =>
    (c.pacientes_en_espera ?? 0) > (max?.pacientes_en_espera ?? -1) ? c : max, null)
  const tiempoPromedio = datosSucursal.length > 0
    ? Math.round(datosSucursal.reduce((s: number, c: any) => s + (c.tiempo_espera_estimado_min ?? c.tiempo_espera_promedio_min ?? 0), 0) / datosSucursal.length)
    : 0
  const impactoAlertas = alertas.reduce((s: number, a: any) => s + (a.impacto_tiempo_min ?? 0), 0)

  const chartData = {
    labels: datosSucursal.map((c: any) => c.estudio ?? c.nombre_estudio ?? '—'),
    datasets: [
      { label: 'Urgentes', data: datosSucursal.map((c: any) => c.pacientes_urgentes ?? 0), backgroundColor: '#EF4444', borderRadius: 4 },
      { label: 'Con cita', data: datosSucursal.map((c: any) => c.pacientes_con_cita ?? 0), backgroundColor: '#2563EB', borderRadius: 4 },
      { label: 'Sin cita', data: datosSucursal.map((c: any) => (c.pacientes_en_espera ?? 0) - (c.pacientes_urgentes ?? 0) - (c.pacientes_con_cita ?? 0)), backgroundColor: '#CBD5E1', borderRadius: 4 },
    ],
  }
  const chartOpts = {
    indexAxis: 'y' as const, responsive: true,
    plugins: { legend: { position: 'bottom' as const, labels: { font: { size: 11 }, boxWidth: 12 } } },
    scales: { x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }, y: { stacked: true } },
  }

  const handleAvanzar = async (visitaId: string, veId: string, estatusActualId: number) => {
    const siguiente = getSiguienteEstatus(estatusActualId)
    if (!siguiente) return
    setAdvancing(veId)
    try {
      await avanzarEstudio(visitaId, { id_visita_estudio: veId, nuevo_estatus: siguiente.id, nuevo_paso: siguiente.paso, nuevo_progreso: siguiente.progreso })
      setTimeout(fetchVisitas, 800)
    } finally { setAdvancing(null) }
  }

  const handleChangePriority = async (visitaId: string, tipo: string) => {
    try { await cambiarTipoPaciente(visitaId, tipo); setTimeout(fetchVisitas, 800) } catch {}
  }

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: 'colas',        label: 'Colas por área' },
    { id: 'pacientes',    label: 'Pacientes',    count: visitas.length || undefined },
    { id: 'alertas',      label: 'Alertas',      count: alertas.length || undefined },
    { id: 'especialistas', label: 'Especialistas' },
  ]

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Ruta Digna</h1>
          <p className="text-xs text-gray-400">Coordinador: {session.nombre}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'}`} />
            <span className="text-xs text-gray-500">{connected ? 'Conectado' : 'Sin conexión'}</span>
          </div>
          <a href={`${import.meta.env.VITE_FRONTEND_URL || 'http://localhost:3000'}/login`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium">
            App Paciente ↗
          </a>
          <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
            value={sucursalId} onChange={e => setSucursalId(Number(e.target.value))}>
            {sucursales.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}{s.ciudad ? ` — ${s.ciudad}` : ''}</option>
            ))}
          </select>
          <button onClick={handleLogout}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium">
            Salir
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        <AlertBanner alertas={alertas} onViewAll={() => setActiveTab('alertas')} />

        <div className="grid grid-cols-4 gap-4">
          <StatsCard label="Pacientes en espera" value={totalEspera} sub="Sucursal seleccionada" />
          <StatsCard label="Área más saturada" value={areaSaturada?.estudio ?? areaSaturada?.nombre_estudio ?? '—'} sub={areaSaturada ? `${areaSaturada.pacientes_en_espera} en espera` : undefined} />
          <StatsCard label="Tiempo promedio" value={tiempoPromedio > 0 ? `~${Math.max(tiempoPromedio - 5, 5)}-${tiempoPromedio + 10} min` : '—'} sub="Rango estimado por área" />
          <StatsCard label="Alertas activas" value={alertas.length} sub={impactoAlertas > 0 ? `+${impactoAlertas} min impacto` : 'Sin impacto'} accent={alertas.length > 0 ? 'text-red-600' : undefined} />
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 text-sm py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? (tab.id === 'alertas' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700') : 'bg-gray-200 text-gray-600'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'colas' && (
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">Colas por área — {sucursales.find(s => s.id === sucursalId)?.nombre ?? `Sucursal ${sucursalId}`}</h2>
            {datosSucursal.length > 0
              ? <Bar data={chartData} options={chartOpts} />
              : <p className="text-sm text-gray-400 text-center py-10">Sin datos para esta sucursal</p>}
            <p className="text-xs text-gray-400 mt-3 text-center">Tiempos son estimaciones</p>
          </div>
        )}

        {activeTab === 'pacientes' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Pacientes en proceso</h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {TIPOS_PACIENTE.slice(0, 4).map(t => (
                  <span key={t.value} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${t.dot}`} /> {t.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {visitas.length > 0
                ? visitas.map((v: any) => (
                  <VisitaRow key={v.visita_id} visita={v} advancing={advancing}
                    onAvanzar={handleAvanzar} onChangePriority={handleChangePriority} />
                ))
                : <p className="text-sm text-gray-400 text-center py-10">Sin visitas activas</p>}
            </div>
          </div>
        )}

        {activeTab === 'alertas' && (
          <AlertasPanel sucursalId={sucursalId} alertas={alertas} onRefresh={fetchAlertas} />
        )}

        {activeTab === 'especialistas' && (
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <EspecialistasPanel />
          </div>
        )}
      </div>
    </div>
  )
}
