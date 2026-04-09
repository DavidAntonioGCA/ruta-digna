import { ReactNode } from 'react'

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  loading?: boolean
  className?: string
}

export function Button({ children, loading, className = '', disabled, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold py-3 px-5 rounded-2xl transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Cargando...
        </>
      ) : children}
    </button>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-3xl shadow-md border border-gray-100 p-4 ${className}`}>
      {children}
    </div>
  )
}

// ─── ChatBubble ───────────────────────────────────────────────────────────────
interface ChatBubbleProps {
  role: 'user' | 'assistant'
  message: string
}

export function ChatBubble({ role, message }: ChatBubbleProps) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1 shadow-md">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
            <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 010 2h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 010-2h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z"/>
          </svg>
        </div>
      )}
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
        }`}
      >
        {message}
      </div>
    </div>
  )
}

// ─── LoadingSpinner ───────────────────────────────────────────────────────────
export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )
}
