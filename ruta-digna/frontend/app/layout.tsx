import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600'] })

export const metadata: Metadata = {
  title: 'Ruta Digna',
  description: 'Tu camino en la clínica, paso a paso.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${dmSans.className} bg-neutral min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
