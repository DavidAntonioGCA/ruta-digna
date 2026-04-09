"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClipboardList, MapPin, Activity, Settings2 } from "lucide-react"
import SettingsDrawer from "./SettingsDrawer"

const navItems = [
  { href: "/antes-de-ir", icon: ClipboardList, label: "Preparación" },
  { href: "/recomendar",  icon: MapPin,         label: "Mi clínica"  },
  { href: "/tracking",    icon: Activity,       label: "Mi visita"   },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (pathname === "/login") return null

  return (
    <>
      <SettingsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-100 z-30 shadow-[0_-1px_12px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-around h-full max-w-md mx-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 px-4 py-2 group"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all
                  ${isActive ? "bg-blue-600 shadow-lg shadow-blue-500/30 scale-110" : "group-hover:bg-slate-100"}`}>
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"}`} />
                </div>
                <span className={`text-[10px] font-bold transition-colors ${isActive ? "text-blue-600" : "text-slate-400"}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* Botón Ajustes — abre drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center gap-1 px-4 py-2 group"
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all
              ${drawerOpen ? "bg-slate-900 shadow-lg scale-110" : "group-hover:bg-slate-100"}`}>
              <Settings2 className={`w-4 h-4 transition-colors ${drawerOpen ? "text-white" : "text-slate-400 group-hover:text-slate-600"}`} />
            </div>
            <span className={`text-[10px] font-bold transition-colors ${drawerOpen ? "text-slate-900" : "text-slate-400"}`}>
              Ajustes
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
