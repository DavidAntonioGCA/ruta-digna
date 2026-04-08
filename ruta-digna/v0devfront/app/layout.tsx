import type { Metadata, Viewport } from 'next'
import { DM_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import AIAssistantButton from '@/components/AIAssistantButton'
import './globals.css'

const dmSans = DM_Sans({ 
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-dm-sans"
});

export const metadata: Metadata = {
  title: 'Ruta Digna',
  description: 'Tu camino en la clínica, paso a paso.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#F1F5F9',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${dmSans.variable} font-sans antialiased bg-neutral`}>
        {children}
        <AIAssistantButton />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
