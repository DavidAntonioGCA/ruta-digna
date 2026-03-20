'use client'
import { Loader2, CheckCircle2, Circle, Clock } from 'lucide-react'

// ── Button ──────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  loading?: boolean
}
export function Button({ variant = 'primary', loading, children, className = '', ...props }: ButtonProps) {
  const base = variant === 'primary' ? 'btn-primary' : variant === 'secondary' ? 'btn-secondary' : 'btn-ghost'
  return (
    <button className={`${base} flex items-center gap-2 ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

// ── Card ────────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

// ── Badge ───────────────────────────────────────────────────────
type BadgeStatus = 'completado' | 'actual' | 'pendiente' | 'urgente' | 'cancelado'
export function Badge({ status, children }: { status: BadgeStatus; children: React.ReactNode }) {
  const cls = {
    completado: 'badge-completado',
    actual:     'badge-actual',
    pendiente:  'badge-pendiente',
    urgente:    'badge-urgente',
    cancelado:  'bg-orange-100 text-orange-700 text-sm font-medium px-3 py-1 rounded-full',
  }[status]
  return <span className={cls}>{children}</span>
}

// ── LoadingSpinner ───────────────────────────────────────────────
export function LoadingSpinner({ text = 'Cargando...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Loader2 size={32} className="animate-spin text-primary" />
      <p className="text-brand-muted text-sm">{text}</p>
    </div>
  )
}

// ── ChatBubble ───────────────────────────────────────────────────
export function ChatBubble({ role, message }: { role: 'user' | 'assistant'; message: string }) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
        role === 'user'
          ? 'bg-primary text-white rounded-br-sm'
          : 'bg-white text-brand-text rounded-bl-sm shadow-card'
      }`}>
        {message}
      </div>
    </div>
  )
}

// ── StudyStep ────────────────────────────────────────────────────
interface StudyStepProps {
  orden:           number
  nombreEstudio:   string
  esActual:        boolean
  esFinal:         boolean   // es_estado_final de la API
  tiempoEsperaMin: number
  preparacion?:    string
  isLast?:         boolean
}
export function StudyStep({ orden, nombreEstudio, esActual, esFinal, tiempoEsperaMin, isLast }: StudyStepProps) {
  return (
    <div className="flex gap-3">
      {/* Indicador visual */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          esFinal   ? 'bg-success text-white' :
          esActual  ? 'bg-primary text-white animate-pulse' :
                      'bg-gray-200 text-gray-400'
        }`}>
          {esFinal ? <CheckCircle2 size={18} /> : esActual ? <Clock size={16} /> : <Circle size={16} />}
        </div>
        {!isLast && <div className={`w-0.5 flex-1 mt-1 ${esFinal ? 'bg-success' : 'bg-gray-200'}`} style={{ minHeight: 24 }} />}
      </div>

      {/* Contenido */}
      <div className={`pb-6 flex-1 ${isLast ? 'pb-0' : ''}`}>
        <div className={`card p-3 ${esActual ? 'border-2 border-primary' : ''}`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-brand-muted mb-0.5">Paso {orden}</p>
              <p className={`font-medium text-sm ${esFinal ? 'text-success' : esActual ? 'text-primary' : 'text-brand-muted'}`}>
                {nombreEstudio}
              </p>
            </div>
            {!esFinal && (
              <span className="text-xs text-brand-muted bg-neutral px-2 py-1 rounded-full">
                ~{tiempoEsperaMin} min
              </span>
            )}
          </div>
          {esActual && (
            <p className="text-xs text-primary mt-1 font-medium">En proceso ahora</p>
          )}
          {esFinal && (
            <p className="text-xs text-success mt-1 font-medium">Completado ✓</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── MultiStepTracker ─────────────────────────────────────────────
interface EstudioAPI {
  orden:           number
  nombre:          string
  es_actual:       boolean      // campo real de la API
  es_estado_final: boolean      // campo real de la API
  tiempo_espera_min: number
  preparacion?:    string
}
export function MultiStepTracker({ estudios, progresoPct }: { estudios: EstudioAPI[]; progresoPct: number }) {
  return (
    <div>
      {/* Barra de progreso general */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-brand-muted mb-1">
          <span>Progreso de tu visita</span>
          <span>{progresoPct}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progresoPct}%` }}
          />
        </div>
      </div>

      {/* Pasos */}
      {estudios
        .sort((a, b) => a.orden - b.orden)
        .map((est, idx) => (
          <StudyStep
            key={est.orden}
            orden={est.orden}
            nombreEstudio={est.nombre}
            esActual={est.es_actual}
            esFinal={est.es_estado_final}
            tiempoEsperaMin={est.tiempo_espera_min}
            preparacion={est.preparacion}
            isLast={idx === estudios.length - 1}
          />
        ))}
    </div>
  )
}

// ── PrepCard ─────────────────────────────────────────────────────
export function PrepCard({ orden, nombreEstudio, instrucciones }: {
  orden: number
  nombreEstudio: string
  instrucciones: string
}) {
  const items = instrucciones.split('.').map(s => s.trim()).filter(Boolean)
  return (
    <div className="card border-l-4 border-warning mb-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs bg-warning text-white px-2 py-0.5 rounded-full font-medium">
          Paso {orden}
        </span>
        <p className="font-medium text-sm text-brand-text">{nombreEstudio}</p>
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-xs text-brand-muted">
            <span className="text-warning mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
